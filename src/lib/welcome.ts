/**
 * The welcome screen's "have we shown this already?" bookkeeping, and the one
 * way to ask for it again.
 *
 * ONCE PER VISIT, so the store is sessionStorage rather than localStorage: a
 * visit is exactly what a session store already models, and it clears itself
 * when the tab closes with nothing to expire or clean up.
 *
 * EVERY ACCESS IS WRAPPED. sessionStorage throws outright in a Safari private
 * window with site data blocked, and reads can come back empty for reasons
 * that have nothing to do with us (see CLAUDE.md section 6c on localStorage).
 * A welcome screen is not worth a white page, so a throwing store fails toward
 * SHOWING the overlay: two seconds of a greeting is a far cheaper wrong answer
 * than a crash on first load.
 */

const KEY = 'haven.welcome.shown';

/** Listeners for replayWelcome(). In practice exactly one: the mounted overlay. */
const listeners = new Set<() => void>();

export function welcomeAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    // Storage is unavailable. Show it and move on.
    return false;
  }
}

export function markWelcomeShown(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do and nothing to report: the cost of a failed write is that
    // the overlay may greet someone twice in one visit.
  }
}

/**
 * Show the welcome screen once more, whatever the store says.
 *
 * Called when an account has just been created, which is the one moment worth
 * greeting someone for even if they already saw this on the way in. The flag
 * is cleared as well as the listener fired, so the two agree if the overlay
 * happens to remount before it runs.
 */
export function replayWelcome(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // The overlay is driven by the callback below, not by this write, so a
    // failure here changes nothing about whether it shows.
  }
  for (const listener of listeners) listener();
}

export function onWelcomeReplay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
