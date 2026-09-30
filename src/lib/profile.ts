import type { PostgrestError } from '@supabase/supabase-js';

// constraint display_name_len check (char_length(display_name) between 1 and 30)
//
// NOT USED BY ANY FORM as of Sep 29: display_name is assigned by
// generate_display_name() at signup and frozen by profiles_name_guard, so
// there is no field to count. Kept because profileErrorMessage still names the
// bounds, and because the constraint itself is still in the schema.
export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 30;
// constraint bio_len check (char_length(bio) <= 300)
export const BIO_MAX = 300;

/**
 * `avatar_emoji` has NO length constraint in the schema — it is just
 * `text not null default '🙂'`. Offering a fixed set is what keeps the column
 * sane, rather than a counter that would have to reason about graphemes:
 * plenty of emoji are several code points (flags are two, ZWJ sequences like
 * 👩‍🚀 are three or more), so "one character" is not a rule that can be
 * enforced by counting.
 */
export const AVATAR_CHOICES = [
  '🙂', '😀', '😅', '😎', '🤓', '🥳',
  '😴', '🤔', '👻', '🐱', '🐶', '🦊',
  '🐼', '🐧', '🦉', '🌵', '🌻', '🍀',
  '🍄', '⭐️', '🌙', '🔥', '🌊', '🎧',
];

/** Turn a failed profile update into something worth showing a person. */
export function profileErrorMessage(error: PostgrestError | null): string {
  if (!error) return "That didn't save. Try again.";

  // enforce_profile_immutable_name() raises 'Usernames cannot be changed.',
  // which is already written for a person, so it passes through verbatim —
  // the same treatment commentErrorMessage and the delete guards get. Nothing
  // in the app sends display_name any more, so this should be unreachable;
  // it is here so that if something ever starts sending it again, the reason
  // is legible instead of raw.
  if (error.code === 'P0001') return error.message;

  if (error.code === '23514') {
    if (error.message.includes('display_name_len')) {
      return `Display names have to be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters.`;
    }
    if (error.message.includes('bio_len')) {
      return `Bios have to be ${BIO_MAX} characters or fewer.`;
    }
  }
  if (error.code === '42501') return "You don't have permission to change this profile.";

  return error.message;
}
