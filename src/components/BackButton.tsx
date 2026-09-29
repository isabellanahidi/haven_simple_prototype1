import { Link } from 'react-router-dom';
import backGlyph from '../assets/back-button.svg';

/**
 * The one back control in the app, and the leading counterpart to the header's
 * settings button.
 *
 * RENDERED AS AN <img>, NEVER INLINED. The asset carries two SVG filters under
 * fixed ids (filter0_dd_179_4246 and the hardAlpha results inside it). Inlined
 * on more than one route — or twice on one, as PostDetail's two branches would
 * do — those ids would collide in the one document and the drop shadow would
 * resolve against whichever copy the browser saw last. An <img> gives each
 * instance its own document, so the ids cannot meet.
 *
 * The label lives in aria-label, not beside the glyph: the design's control is
 * the circle alone. alt="" keeps the image out of the accessible name so the
 * link announces as "Back" once rather than twice.
 *
 * Positioning — which lifts this out of the page flow and onto the header's
 * centre line — is .back-link's job. See src/styles.css.
 */
export function BackButton({ to }: { to: string }) {
  return (
    <Link className="back-link" to={to} aria-label="Back">
      <img className="back-link-glyph" src={backGlyph} alt="" />
    </Link>
  );
}
