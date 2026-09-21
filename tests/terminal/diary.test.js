global.document = { addEventListener() {} };
global.window = { localStorage: { getItem: () => null, setItem() {} } };
global.app = {
  Utils: { normalizeText: (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") },
  Settings: { get: (a, b) => (b === "meal-names" ? ["Breakfast", "Lunch", "Dinner", "Snacks", "", "", ""] : undefined) },
  strings: { diary: { "default-meals": {} } },
  standardUnits: ["g", "ml"],
};
const vm = require("vm"), fs = require("fs");
const load = (f) => vm.runInThisContext(fs.readFileSync(require("path").join(__dirname, "../../www/activities/terminal/js", f), "utf8"));
load("terminal.js"); load("terminal-diary.js");
const d = app.TerminalDiary, t = app.Terminal;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };
const P = (s) => { const r = d.parseAmount(t.tokenize(s)); return { a: r.amount && [r.amount.value, r.amount.unit || null, r.amount.times], rest: r.rest.join(" ") }; };

eq("num int", d.parseNumber("60"), 60);
eq("num comma", d.parseNumber("0,5"), 0.5);
eq("num frac", d.parseNumber("1/4"), 0.25);
eq("num bad", isNaN(d.parseNumber("abc")), true);
eq("amt 60g", P("oats 60g"), { a: [60, "g", false], rest: "oats" });
eq("amt 0.5", P("apple 0.5"), { a: [0.5, null, true], rest: "apple" });
eq("amt 2x", P("eggs boiled 2x"), { a: [2, null, true], rest: "eggs boiled" });
eq("amt 1/2", P("pizza 1/2"), { a: [0.5, null, true], rest: "pizza" });
eq("amt 2 slices", P("rye bread 2 slices"), { a: [2, "slices", false], rest: "rye bread" });
eq("amt none", P("chicken breast"), { a: undefined, rest: "chicken breast" });
eq("amt 1.5kg", P("rice 1.5kg"), { a: [1.5, "kg", false], rest: "rice" });
eq("amt 200 ml sep", P("milk 200 ml"), { a: [200, "ml", false], rest: "milk" });

const oats = { name: "oats", portion: 100, unit: "g" }, bread = { name: "rye bread", portion: 1, unit: "slice" }, banana = { name: "banana", portion: 1 };
const A = (food, s) => d.toItemAmount(food, d.parseAmount(t.tokenize(s)).amount);
eq("oats 60g", A(oats, "60g"), { portion: 60, quantity: 1 });
eq("oats no amount", A(oats, ""), { portion: 100, quantity: 1 });
eq("oats 0.5", A(oats, "0.5"), { portion: 100, quantity: 0.5 });
eq("oats 1kg", A(oats, "1kg"), { portion: 1000, quantity: 1 });
eq("oats 2 slices err", !!A(oats, "2 slices").error, true);
eq("bread 2 slices", A(bread, "2 slices"), { portion: 2, quantity: 1 });
eq("bread 2x", A(bread, "2x"), { portion: 1, quantity: 2 });
eq("banana 3", A(banana, "3"), { portion: 1, quantity: 3 });

const T = (s) => d.splitTags(t.tokenize(s));
eq("tag time", T("oats @8:05").time, "08:05");
eq("tag bad time", !!T("oats @25:00").error, true);
eq("tag date", T("oats @2026-09-18").date, "2026-09-18");
eq("tag bad date", !!T("oats @2026-02-30").error, true);
eq("tag yesterday", T("oats @yesterday").date, t.dateAlias("yesterday"));
eq("tag meal", T("oats @lunch").meal, "lunch");
eq("tag plain", T("oats 60g @lunch @9:00").plain, ["oats", "60g"]);
eq("tag quoted meal", T('mv 3 "@late snack"').meal, "late snack");

eq("meal exact", d.findMeal("lunch").index, 1);
eq("meal prefix", d.findMeal("din").index, 2);
eq("meal none", d.findMeal("brunch"), undefined);
eq("meal accent/case", d.findMeal("LUNCH").index, 1);
eq("hour 8", d.mealForHour(8).name, "breakfast");
eq("hour 13", d.mealForHour(13).name, "lunch");
eq("hour 19", d.mealForHour(19).name, "dinner");
eq("hour 23", d.mealForHour(23).name, "snacks");
eq("hour 3", d.mealForHour(3).name, "breakfast");

const s = d.stamp("2026-09-18", "08:12");
eq("stamp", [s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes()], [2026, 8, 18, 8, 12]);
eq("key", d.dateKey("2026-09-18").toISOString(), "2026-09-18T00:00:00.000Z");
eq("units", d.normalizeUnit("Slices").unit, "slice");

d.foodNames = ["Chicken breast", "Chicken thigh", "Oats", "Rye bread"];
const hint = (v) => { t.cwd = []; t.el.input = { value: v }; return t.getHint(); };
eq("hint + food", hint("+ oa"), "ts");
eq("hint + multiword", hint("+ chicken br"), "east");
eq("hint + kcal", hint("+ kc"), "al");
eq("hint + meal", hint("+ oats 60g @lu"), "nch");
eq("hint cmd +", hint("+"), "");
eq("hint mv meal", hint("mv 3 @di"), "nner");

if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
