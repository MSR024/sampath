// Builds the self-contained site at the repository root (GitHub Pages serves it from there).
// Inlines site settings, logic and seed data into index.html, fills {{site tokens}},
// and writes CNAME, site.webmanifest and the static assets next to it.
const fs = require("fs");
const path = require("path");
const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const site = JSON.parse(fs.readFileSync(path.join(__dirname, "site.json"), "utf8"));
const seed = JSON.stringify(JSON.parse(src("seed.json")));
const safe = (s) => s.replace(/</g, "\\u003c");
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

let html = src("index.html")
  .replace("/*__SITE__*/", () => safe(JSON.stringify(site)))
  .replace("/*__LOGIC__*/", () => src("logic.js").replace(/<\/script/gi, "<\\/script"))
  .replace("/*__SEED__*/", () => safe(seed));
const tokens = { ...site, url: "https://" + site.domain + "/" };
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (!(k in tokens)) throw new Error("Unknown token " + m + " in src/index.html (add it to site.json)");
  return attr(tokens[k]);
});

const OUT = path.join(__dirname, "..");
fs.writeFileSync(path.join(OUT, "index.html"), html);
// A custom domain needs CNAME; the github.io address must not have one.
const cname = path.join(OUT, "CNAME");
if (/github\.io/.test(site.domain)) { if (fs.existsSync(cname)) fs.unlinkSync(cname); }
else fs.writeFileSync(cname, site.domain + "\n");
fs.writeFileSync(path.join(OUT, "site.webmanifest"), JSON.stringify({
  name: site.name, short_name: site.shortName, start_url: "/", display: "standalone",
  background_color: "#ffffff", theme_color: site.themeColor,
  icons: [
    { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 2) + "\n");
const pub = path.join(__dirname, "src", "public");
if (fs.existsSync(pub)) for (const f of fs.readdirSync(pub)) fs.copyFileSync(path.join(pub, f), path.join(OUT, f));
console.log("Built index.html (" + Math.round(html.length / 1024) + " KB) for " + site.domain);
