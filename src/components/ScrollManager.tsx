import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** How long a restore keeps retrying while the screen's data lands, in frames. */
const RESTORE_FRAMES = 60;

/**
 * Scroll position across route changes, for the app-shell scroll container.
 *
 * THERE WAS NOTHING TO MOVE HERE. Before the app-shell change the app had no
 * scroll restoration at all: the document scrolled, react-router-dom's
 * BrowserRouter does not reset it, and no screen listened to or set the window
 * scroll. Moving the scroll into .app-main preserved that exactly — the
 * container is one long-lived element, so its scrollTop survives a route
 * change just as the window's did, which meant leaving a scrolled screen for a
 * short one landed the new screen at an arbitrary offset.
 *
 *   PUSH / REPLACE -> top. A new screen starts at its top.
 *   POP            -> where this entry was left, so back lands in place.
 *
 * Positions are keyed by `location.key`, which react-router mints per history
 * entry, so two visits to the same path are two positions. Memory only, like
 * the collapse state in CommentThread — a reload starts clean.
 *
 * ---------------------------------------------------------------------------
 * TWO PIECES OF TIMING MAKE THIS WORK, AND BOTH ARE EASY TO UNDO BY ACCIDENT.
 *
 * 1. THE POSITION IS SAVED ON SCROLL, NOT ON THE WAY OUT. The obvious version
 *    saves in the effect cleanup, and it always saves 0. React mutates the DOM
 *    before it runs any cleanup, so the outgoing screen's rows are gone and
 *    the browser has already clamped scrollTop to 0 against the short new
 *    content by the time the cleanup could read it. Measured: back from a feed
 *    left at 500 restored to 0, every time.
 *
 * 2. THE NAVIGATION HANDLER IS A LAYOUT EFFECT. That clamp queues its own
 *    scroll event, which would fire the listener and overwrite the outgoing
 *    entry's saved position with 0. Scroll events are dispatched
 *    asynchronously, and layout effects run synchronously in the commit phase,
 *    so `settling` is already true before that event lands.
 * ---------------------------------------------------------------------------
 */
export function ScrollManager({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  const positions = useRef(new Map<string, number>());
  /** The entry that scrolling currently belongs to. */
  const activeKey = useRef(key);
  /** True while a navigation is being applied, so clamp noise is not saved. */
  const settling = useRef(false);

  // One listener for the life of the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const saved = positions.current;

    const onScroll = () => {
      if (settling.current) return;
      saved.set(activeKey.current, el.scrollTop);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const saved = positions.current;
    if (!el) return;

    settling.current = true;
    activeKey.current = key;

    const target = navigationType === 'POP' ? (saved.get(key) ?? 0) : 0;
    el.scrollTop = target;

    if (target === 0 || el.scrollTop === target) {
      settling.current = false;
      return;
    }

    // A ONE-SHOT ASSIGNMENT IS NOT ENOUGH FOR A RESTORE. Every screen here
    // fetches before it renders, so right now the page is a skeleton a few
    // hundred pixels tall: setting scrollTop to 500 on a container that can
    // only reach 0 clamps silently, and by the time the rows arrive the moment
    // has gone. So re-apply each frame until the content is tall enough.
    //
    // It gives up after RESTORE_FRAMES, and stops the moment anything else
    // moves the container — which is what keeps it from fighting a reader who
    // starts scrolling before the data lands.
    let frames = 0;
    let raf = 0;
    let lastSet = el.scrollTop;

    const stop = () => {
      settling.current = false;
      // Whatever we actually managed is what this entry is worth now.
      saved.set(key, el.scrollTop);
    };

    const retry = () => {
      if (el.scrollTop !== lastSet || frames > RESTORE_FRAMES) return stop();
      if (el.scrollTop === target) return stop();
      frames += 1;
      el.scrollTop = target;
      lastSet = el.scrollTop;
      raf = requestAnimationFrame(retry);
    };
    raf = requestAnimationFrame(retry);

    return () => {
      cancelAnimationFrame(raf);
      settling.current = false;
    };
  }, [key, navigationType, containerRef]);

  return null;
}
