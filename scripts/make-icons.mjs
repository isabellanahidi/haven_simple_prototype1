#!/usr/bin/env node
/**
 * Generate the Home Screen / PWA icons from public/havenlogo.svg.
 *
 *   node scripts/make-icons.mjs
 *
 * Re-run this whenever the logo changes. Outputs overwrite the existing files
 * in place, so no <link> href or manifest entry needs editing.
 *
 * Composition decisions, all of which have a reason:
 *
 *  - Solid #fbf0f2 fill across the whole square, and the alpha channel is
 *    stripped from the output. iOS renders transparent pixels in a home-screen
 *    icon as black, so a PNG that merely *looks* opaque is not enough — the
 *    channel has to be gone.
 *  - Square corners. iOS applies its own squircle mask; pre-rounding leaves
 *    pink spurs poking out at the corners of Apple's mask.
 *  - Logo at 65% of canvas width. That padding also keeps the mark inside
 *    Android's maskable safe zone, which is the centre 80% diameter circle,
 *    so the same file works for `purpose: "any maskable"`.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const SOURCE = 'public/havenlogo.svg';
const BACKGROUND = '#fbf0f2'; // --bg, and the manifest's background_color
const LOGO_SCALE = 0.65;      // fraction of canvas width

const TARGETS = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
];

const svg = await readFile(SOURCE);
// Read the intrinsic width rather than hardcoding it, so swapping the source
// logo for one with different dimensions doesn't silently under-render.
const { width: sourceWidth } = await sharp(svg).metadata();

for (const { file, size } of TARGETS) {
  const logoWidth = Math.round(size * LOGO_SCALE);

  // Rasterize the SVG at the width we actually need. Passing `density` scaled
  // to the target avoids rendering small and upscaling, which would soften the
  // edges — SVG renders at 72dpi by default.
  const density = Math.ceil((72 * logoWidth) / sourceWidth) * 2;
  const logo = await sharp(svg, { density })
    .resize({ width: logoWidth, withoutEnlargement: false })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    // flatten composites onto the background and drops alpha; removeAlpha is
    // belt-and-braces so the encoder cannot write an alpha channel back.
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);

  const { width, height, channels, hasAlpha } = await sharp(file).metadata();
  console.log(
    `  ${file.padEnd(30)} ${width}x${height}  logo ${logoWidth}px  ` +
      `channels ${channels}  alpha ${hasAlpha}`,
  );
}
