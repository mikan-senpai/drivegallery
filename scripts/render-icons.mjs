/**
 * Renders the app icon, Android adaptive icon foreground, and splash mark
 * from inline SVG into assets/. Run: node scripts/render-icons.mjs
 *
 * Mark: two stacked photo frames — the front one a misty dusk landscape —
 * in the Twilight Stillness palette (sand #C9BBA5, sage #8C9A8D, mist
 * #E8D9C4 / #D9B89A, charcoal #151413).
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name) => join(root, 'assets', name);
mkdirSync(join(root, 'assets'), { recursive: true });

/** The mark alone, centred in a 1024 canvas, scaled to `scale` of the canvas. */
function mark(scale) {
  // Designed on a 600×600 grid, then scaled + centred.
  const s = (1024 * scale) / 600;
  const off = (1024 - 600 * s) / 2;
  return `
  <g transform="translate(${off} ${off}) scale(${s})">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#E8D9C4"/>
        <stop offset="1" stop-color="#D9B89A"/>
      </linearGradient>
      <clipPath id="photo"><rect x="70" y="120" width="420" height="420" rx="96"/></clipPath>
    </defs>
    <!-- back frame -->
    <rect x="130" y="60" width="400" height="400" rx="92" fill="none"
          stroke="#C9BBA5" stroke-opacity="0.55" stroke-width="26" transform="rotate(9 330 260)"/>
    <!-- front photo -->
    <g clip-path="url(#photo)">
      <rect x="70" y="120" width="420" height="420" fill="url(#sky)"/>
      <circle cx="360" cy="270" r="46" fill="#F6EFE4"/>
      <path d="M70 430 L190 320 L270 390 L350 300 L490 430 L490 540 L70 540 Z" fill="#8C9A8D"/>
      <path d="M70 470 L170 410 L260 460 L380 390 L490 460 L490 540 L70 540 Z" fill="#5A6B5E"/>
    </g>
    <rect x="70" y="120" width="420" height="420" rx="96" fill="none" stroke="#F6EFE4" stroke-opacity="0.35" stroke-width="4"/>
  </g>`;
}

const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg ?? ''}
  ${body}
</svg>`;

const charcoal = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2826"/>
      <stop offset="1" stop-color="#151413"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>`;

const render = (content, file, size = 1024) =>
  sharp(Buffer.from(content)).resize(size, size).png().toFile(out(file));

await Promise.all([
  // iOS / legacy icon: full-bleed (the OS applies its own corner mask).
  render(svg(mark(0.78), charcoal), 'icon.png'),
  // Android adaptive foreground: keep the mark inside the ~66% safe zone.
  render(svg(mark(0.58)), 'adaptive-icon.png'),
  // Splash mark on transparent background (bg colour comes from app.json).
  render(svg(mark(0.9)), 'splash-icon.png'),
  render(svg(mark(0.78), charcoal), 'favicon.png', 48),
]);

console.log('Rendered assets/icon.png, adaptive-icon.png, splash-icon.png, favicon.png');
