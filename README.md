# Sampath.Family

Birthdays and wedding anniversaries for the family group Sampath Anna (Raju) founded. Launching 19 December 2026, on his birthday.

The site is one self-contained page served by GitHub Pages from the top of this repository. No server and no database. Built from the [Royal Dr Gang](https://github.com/MSR024/RoyalDrGang) template.

## Layout

```
index.html, og.png, favicon*, apple-touch-icon.png, icon-512.png, site.webmanifest
                     The built website (what GitHub Pages serves). Don't edit index.html directly.
CNAME                The custom domain for GitHub Pages (written by build.js from site.json)
.nojekyll            Tells Pages to serve files as-is
dev/site.json        Group name, domain, base time zone, link-preview text
dev/src/seed.json    THE DATA: everyone's birthdays, anniversaries, nicknames, families, founder (Sampath Anna) highlight
dev/src/logic.js     Sorting, dates, search, filters, families, import/export, storage
dev/src/index.html   The page: layout, styles, behaviour
dev/test/            Unit tests (Node's built-in runner, no install needed)
dev/build.js         Builds dev/src + site.json → index.html, CNAME, site.webmanifest at the repo root
dev/make-assets.js   Regenerates the link-preview image and icons (needs `sharp`)
```

## Making a change

Requires Node 18+. Nothing to install.

```bash
cd dev
# 1. edit src/seed.json (data) or src/index.html (design)
# 2. if you changed seed.json, bump "seedVersion" by 1 so saved browsers pick up the change
node --test test/*.test.js   # run the tests
node build.js                # rebuild ../index.html
cd .. && git add -A && git commit -m "Add Swetha's birthday" && git push
```

GitHub Pages republishes about a minute after the push.

## GitHub Pages and the domain (one-time setup)

1. Repo **Settings → Pages**: Source **Deploy from a branch**, branch **main**, folder **/ (root)**, Save.
2. The custom domain field shows the domain from `CNAME`. Tick **Enforce HTTPS** once the certificate is active.
3. Namecheap → Domain List → Manage → **Advanced DNS**:

   | Type | Host | Value |
   |---|---|---|
   | CNAME | `www` | `msr024.github.io.` |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |

   Remove Namecheap's default parking records first. Leave DNSSEC off and add no CAA records.

## Whose "today"?

The calendar day follows **India time (IST)** for every visitor, because most of the family is in India: a birthday on the 19th shows as "today" in California from 10:30 AM PST on the 18th. Change `timeZone` in `dev/site.json` and rebuild.

## Look

Telangana throughout: paddy-field green and cotton cream with a Pochampally ikat strip, the Kakatiya Kala Thoranam and a mango-leaf, banti and tangedu thoranam. On a Telugu celebrant's day the band turns turmeric with a Bathukamma. Other communities keep their own looks (for example Kerala kasavu on Thara's birthday). The logo is **Sampath.Family**, its dot a small deepam flame.

## Sampath Anna's birthday (Dec 19) and the launch

`personMetadata` in `seed.json` marks Sampath Anna, the founder, as featured (keyed by `birthday-sampath`). On Dec 19 the top reads "Sampath Anna's Birthday" with its own line, and his card is highlighted with a Founder badge all year. No age is ever shown. The site launches on his birthday: `launchDate` in `dev/site.json` drives the footer line ("Sampath.Family, Launched on 19 December 2026, on Sampath Anna’s birthday").

## Who can edit

Public editing is **off** (`"publicEditing": false` in `dev/site.json`): there is no Manage page or edit button on the site, and anything an older visit saved in a browser is ignored, so everyone sees exactly the published list. Sateesh updates the data through Claude (seed.json → build → push). Set it to `true` to bring the Manage page back.

## How the data works

- `dev/src/seed.json` is the shared list everyone sees. It has a `seedVersion` number.
- Edits made on the site's **Manage events** page are saved only in that browser (localStorage). To make an edit permanent for everyone, put it in `seed.json`, bump `seedVersion`, rebuild and push.
- When `seedVersion` changes, a browser with saved edits picks up new and corrected seed records automatically. Records that person edited by hand, and events they deleted, are left alone.
- **Reload latest seed data** adds back any missing bundled events. **Restore original list** discards local edits.
- **Export JSON / Import** move a list between devices. On import, possible duplicates are shown for you to merge, keep both, or skip.

## Data model

```ts
type Birthday    = { id; type: "birthday"; name; month; day; aliases: string[]; community?; relationship?; parents?: [string, string]; verified; note? };
type Anniversary = { id; type: "anniversary"; people: [string, string]; month; day; aliases: string[]; verified; note? };
```

- Months are 1–12. Ages and anniversary counts aren't shown, because years aren't recorded.
- Extra fields (`birthYear`, `photo`, `reminder`, …) are kept through edits, import and export, so they can be added later.
- `community` is one of the keys in `COMMUNITIES` in `logic.js` (`telugu`, `tamil`, `tamil-sourashtra`, `malayali`, `muslim`). It sets the language of the greeting on each card. Anniversaries use both partners' languages.
- `parents` links a child to a couple, and the **Families** section on the Manage page is built from it. It also flags missing birthdays and anniversaries.

## Tests

- `test/logic.test.js` checks the shared logic against the Royal Dr template data (`test/fixture-seed.json`): search, loose spelling, duplicate rules, import/export, seed migration.
- `test/site.test.js` checks this group's data: counts per month, pet-name search, families, every person has a community, and Sampath Anna's featured birthday (own title, Telugu greeting, found by Sampath, Raju or Anna).
