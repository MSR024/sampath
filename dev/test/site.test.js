// Tests for this group's own data (src/seed.json) and the founder's featured birthday.
// The shared logic is covered by logic.test.js against the Royal Dr template fixture.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/logic.js");
const seed = require("../src/seed.json");
const site = require("../site.json");

R.setPersonMetadata(seed.personMetadata);
const all = () => R.seedEvents(seed);
const names = (list) => list.map(R.displayName);
const q = (s) => names(R.filterEvents(all(), { query: s }));
const byName = (n) => all().find((e) => e.type === "birthday" && e.name === n);

test("seed loads 44 birthdays and 12 anniversaries, all valid, ids unique", () => {
  assert.equal(seed.birthdays.length, 44);
  assert.equal(seed.anniversaries.length, 12);
  const ids = new Set();
  for (const e of all()) {
    const { event, errors } = R.validateEvent(e);
    assert.deepEqual(errors, [], R.displayName(e));
    assert.ok(event.id && !ids.has(event.id), "unique id " + event.id);
    ids.add(event.id);
  }
  assert.equal(R.seedVersionOf(seed), seed.seedVersion);
});

test("all 12 monthly totals match the seed", () => {
  const expected = { // [birthdays, anniversaries]
    1: [4, 1], 2: [2, 1], 3: [3, 3], 4: [4, 0], 5: [3, 2], 6: [0, 1],
    7: [6, 0], 8: [7, 1], 9: [2, 0], 10: [6, 0], 11: [3, 2], 12: [4, 1],
  };
  for (const m of R.monthSummary(all())) {
    assert.deepEqual([m.birthdays.length, m.anniversaries.length], expected[m.month], m.name);
  }
});

test("every person has a community, so their greeting and theme work", () => {
  for (const b of all().filter((e) => e.type === "birthday")) {
    assert.ok(R.COMMUNITIES[b.community], b.name + " has no community");
  }
});

test("calendar day follows India time for every viewer", () => {
  assert.equal(R.BASE_TIME_ZONE, site.timeZone);
  assert.equal(site.timeZone, "Asia/Kolkata");
  // 11:00 AM Dec 18 in California is already 12:30 AM Dec 19 in India: Sampath Anna's day has begun.
  const t = R.todayIn(R.BASE_TIME_ZONE, new Date("2026-12-18T19:00:00Z"));
  assert.deepEqual([t.getMonth() + 1, t.getDate()], [12, 19]);
  assert.deepEqual(R.nextCelebration(all(), t).events.map(R.displayName), ["Sampath Anna (Raju)"]);
  // 11:59 PM Dec 19 in India rolls to Dec 20 one minute later (6:30 PM UTC)
  assert.equal(R.todayIn(R.BASE_TIME_ZONE, new Date("2026-12-19T18:29:00Z")).getDate(), 19);
  assert.equal(R.todayIn(R.BASE_TIME_ZONE, new Date("2026-12-19T18:31:00Z")).getDate(), 20);
});

test("pet names and loose spellings find the right people", () => {
  assert.ok(q("Smiley").includes("Roshini"));
  assert.ok(q("Monu").includes("Samanvith"));
  assert.ok(q("Chutki").includes("Charvi"));
  assert.ok(q("Sony").includes("Hasini"));
  assert.ok(q("Minnu").includes("Sresta"));
  assert.ok(q("Appu").includes("Apurva"));
  assert.ok(q("Gundu").includes("Satish Reddy"));
  assert.ok(q("Gundu").includes("Satish Reddy & Harika"), "a partner's pet name finds the couple");
  assert.ok(q("Sowji").includes("Shyam & Sowjanya"));
  assert.ok(q("Satya Kiran").includes("Ramana & Sandhya"));
  assert.ok(q("Tara").includes("Thara"));
  const sat = q("Satish");
  assert.ok(sat.includes("Satish Reddy") && sat.includes("Sateesh"), "loose spelling finds both");
});

test("similar names are never merged as duplicates", () => {
  const ev = all();
  const dup = (e) => R.findDuplicate(Object.assign({ month: 1, day: 1, aliases: [] }, e), ev);
  assert.equal(dup({ type: "birthday", name: "Chikki" }).id, "birthday-chikki");
  assert.equal(dup({ type: "birthday", name: "Likki" }).id, "birthday-likky");
  assert.equal(dup({ type: "birthday", name: "Sarita" }), null, "Sarita (Sathyam) is not Saritha (Santosh)");
  assert.equal(dup({ type: "birthday", name: "Satish" }), null, "Satish is not Sateesh or Satish Reddy");
  assert.notEqual(dup({ type: "birthday", name: "Sathish" }).id, "birthday-satish-reddy");
});

test("Sateesh & Thara: kids linked, greeting in both Telugu and Malayalam", () => {
  const g = R.familyGrid(all());
  const fam = g.families.find((f) => f.people.join(" & ") === "Sateesh & Thara");
  assert.deepEqual(fam.kids.map((k) => k.name), ["Apurva", "Vihaan"]);
  assert.ok(fam.partners.every((p) => p.birthday));
  const ann = all().find((e) => e.id === "anniversary-sateesh-thara");
  assert.deepEqual(R.greetingsFor(ann, all()).map((x) => x.lang), ["te", "ml"]);
});

test("Sampath Anna's family: Sridevi and their daughter Roshini", () => {
  const g = R.familyGrid(all());
  const fam = g.families.find((f) => [...f.people].sort().join(" & ") === "Sampath & Sridevi");
  assert.ok(fam, "family exists");
  assert.deepEqual(fam.kids.map((k) => k.name), ["Roshini"]);
  assert.deepEqual(fam.partners.map((p) => p.birthday && p.birthday.id).sort(), ["birthday-sampath", "birthday-sridevi"]);
});

test("family name shows once: a person's own, or for a couple the first partner's", () => {
  const ev = all().map((e) => e.id === "birthday-sateesh" ? Object.assign({}, e, { familyName: "Moola" })
    : e.id === "birthday-thara" ? Object.assign({}, e, { familyName: "Other" }) : e);
  const get = (id) => ev.find((e) => e.id === id);
  assert.equal(R.familyNameOf(get("birthday-sateesh"), ev), "Moola");
  assert.equal(R.familyNameOf(get("anniversary-sateesh-thara"), ev), "Moola", "first partner wins, not repeated");
  assert.equal(R.familyNameOf(Object.assign({}, get("anniversary-sateesh-thara"), { familyName: "Set" }), ev), "Set");
  assert.equal(R.familyNameOf(get("birthday-vihaan"), ev), "", "nothing invented when not given");
  const found = R.filterEvents(ev, { query: "moola" }).map(R.displayName);
  assert.ok(found.includes("Sateesh") && found.includes("Sateesh & Thara"));
  assert.equal(R.validateEvent(Object.assign({}, get("birthday-sateesh"), { familyName: "  " })).event.familyName, undefined);
});

/* ---------- Founder's birthday ---------- */
test("Sampath Anna's birthday is featured: own title, Telugu greeting, no age", () => {
  const s = byName("Sampath");
  const m = R.featuredFor(s);
  assert.ok(m && m.featured && m.isGroupFounder);
  assert.equal(R.displayName(s), "Sampath Anna (Raju)");
  assert.equal(m.dayTitle, "Sampath Anna\u2019s Birthday");
  assert.deepEqual(R.greetingsFor(s, all()).map((g) => g.lang), ["te"]);
  assert.ok(!("birthYear" in s), "no year, so no age can be calculated");
  assert.equal(R.isFeatured(byName("Sateesh")), false);
});

test("Dec 19 shows Sampath Anna, found by Sampath, Raju or Anna", () => {
  assert.deepEqual(names(R.filterEvents(all(), { month: 12 })).filter((n) => n.startsWith("Sampath")), ["Sampath Anna (Raju)"]);
  for (const t of ["Raju", "sampath", "Sampath Anna"]) assert.ok(q(t).includes("Sampath Anna (Raju)"), t);
  assert.ok(names(R.filterEvents(all(), { filter: "birthday" })).includes("Sampath Anna (Raju)"));
});

test("the feature survives an edit (metadata is keyed by id) and export keeps the record", () => {
  const edited = Object.assign({}, byName("Sampath"), { note: "edited" });
  assert.ok(R.isFeatured(R.validateEvent(edited).event));
  assert.ok(R.exportData(all()).birthdays.some((b) => b.id === "birthday-sampath"));
});

test("launch is set for Sampath Anna's birthday, Dec 19 2026", () => {
  assert.equal(site.launchDate, "2026-12-19");
});
