import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The bottom-sheet drawer from the Figma frames Home-NDTab-closed
 * (node 179:3533) and SwipeableDrawer (node 192:804). The second frame is the
 * same sheet at its full snap point, not a separate screen.
 *
 * Two snap points and nothing in between:
 *
 *   peek — the sheet header only: the grab handle and the "New Discussions"
 *          pill. Its height is --sheet-peek, and the resting transform is
 *          expressed in CSS as translateY(calc(100% - var(--sheet-peek))), so
 *          the collapsed position is correct on the very first paint, before
 *          any measurement has happened.
 *   full — translateY(0). The sheet's height is set in CSS from --sheet-top,
 *          so "full" means the top edge lands under the greeting.
 *
 * No new dependencies: pointer events plus a CSS transform. The travel
 * distance is measured off the DOM during a drag rather than duplicated as a
 * TypeScript constant — the grab element's own height IS the peek height, so
 * --sheet-peek stays the single place the number is written.
 *
 * `touch-action: none` is on the grab area ONLY (see .sheet-grab). Putting it
 * on the sheet would kill scrolling of the list inside once expanded.
 */

/** px/ms. A flick faster than this wins over position. */
const FLICK_VELOCITY = 0.4;
/** Movement under this many px, inside TAP_MS, counts as a tap, not a drag. */
const TAP_SLOP = 6;
const TAP_MS = 400;

type DragState = {
  pointerId: number;
  startY: number;
  startOffset: number;
  startTime: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  maxMoved: number;
};

export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  /**
   * A pointer sequence that starts on the handle still produces a click on it
   * afterwards — pointer capture retargets move and up, but not the click. So
   * every pointer release would toggle twice: once from endDrag, once from the
   * button. endDrag owns the pointer case (it is the only one that can tell a
   * tap from a drag), and this swallows the click that follows it. The click
   * handler stays, because a keyboard or assistive-technology activation
   * arrives as a click with no pointer sequence in front of it.
   */
  const swallowClick = useRef(false);

  const [expanded, setExpanded] = useState(false);
  // Non-null only while a pointer is down: the live translateY in px. When
  // null the resting position comes from CSS, which is what keeps the first
  // paint correct without measuring anything.
  const [offset, setOffset] = useState<number | null>(null);

  const bodyId = useId();

  /** How far the sheet moves between the two snap points. */
  const travel = useCallback(() => {
    const sheet = sheetRef.current;
    const grab = grabRef.current;
    if (!sheet || !grab) return 0;
    return Math.max(sheet.offsetHeight - grab.offsetHeight, 0);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Mouse: primary button only. Touch and pen report button 0 too.
    if (e.button !== 0) return;
    const grab = e.currentTarget;
    grab.setPointerCapture(e.pointerId);
    // Cleared here rather than only when consumed, so a release that produces
    // no click at all cannot leave the next activation swallowed.
    swallowClick.current = false;
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startOffset: expanded ? 0 : travel(),
      startTime: e.timeStamp,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      maxMoved: 0,
    };
    setOffset(drag.current.startOffset);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const dt = e.timeStamp - d.lastTime;
    // Guard against a zero delta: two events can share a timestamp.
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastTime = e.timeStamp;

    const moved = e.clientY - d.startY;
    d.maxMoved = Math.max(d.maxMoved, Math.abs(moved));

    const max = travel();
    setOffset(Math.min(Math.max(d.startOffset + moved, 0), max));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    swallowClick.current = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const max = travel();
    const current = Math.min(Math.max(d.startOffset + (e.clientY - d.startY), 0), max);

    // A tap toggles. Checked first, so a stationary press-and-release is never
    // read as a drag that happened to land back where it started.
    if (d.maxMoved < TAP_SLOP && e.timeStamp - d.startTime < TAP_MS) {
      setOffset(null);
      setExpanded((v) => !v);
      return;
    }

    // A flick wins over position; otherwise settle on the nearer snap point.
    let next: boolean;
    if (Math.abs(d.velocity) > FLICK_VELOCITY) next = d.velocity < 0;
    else next = current < max / 2;

    setOffset(null);
    setExpanded(next);
  };

  // A drag interrupted by the browser (a system gesture, a context menu)
  // leaves no pointerup, so the sheet would sit frozen mid-travel.
  const onPointerCancel = () => {
    drag.current = null;
    setOffset(null);
  };

  // Escape closes an expanded sheet — the only other way out is the handle,
  // which may be off screen under a keyboard.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const dragging = offset !== null;

  return (
    <div
      ref={sheetRef}
      className={`sheet${expanded ? ' sheet-expanded' : ''}${dragging ? ' sheet-dragging' : ''}`}
      style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
    >
      <div
        ref={grabRef}
        className="sheet-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={onPointerCancel}
      >
        {/* The handle and the pill are both drawn by the frame as buttons, and
            both are inside the grab area, so either one drags. The handle
            carries the control semantics; the pill is a label, marked
            presentational so the two do not read as separate controls. */}
        <button
          type="button"
          className="sheet-handle-hit"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => {
            if (swallowClick.current) {
              swallowClick.current = false;
              return;
            }
            setExpanded((v) => !v);
          }}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sr-only">{expanded ? `Collapse ${title}` : `Expand ${title}`}</span>
        </button>

        <span className="sheet-pill" aria-hidden="true">
          {title}
        </span>
      </div>

      {/* Collapsed, the body is translated off the bottom of the screen. It is
          still in the DOM, so without inert it stays tabbable and a focus
          would scroll it into view from nowhere. */}
      <div className="sheet-body" id={bodyId} inert={!expanded}>
        {children}
      </div>
    </div>
  );
}
