/**
 * /webinar — one line about the upcoming PCOS webinar, and nothing else.
 *
 * Split out of /messages on Sep 30. That route was carrying the webinar copy
 * because the Messages tab was the only thing that pointed anywhere; now the
 * Webinar tile in the topic grid owns this destination and /messages is a
 * placeholder about messages. See CLAUDE.md sections 26 and 27.
 *
 * NOT A TAB DESTINATION. The bottom bar has three slots and this is not one of
 * them, so no tab renders active here — TabBar's checks are per-path equality
 * and none of them match /webinar. That is deliberate rather than incidental:
 * the tile is the way in.
 *
 * NO BACK LINK ON PURPOSE, matching /messages. The tab bar renders outside
 * <Routes> on every route (section 12), so this screen is leavable in the
 * standalone Home Screen app without one — and a back link would be the only
 * other thing on a page whose whole point is that it holds a single sentence.
 *
 * Centring is .stub-page's job: it composes 100dvh with the header band and
 * the tab bar's own clearance, so the text sits in the middle of what is left
 * and never under either bar.
 */
export default function Webinar() {
  return (
    <div className="stub-page">
      <p className="stub-text">Stay tuned for our PCOS webinar — Oct 21 at 5 pm CT</p>
    </div>
  );
}
