/**
 * Character count that matches Postgres `char_length()`.
 *
 * `char_length` counts code points; JS `.length` counts UTF-16 code units, so
 * anything outside the BMP — emoji, most obviously, and this app encourages
 * them — counts double. Spreading iterates code points and agrees with the DB,
 * which is what the CHECK constraints are actually written against.
 */
export function charLength(value: string): number {
  return [...value].length;
}
