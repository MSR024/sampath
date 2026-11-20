// Tests for this group's own data (src/seed.json) and the founder remembrance.
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

test("every living person has a community, so their greeting and theme work", () => {
  for (const b of all().filter((e) => e.type === "birthday" && !R.isMemorial(e))) {
    assert.ok(R.COMMUNITIES[b.community], b.name + " has no community");
  }
});

test("calendar day follows India time for every viewer", () => {
  assert.equal(R.BASE_TIME_ZONE, site.timeZone);
  assert.equal(site.timeZone, "Asia/Kolkata");
  // 11:00 AM Dec 18 in California is already 12:30 AM Dec 19 in India: Sampath's day has begun.
  const t = R.todayIn(R.BASE_TIME_ZONE, new Date("2026-12-18T19:00:00Z"));
  assert.deepEqual([t.getMonth() + 1, t.getDate()], [12, 19]);
  assert.deepEqual(R.nextCelebration(all(), t).events.map(R.displayName), ["Sampath (Raju)"]);
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

/* ---------- Founder remembrance ---------- */
test("Sampath is remembered, not wished a happy birthday", () => {
  const s = byName("Sampath");
  const m = R.memorialFor(s);
  assert.ok(m && m.isMemorial && m.isGroupFounder);
  assert.equal(R.displayName(s), "Sampath (Raju)");
  assert.deepEqual(R.greetingsFor(s, all()), [], "no birthday greeting");
  assert.deepEqual(R.communitiesOf(s, all()), [], "no festive regional theme");
  assert.equal(m.ageAtPassing, 48);
  assert.ok(!("birthYear" in s), "no year, so no age can be calculated");
  assert.equal(R.isMemorial(byName("Sateesh")), false);
});

test("Sampath stays on Dec 19 and is found by Sampath or Raju", () => {
  const dec = names(R.filterEvents(all(), { month: 12 }));
  assert.ok(dec.includes("Sampath (Raju)"));
  assert.ok(q("Raju").includes("Sampath (Raju)"));
  assert.ok(q("sampath").includes("Sampath (Raju)"));
});

test("Remembrance filter shows only Sampath; Birthdays still includes him", () => {
  assert.deepEqual(names(R.filterEvents(all(), { filter: "remembrance" })), ["Sampath (Raju)"]);
  assert.ok(names(R.filterEvents(all(), { filter: "birthday" })).includes("Sampath (Raju)"));
  assert.ok(!names(R.filterEvents(all(), { filter: "anniversary" })).includes("Sampath (Raju)"));
});

test("remembrance survives an edit (metadata is keyed by id) and export keeps the record", () => {
  const edited = Object.assign({}, byName("Sampath"), { note: "edited" });
  assert.ok(R.isMemorial(R.validateEvent(edited).event));
  const out = R.exportData(all());
  assert.ok(out.birthdays.some((b) => b.id === "birthday-sampath"));
});
