/**
 * /messages — the destination the design's third tab has always pointed at.
 *
 * The frame for it (`messages`, node 179:4954) has not been read, so this is
 * deliberately not an attempt at that screen. It is a placeholder with one
 * line of copy: no page header, no back link, nothing else.
 *
 * It used to carry the webinar copy, because the Messages tab was for a while
 * the only live destination in the app that could hold it. That moved to
 * /webinar on Sep 30, where the topic grid's Webinar tile points; this route
 * is now about messages and says so. See CLAUDE.md sections 26 and 27.
 *
 * NO BACK LINK ON PURPOSE. The tab bar renders outside <Routes> on every
 * route (section 12), so this screen is leavable in the standalone Home
 * Screen app without one — and a back link would be the only other thing on a
 * page whose whole point is that it holds a single sentence.
 *
 * Centring is .stub-page's job, shared with /webinar.
 */
export default function Messages() {
  return (
    <div className="stub-page">
      <p className="stub-text">Messages coming soon</p>
    </div>
  );
}
