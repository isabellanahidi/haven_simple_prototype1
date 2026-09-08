import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { charLength } from './text';

/**
 * The optional personal name — a real first name, used only to greet someone.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HARD RULE: this value lives in `auth.users.raw_user_meta_data` and NOWHERE
 * ELSE. It must never become a column on `profiles` or on any other table, and
 * it must never appear in a select, filter, join, or embed.
 *
 * The reason is the whole promise of the app. `profiles` is world-readable by
 * design — `profiles_select` is `using (true)` — so a real name stored beside
 * a pseudonym would be readable by every visitor holding the anon key, and
 * would permanently tie the person to everything they had ever posted. Auth
 * metadata is returned only inside the owner's own session, so it is the one
 * place that is genuinely private to them.
 *
 * There is exactly one way in (`supabase.auth.updateUser({ data: ... })`) and
 * one way out (this file, reading the session user). Keep it that way. See
 * CLAUDE.md section 18.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Matches the `display_name` ceiling's spirit; counted in code points. */
export const PERSONAL_NAME_MAX = 40;

/** Shown to a signed-in person who hasn't given a name. */
export const GREETING_FALLBACK = 'Love';

/**
 * Read the name off a session user.
 *
 * Returns null for anything that isn't a non-empty string. User metadata is
 * user-writable, so the stored value is not guaranteed to be a string at all —
 * a hand-edited account could hold an object or an array there, and rendering
 * that would either crash or leak a shape into the page. The `typeof` guard is
 * what makes the greeting safe to render as text without inspecting it further.
 */
export function personalName(user: User | null | undefined): string | null {
  const raw = user?.user_metadata?.personal_name;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Length of what would actually be stored — the trimmed value — counted in
 * code points via charLength, so an emoji in a name counts once rather than
 * twice. Same helper the profile counters use, for the same reason.
 */
export function personalNameLength(value: string): number {
  return charLength(value.trim());
}

/**
 * Whether this person has already declined to give a name.
 *
 * Without this, "Not now" is forgotten and the prompt returns on every OTP
 * sign-in — which reads as nagging for exactly the people who most clearly
 * said no. Stored in the same metadata object as the name itself; `data`
 * merges, so it cannot disturb `personal_name` or `has_password`.
 */
export function personalNameSkipped(user: User | null | undefined): boolean {
  return user?.user_metadata?.personal_name_skipped === true;
}

/** Record a decline. Same single store, same merge semantics. */
export async function skipPersonalName() {
  return supabase.auth.updateUser({ data: { personal_name_skipped: true } });
}

/** The name to greet someone by, falling back when they haven't given one. */
export function greetingName(name: string | null): string {
  return name ?? GREETING_FALLBACK;
}

/** True when this value can be written as-is. */
export function personalNameValid(value: string): boolean {
  return personalNameLength(value) <= PERSONAL_NAME_MAX;
}

/**
 * The single write path. Auth metadata only — never a table.
 *
 * An emptied field stores null rather than '', so `personalName()` reads it
 * back as absent and the greeting falls back cleanly. `data` merges rather
 * than replaces, so this cannot disturb `has_password`.
 */
export async function savePersonalName(value: string) {
  const trimmed = value.trim();
  return supabase.auth.updateUser({
    data: {
      personal_name: trimmed.length > 0 ? trimmed : null,
      // Giving a name answers the question, so a previous decline is spent. If
      // they later clear the field, the prompt is allowed to return once.
      personal_name_skipped: false,
    },
  });
}
