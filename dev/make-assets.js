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
const domainLabel = site.ogDomain;  // shown in the white strip; empty until the custom domain is live
const out = path.join(__dirname, "src", "public");
fs.mkdirSync(out, { recursive: true });

const GREEN = "#24502c", CREAM = "#fdf6e3", TURMERIC = "#f2c14e", CHILLI = "#b3261e";
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

// The flame "dot" of the Sampath.Family logo (a small deepam), drawn in a 10×14 box.
const flame = (x, y, w) => `<g transform="translate(${x} ${y}) scale(${w / 10})">
  <path d="M5 0C8 4 9 7.5 9 9.6A4 4 0 0 1 1 9.6C1 7.5 2 4 5 0Z" fill="#d9480f"/>
  <path d="M5 5.6C6.4 7.4 6.6 8.7 6.6 9.7A1.6 1.6 0 0 1 3.4 9.7C3.4 8.7 3.6 7.4 5 5.6Z" fill="#ffd27a"/></g>`;

// Bathukamma: flower tiers on a brass plate, Gauramma on top (same drawing as the site's celebration day).
function bathukamma() {
  const tiers = ["#f4c430", "#c2185b", "#3f8a3a", "#fff8e7", "#f08a00", "#7b1fa2", "#f4c430"];
  let g = `<ellipse cx="0" cy="86" rx="88" ry="10" fill="#c9971c"/><ellipse cx="0" cy="83" rx="80" ry="7" fill="#e8b93a"/>`;
  tiers.forEach((c, i) => {
    const yb = 80 - i * 20, yt = yb - 20, wb = 78 - i * 10, wt = wb - 9;
    g += `<path d="M${-wb} ${yb}L${-wt} ${yt}Q0 ${yt - 6} ${wt} ${yt}L${wb} ${yb}Q0 ${yb + 6} ${-wb} ${yb}Z" fill="${c}"/>`;
    const n = Math.max(4, Math.round(wt / 7)), dot = c === "#fff8e7" ? "#f4c430" : c === "#3f8a3a" ? "#a9d38a" : "#fff8e7";
    for (let k = 0; k <= n; k++) g += `<circle cx="${(-wt + (2 * wt * k) / n).toFixed(1)}" cy="${yt + 1}" r="2.6" fill="${dot}"/>`;
  });
  return g + `<path d="M0 -92L10 -60H-10Z" fill="#e8a317"/><circle cx="0" cy="-70" r="2.6" fill="${CHILLI}"/>`;
}
const ikat = (W) => { let s = `<rect width="${W}" height="14" fill="${TURMERIC}"/>`;
  for (let x = 0; x < W; x += 44) s += `<path d="M${x + 22} 0l6 4h4l-4 3 4 3h-4l-6 4-6-4h-4l4-3-4-3h4Z" fill="${CHILLI}"/><path d="M${x + 22} 4.4l2.8 2.6-2.8 2.6-2.8-2.6Z" fill="#fff8e7"/>`;
  return s; };
const paddy = (W, y) => { let s = "";
  for (let x = 8; x < W; x += 30) s += `<g transform="translate(${x} ${y})" fill="#a9d38a" opacity=".55"><path d="M0 0C0-12-3-18-8-22 -2-19 1-12 1.4 0Z"/><path d="M2 0c0-13 2-20 7-25-2 7-4 15-4.6 25Z"/><path d="M1 0c0-9 1-15 0-22 2 6 2.4 14 1.6 22Z"/></g><ellipse cx="${x + 7}" cy="${y - 23}" rx="1.6" ry="3" fill="${TURMERIC}" transform="rotate(30 ${x + 7} ${y - 23})"/>`;
  return s; };

// Wordmark widths in Gelasio Bold at 112px, measured in Chrome (Sampath 514, Family 397).
const WM = 104, k = WM / 112, wA = 514.2 * k, fl = 30, gap = 6;
const xFam = 80 + wA + gap + fl + gap;

// 1200×630 Open Graph / WhatsApp preview
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${GREEN}"/>
  ${ikat(1200)}
  ${paddy(1200, 560)}
  <rect y="560" width="1200" height="70" fill="${CREAM}"/>
  ${garland(1200, 560)}
  <g transform="translate(1098 300) scale(1.02)">${bathukamma()}</g>
  <text x="82" y="210" font-family="Inter" font-weight="600" font-size="34" fill="${CREAM}" opacity=".85">Birthdays &amp; wedding anniversaries</text>
  <text x="80" y="342" font-family="Gelasio" font-weight="700" font-size="${WM}" fill="${CREAM}">${xml(site.brandA)}</text>
  ${flame(80 + wA + gap, 342 - fl * 1.4 + 4, fl)}
  <text x="${xFam.toFixed(1)}" y="342" font-family="Gelasio" font-weight="700" font-size="${WM}" fill="${TURMERIC}">${xml(site.brandB)}</text>
  <text x="82" y="430" font-family="Inter" font-weight="500" font-size="34" fill="${CREAM}" opacity=".9">${xml(site.ogLine)}</text>
  ${domainLabel ? `<text x="80" y="606" font-family="Inter" font-weight="600" font-size="26" fill="${GREEN}">${xml(domainLabel)}</text>` : ""}
</svg>`;

// Square icon: "S" with the flame dot, on saffron
const icon = (size, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-100 -100 200 200">
  <rect x="-100" y="-100" width="200" height="200" rx="${rounded ? 44 : 0}" fill="${GREEN}"/>
  <circle r="86" fill="none" stroke="${TURMERIC}" stroke-opacity=".7" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>
  <text x="-64" y="54" font-family="Gelasio, Georgia, serif" font-weight="700" font-size="152" fill="${CREAM}">S</text>
  ${flame(38, 54 - 34 + 3, 24)}
</svg>`;

(async () => {
  await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(out, "og.png"));
  fs.writeFileSync(path.join(out, "favicon.svg"), icon(64, true));
  await sharp(Buffer.from(icon(180, false))).png().toFile(path.join(out, "apple-touch-icon.png"));
  await sharp(Buffer.from(icon(32, true))).png().toFile(path.join(out, "favicon-32.png"));
  await sharp(Buffer.from(icon(512, true))).png().toFile(path.join(out, "icon-512.png"));
  for (const f of fs.readdirSync(out)) console.log(f.padEnd(22), Math.round(fs.statSync(path.join(out, f)).size / 1024) + " KB");
})();
