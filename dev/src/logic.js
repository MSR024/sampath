/* Family celebrations site — pure logic (no DOM). Works in the browser (window.RGC) and in Node (module.exports). */
(function (root) {
  "use strict";

  // Group-specific settings (name, time zone, storage key) live in dev/site.json.
  // build.js inlines them as window.RGC_SITE; Node (tests) reads the file directly.
  const SITE = root.RGC_SITE || (typeof require === "function" ? require("../site.json") : {});
  const STORAGE_KEY = SITE.storageKey || "family-celebrations:v1";
  const SCHEMA_VERSION = 1;
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb 29 allowed (birth year unknown)

  // Communities of the group, with their home region and native-script greetings.
  const COMMUNITIES = {
    telugu: { label: "Telugu", region: "Andhra Pradesh & Telangana", lang: "te", dir: "ltr",
      birthday: ["పుట్టినరోజు శుభాకాంక్షలు", "Puttinaroju Shubhakankshalu"],
      anniversary: ["పెళ్లిరోజు శుభాకాంక్షలు", "Pelliroju Shubhakankshalu"] },
    tamil: { label: "Tamil", region: "Tamil Nadu", lang: "ta", dir: "ltr",
      birthday: ["இனிய பிறந்தநாள் வாழ்த்துகள்", "Iniya Piranthanaal Vaazhthukal"],
      anniversary: ["இனிய திருமண நாள் வாழ்த்துகள்", "Iniya Thirumana Naal Vaazhthukal"] },
    "tamil-sourashtra": { label: "Tamil & Sourashtra", region: "Tamil Nadu", lang: "ta", dir: "ltr",
      birthday: ["இனிய பிறந்தநாள் வாழ்த்துகள்", "Iniya Piranthanaal Vaazhthukal"],
      anniversary: ["இனிய திருமண நாள் வாழ்த்துகள்", "Iniya Thirumana Naal Vaazhthukal"] },
    malayali: { label: "Malayali", region: "Kerala", lang: "ml", dir: "ltr",
      birthday: ["ജന്മദിനാശംസകൾ", "Janmadinashamsakal"],
      anniversary: ["വിവാഹ വാർഷികാശംസകൾ", "Vivaha Varshikashamsakal"] },
    muslim: { label: "Muslim", region: "", lang: "ur", dir: "rtl",
      birthday: ["سالگرہ مبارک", "Saalgirah Mubarak"],
      anniversary: ["شادی کی سالگرہ مبارک", "Shaadi ki Saalgirah Mubarak"] },
  };

  /* ---------- Person metadata (featured people) ---------- */
  // Extra facts about a person that aren't part of the event itself, keyed by the birthday's id,
  // e.g. the group's founder: { personId, featured, displayName, dayTitle, badge, subtitle, daySlogan }.
  let PERSON_META = new Map();
  function setPersonMetadata(list) {
    PERSON_META = new Map((Array.isArray(list) ? list : []).filter((m) => m && m.personId).map((m) => [String(m.personId), m]));
  }
  function personMeta(ev) {
    return (ev && ev.type === "birthday" && PERSON_META.get(ev.id)) || null;
  }
  // A featured birthday (the founder's) is highlighted all year and gets its own title on the day.
  function featuredFor(ev) {
    const m = personMeta(ev);
    return m && m.featured ? m : null;
  }
  const isFeatured = (ev) => !!featuredFor(ev);

  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  // Loose "sounds-like" key for search only (never for duplicate detection):
  // Sateesh/Satheesh/Satish, Tara/Thara, Apurva/Apoorva, Venky/Venki, Eshan/Eshaan all collapse together.
  function phon(s) {
    return norm(s).replace(/[^a-z ]/g, "")
      .replace(/ee/g, "i").replace(/oo/g, "u").replace(/aa/g, "a")
      .replace(/([bcdgjkpstz])h/g, "$1").replace(/y\b/g, "i")
      .replace(/(.)\1+/g, "$1");
  }

  /* ---------- Naming ---------- */
  function displayName(ev) {
    if (ev.type === "anniversary") return ev.people.join(" & ");
    const m = featuredFor(ev);
    return (m && m.displayName) || ev.name;
  }
  // Family name (surname) shown once before the name, Telugu style. Stored on the husband/father; a wife takes
  // her husband's (she is the second partner of an anniversary), a child takes the father's
  // (first of "parents"), and a couple shows it once (anniversary's own, else the husband's).
  function familyNameOf(ev, events) {
    if (ev.familyName) return ev.familyName;
    if (!events) return "";
    const idx = buildAliasIndex(events);
    const person = (name) => { const c = canonicalPerson(name, idx); return events.find((e) => e.type === "birthday" && norm(e.name) === c); };
    const own = (name) => { const p = person(name); return (p && p.familyName) || ""; };
    if (ev.type === "anniversary") return own(ev.people[0]) || own(ev.people[1]);
    if (Array.isArray(ev.parents) && ev.parents.length) { const f = own(ev.parents[0]); if (f) return f; }
    const me = canonicalPerson(ev.name, idx);
    for (const a of events) {
      if (a.type !== "anniversary" || canonicalPerson(a.people[1], idx) !== me) continue;
      const f = a.familyName || own(a.people[0]);
      if (f) return f;
    }
    return "";
  }
  function formatDayMonth(month, day) {
    return MONTHS[month - 1] + " " + day;
  }

  /* ---------- Sorting & grouping ---------- */
  function compareEvents(a, b) {
    return a.month - b.month || a.day - b.day ||
      (a.type === b.type ? 0 : a.type === "birthday" ? -1 : 1) ||
      displayName(a).localeCompare(displayName(b));
  }
  function sortEvents(events) {
    return events.slice().sort(compareEvents);
  }
  function groupByDate(events) {
    const groups = [];
    for (const ev of sortEvents(events)) {
      const last = groups[groups.length - 1];
      if (last && last.month === ev.month && last.day === ev.day) last.events.push(ev);
      else groups.push({ month: ev.month, day: ev.day, events: [ev] });
    }
    return groups;
  }
  function eventsInMonth(events, month) {
    return sortEvents(events.filter((e) => e.month === month));
  }
  function monthSummary(events) {
    return MONTHS.map((name, i) => {
      const list = eventsInMonth(events, i + 1);
      return {
        month: i + 1, name, total: list.length,
        birthdays: list.filter((e) => e.type === "birthday"),
        anniversaries: list.filter((e) => e.type === "anniversary"),
      };
    });
  }

  /* ---------- Dates ---------- */
  // The group's calendar day follows one time zone (site.json "timeZone") for every viewer, so
  // family in India and the US see a celebration on the same day. Returns a local Date
  // at midnight carrying that zone's year, month and day.
  const BASE_TIME_ZONE = SITE.timeZone || "America/Los_Angeles";
  function todayIn(timeZone, now) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || BASE_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(now || new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    return new Date(get("year"), get("month") - 1, get("day"));
  }
  function currentMonth(today) {
    return (today || new Date()).getMonth() + 1;
  }
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  // Date of this event in a given year (Feb 29 is observed on Feb 28 in non-leap years).
  function occurrenceIn(ev, year) {
    const day = ev.month === 2 && ev.day === 29 && !isLeap(year) ? 28 : ev.day;
    return new Date(year, ev.month - 1, day);
  }
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  // Whole days until the next occurrence (0 = today). Rolls into next year (Dec → Jan).
  function daysUntil(ev, today) {
    const t = startOfDay(today || new Date());
    let next = occurrenceIn(ev, t.getFullYear());
    if (next < t) next = occurrenceIn(ev, t.getFullYear() + 1);
    return Math.round((next - t) / 86400000);
  }
  function relativeLabel(days) {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return "In " + days + " days";
  }
  // All events sharing the soonest upcoming date (today included).
  function nextCelebration(events, today) {
    if (!events.length) return null;
    let best = Infinity, list = [];
    for (const ev of events) {
      const d = daysUntil(ev, today);
      if (d < best) { best = d; list = [ev]; }
      else if (d === best) list.push(ev);
    }
    return { days: best, events: sortEvents(list) };
  }
  // Soonest date strictly after today (used when today already has celebrations).
  function nextAfterToday(events, today) {
    const future = events.filter((e) => daysUntil(e, today) > 0);
    return nextCelebration(future, today);
  }
  function upcoming(events, today, limit) {
    return events.map((ev) => ({ ev, days: daysUntil(ev, today) }))
      .sort((a, b) => a.days - b.days || compareEvents(a.ev, b.ev))
      .slice(0, limit || events.length);
  }

  /* ---------- Search & filters ---------- */
  // Map each person's canonical name to their known aliases (taken from birthday records).
  function buildAliasIndex(events) {
    const idx = new Map();
    for (const ev of events) {
      if (ev.type !== "birthday") continue;
      const key = norm(ev.name);
      const set = idx.get(key) || new Set([key]);
      (ev.aliases || []).forEach((a) => set.add(norm(a)));
      idx.set(key, set);
    }
    return idx;
  }
  // Community keys for an event: a birthday's own tag; an anniversary takes each partner's tag.
  function communitiesOf(ev, events) {
    if (ev.type === "birthday") return COMMUNITIES[ev.community] ? [ev.community] : [];
    if (ev.community && COMMUNITIES[ev.community]) return [ev.community];
    const idx = buildAliasIndex(events || []);
    const out = [];
    for (const p of ev.people) {
      const canon = canonicalPerson(p, idx);
      const person = (events || []).find((e) => e.type === "birthday" && norm(e.name) === canon);
      if (person && COMMUNITIES[person.community] && !out.includes(person.community)) out.push(person.community);
    }
    return out;
  }
  // Native-script greetings for an event, de-duplicated (Tamil and Tamil & Sourashtra share one).
  function greetingsFor(ev, events) {
    const seen = new Set(), out = [];
    for (const key of communitiesOf(ev, events)) {
      const c = COMMUNITIES[key], [text, roman] = c[ev.type];
      if (seen.has(text)) continue;
      seen.add(text);
      out.push({ community: key, label: c.label, lang: c.lang, dir: c.dir, text, roman });
    }
    return out;
  }
  function wishText(ev, events) {
    const english = (ev.type === "birthday" ? "Happy Birthday, " : "Happy Wedding Anniversary, ") + displayName(ev) + "!";
    return [english, ...greetingsFor(ev, events).map((g) => g.text + "!")].join("\n");
  }

  function searchTerms(ev, aliasIndex) {
    const terms = [norm(displayName(ev)), ...(ev.aliases || []).map(norm)];
    if (ev.familyName) terms.push(norm(ev.familyName));
    if (ev._familyName) terms.push(norm(ev._familyName));
    for (const key of ev._communities || (ev.community ? [ev.community] : [])) {
      const c = COMMUNITIES[key];
      if (c) terms.push(norm(c.label), norm(c.region));
    }
    if (ev.type === "anniversary") {
      for (const p of ev.people) {
        terms.push(norm(p));
        const set = aliasIndex && aliasIndex.get(norm(p));
        if (set) set.forEach((a) => terms.push(a));
      }
    }
    return terms;
  }
  function termMatches(term, q) {
    if (term.includes(q)) return true;
    const pq = phon(q);
    return pq.length >= 3 && phon(term).includes(pq);
  }
  function matchesQuery(ev, query, aliasIndex) {
    const q = norm(query);
    if (!q) return true;
    return searchTerms(ev, aliasIndex).some((t) => termMatches(t, q));
  }
  function matchesType(ev, filter) {
    if (filter === "birthday") return ev.type === "birthday";
    if (filter === "anniversary") return ev.type === "anniversary";
    if (filter === "unverified") return !ev.verified;
    return true;
  }
  function filterEvents(events, opts) {
    const o = opts || {};
    const aliasIndex = buildAliasIndex(events);
    const q = norm(o.query);
    return sortEvents(events.filter((ev) =>
      matchesType(ev, o.filter || "all") &&
      (o.month == null || ev.month === o.month) &&
      (!q || matchesQuery(Object.assign({}, ev, { _familyName: familyNameOf(ev, events) },
        ev.type === "anniversary" ? { _communities: communitiesOf(ev, events) } : {}), q, aliasIndex))));
  }
  // Which alias matched (to show "matched Buddy"), or null when the canonical name matched.
  function matchedAlias(ev, query, events) {
    const q = norm(query);
    if (!q || norm(displayName(ev)).includes(q)) return null;
    const exact = (ev.aliases || []).find((a) => norm(a).includes(q));
    if (exact) return exact;
    if (termMatches(norm(displayName(ev)), q)) return null;
    const own = (ev.aliases || []).find((a) => termMatches(norm(a), q));
    if (own) return own;
    if (ev.type === "anniversary" && events) { // a partner's personal nickname, e.g. "Buddy"
      for (const p of ev.people) {
        const person = events.find((e) => e.type === "birthday" && norm(e.name) === norm(p));
        const hit = person && (person.aliases || []).find((a) => termMatches(norm(a), q));
        if (hit) return hit;
      }
    }
    return null;
  }

  /* ---------- Validation ---------- */
  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
  }
  function makeId(ev, existingIds) {
    const base = ev.type + "-" + slug(ev.type === "anniversary" ? ev.people.join(" ") : ev.name);
    let id = base, n = 2;
    while (existingIds && existingIds.has(id)) id = base + "-" + n++;
    return id;
  }
  function cleanList(v) {
    const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
    const seen = new Set();
    return arr.map((s) => String(s).trim()).filter((s) => s && !seen.has(norm(s)) && seen.add(norm(s)));
  }
  // Returns { event, errors }. Unknown extra fields (birthYear, photo, reminder…) are preserved.
  function validateEvent(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object") return { event: null, errors: ["Record is not an object."] };
    const ev = Object.assign({}, raw);
    ev.month = Number(ev.month);
    ev.day = Number(ev.day);
    ev.aliases = cleanList(ev.aliases);
    ev.verified = ev.verified === true || ev.verified === "true";
    if (ev.type === "birthday") {
      ev.name = String(ev.name || "").trim();
      if (!ev.name) errors.push("Name is required.");
      delete ev.people;
    } else if (ev.type === "anniversary") {
      const p = Array.isArray(ev.people) ? ev.people.map((s) => String(s || "").trim()) : [];
      if (p.length !== 2 || !p[0] || !p[1]) errors.push("Both partners' names are required.");
      ev.people = [p[0] || "", p[1] || ""];
      delete ev.name;
    } else {
      errors.push('Type must be "birthday" or "anniversary".');
    }
    if (!Number.isInteger(ev.month) || ev.month < 1 || ev.month > 12) errors.push("Month must be 1–12.");
    else if (!Number.isInteger(ev.day) || ev.day < 1 || ev.day > DAYS_IN_MONTH[ev.month - 1])
      errors.push("Day must be between 1 and " + DAYS_IN_MONTH[ev.month - 1] + " for " + MONTHS[ev.month - 1] + ".");
    if (ev.community != null && !COMMUNITIES[ev.community]) delete ev.community;
    for (const k of ["relationship", "note", "familyName"]) {
      if (ev[k] == null || String(ev[k]).trim() === "") delete ev[k];
      else ev[k] = String(ev[k]).trim();
    }
    if (ev.id != null) ev.id = String(ev.id);
    return { event: errors.length ? null : ev, errors };
  }

  /* ---------- Duplicate detection ---------- */
  // Identity keys for a person: canonical name plus aliases. Never fuzzy — "Meenu" ≠ "Meenaz", "Kishore Avengu" ≠ "Kishore Koneti".
  function personKeys(name, aliasIndex) {
    const k = norm(name);
    const keys = new Set([k]);
    if (aliasIndex) {
      if (aliasIndex.has(k)) aliasIndex.get(k).forEach((a) => keys.add(a));
      else for (const [canon, set] of aliasIndex) if (set.has(k)) { set.forEach((a) => keys.add(a)); keys.add(canon); }
    }
    return keys;
  }
  const overlaps = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };
  function canonicalPerson(name, aliasIndex) {
    const k = norm(name);
    if (!aliasIndex || aliasIndex.has(k)) return k;
    for (const [canon, set] of aliasIndex) if (set.has(k)) return canon;
    return k;
  }
  function isDuplicate(a, b, aliasIndex) {
    if (a.type !== b.type) return false;
    if (a.id && b.id && a.id === b.id) return true;
    if (a.type === "birthday") {
      const ka = new Set([norm(a.name), ...(a.aliases || []).map(norm)]);
      const kb = new Set([norm(b.name), ...(b.aliases || []).map(norm)]);
      return overlaps(personKeys(a.name, aliasIndex), kb) || overlaps(ka, personKeys(b.name, aliasIndex)) || norm(a.name) === norm(b.name);
    }
    const pa = a.people.map((p) => canonicalPerson(p, aliasIndex)).sort().join("|");
    const pb = b.people.map((p) => canonicalPerson(p, aliasIndex)).sort().join("|");
    return pa === pb;
  }
  function findDuplicate(ev, events, ignoreId) {
    const idx = buildAliasIndex(events);
    return events.find((e) => e.id !== ignoreId && isDuplicate(ev, e, idx)) || null;
  }
  // Merge an incoming record into an existing one without losing anything.
  function mergeEvents(existing, incoming) {
    const out = Object.assign({}, incoming, existing);
    const extraNames = existing.type === "birthday" && norm(incoming.name) !== norm(existing.name) ? [incoming.name] : [];
    out.aliases = cleanList([...(existing.aliases || []), ...extraNames, ...(incoming.aliases || [])]);
    const sameDate = existing.month === incoming.month && existing.day === incoming.day;
    if (!sameDate && incoming.verified && !existing.verified) {
      out.month = incoming.month; out.day = incoming.day; out.verified = true;
      out.note = joinNotes(existing.note, "Date updated from import (was " + formatDayMonth(existing.month, existing.day) + ").");
    } else {
      out.verified = existing.verified || (sameDate && incoming.verified);
      if (!sameDate) out.note = joinNotes(existing.note, "Imported record listed " + formatDayMonth(incoming.month, incoming.day) + ".");
    }
    if (!out.relationship && incoming.relationship) out.relationship = incoming.relationship;
    if (incoming.note && incoming.note !== existing.note) out.note = joinNotes(out.note, incoming.note);
    out.id = existing.id;
    return out;
  }
  function joinNotes(a, b) {
    if (!a) return b; if (!b || a.includes(b)) return a; return a + " " + b;
  }

  /* ---------- Import / export ---------- */
  function exportData(events, now) {
    const s = sortEvents(events);
    return {
      app: SITE.name || "Family Celebrations", schemaVersion: SCHEMA_VERSION,
      exportedAt: (now || new Date()).toISOString(),
      birthdays: s.filter((e) => e.type === "birthday"),
      anniversaries: s.filter((e) => e.type === "anniversary"),
    };
  }
  function exportJSON(events, now) {
    return JSON.stringify(exportData(events, now), null, 2);
  }
  // Accepts {birthdays, anniversaries}, {events: [...]}, or a bare array.
  function parseImport(text) {
    let data;
    try { data = typeof text === "string" ? JSON.parse(text) : text; }
    catch (e) { return { events: [], errors: ["This isn't valid JSON: " + e.message] }; }
    let raw;
    if (Array.isArray(data)) raw = data;
    else if (data && Array.isArray(data.events)) raw = data.events;
    else if (data && (Array.isArray(data.birthdays) || Array.isArray(data.anniversaries))) {
      raw = [...(data.birthdays || []).map((b) => Object.assign({ type: "birthday" }, b)),
             ...(data.anniversaries || []).map((a) => Object.assign({ type: "anniversary" }, a))];
    } else return { events: [], errors: ["No birthdays or anniversaries found in this file."] };
    const events = [], errors = [];
    raw.forEach((r, i) => {
      const { event, errors: errs } = validateEvent(r);
      if (event) events.push(event);
      else errors.push("Record " + (i + 1) + (r && (r.name || r.people) ? " (" + (r.name || [].concat(r.people).join(" & ")) + ")" : "") + ": " + errs.join(" "));
    });
    return { events, errors };
  }
  // Split imported events into new records and possible duplicates of existing ones.
  function planImport(existing, incoming) {
    const plan = { fresh: [], duplicates: [], identical: [] };
    const pool = existing.slice();
    for (const ev of incoming) {
      const dup = findDuplicate(ev, pool);
      if (!dup) { plan.fresh.push(ev); pool.push(ev); continue; }
      if (sameContent(dup, ev)) plan.identical.push(ev);
      else plan.duplicates.push({ incoming: ev, existing: dup });
    }
    return plan;
  }
  function sameContent(a, b) {
    const strip = (e) => JSON.stringify(Object.keys(e).filter((k) => k !== "id").sort().map((k) => [k, e[k]]));
    return strip(a) === strip(b);
  }
  // decisions: { [incomingIndex]: "merge" | "both" | "skip" }
  function applyImport(existing, plan, decisions) {
    let out = existing.slice();
    const ids = new Set(out.map((e) => e.id));
    const add = (ev) => {
      const e = Object.assign({}, ev);
      if (!e.id || ids.has(e.id)) e.id = makeId(e, ids);
      ids.add(e.id); out.push(e);
    };
    plan.fresh.forEach(add);
    plan.duplicates.forEach((d, i) => {
      const choice = (decisions && decisions[i]) || "skip";
      if (choice === "merge") out = out.map((e) => (e.id === d.existing.id ? mergeEvents(e, d.incoming) : e));
      else if (choice === "both") add(d.incoming);
    });
    return sortEvents(out);
  }

  /* ---------- Storage (seed stays read-only; user copy lives under its own key) ---------- */
  function seedEvents(seed) {
    return sortEvents([...(seed.birthdays || []).map((b) => Object.assign({ type: "birthday" }, b)),
                       ...(seed.anniversaries || []).map((a) => Object.assign({ type: "anniversary" }, a))]
      .map((e) => JSON.parse(JSON.stringify(e))));
  }
  const seedVersionOf = (seed) => Number(seed && seed.seedVersion) || 1;

  // Add seed events missing from local data. Never touches existing records (user edits win).
  // Seed events the user deliberately deleted stay deleted unless includeDeleted is set.
  function mergeSeed(events, seed, opts) {
    const o = opts || {};
    const deleted = new Set(o.includeDeleted ? [] : o.deletedSeedIds || []);
    const seedById = new Map(seedEvents(seed).map((s) => [s.id, s]));
    const filled = [], updated = [];
    // When we know which records the user changed (editedIds), every other seed record takes the
    // latest seed version, so corrections reach everyone. Without that list (older saves) we only
    // fill in fields a record lacks. Either way, nothing the user edited is overwritten.
    const edited = Array.isArray(o.editedIds) ? new Set(o.editedIds) : null;
    const out = events.map((e) => {
      const s = seedById.get(e.id);
      if (!s) return e;
      if (edited && !edited.has(e.id)) {
        if (sameContent(e, s)) return e;
        updated.push(e.id);
        return s;
      }
      const missing = Object.keys(s).filter((k) => !(k in e));
      if (!missing.length) return e;
      filled.push(e.id);
      const copy = Object.assign({}, e);
      for (const k of missing) copy[k] = s[k];
      return copy;
    });
    const ids = new Set(out.map((e) => e.id));
    const added = [];
    for (const s of seedById.values()) {
      if (ids.has(s.id) || deleted.has(s.id)) continue;
      if (findDuplicate(s, out)) continue; // same person already entered by hand
      out.push(s); ids.add(s.id); added.push(s);
    }
    return { events: sortEvents(out), added, filled, updated };
  }

  // Returns { events, source, savedAt, deletedSeedIds, migrated?, error? }.
  // Saved data from an older (or unversioned) seed is migrated by merging in new seed events.
  function loadEvents(storage, seed) {
    const fresh = { events: seedEvents(seed), source: "seed", deletedSeedIds: [] };
    let data;
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      data = JSON.parse(raw);
    } catch (e) {
      return Object.assign(fresh, { error: "Saved changes couldn't be read, so the original list is shown." });
    }
    if (!data || !Array.isArray(data.events)) return Object.assign(fresh, { error: "Saved changes were in an unknown format, so the original list is shown." });
    const valid = [];
    for (const e of data.events) { const v = validateEvent(e); if (v.event && v.event.id) valid.push(v.event); }
    const deletedSeedIds = Array.isArray(data.deletedSeedIds) ? data.deletedSeedIds : [];
    const editedIds = Array.isArray(data.editedIds) ? data.editedIds : undefined;
    const result = { events: sortEvents(valid), source: "saved", savedAt: data.savedAt, deletedSeedIds, editedIds: editedIds || [] };
    if (Number(data.seedVersion) !== seedVersionOf(seed)) {
      const m = mergeSeed(valid, seed, { deletedSeedIds, editedIds });
      result.events = m.events;
      result.migrated = { from: data.seedVersion || null, to: seedVersionOf(seed), added: m.added, filled: m.filled, updated: m.updated };
    }
    return result;
  }
  function saveEvents(storage, events, opts) {
    const o = opts instanceof Date ? { now: opts } : opts || {};
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: SCHEMA_VERSION, seedVersion: o.seedVersion || null,
        savedAt: (o.now || new Date()).toISOString(),
        deletedSeedIds: o.deletedSeedIds || [], ...(Array.isArray(o.editedIds) ? { editedIds: o.editedIds } : {}), events: sortEvents(events),
      }));
      return true;
    } catch (e) { return false; }
  }
  function restoreSeed(storage, seed) {
    try { storage && storage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    return seedEvents(seed);
  }
  function changedIds(before, after) {
    const prev = new Map(before.map((e) => [e.id, e]));
    return after.filter((e) => !prev.has(e.id) || !sameContent(prev.get(e.id), e)).map((e) => e.id);
  }

  // Family grid: each couple (from anniversaries) with both partners' birthday records and their kids.
  function familyGrid(events) {
    const idx = buildAliasIndex(events);
    const byCanon = new Map(events.filter((e) => e.type === "birthday").map((e) => [norm(e.name), e]));
    const key = (names) => names.map((n) => canonicalPerson(n, idx)).sort().join("|");
    const families = sortEvents(events.filter((e) => e.type === "anniversary")).map((a) => ({
      anniversary: a, key: key(a.people),
      partners: a.people.map((p) => ({ name: p, birthday: byCanon.get(canonicalPerson(p, idx)) || null })),
      kids: [],
    }));
    const famByKey = new Map(families.map((f) => [f.key, f]));
    const birthdays = sortEvents(events.filter((x) => x.type === "birthday"));
    // Parents named on a child but with no anniversary yet still form a family (anniversary: null).
    for (const e of birthdays) {
      if (!Array.isArray(e.parents) || e.parents.length !== 2) continue;
      const k = key(e.parents);
      if (famByKey.has(k)) continue;
      const f = { anniversary: null, people: e.parents.slice(), key: k,
        partners: e.parents.map((p) => ({ name: p, birthday: byCanon.get(canonicalPerson(p, idx)) || null })), kids: [] };
      families.push(f); famByKey.set(k, f);
    }
    for (const f of families) if (!f.people) f.people = f.anniversary.people.slice();
    const inCouple = new Set(families.flatMap((f) => f.partners.map((p) => canonicalPerson(p.name, idx))));
    const unlinked = [], orphanKids = [];
    for (const e of birthdays) {
      if (Array.isArray(e.parents) && e.parents.length) {
        const f = famByKey.get(key(e.parents));
        if (f) f.kids.push(e); else orphanKids.push(e);
      } else if (!inCouple.has(norm(e.name))) unlinked.push(e);
    }
    for (const f of families) f.kids.sort((x, y) => displayName(x).localeCompare(displayName(y)));
    const missing = families.flatMap((f) => f.partners.filter((p) => !p.birthday).map((p) => ({ name: p.name, family: f })));
    const missingAnniversaries = families.filter((f) => !f.anniversary);
    return { families, unlinked, orphanKids, missing, missingAnniversaries };
  }

  // Same collection the screen shows, counted once.
  function summarize(list) {
    const birthdays = list.filter((e) => e.type === "birthday").length;
    return { total: list.length, birthdays, anniversaries: list.length - birthdays };
  }
  function counts(events) {
    const verified = events.filter((e) => e.verified).length;
    return { total: events.length, verified, unverified: events.length - verified,
      birthdays: events.filter((e) => e.type === "birthday").length,
      anniversaries: events.filter((e) => e.type === "anniversary").length };
  }

  const api = {
    SITE, setPersonMetadata, personMeta, featuredFor, isFeatured,
    phon, COMMUNITIES, communitiesOf, greetingsFor, wishText,
    STORAGE_KEY, SCHEMA_VERSION, MONTHS, DAYS_IN_MONTH, norm,
    displayName, familyNameOf, formatDayMonth, compareEvents, sortEvents, groupByDate, eventsInMonth, monthSummary,
    BASE_TIME_ZONE, todayIn, currentMonth, daysUntil, relativeLabel, nextCelebration, nextAfterToday, upcoming,
    buildAliasIndex, matchesQuery, filterEvents, matchedAlias,
    validateEvent, makeId, isDuplicate, findDuplicate, mergeEvents,
    exportData, exportJSON, parseImport, planImport, applyImport,
    changedIds, familyGrid,
    seedEvents, seedVersionOf, mergeSeed, loadEvents, saveEvents, restoreSeed, counts, summarize,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RGC = api;
})(typeof window !== "undefined" ? window : globalThis);
