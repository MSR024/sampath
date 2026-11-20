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
  assert.ok(q("Gundu").includes("Satish"));
  assert.ok(q("Gundu").includes("Satish & Harika"), "a partner's pet name finds the couple");
  assert.ok(q("Satish Reddy").includes("Satish"), "old name still finds him");
  assert.ok(q("Sowji").includes("Shyam & Sowjanya"));
  assert.ok(q("Satya Kiran").includes("Ramana & Sandhya"));
  assert.ok(q("Tara").includes("Thara"));
  const sat = q("Satish");
  assert.ok(sat.includes("Satish") && sat.includes("Sateesh"), "loose spelling finds both");
});

test("similar names are never merged as duplicates", () => {
  const ev = all();
  const dup = (e) => R.findDuplicate(Object.assign({ month: 1, day: 1, aliases: [] }, e), ev);
  assert.equal(dup({ type: "birthday", name: "Chikki" }).id, "birthday-chikki");
  assert.equal(dup({ type: "birthday", name: "Likki" }).id, "birthday-likky");
  assert.equal(dup({ type: "birthday", name: "Sarita" }), null, "Sarita (Sathyam) is not Saritha (Santosh)");
  assert.equal(dup({ type: "birthday", name: "Satish" }).id, "birthday-satish-reddy", "Appidi Satish");
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
  const ev = all(), get = (id) => ev.find((e) => e.id === id);
  assert.equal(R.familyNameOf(get("birthday-sateesh"), ev), "Moola");
  assert.equal(R.familyNameOf(get("birthday-sampath"), ev), "Mula");
  assert.equal(R.familyNameOf(get("anniversary-sateesh-thara"), ev), "Moola", "taken once from the husband");
  assert.equal(R.familyNameOf(get("anniversary-venkanna-sunitha"), ev), "Appidi", "couple without birthdays");
  assert.equal(R.familyNameOf(get("anniversary-karthik-bindu"), ev), "", "nothing invented when not given");
  // wives take the husband's, kids the father's
  for (const [id, f] of [["birthday-thara", "Moola"], ["birthday-harika", "Appidi"], ["birthday-sowjanya", "Appidi"], ["birthday-sandhya", "Kosana"],
    ["birthday-saritha", "Mula"], ["birthday-apurva", "Moola"], ["birthday-vihaan", "Moola"], ["birthday-roshini", "Mula"], ["birthday-sridevi", "Mula"]])
    assert.equal(R.familyNameOf(get(id), ev), f, id);
  assert.equal(R.displayName(get("anniversary-satish-reddy-harika")), "Satish & Harika");
  const found = R.filterEvents(ev, { query: "appidi" }).map(R.displayName);
  for (const n of ["Harika", "Sowjanya", "Satish", "Satish & Harika", "Venkanna & Sunitha", "Sandeep & Swetha", "Shyam & Sowjanya"]) assert.ok(found.includes(n), n);
  assert.equal(R.validateEvent(Object.assign({}, get("birthday-sateesh"), { familyName: "  " })).event.familyName, undefined);
});

test("kids linked to their parents take the father's family name", () => {
  const g = R.familyGrid(all());
  const kids = (a, b) => g.families.find((f) => [...f.people].sort().join("|") === [a, b].sort().join("|")).kids.map((k) => k.name);
  assert.deepEqual(kids("Santosh", "Saritha"), ["Lucky"]);
  assert.deepEqual(kids("Srikanth", "Kavitha"), ["Cherry", "Trishool"]);
  assert.deepEqual(kids("Sravan", "Ashwini"), ["Mintu"]);
  assert.deepEqual(kids("Sathyam", "Sarita"), ["Hasini", "Honey"]);
  assert.deepEqual(kids("Ramana", "Sandhya"), ["Samanvith"]);
  assert.deepEqual(kids("Karthik", "Bindu"), ["Minshu", "Sresta"]);
  assert.deepEqual(kids("Shyam", "Sowjanya"), ["Charvi", "Varnika"]);
  assert.deepEqual(kids("Satish", "Harika"), ["Ananya", "Likila"]);
  assert.deepEqual(kids("Venkanna", "Sunitha"), ["Vaishnavi", "Vardhan"]);
  assert.deepEqual(kids("Sandeep", "Swetha"), ["Roshan"]);
  assert.deepEqual(kids("Linganna", "Srilatha"), ["Anu", "Ashu"]);
  const ev = all();
  assert.equal(R.familyNameOf(ev.find((e) => e.id === "birthday-lucky"), ev), "Mula");
  assert.equal(R.familyNameOf(ev.find((e) => e.id === "birthday-samanvith"), ev), "Kosana");
  for (const id of ["birthday-varnika", "birthday-charvi", "birthday-chikki", "birthday-likky", "birthday-vardhan", "birthday-vaishnavi", "birthday-roshan"])
    assert.equal(R.familyNameOf(ev.find((e) => e.id === id), ev), "Appidi", id);
  assert.ok(q("Chikki").includes("Ananya") && q("Likky").includes("Likila"), "pet names still find the twins");
  assert.equal(R.familyNameOf(ev.find((e) => e.id === "birthday-honey"), ev), "Manda", "father has no birthday record: couple's name");
  assert.equal(R.familyNameOf(ev.find((e) => e.id === "anniversary-sathyam-sarita"), ev), "Manda");
  assert.ok(R.filterEvents(ev, { query: "Satyam" }).map(R.displayName).includes("Sathyam & Sarita"));
  assert.equal(R.familyNameOf(ev.find((e) => e.id === "birthday-cherry"), ev), "", "Srikanth's family name not given yet");
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
