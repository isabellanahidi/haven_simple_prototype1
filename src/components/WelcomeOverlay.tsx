import { useEffect, useState } from 'react';
import { markWelcomeShown, onWelcomeReplay, welcomeAlreadyShown } from '../lib/welcome';

/** Fully opaque before the fade starts. */
const VISIBLE_MS = 2000;
/** Must match the transition duration on .welcome in styles.css. */
const FADE_MS = 400;
/**
 * prefers-reduced-motion: no fade at all, so the whole thing is one shorter
 * hold. Longer than VISIBLE_MS alone would be (the fade is readable time too),
 * shorter than VISIBLE_MS + FADE_MS, so it neither flashes nor outstays.
 */
const REDUCED_MS = 2200;

type Phase = 'hidden' | 'visible' | 'fading';

/**
 * A full-screen greeting on the first render of a visit, and again the moment
 * an account is created.
 *
 * It removes itself from the DOM — this returns null once the fade is done, so
 * there is nothing left to intercept a tap. It also stops taking taps the
 * instant the fade begins, well before it is invisible, so the 400ms it spends
 * fading is not 400ms of swallowed taps on the screen behind it.
 *
 * Mounted once in App.tsx, outside <Routes>, so a route change cannot restart
 * it and it does not depend on which screen the person landed on.
 *
 * THE TIMER EFFECT IS KEYED ON THE PHASE, NOT ON MOUNT, and that is the whole
 * shape of this component rather than a detail. An effect that ran the entire
 * sequence once on mount hangs under StrictMode: React mounts, tears down and
 * remounts, so the cleanup clears the timers, and the second run reads a
 * sessionStorage flag the first run has already written and therefore declines
 * to start anything. The overlay then sits there forever. Deriving each timer
 * from the current phase means a cleanup and re-run simply re-arms the timer
 * for the phase the component is already in.
 */
export function WelcomeOverlay() {
  // A pure read, so it is safe to run in a lazy initializer — and it must be
  // the initial state rather than an effect, so the decision outlives the
  // remount described above.
  const [phase, setPhase] = useState<Phase>(() => (welcomeAlreadyShown() ? 'hidden' : 'visible'));

  // A new account asks for it again, whatever this visit has already seen.
  useEffect(() => onWelcomeReplay(() => setPhase('visible')), []);

  useEffect(() => {
    if (phase === 'hidden') return;

    // Idempotent, and cheap enough to repeat: it only has to have happened by
    // the time the next load reads it.
    markWelcomeShown();

    if (phase === 'fading') {
      const t = window.setTimeout(() => setPhase('hidden'), FADE_MS);
      return () => window.clearTimeout(t);
    }

    // Read here rather than once at module load: the setting can change
    // between the arrival greeting and the one after sign-up.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(
      // Reduced motion skips the fading phase outright rather than passing
      // through it with the transition disabled, so nothing animates and the
      // overlay simply goes.
      () => setPhase(reduced ? 'hidden' : 'fading'),
      reduced ? REDUCED_MS : VISIBLE_MS,
    );
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      className={phase === 'fading' ? 'welcome welcome-fading' : 'welcome'}
      // Announced once, politely: it interrupts nothing and there is nothing
      // to act on. Not a dialog — it traps no focus and takes no input.
      role="status"
    >
      <p className="welcome-text">Welcome — we are here to support each other.</p>
    </div>
  );
}
