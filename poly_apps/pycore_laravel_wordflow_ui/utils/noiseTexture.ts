/**
 * Self-contained decorative noise texture.
 *
 * Replaces a previously external dependency
 * (https://grainy-gradients.vercel.app/noise.svg) which now 404s and added a
 * failed cross-origin GET (DNS + TLS + 404) for every component that used it.
 *
 * This is the standard "grainy gradient" technique: an inline SVG using
 * <feTurbulence type='fractalNoise'> rendered as a data URI, so there is no
 * network request at all.
 *
 * Important: the value is fully URL-encoded so it is safe inside a CSS
 * `url(...)` context (and inside a Tailwind `bg-[url('...')]` arbitrary
 * value). Quotes are encoded too (%22 / %27) so the inner SVG attribute
 * quotes cannot clash with the wrapping `url('...')` quotes. Fixed pixel
 * dimensions are used (instead of '100%') so the markup contains no bare '%'.
 */

// Raw SVG. Single fractal-noise turbulence layer, kept intentionally minimal.
const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>" +
  "<filter id='n'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>" +
  "</filter>" +
  "<rect width='128' height='128' filter='url(#n)'/>" +
  "</svg>";

/**
 * Percent-encode the characters that are unsafe inside a CSS url() value.
 * Order matters: encode '%' first (keeps the function correct/reusable even
 * if the markup ever contains a literal '%'), then structural characters and
 * quotes, then collapse and encode whitespace.
 */
const encodeForCss = (svg: string): string =>
  svg
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, '%22')
    .replace(/'/g, '%27')
    .replace(/\s+/g, ' ')
    .replace(/ /g, '%20');

/** Bare data URI, e.g. for use in inline `style={{ backgroundImage: ... }}`. */
export const NOISE_TEXTURE_DATA_URI =
  "data:image/svg+xml," + encodeForCss(NOISE_SVG);

/**
 * Tailwind arbitrary-value background class using the inline data URI.
 * Drop-in replacement for the old `bg-[url('https://.../noise.svg')]`.
 */
export const NOISE_TEXTURE_BG_CLASS =
  `bg-[url('${NOISE_TEXTURE_DATA_URI}')]`;
