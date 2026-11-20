// Generates the link-preview image and site icons into src/public/.
// Run: node make-assets.js   (needs the "sharp" package)
const fs = require("fs");
const path = require("path");
let sharp;
try { sharp = require("sharp"); } catch { sharp = require("/opt/npm-tools/node_modules/sharp"); }

const site = require("./site.json");
const xml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Shrink the big title to fit beside the rangoli (≈ 820px of room).
const titleSize = Math.min(108, Math.floor(820 / (site.brand.length * 0.52)));
const domainLabel = site.ogDomain || site.domain.replace(/^www\./, "");
const out = path.join(__dirname, "src", "public");
fs.mkdirSync(out, { recursive: true });

const SAFFRON = "#f7b52c", INK = "#2b1430", RANI = "#d6246e", PURPLE = "#7b1fa2", MARIGOLD = "#f2a20c", LEAF = "#2f7d3c";
const PETAL = "M0 0C-9-8-9-22 0-30 9-22 9-8 0 0Z";
const ring = (n, r, scale, fill, rot = 0) => Array.from({ length: n }, (_, i) =>
  `<path d="${PETAL}" fill="${fill}" transform="rotate(${(360 / n) * i + rot}) translate(0 ${-r}) scale(${scale})"/>`).join("");
const rangoli = (dots = true) => `
  ${dots ? `<circle r="92" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-dasharray="2 7"/>` +
    Array.from({ length: 16 }, (_, i) => { const a = (Math.PI * 2 * i) / 16; return `<circle cx="${(86 * Math.cos(a)).toFixed(1)}" cy="${(86 * Math.sin(a)).toFixed(1)}" r="3.2" fill="#fff" opacity=".85"/>`; }).join("") : ""}
  ${ring(8, 30, 1.6, RANI)}${ring(8, 22, 1.15, PURPLE, 22.5)}${ring(8, 8, 0.8, MARIGOLD)}
  <circle r="12" fill="#fff"/><circle r="7" fill="${RANI}"/><circle r="3" fill="#f7c04a"/>`;
const flower = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${MARIGOLD}"/><circle cx="${x}" cy="${y}" r="${r * 0.65}" fill="#f7c04a"/><circle cx="${x}" cy="${y}" r="${r * 0.28}" fill="#d9780a"/>`;
const mango = (x, y, h) => `<path d="M${x} ${y}c${h * 0.2} ${h * 0.23} ${h * 0.2} ${h * 0.65} 0 ${h}c${-h * 0.2} ${-h * 0.35} ${-h * 0.2} ${-h * 0.77} 0 ${-h}Z" fill="${LEAF}"/>`;

function garland(W, y) {
  const n = Math.round(W / 40); let s = `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${LEAF}" stroke-width="3"/>`;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * (W / n); s += i % 2 ? mango(x, y - 2, 34) : flower(x, y, 12); }
  return s;
}
// Kolam dot grid
function kolam(W, H, step = 30) {
  let s = "";
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) s += `<circle cx="${x}" cy="${y}" r="2" fill="#fff" opacity=".4"/>`;
  return s;
}

// 1200×630 Open Graph / WhatsApp preview
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${SAFFRON}"/>
  ${kolam(1200, 560)}
  <rect y="560" width="1200" height="70" fill="#fff"/>
  ${garland(1200, 560)}
  <g transform="translate(1045 285) scale(1.42)">${rangoli()}</g>
  <text x="80" y="200" font-family="Inter" font-weight="600" font-size="34" fill="${INK}" opacity=".8">Birthdays &amp; wedding anniversaries</text>
  <text x="76" y="330" font-family="Gelasio" font-weight="700" font-size="${titleSize}" fill="${INK}" letter-spacing="-1.5">${xml(site.brand)}</text>
  <text x="80" y="404" font-family="Gelasio" font-weight="700" font-size="60" fill="${RANI}">Celebrations</text>
  <text x="80" y="490" font-family="Inter" font-weight="500" font-size="30" fill="${INK}" opacity=".85">${xml(site.ogLine)}</text>
  <text x="80" y="606" font-family="Inter" font-weight="600" font-size="26" fill="${INK}">${xml(domainLabel)}</text>
</svg>`;

// Square icon: rangoli on saffron
const icon = (size, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-100 -100 200 200">
  <rect x="-100" y="-100" width="200" height="200" rx="${rounded ? 44 : 0}" fill="${SAFFRON}"/>
  <g transform="scale(1.02)">${rangoli(false)}</g>
</svg>`;

(async () => {
  await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(out, "og.png"));
  fs.writeFileSync(path.join(out, "favicon.svg"), icon(64, true));
  await sharp(Buffer.from(icon(180, false))).png().toFile(path.join(out, "apple-touch-icon.png"));
  await sharp(Buffer.from(icon(32, true))).png().toFile(path.join(out, "favicon-32.png"));
  await sharp(Buffer.from(icon(512, true))).png().toFile(path.join(out, "icon-512.png"));
  for (const f of fs.readdirSync(out)) console.log(f.padEnd(22), Math.round(fs.statSync(path.join(out, f)).size / 1024) + " KB");
})();
