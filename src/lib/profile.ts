import type { PostgrestError } from '@supabase/supabase-js';

// constraint display_name_len check (char_length(display_name) between 1 and 30)
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
