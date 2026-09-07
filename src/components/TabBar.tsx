import { Link, useLocation } from 'react-router-dom';

/**
 * The persistent bottom navigation, per the Figma "task-bar" component.
 *
 * Three slots, in the design's order: Home, Ask, Messages. The bar is fixed to
 * the bottom of the viewport on every route, which is what makes each screen
 * leavable in the standalone Home Screen app where there is no back gesture and
 * no URL bar. See CLAUDE.md section 12.
 *
 * Icons are the exact SVGs exported from Figma, in public/icons/. Active and
 * inactive are genuinely different glyphs (a filled house vs an outlined one),
 * not one glyph recoloured — so home and ask each ship two files. The message
 * bubble ships one: its stroke is the same colour as the active circle, so the
 * stroke disappears against it and the white fill reads as a solid bubble.
 */

/** Which tab owns a given path. Post detail belongs to the feed. */
function homeIsActive(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/p/');
}

export function TabBar() {
  const { pathname } = useLocation();

  const onHome = homeIsActive(pathname);
  const onAsk = pathname === '/new';

  return (
    <nav className="tab-bar" aria-label="Main">
      <div className="tab-bar-inner">
        <Link
          className={`tab${onHome ? ' tab-active' : ''}`}
          to="/"
          aria-label="Home"
          aria-current={onHome ? 'page' : undefined}
        >
          <img
            className="tab-icon"
            src={onHome ? '/icons/tab-home-active.svg' : '/icons/tab-home.svg'}
            alt=""
          />
        </Link>

        <Link
          className={`tab${onAsk ? ' tab-active' : ''}`}
          to="/new"
          aria-label="Ask a question"
          aria-current={onAsk ? 'page' : undefined}
        >
          <img
            className="tab-icon"
            src={onAsk ? '/icons/tab-ask-active.svg' : '/icons/tab-ask.svg'}
            alt=""
          />
        </Link>

        {/* The design's third tab is a Messages screen this app does not have,
            and this pass adds no routes. Rendering it disabled keeps the
            design's three-slot spacing without inventing a destination. */}
        <button className="tab tab-disabled" type="button" disabled aria-label="Messages — not available yet">
          <img className="tab-icon" src="/icons/tab-messages.svg" alt="" />
        </button>
      </div>
    </nav>
  );
}
