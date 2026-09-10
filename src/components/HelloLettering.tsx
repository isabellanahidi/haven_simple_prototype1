/**
 * The word "Hello," from the Figma home frame, as outlines.
 *
 * It replaces the self-hosted Pacifico webfont that section 19 added: the
 * greeting is the only place Pacifico was used, so drawing it as a path is
 * strictly less to ship and cannot render in a fallback face while a font
 * loads.
 *
 * Extracted from the design's outlined greeting, which was one <path> holding
 * both lines — "Hello," above (y <= 39) and "Jane" below (y >= 45). Only the
 * eleven "Hello," subpaths are kept: H, e, l, l, o and the comma, each with
 * its counter. The "Jane" half is discarded, because the name has to stay live
 * text — it comes from user metadata and changes per person.
 *
 * TWO NUMBERS MATTER AND ARE NOT ARBITRARY:
 *
 *   - the source is drawn at 1 unit = 1 CSS px against a 45px type size, which
 *     is what the frame sets. So the viewBox is used at 45ths of an em and the
 *     lettering tracks --fs-greeting instead of being pinned to one size.
 *   - the baseline sits at y = 31.5 (the flat bottoms of H, l and o all land
 *     there). The viewBox runs to 38.745 because the comma descends below it,
 *     so 7.245px of the box hangs under the baseline. .feed-greeting-script's
 *     vertical-align is that descent, which is what puts this on the same
 *     baseline as the name beside it.
 *
 * fill="currentColor" so it follows --text-body from .feed-greeting rather
 * than carrying the design's #3D1307 as a second, silently diverging copy.
 *
 * aria-hidden, with the word supplied as text in Feed.tsx, so the heading is
 * announced as one ordinary string.
 */
export function HelloLettering() {
  return (
    <svg
      className="feed-greeting-script"
      viewBox="1.755 0 120.708 38.745"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.41499 31.5C5.30999 31.5 1.75499 29.43 1.75499 25.2C1.75499 21.645 4.54499 16.245 13.32 15.66L14.445 6.92999H13.68C11.97 6.92999 10.485 7.96499 10.215 9.89999C10.17 10.53 10.17 11.205 10.35 11.97L6.02999 13.365C5.48999 12.555 5.21999 11.295 5.21999 10.035C5.21999 6.38999 7.91999 2.69999 14.625 2.69999C16.605 2.69999 19.035 2.96999 20.34 3.14999L18.81 15.615H25.965L27.72 3.14999H33.345L31.59 15.615H35.73L35.1 20.34H30.915L30.645 22.32C30.24 25.29 31.095 26.73 32.94 26.73C35.1 26.73 36.9 25.11 38.835 21.375L42.66 23.22C40.32 27.99 36.585 31.455 31.725 31.455C27.54 31.455 24.12 28.755 25.02 22.32L25.29 20.34H18.225C17.37 27.18 14.715 31.5 8.41499 31.5ZM6.88499 24.975C6.88499 26.1 7.87499 26.775 8.86499 26.775C10.755 26.775 12.105 24.255 12.735 20.475C8.14499 21.105 6.88499 23.76 6.88499 24.975ZM38.2233 22.635C38.2233 17.685 41.3733 12.375 47.6283 12.375C51.7683 12.375 53.8833 15.03 53.8833 17.55C53.8833 20.25 51.8133 23.715 44.4783 25.02C45.3783 26.235 47.0433 27 49.1583 27C52.3983 27 55.3683 25.47 57.3483 21.375L61.1733 23.22C58.5183 28.935 54.0183 31.5 48.5733 31.5C42.1833 31.5 38.2233 28.125 38.2233 22.635ZM43.7583 21.375C47.2233 20.97 48.7533 19.125 48.7533 17.865C48.7533 17.28 48.3483 16.74 47.5383 16.74C45.6483 16.74 44.0733 18.855 43.7583 21.375ZM67.1192 31.5C60.9992 31.5 56.4992 27.585 57.3092 19.98L57.5342 17.91C58.7042 7.10999 62.6642-0.00001 69.9542-0.00001C73.4192-0.00001 76.6142 2.29499 76.6142 6.34499C76.6142 10.8 71.4392 18.855 62.5292 22.14C62.8442 25.785 65.4092 27 67.8392 27C70.8092 27 73.4192 25.47 75.7142 21.375L79.5392 23.22C77.1092 28.35 72.6992 31.5 67.1192 31.5ZM63.0692 16.875C68.6492 13.815 71.1692 8.63999 71.1692 6.47999C71.1692 5.35499 70.6742 4.58999 69.5492 4.58999C66.7592 4.58999 64.2842 9.85499 63.0692 16.875ZM85.4884 31.5C79.3684 31.5 74.8684 27.585 75.6784 19.98L75.9034 17.91C77.0734 7.10999 81.0334-0.00001 88.3234-0.00001C91.7884-0.00001 94.9834 2.29499 94.9834 6.34499C94.9834 10.8 89.8084 18.855 80.8984 22.14C81.2134 25.785 83.7784 27 86.2084 27C89.1784 27 91.7884 25.47 94.0834 21.375L97.9084 23.22C95.4784 28.35 91.0684 31.5 85.4884 31.5ZM81.4384 16.875C87.0184 13.815 89.5384 8.63999 89.5384 6.47999C89.5384 5.35499 89.0434 4.58999 87.9184 4.58999C85.1284 4.58999 82.6534 9.85499 81.4384 16.875ZM102.373 31.5C97.2875 31.5 93.7775 28.08 93.6875 23.355C93.5975 17.46 97.8725 12.375 104.488 12.375C109.483 12.375 112.678 15.615 112.768 20.52C112.858 26.82 108.673 31.5 102.373 31.5ZM102.508 27C105.298 27 107.278 24.12 107.233 20.61C107.188 18.585 106.108 16.875 103.948 16.875C100.933 16.875 99.2225 20.025 99.2225 23.085C99.2225 25.38 100.393 27 102.508 27ZM117.963 26.685L122.463 28.26L118.548 38.745L114.408 37.305L117.963 26.685Z" />
    </svg>
  );
}
