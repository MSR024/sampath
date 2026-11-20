const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/logic.js");
const seed = require("./fixture-seed.json"); // Royal Dr template data: exercises the shared logic

const all = () => R.seedEvents(seed);
const d = (y, m, day) => new Date(y, m - 1, day);
const names = (list) => list.map(R.displayName);

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test("seed loads 40 birthdays and 10 anniversaries, all valid", () => {
  const ev = all();
  assert.equal(ev.length, 50);
  assert.equal(R.counts(ev).birthdays, 40);
  assert.equal(R.counts(ev).anniversaries, 10);
  for (const e of ev) assert.deepEqual(R.validateEvent(e).errors, [], R.displayName(e));
  assert.equal(new Set(ev.map((e) => e.id)).size, 50, "ids are unique");
});

test("sorts events by month, then day, birthdays before anniversaries on the same day", () => {
  const sorted = R.sortEvents([
    { id: "c", type: "birthday", name: "C", month: 12, day: 1, aliases: [] },
    { id: "a2", type: "anniversary", people: ["X", "Y"], month: 1, day: 5, aliases: [] },
    { id: "b", type: "birthday", name: "B", month: 1, day: 30, aliases: [] },
    { id: "a", type: "birthday", name: "A", month: 1, day: 5, aliases: [] },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ["a", "a2", "b", "c"]);
  const s = R.sortEvents(all());
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].month * 100 + s[i - 1].day <= s[i].month * 100 + s[i].day);
});

test("groups same-day events together", () => {
  const april = R.groupByDate(R.eventsInMonth(all(), 4));
  const apr8 = april.find((g) => g.day === 8);
  assert.deepEqual(names(apr8.events).sort(), ["Maggie", "Rekha"]);
  const nov18 = R.groupByDate(R.eventsInMonth(all(), 11)).find((g) => g.day === 18);
  assert.equal(nov18.events.length, 2);
});

test("selects the current month", () => {
  assert.equal(R.currentMonth(d(2026, 11, 19)), 11);
  assert.equal(R.currentMonth(d(2027, 1, 1)), 1);
  assert.equal(R.currentMonth(d(2026, 12, 31)), 12);
});

test("calculates the next celebration, including today", () => {
  const n = R.nextCelebration(all(), d(2026, 11, 19));
  assert.equal(n.days, 0);
  assert.deepEqual(names(n.events), ["Kanthi"]);
  const after = R.nextAfterToday(all(), d(2026, 11, 19));
  assert.equal(after.days, 6);
  assert.deepEqual(names(after.events), ["Kishore Avengu & Suneesha"]);
  const n2 = R.nextCelebration(all(), d(2026, 4, 9));
  assert.deepEqual(names(n2.events), ["Hasnain"]);
  assert.equal(R.relativeLabel(n2.days), "Tomorrow");
  assert.equal(R.relativeLabel(5), "In 5 days");
});

test("rolls over from December to January", () => {
  const n = R.nextCelebration(all(), d(2026, 12, 30));
  assert.deepEqual(names(n.events), ["Ali & Meenaz"]);
  assert.equal(n.days, 6); // Dec 30 → Jan 5
  const vihaan = all().find((e) => e.id === "birthday-vihaan");
  assert.equal(R.daysUntil(vihaan, d(2026, 12, 31)), 9);
  assert.equal(R.daysUntil(vihaan, d(2027, 1, 10)), 364);
  const kk = all().find((e) => e.id === "birthday-kishore-koneti");
  assert.equal(R.daysUntil(kk, d(2026, 12, 29)), 0);
  assert.equal(R.daysUntil(kk, d(2026, 12, 30)), 364);
});

test("Feb 29 dates are observed on Feb 28 in non-leap years", () => {
  const leapling = { type: "birthday", name: "L", month: 2, day: 29, aliases: [] };
  assert.equal(R.daysUntil(leapling, d(2027, 2, 27)), 1);
  assert.equal(R.daysUntil(leapling, d(2028, 2, 28)), 1);
});

test("filters birthdays and anniversaries", () => {
  const b = R.filterEvents(all(), { filter: "birthday" });
  const a = R.filterEvents(all(), { filter: "anniversary" });
  assert.equal(b.length, 40);
  assert.equal(a.length, 10);
  assert.ok(b.every((e) => e.type === "birthday"));
  assert.ok(a.every((e) => e.type === "anniversary"));
  assert.deepEqual(names(R.filterEvents(all(), { filter: "anniversary", month: 11 })),
    ["Subbu & Kanthi", "Krishna & Rekha", "Vivek & Srujana", "Kishore Avengu & Suneesha"]);
});

test("filters unverified records", () => {
  const u = R.filterEvents(all(), { filter: "unverified" });
  assert.deepEqual(names(u).sort(), ["Madhu & Vijetha", "Maggie", "Soumya", "Subbu & Kanthi", "Yashika"]);
  assert.deepEqual(R.counts(all()), { total: 50, verified: 45, unverified: 5, birthdays: 40, anniversaries: 10 });
});

test("search matches canonical names and aliases", () => {
  const q = (s) => names(R.filterEvents(all(), { query: s }));
  assert.deepEqual(q("Lavanya"), ["Venkat & Soumya", "Soumya"]);
  assert.deepEqual(q("buddy"), ["Kishore Koneti & Shilpa", "Kishore Koneti"]);
  assert.deepEqual(q("Rajitha"), ["Bhaskar & Lahari", "Lahari"]);
  assert.deepEqual(q("talaivarae"), ["Krishna", "Krishna & Rekha"]);
  assert.deepEqual(q("TARA"), ["Thara", "Sateesh & Thara"]);
  assert.deepEqual(q("bachi"), ["Bhaskar & Lahari", "Bhaskar"]);
  assert.ok(q("Kishore").includes("Kishore Avengu"));
  assert.ok(q("Kishore").includes("Kishore Koneti"));
  assert.ok(!q("Kishore Kumar").includes("Kishore Avengu"), "Kishore Kumar is Koneti only");
  assert.equal(R.matchedAlias(all().find((e) => e.id === "birthday-soumya"), "soma"), "Soma");
  assert.equal(R.matchedAlias(all().find((e) => e.id === "birthday-soumya"), "Soum"), null);
});

test("Meenaz and Meenu stay separate people", () => {
  const ev = all();
  const meenaz = ev.find((e) => e.id === "birthday-meenaz");
  const meenu = ev.find((e) => e.id === "birthday-meenu");
  const idx = R.buildAliasIndex(ev);
  assert.equal(R.isDuplicate(meenaz, meenu, idx), false);
  assert.equal(R.findDuplicate({ type: "birthday", name: "Meenu", month: 5, day: 4, aliases: [] }, ev).id, "birthday-meenu");
  assert.equal(R.findDuplicate({ type: "birthday", name: "Menaz", month: 10, day: 11, aliases: [] }, ev).id, "birthday-meenaz");
});

test("duplicate detection uses identities, never fuzzy names", () => {
  const ev = all();
  const dup = (e) => R.findDuplicate(Object.assign({ aliases: [], month: 1, day: 1 }, e), ev);
  assert.equal(dup({ type: "birthday", name: "Venky" }).id, "birthday-venkat");
  assert.equal(dup({ type: "birthday", name: "Kishore Kumar" }).id, "birthday-kishore-koneti");
  assert.equal(dup({ type: "birthday", name: "kishore avengu" }).id, "birthday-kishore-avengu");
  assert.equal(dup({ type: "birthday", name: "Kishore" }), null);
  assert.equal(dup({ type: "birthday", name: "Soumyaa" }), null);
  assert.equal(dup({ type: "anniversary", people: ["Rajitha", "Bachi"] }).id, "anniversary-bhaskar-lahari");
  assert.equal(dup({ type: "anniversary", people: ["Buddy", "Shilpa"] }).id, "anniversary-kishore-koneti-shilpa");
  assert.equal(dup({ type: "anniversary", people: ["Kishore Avengu", "Shilpa"] }), null);
  // an edit doesn't count as a duplicate of itself
  const venkat = ev.find((e) => e.id === "birthday-venkat");
  assert.equal(R.findDuplicate(venkat, ev, venkat.id), null);
});

test("validation rejects bad dates and keeps future fields", () => {
  assert.match(R.validateEvent({ type: "birthday", name: "X", month: 2, day: 30 }).errors[0], /Day must be/);
  assert.match(R.validateEvent({ type: "birthday", name: "X", month: 13, day: 1 }).errors[0], /Month/);
  assert.match(R.validateEvent({ type: "anniversary", people: ["A"], month: 1, day: 1 }).errors[0], /partners/);
  assert.ok(R.validateEvent({ type: "birthday", name: "X", month: 2, day: 29 }).event);
  const v = R.validateEvent({ type: "birthday", name: " X ", month: "3", day: "4", aliases: "a, b, A", birthYear: 1990, reminder: { days: 1 } });
  assert.equal(v.event.name, "X");
  assert.deepEqual(v.event.aliases, ["a", "b"]);
  assert.equal(v.event.birthYear, 1990);
  assert.deepEqual(v.event.reminder, { days: 1 });
});

test("exports and re-imports JSON without loss", () => {
  const ev = all();
  const json = R.exportJSON(ev, new Date("2026-11-19T00:00:00Z"));
  const data = JSON.parse(json);
  assert.equal(data.app, R.SITE.name);
  assert.equal(data.birthdays.length, 40);
  assert.equal(data.anniversaries.length, 10);
  const { events, errors } = R.parseImport(json);
  assert.deepEqual(errors, []);
  assert.deepEqual(R.sortEvents(events), ev);
  const plan = R.planImport(ev, events);
  assert.equal(plan.fresh.length, 0);
  assert.equal(plan.duplicates.length, 0);
  assert.equal(plan.identical.length, 50);
});

test("import accepts arrays and reports bad records and bad JSON", () => {
  assert.match(R.parseImport("{nope").errors[0], /valid JSON/);
  assert.match(R.parseImport("{}").errors[0], /No birthdays/);
  const r = R.parseImport(JSON.stringify([
    { type: "birthday", name: "New Kid", month: 6, day: 1 },
    { type: "birthday", name: "Bad", month: 4, day: 31 },
  ]));
  assert.equal(r.events.length, 1);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /Bad/);
});

test("import asks about duplicates and applies merge / keep both / skip", () => {
  const ev = all();
  const incoming = R.parseImport(JSON.stringify({ birthdays: [
    { name: "New Kid", month: 6, day: 1, aliases: [], verified: true },
    { name: "Soma", month: 3, day: 1, aliases: ["Sou"], verified: true, note: "Confirmed by Venkat." },
    { name: "Buddy", month: 12, day: 29, aliases: [], verified: true },
  ] })).events;
  const plan = R.planImport(ev, incoming);
  assert.equal(plan.fresh.length, 1);
  assert.equal(plan.duplicates.length, 2);
  assert.equal(plan.duplicates[0].existing.id, "birthday-soumya");

  const merged = R.applyImport(ev, plan, { 0: "merge", 1: "skip" });
  assert.equal(merged.length, 51);
  const soumya = merged.find((e) => e.id === "birthday-soumya");
  assert.equal(soumya.name, "Soumya", "canonical name kept");
  assert.equal(soumya.day, 1, "verified import wins over unverified date");
  assert.equal(soumya.verified, true);
  assert.ok(soumya.aliases.includes("Sou"));
  assert.match(soumya.note, /Confirmed by Venkat/);

  const both = R.applyImport(ev, plan, { 0: "both", 1: "both" });
  assert.equal(both.length, 53);
  assert.equal(new Set(both.map((e) => e.id)).size, 53, "new ids never collide");

  const skipped = R.applyImport(ev, plan, {});
  assert.equal(skipped.length, 51);
});

test("merge never silently overwrites a verified date", () => {
  const ev = all();
  const venkat = ev.find((e) => e.id === "birthday-venkat");
  const m = R.mergeEvents(venkat, { type: "birthday", name: "Venky", month: 2, day: 25, aliases: [], verified: true });
  assert.equal(m.day, 24);
  assert.match(m.note, /Imported record listed February 25/);
});

test("saves to and restores from localStorage, keeping the seed untouched", () => {
  const store = new MemoryStorage();
  let { events, source } = R.loadEvents(store, seed);
  assert.equal(source, "seed");
  events = events.filter((e) => e.id !== "birthday-maggie");
  events.push({ id: "birthday-new", type: "birthday", name: "New", month: 1, day: 2, aliases: [], verified: true });
  assert.ok(R.saveEvents(store, events, { seedVersion: seed.seedVersion, deletedSeedIds: ["birthday-maggie"] }));
  const again = R.loadEvents(store, seed);
  assert.equal(again.source, "saved");
  assert.equal(again.events.length, 50);
  assert.ok(again.events.some((e) => e.id === "birthday-new"));
  assert.ok(!again.events.some((e) => e.id === "birthday-maggie"));
  assert.ok(seed.birthdays.some((b) => b.id === "birthday-maggie"), "seed file not mutated");
  const restored = R.restoreSeed(store, seed);
  assert.equal(restored.length, 50);
  assert.equal(store.getItem(R.STORAGE_KEY), null);
  assert.equal(R.loadEvents(store, seed).source, "seed");
});

test("corrupt or unavailable storage falls back to the seed", () => {
  const store = new MemoryStorage();
  store.setItem(R.STORAGE_KEY, "{broken");
  const r = R.loadEvents(store, seed);
  assert.equal(r.source, "seed");
  assert.ok(r.error);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(R.loadEvents(throwing, seed).source, "seed");
  assert.equal(R.saveEvents(throwing, all()), false);
});

/* ---------- Regression: November contents and monthly totals ---------- */
test("November contains exactly 3 birthdays and 4 anniversaries", () => {
  const nov = R.filterEvents(all(), { filter: "all", month: 11 });
  assert.deepEqual(R.summarize(nov), { total: 7, birthdays: 3, anniversaries: 4 });
  const fmt = (e) => `${e.day} ${R.displayName(e)} ${e.verified ? "verified" : "unverified"}`;
  assert.deepEqual(nov.filter((e) => e.type === "birthday").map(fmt),
    ["11 Apurva verified", "15 Bhaskar verified", "19 Kanthi verified"]);
  assert.deepEqual(nov.filter((e) => e.type === "anniversary").map(fmt), [
    "2 Subbu & Kanthi unverified", "18 Krishna & Rekha verified",
    "18 Vivek & Srujana verified", "25 Kishore Avengu & Suneesha verified"]);
  // the same-day pair on the 18th is preserved
  assert.equal(R.groupByDate(nov).find((g) => g.day === 18).events.length, 2);
});

test("type filters keep every valid November event", () => {
  const b = R.filterEvents(all(), { filter: "birthday", month: 11 });
  const a = R.filterEvents(all(), { filter: "anniversary", month: 11 });
  const u = R.filterEvents(all(), { filter: "unverified", month: 11 });
  assert.equal(b.length, 3);
  assert.equal(a.length, 4);
  assert.equal(b.length + a.length, R.filterEvents(all(), { month: 11 }).length);
  // "0 birthdays · 1 anniversary" is only correct with the Needs confirmation filter on
  assert.deepEqual(R.summarize(u), { total: 1, birthdays: 0, anniversaries: 1 });
});

test("all 12 monthly totals match the full seed dataset", () => {
  const expected = { // [birthdays, anniversaries], counted by hand from seed.json
    1: [4, 1], 2: [1, 1], 3: [3, 0], 4: [6, 0], 5: [3, 1], 6: [2, 1],
    7: [6, 0], 8: [3, 0], 9: [1, 0], 10: [5, 0], 11: [3, 4], 12: [3, 2],
  };
  const summary = R.monthSummary(all());
  for (const m of summary) {
    assert.deepEqual([m.birthdays.length, m.anniversaries.length], expected[m.month], R.MONTHS[m.month - 1]);
    assert.deepEqual(R.summarize(R.eventsInMonth(all(), m.month)),
      { total: m.total, birthdays: m.birthdays.length, anniversaries: m.anniversaries.length });
  }
  assert.equal(summary.reduce((n, m) => n + m.total, 0), seed.birthdays.length + seed.anniversaries.length);
});

test("months are 1-based everywhere", () => {
  for (const e of all()) assert.ok(e.month >= 1 && e.month <= 12);
  assert.equal(R.currentMonth(d(2026, 1, 15)), 1);
  assert.equal(R.eventsInMonth(all(), 0).length, 0);
  assert.equal(R.eventsInMonth(all(), 1)[0].id, "anniversary-ali-meenaz");
  assert.equal(R.monthSummary(all())[10].name, "November");
  assert.equal(R.monthSummary(all())[10].month, 11);
});

test("every item from both seed arrays loads", () => {
  const ids = new Set(all().map((e) => e.id));
  for (const b of seed.birthdays) assert.ok(ids.has(b.id), b.id);
  for (const a of seed.anniversaries) assert.ok(ids.has(a.id), a.id);
  assert.equal(R.seedVersionOf(seed), seed.seedVersion);
});

/* ---------- Seed versioning and migration ---------- */
test("stale, incomplete localStorage from an older seed is migrated", () => {
  const store = new MemoryStorage();
  // simulate an old save: unversioned, only the first anniversary, plus one user edit and one addition
  const old = all().filter((e) => e.type === "birthday" || e.id === "anniversary-ali-meenaz")
    .map((e) => (e.id === "birthday-maggie" ? Object.assign({}, e, { day: 7, verified: true }) : e));
  old.push({ id: "birthday-guest", type: "birthday", name: "Guest", month: 11, day: 3, aliases: [], verified: true });
  store.setItem(R.STORAGE_KEY, JSON.stringify({ schemaVersion: 1, events: old }));
  const r = R.loadEvents(store, seed);
  assert.equal(r.migrated.added.length, 9, "nine missing anniversaries merged back in");
  const nov = r.events.filter((e) => e.month === 11);
  assert.deepEqual(R.summarize(nov), { total: 8, birthdays: 4, anniversaries: 4 });
  const maggie = r.events.find((e) => e.id === "birthday-maggie");
  assert.equal(maggie.day, 7, "user edit kept");
  assert.equal(maggie.verified, true);
  assert.ok(r.events.some((e) => e.id === "birthday-guest"), "user addition kept");
});

test("migration respects deliberate deletions; a current-version save is not migrated", () => {
  const store = new MemoryStorage();
  const events = all().filter((e) => e.id !== "birthday-shyam");
  R.saveEvents(store, events, { seedVersion: 1, deletedSeedIds: ["birthday-shyam"] });
  const r = R.loadEvents(store, seed);
  assert.ok(r.migrated);
  assert.ok(!r.events.some((e) => e.id === "birthday-shyam"), "deleted event stays deleted");
  assert.deepEqual(r.deletedSeedIds, ["birthday-shyam"]);
  R.saveEvents(store, r.events, { seedVersion: seed.seedVersion, deletedSeedIds: r.deletedSeedIds });
  const again = R.loadEvents(store, seed);
  assert.equal(again.migrated, undefined);
  assert.equal(again.events.length, 49);
});

test("reload latest seed data adds missing events without overwriting edits", () => {
  const edited = all().filter((e) => e.id !== "anniversary-vivek-srujana")
    .map((e) => (e.id === "birthday-soumya" ? Object.assign({}, e, { day: 1, verified: true }) : e));
  const m = R.mergeSeed(edited, seed, { includeDeleted: true, deletedSeedIds: ["anniversary-vivek-srujana"] });
  assert.deepEqual(m.added.map((e) => e.id), ["anniversary-vivek-srujana"]);
  assert.equal(m.events.length, 50);
  assert.equal(m.events.find((e) => e.id === "birthday-soumya").day, 1);
  // a hand-entered copy of a seed person is not duplicated
  const manual = all().filter((e) => e.id !== "birthday-venkat");
  manual.push({ id: "birthday-venky", type: "birthday", name: "Venky", month: 2, day: 24, aliases: [], verified: true });
  assert.equal(R.mergeSeed(manual, seed).added.length, 0);
});

test("restore loads the complete current seed file", () => {
  const store = new MemoryStorage();
  R.saveEvents(store, all().slice(0, 3), { seedVersion: 1 });
  const restored = R.restoreSeed(store, seed);
  assert.equal(restored.length, seed.birthdays.length + seed.anniversaries.length);
  assert.deepEqual(R.summarize(restored.filter((e) => e.month === 11)), { total: 7, birthdays: 3, anniversaries: 4 });
});

/* ---------- Communities and greetings ---------- */
test("every person has a community and anniversaries take their partners'", () => {
  const ev = all();
  for (const b of ev.filter((e) => e.type === "birthday")) assert.ok(R.COMMUNITIES[b.community], b.name);
  const get = (id) => ev.find((e) => e.id === id);
  assert.deepEqual(R.communitiesOf(get("anniversary-subbu-kanthi"), ev), ["tamil"]);
  assert.deepEqual(R.communitiesOf(get("anniversary-krishna-rekha"), ev), ["tamil-sourashtra"]);
  assert.deepEqual(R.communitiesOf(get("anniversary-ali-meenaz"), ev), ["muslim"]);
  assert.deepEqual(R.communitiesOf(get("anniversary-sateesh-thara"), ev), ["telugu", "malayali"]);
  assert.deepEqual(R.communitiesOf(get("anniversary-kishore-avengu-suneesha"), ev), ["telugu"]);
});

test("greetings use each community's own language", () => {
  const ev = all();
  const get = (id) => ev.find((e) => e.id === id);
  assert.equal(R.greetingsFor(get("birthday-kanthi"), ev)[0].lang, "ta");
  assert.equal(R.greetingsFor(get("birthday-thara"), ev)[0].lang, "ml");
  assert.equal(R.greetingsFor(get("birthday-ali"), ev)[0].dir, "rtl");
  assert.equal(R.greetingsFor(get("birthday-venkat"), ev)[0].roman, "Puttinaroju Shubhakankshalu");
  assert.deepEqual(R.greetingsFor(get("anniversary-sateesh-thara"), ev).map((g) => g.lang), ["te", "ml"]);
  assert.match(R.wishText(get("birthday-kanthi"), ev), /^Happy Birthday, Kanthi!\nஇனிய/);
});

test("search finds people by community or home state", () => {
  const q = (s) => names(R.filterEvents(all(), { query: s }));
  assert.deepEqual(q("kerala"), ["Thara", "Sateesh & Thara"]);
  assert.ok(q("tamil").includes("Subbu & Kanthi"));
  assert.ok(q("tamil").includes("Rekha"));
  assert.ok(q("sourashtra").includes("Krishna & Rekha"));
  assert.ok(q("telangana").includes("Venkat"));
});

test("migration fills the new community tag without overwriting edits", () => {
  const store = new MemoryStorage();
  const old = all().map((e) => { const c = Object.assign({}, e); delete c.community; return c; })
    .map((e) => (e.id === "birthday-meenu" ? Object.assign({}, e, { community: "telugu", note: "edited" }) : e));
  R.saveEvents(store, old, { seedVersion: 2 });
  const r = R.loadEvents(store, seed);
  assert.equal(r.events.find((e) => e.id === "birthday-kanthi").community, "tamil");
  const meenu = r.events.find((e) => e.id === "birthday-meenu");
  assert.equal(meenu.community, "telugu", "user's own value kept");
  assert.equal(meenu.note, "edited");
  assert.equal(r.migrated.filled.length, 39);
});

/* ---------- Pet names and spelling variants ---------- */
test("every pet name and alias in the data finds its person", () => {
  const ev = all();
  for (const e of ev) {
    for (const alias of e.aliases) {
      const found = R.filterEvents(ev, { query: alias }).map((x) => x.id);
      assert.ok(found.includes(e.id), `"${alias}" should find ${R.displayName(e)}`);
    }
  }
  // personal pet names also find the couple's anniversary
  const q = (s) => names(R.filterEvents(ev, { query: s }));
  for (const [nick, couple] of [["Buddy", "Kishore Koneti & Shilpa"], ["Bachi", "Bhaskar & Lahari"], ["Talaivarae", "Krishna & Rekha"],
    ["Venky", "Venkat & Soumya"], ["Lavanya", "Venkat & Soumya"], ["Satheesh", "Sateesh & Thara"], ["Ali Mama", "Ali & Meenaz"], ["Menaz", "Ali & Meenaz"]])
    assert.ok(q(nick).includes(couple), `${nick} → ${couple}`);
});

test("search forgives common spelling differences", () => {
  const q = (s) => names(R.filterEvents(all(), { query: s }));
  assert.ok(q("Satish").includes("Sateesh"));
  assert.ok(q("Tara").includes("Thara"));
  assert.ok(q("Apoorva").includes("Apurva"));
  assert.ok(q("Venki").includes("Venkat"));
  assert.ok(q("Esan").includes("Eshan"));
  assert.ok(q("Prajit").includes("Prajith"));
  assert.ok(q("Sharini").includes("Shaarini"));
  assert.ok(q("Kanti").includes("Kanthi"));
  assert.deepEqual(q("xyz"), []);
});

test("search reports which pet name matched", () => {
  const ev = all();
  const get = (id) => ev.find((e) => e.id === id);
  assert.equal(R.matchedAlias(get("birthday-ashritha"), "cherry", ev), "Cherry");
  assert.equal(R.matchedAlias(get("birthday-apurva"), "appu", ev), "Appu");
  assert.equal(R.matchedAlias(get("birthday-sateesh"), "satish", ev), null);
  assert.equal(R.matchedAlias(get("anniversary-kishore-koneti-shilpa"), "buddy", ev), "Buddy & Shilpa");
  assert.equal(R.matchedAlias(get("anniversary-krishna-rekha"), "talai", ev), "Talaivarae");
  assert.equal(R.matchedAlias(get("birthday-krishna"), "Krish", ev), null);
});

test("loose spelling never affects duplicate detection", () => {
  const ev = all();
  assert.equal(R.findDuplicate({ type: "birthday", name: "Satish", month: 1, day: 1, aliases: [] }, ev), null);
  assert.equal(R.findDuplicate({ type: "birthday", name: "Meenu", month: 1, day: 1, aliases: [] }, ev).id, "birthday-meenu");
});

/* ---------- Families ---------- */
test("family grid links kids to their parents and finds gaps", () => {
  const g = R.familyGrid(all());
  const fam = (a, b) => g.families.find((f) => f.people.includes(a) && f.people.includes(b));
  assert.deepEqual(fam("Ali", "Meenaz").kids.map((k) => k.name), ["Hasnain", "Zain"]);
  assert.deepEqual(fam("Venkat", "Soumya").kids.map((k) => k.name), ["Mahanya"]);
  assert.deepEqual(fam("Subbu", "Kanthi").kids.map((k) => k.name), ["Bala", "Meenu"]);
  assert.deepEqual(fam("Bhaskar", "Lahari").kids.map((k) => k.name), ["Eshan", "Yashika"]);
  assert.deepEqual(fam("Kishore Koneti", "Shilpa").kids.map((k) => k.name), ["Shyam", "Veeksha"]);
  assert.deepEqual(fam("Krishna", "Rekha").kids.map((k) => k.name), ["Arjun", "Prajith"]);
  assert.deepEqual(fam("Kishore Avengu", "Suneesha").kids.map((k) => k.name), ["Shaarini"]);
  assert.deepEqual(fam("Madhu", "Vijetha").kids.map((k) => k.name), ["Ashritha", "Siddu"]);
  assert.deepEqual(fam("Sateesh", "Thara").kids.map((k) => k.name), ["Apurva", "Vihaan"]);
  assert.deepEqual(fam("Vivek", "Srujana").kids.map((k) => k.name), ["Anvi", "Avyansh"]);
  assert.deepEqual(g.missing.map((m) => m.name), ["Suneesha", "Saritha"]);
  assert.equal(g.families.length, 11);
  assert.deepEqual(g.missingAnniversaries.map((f) => f.people.join(" & ")), ["Suresh & Saritha"]);
  assert.deepEqual(fam("Suresh", "Saritha").kids.map((k) => k.name), ["Maggie", "Misha"]);
  assert.ok(!g.unlinked.some((e) => ["Hasnain", "Zain", "Mahanya", "Meenu", "Ali", "Suneesha"].includes(e.name)));
  assert.deepEqual(g.unlinked.map((e) => e.name),
    []);
  assert.deepEqual(g.orphanKids, []);
});

test("Zainu and Hasnu find Ali & Meenaz's boys", () => {
  const q = (s) => names(R.filterEvents(all(), { query: s }));
  assert.ok(q("Zainu").includes("Zain"));
  assert.ok(q("Hasnu").includes("Hasnain"));
  const zain = all().find((e) => e.id === "birthday-zain");
  assert.equal(R.greetingsFor(zain, all())[0].lang, "ur");
});

test("seed corrections reach every record the user hasn't edited", () => {
  const store = new MemoryStorage();
  const old = all().map((e) => (e.id === "birthday-zain" ? Object.assign({}, e, { community: "telugu", relationship: undefined }) : e))
    .map((e) => (e.id === "birthday-hasnain" ? Object.assign({}, e, { note: "my note" }) : e));
  R.saveEvents(store, old, { seedVersion: 3, editedIds: ["birthday-hasnain"] });
  const r = R.loadEvents(store, seed);
  const zain = r.events.find((e) => e.id === "birthday-zain");
  assert.equal(zain.community, "muslim", "unedited record updated");
  assert.equal(zain.relationship, "Son of Ali and Meenaz");
  assert.equal(r.events.find((e) => e.id === "birthday-hasnain").note, "my note", "edited record kept");
  assert.ok(r.migrated.updated.includes("birthday-zain"));
  assert.ok(!r.migrated.updated.includes("birthday-hasnain"));
  assert.deepEqual(r.editedIds, ["birthday-hasnain"]);
});

test("changedIds spots additions and edits", () => {
  const a = all();
  const b = a.map((e) => (e.id === "birthday-bala" ? Object.assign({}, e, { day: 20 }) : e)).concat([{ id: "birthday-x", type: "birthday", name: "X", month: 1, day: 1, aliases: [], verified: true }]);
  assert.deepEqual(R.changedIds(a, b).sort(), ["birthday-bala", "birthday-x"]);
});

/* ---------- One calendar day for everyone (US Pacific) ---------- */
test("today follows US Pacific time for every viewer", () => {
  // 10:30 AM Nov 20 in India = 9:00 PM Nov 19 in California
  const india = new Date("2026-11-20T05:00:00Z");
  const t = R.todayIn(R.BASE_TIME_ZONE, india);
  assert.deepEqual([t.getFullYear(), t.getMonth() + 1, t.getDate()], [2026, 11, 19]);
  assert.deepEqual(R.names ? [] : R.nextCelebration(all(), t).events.map(R.displayName), ["Kanthi"]);
  // just after midnight in California, Nov 20 begins
  const t2 = R.todayIn(R.BASE_TIME_ZONE, new Date("2026-11-20T08:01:00Z"));
  assert.equal(t2.getDate(), 20);
  // daylight saving: 11 PM PDT on July 4 is still July 4
  const t3 = R.todayIn(R.BASE_TIME_ZONE, new Date("2026-07-05T06:00:00Z"));
  assert.deepEqual([t3.getMonth() + 1, t3.getDate()], [7, 4]);
  // New Year's Eve in California while it's already Jan 1 in India
  const t4 = R.todayIn(R.BASE_TIME_ZONE, new Date("2027-01-01T05:00:00Z"));
  assert.deepEqual([t4.getFullYear(), t4.getMonth() + 1, t4.getDate()], [2026, 12, 31]);
});
