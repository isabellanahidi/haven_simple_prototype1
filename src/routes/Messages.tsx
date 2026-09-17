/**
 * /messages — the destination the design's third tab has always pointed at.
 *
 * The frame for it (`messages`, node 179:4954) has not been read, so this is
 * deliberately not an attempt at that screen. It is a placeholder with one
 * line of copy: no page header, no back link, nothing else.
 *
 * NO BACK LINK ON PURPOSE. The tab bar renders outside <Routes> on every
 * route (CLAUDE.md section 12), so this screen is leavable in the standalone
 * Home Screen app without one — and a back link would be the only other thing
 * on a page whose whole point is that it holds a single sentence.
 *
 * Centring is .messages-page's job: it composes 100dvh with the header band
 * and the tab bar's own clearance, so the text sits in the middle of what is
 * left and never under either bar.
 */
export default function Messages() {
  return (
    <div className="messages-page">
      <p className="messages-text">Stay tuned for webinar</p>
    </div>
  );
}
