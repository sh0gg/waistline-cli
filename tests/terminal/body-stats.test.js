// The scale fields added by the settings migration, and the day's energy that the statistics work out
// from either the watch's daily total (burned) or its activity plus the scale's resting rate (bmr + active)
global.document = { addEventListener() {} };
global.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
global.dbHandler = {};
global.app = {
  Utils: { normalizeText: (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, ""), convertUnit: (v) => v },
  Settings: { get: () => undefined, getField: () => undefined }, strings: { diary: { "default-meals": {} } }, standardUnits: ["g", "ml"],
  nutrimentUnits: {}, FoodsMealsRecipes: {},
  nutriments: ["calories", "fat"],
  bodyStats: ["weight", "neck", "waist", "hips", "body fat"],
  scaleStats: ["muscle", "water", "bone", "bmr"],
};
const vm = require("vm"), fs = require("fs"), path = require("path");
const load = (f) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../../www/activities", f), "utf8"));
load("settings/js/settings.js");
const settingsApi = app.Settings;
["terminal/js/terminal.js", "terminal/js/terminal-diary.js", "terminal/js/terminal-body.js", "terminal/js/terminal-stats.js"].forEach(load);
const stats = app.TerminalStats, body = app.TerminalBody;

let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };

// ---------------------------------------------------------------------
// Settings migration: the scale fields are added where they are missing
// ---------------------------------------------------------------------
const migrate = (settings) => settingsApi.migrateSettings(settings, false);

// An install from before the change: the original fields plus one of the user's own, and a hidden field
const before = () => ({
  schemaVersion: 9, diary: {}, nutriments: { order: [] },
  bodyStats: { order: ["weight", "neck", "waist", "hips", "body fat", "active"], units: { active: "kcal" } },
  bodyStatsVisibility: { weight: true, "body fat": true, active: true },
});

let s = migrate(before());
eq("adds the scale fields at the end", s.bodyStats.order, ["weight", "neck", "waist", "hips", "body fat", "active", "muscle", "water", "bone", "bmr"]);
eq("shows the ones it added", ["muscle", "water", "bone", "bmr"].map(k => s.bodyStatsVisibility[k]), [true, true, true, true]);
eq("keeps the visibility it found", [s.bodyStatsVisibility.weight, s.bodyStatsVisibility["body fat"], s.bodyStatsVisibility.active, s.bodyStatsVisibility.neck], [true, true, true, undefined]);
eq("moves the schema on", s.schemaVersion, 10);
eq("leaves the user's own units alone", s.bodyStats.units, { active: "kcal" });

// A field the user already has, and hid, stays hidden and is not added twice
const hid = before();
hid.bodyStats.order.push("water");
hid.bodyStatsVisibility.water = false;
s = migrate(hid);
eq("an existing field is not added twice", s.bodyStats.order.filter(k => k === "water").length, 1);
eq("an existing field keeps being hidden", s.bodyStatsVisibility.water, false);
eq("the others are still added", ["muscle", "bone", "bmr"].every(k => s.bodyStats.order.includes(k) && s.bodyStatsVisibility[k] === true), true);

// Nothing stored yet for visibility
const bare = before();
delete bare.bodyStatsVisibility;
s = migrate(bare);
eq("works without stored visibility", s.bodyStatsVisibility, { muscle: true, water: true, bone: true, bmr: true });

// Running it again changes nothing
const again = migrate(JSON.parse(JSON.stringify(s)));
eq("a second run changes nothing", again.bodyStats.order, s.bodyStats.order);

// The scale fields must not be in the list that Goals.getGoalUnit shows in centimetres
eq("scale fields are not tape measurements", app.bodyStats.some(k => app.scaleStats.includes(k)), false);

// ---------------------------------------------------------------------
// spent(): the day's energy
// ---------------------------------------------------------------------
// Fields and readings by name, in kcal. series returns { iso, value } like TerminalBody.series
const setup = (fieldNames, readings) => {
  body.fields = () => fieldNames.map(name => ({ name: name, internalUnit: "kcal", unit: "kcal", visible: true }));
  body.series = async (name) => (readings[name] || []).map(([iso, value]) => ({ iso: iso, value: value }));
  body.toDisplay = (field, value) => value;
};
const run = async () => {
  // Burned wins, and is used as it is
  setup(["weight", "burned", "active", "bmr"], { burned: [["2026-09-01", 2400], ["2026-09-02", 2500]], active: [["2026-09-01", 800]], bmr: [["2026-09-01", 1700]] });
  let r = await stats.spent("2026-09-01", "2026-09-30");
  eq("burned as it is", [r.source, r.points], ["burned", [{ iso: "2026-09-01", value: 2400 }, { iso: "2026-09-02", value: 2500 }]]);

  // Only activity and bmr: their sum, day by day
  setup(["weight", "active", "bmr"], { active: [["2026-09-01", 800], ["2026-09-02", 600], ["2026-09-03", 900]], bmr: [["2026-09-01", 1700], ["2026-09-03", 1710]] });
  r = await stats.spent("2026-09-01", "2026-09-30");
  eq("bmr + active of the same day", [r.source, r.points], ["bmr+active", [{ iso: "2026-09-01", value: 2500 }, { iso: "2026-09-03", value: 2610 }]]);
  eq("a day without bmr is left out, not filled from another day", r.points.some(p => p.iso === "2026-09-02"), false);

  // The range is respected
  r = await stats.spent("2026-09-02", "2026-09-30");
  eq("only days inside the range", r.points.map(p => p.iso), ["2026-09-03"]);

  // Activity but no bmr field
  setup(["weight", "active"], { active: [["2026-09-01", 800]] });
  r = await stats.spent("2026-09-01", "2026-09-30");
  eq("activity without a bmr field", [r.points.length, /field add bmr kcal/.test(r.why)], [0, true]);

  // Both fields, no day with both
  setup(["weight", "active", "bmr"], { active: [["2026-09-01", 800]], bmr: [["2026-09-05", 1700]] });
  r = await stats.spent("2026-09-01", "2026-09-30");
  eq("no day has both", [r.points.length, /no day in this range has both/.test(r.why)], [0, true]);

  // Nothing at all: says how to enter it, both ways
  setup(["weight"], {});
  r = await stats.spent("2026-09-01", "2026-09-30");
  eq("nothing entered", [r.points.length, /field add burned kcal/.test(r.why), /field add active kcal/.test(r.why)], [0, true, true]);
};
run().then(() => { if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed"); });
