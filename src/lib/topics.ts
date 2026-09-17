/**
 * The topic tag on posts.
 *
 * ---------------------------------------------------------------------------
 * ONE TOPIC. THIS IS NOT A TOPICS SYSTEM.
 *
 * "Communities / subreddits" is cut (CLAUDE.md section 3) and stays cut. PCOS
 * is a single hand-placed slice of it, re-added deliberately — see section 26
 * for the decision and what it does and does not license.
 *
 * There is no topics table, no registry, and no route that takes a topic as a
 * parameter: /t/pcos is a literal path. The database's CHECK constraint
 * (`topic is null or topic = 'pcos'`) is the real guard on the value; this
 * module exists so the client never knowingly sends something that constraint
 * would reject, and so the slug is written down once.
 *
 * Adding a second topic is a schema change plus a route plus a tile, in that
 * order. It is not an edit to this array.
 * ---------------------------------------------------------------------------
 */

export const PCOS = 'pcos';

/** Mirrors the CHECK constraint exactly. */
const ALLOWED: readonly string[] = [PCOS];

/** A post's topic: one of the allowed slugs, or null for untagged. */
export type Topic = typeof PCOS;

/**
 * Validate a topic that came from outside the code — today, the `?topic=`
 * search param on /new, which anyone can type anything into.
 *
 * Anything unrecognised becomes null, i.e. untagged, rather than an error: a
 * junk preset should let the person write their post, not block the composer.
 * The database would reject a bad value anyway; this makes sure it never has
 * to.
 */
export function asTopic(value: string | null | undefined): Topic | null {
  return value != null && ALLOWED.includes(value) ? (value as Topic) : null;
}

/** The human label for a slug. One topic, so one entry. */
export function topicLabel(topic: Topic): string {
  return topic === PCOS ? 'PCOS' : topic;
}
