import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PCOS } from '../lib/topics';

/**
 * The search field and topic tiles from the Figma frame Home-NDTab-closed
 * (node 179:3533).
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE IS WIRED TO ANYTHING, AND THAT IS DELIBERATE.
 *
 * Search is cut (CLAUDE.md section 3) and there is no topic column, table or
 * filter anywhere in the schema — a topic is closer to the "communities /
 * subreddits" that section 3 also cuts. The frame draws both, so both are
 * drawn here, but neither can be honestly connected to the data model as it
 * stands. So:
 *
 *   - the search input is `disabled`, styled to match the frame rather than
 *     to take the browser's grey disabled treatment. It does not focus, so it
 *     cannot raise the iOS keyboard over a field that would ignore the typing.
 *   - six of the seven tiles are list items, not buttons or links. They look
 *     tappable because the frame draws them that way; they are not announced
 *     as controls, and they have no :active state, so nothing promises a
 *     response that will not arrive.
 *
 * THE ONE EXCEPTION IS PCOS/PMOS, which links to /t/pcos. That is a narrow,
 * deliberate re-add of the cut feature, decided in CLAUDE.md section 26 — one
 * topic, hand-placed, with no topics table behind it. The <li> is kept and the
 * link goes INSIDE it, so the grid stays a list of tiles rather than a list of
 * links, and the six inert tiles are unchanged.
 *
 * Wiring up the search field, or a second tile, means adding a feature that
 * was cut. Ask first.
 * ---------------------------------------------------------------------------
 *
 * The illustrations are all one sprite sheet, public/img/haven-topics.png,
 * committed from the frame's own image fill. Each tile crops a different
 * region of it, exactly as Figma does: a fixed-aspect box with overflow
 * hidden, holding an oversized <img> offset by percentages of that box. Every
 * number below is a percentage rather than a pixel so the whole tile scales
 * with the column, which matters above 393px where the design's fixed widths
 * would leave the art stranded.
 */

const SPRITE = '/img/haven-topics.png';

type Topic = {
  name: string;
  /** Illustration box, as a share of the tile: top edge, height, aspect ratio. */
  top: string;
  height: string;
  aspect: string;
  /** The crop: the <img>'s size and offset, as percentages of that box. */
  crop: { w: string; h: string; l: string; t: string };
};

/**
 * THE ACTIVE TILE, AND THE ONLY PLACE IT IS NAMED.
 *
 * One topic renders in full colour and carries the pin; every other tile is
 * greyscale at 60%. Both facts hang off this one constant and the single
 * `topic-tile-active` class it sets, so moving the state to another topic —
 * or to something a person actually chose — is one edit here.
 *
 * The pin used to be its own per-topic flag. It is folded in because the frame
 * agrees the two are the same tile, and two flags that must always match are
 * one flag with a way to go wrong.
 */
const ACTIVE_TOPIC = 'PCOS/PMOS';

/**
 * The one tile that goes somewhere, keyed by the same name. Deliberately a
 * lookup with a single entry rather than a `href` field on every Topic: six of
 * the seven have nowhere to go, and an optional field on all of them reads as
 * an invitation to fill it in.
 */
const TOPIC_HREFS: Record<string, string> = {
  'PCOS/PMOS': `/t/${PCOS}`,
};

/**
 * The pin is a real component in the file with Default and select variants,
 * and every tile has an instance — but on six of the seven the instance is
 * positioned outside the tile's own bounds (e.g. y=384 inside a 112px-tall
 * tile) and the tile clips it away. Only PCOS/PMOS has one placed at (137, 0),
 * and it is the `select` variant.
 *
 * Read as: the frame renders exactly one pinned tile, so that is what this
 * renders. It is drawn, not pressable — pinning a topic is not a thing this
 * app can store.
 */
const TOPICS: Topic[] = [
  {
    name: 'PCOS/PMOS',
    top: '39.29%',
    height: '46.43%',
    aspect: '94 / 52',
    crop: { w: '261.22%', h: '770.64%', l: '-32.65%', t: '-86.24%' },
  },
  {
    name: 'Endometriosis',
    top: '38.39%',
    height: '46.43%',
    aspect: '94 / 52',
    crop: { w: '261.22%', h: '770.64%', l: '-30.53%', t: '-274.08%' },
  },
  {
    name: 'Adenomyosis',
    top: '41.08%',
    height: '46.43%',
    aspect: '94 / 52',
    crop: { w: '261.22%', h: '770.64%', l: '-35.75%', t: '-444.41%' },
  },
  {
    name: 'Pregnancy',
    top: '38.40%',
    height: '52.24%',
    aspect: '84.6 / 58.5',
    crop: { w: '261.22%', h: '616.51%', l: '-178.69%', t: '-52.25%' },
  },
  {
    name: 'Menopause',
    top: '33.94%',
    height: '52.24%',
    aspect: '84.6 / 58.5',
    crop: { w: '261.22%', h: '616.51%', l: '-179.90%', t: '-197.41%' },
  },
  {
    name: 'Hysterectomy',
    top: '29.47%',
    height: '58.04%',
    aspect: '85 / 65',
    crop: { w: '260%', h: '554.86%', l: '-175.93%', t: '-303.18%' },
  },
  {
    name: 'General Health',
    top: '33.94%',
    height: '52.24%',
    aspect: '84.6 / 58.5',
    crop: { w: '261.22%', h: '616.51%', l: '-166.94%', t: '-515.06%' },
  },
];

/** The pin, composed from the frame's two exported vectors at the frame's own
 *  offsets. Both are white-on-brand, so neither follows a colour token. */
function Pin() {
  return (
    <span className="topic-pin" aria-hidden="true">
      <img className="topic-pin-head" src="/icons/pin-head.svg" alt="" />
      <img className="topic-pin-stem" src="/icons/pin-stem.svg" alt="" />
    </span>
  );
}

/**
 * The inside of a tile: a link when the topic has a destination, a plain
 * wrapper when it does not.
 *
 * The link is absolutely inset to the tile's own box, so it covers the whole
 * card — the tap target is the tile, comfortably past 44x44 at every width the
 * two-column grid produces. Because that box is identical to the tile's, the
 * absolutely positioned illustration and pin inside it resolve against the
 * same rectangle they did before and render unchanged.
 */
function TileBody({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  // No aria-label: the link's accessible name is its own text, which is the
  // topic's name. The illustration and the pin are both aria-hidden.
  return (
    <Link className="topic-tile-link" to={href}>
      {children}
    </Link>
  );
}

export function TopicGrid() {
  return (
    <>
      <div className="topic-search">
        <img className="topic-search-icon" src="/icons/search.svg" alt="" />
        <input
          className="topic-search-input"
          type="search"
          placeholder="Search for topics..."
          aria-label="Search for topics (not available yet)"
          disabled
        />
      </div>

      <ul className="topic-grid">
        {TOPICS.map((topic) => {
          const active = topic.name === ACTIVE_TOPIC;
          const href = TOPIC_HREFS[topic.name];
          return (
            <li className={`topic-tile${active ? ' topic-tile-active' : ''}`} key={topic.name}>
              <TileBody href={href}>
                <span className="topic-name">{topic.name}</span>
                <span
                  className="topic-ill"
                  aria-hidden="true"
                  style={
                    {
                      '--ill-top': topic.top,
                      '--ill-h': topic.height,
                      '--ill-ar': topic.aspect,
                    } as CSSProperties
                  }
                >
                  <img
                    src={SPRITE}
                    alt=""
                    style={
                      {
                        '--crop-w': topic.crop.w,
                        '--crop-h': topic.crop.h,
                        '--crop-l': topic.crop.l,
                        '--crop-t': topic.crop.t,
                      } as CSSProperties
                    }
                  />
                </span>
                {active && <Pin />}
              </TileBody>
            </li>
          );
        })}
      </ul>
    </>
  );
}
