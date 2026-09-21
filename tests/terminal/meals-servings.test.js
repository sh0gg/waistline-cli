global.document = { addEventListener() {} };
global.window = { localStorage: { getItem: () => null, setItem() {} } };
global.app = {
  Utils: { normalizeText: (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), convertUnit: (v) => v },
  Settings: { get: () => undefined }, strings: { diary: { "default-meals": {} } }, standardUnits: ["g", "ml"],
  nutrimentUnits: { kilojoules: "kJ", calories: "kcal" }, FoodsMealsRecipes: {},
};
const vm = require("vm"), fs = require("fs");
const load = (f) => vm.runInThisContext(fs.readFileSync(require("path").join(__dirname, "../../www/activities/terminal/js", f), "utf8"));
["terminal.js", "terminal-diary.js", "terminal-foods.js", "terminal-meals.js"].forEach(load);
const t = app.Terminal, d = app.TerminalDiary, f = app.TerminalFoods, m = app.TerminalMeals;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };
const S = (s, needName = true) => f.parseSpec(t.tokenize(s), needName);

// serving keyword
eq("serving parse", S("arroz 100g kcal 350 serving bag=125g").serving, { name: "bag", value: 125, unit: "g" });
eq("serving none", S("serving none", false).serving, null);
eq("serving bad", !!S("arroz 100g kcal 350 serving bag").error, true);
eq("serving as name word", S("serving spoon 1 kcal 5").name, "serving spoon");
eq("serving kcal still read", S("arroz 100g serving bag=125g kcal 350").nutrition, { calories: 350 });
// per
eq("per g", S("per 125g", false).per, { portion: 125, unit: "g", step: 1 });
eq("per two words", S("per 2 slices", false).per, { portion: 2, unit: "slices", step: 2 });
eq("per in new is a name word", S("per capita 100g kcal 5").name, "per capita");
eq("per bare", S("per 50", false).per.portion, 50);
eq("per bad", !!S("per x", false).error, true);
// resolveServing
eq("resolve same", f.resolveServing({ name: "bag", value: 125, unit: "g" }, "g"), { name: "bag", size: 125 });
eq("resolve no unit typed", f.resolveServing({ name: "bag", value: 125, unit: "" }, "g"), { name: "bag", size: 125 });
eq("resolve kg", f.resolveServing({ name: "sack", value: 1, unit: "kg" }, "g"), { name: "sack", size: 1000 });
eq("resolve mismatch", !!f.resolveServing({ name: "bag", value: 125, unit: "ml" }, "g").error, true);
eq("resolve no food unit", !!f.resolveServing({ name: "x", value: 1, unit: "" }, "").error, true);
// amounts with serving
const rice = { name: "rice", portion: 100, unit: "g", serving: { name: "bag", size: 125 } };
const A = (food, s) => d.toItemAmount(food, d.parseAmount(t.tokenize(s)).amount);
eq("1 bag", A(rice, "1 bag"), { portion: 125, quantity: 1 });
eq("2 bags", A(rice, "2 bags"), { portion: 250, quantity: 1 });
eq("0.5 bag", A(rice, "0.5bag"), { portion: 62.5, quantity: 1 });
eq("rice 125g", A(rice, "125g"), { portion: 125, quantity: 1 });
eq("rice unknown unit", !!A(rice, "2 slices").error, true);
eq("build serving", f.buildFood({ name: "x", portion: 100, unit: "g", nutrition: {}, servingResolved: { name: "bag", size: 125 } }).serving, { name: "bag", size: 125 });
eq("build no serving", "serving" in f.buildFood({ name: "x", portion: 100, unit: "g", nutrition: {} }), false);
// plural label
eq("plural", [d.plural("slice", 2), d.plural("slice", 1), d.plural("cups", 2), d.plural("bag", 0.5)], ["slices", "slice", "cups", "bags"]);
// meal definitions
const P = (s) => m.parseDefinition(s);
eq("meal def", P("sandwich = white bread 2 slices, gouda 2 slices, mayo 10g").ingredients.map(i => [i.name, i.amount && i.amount.value, i.amount && i.amount.unit || null]), [["white bread", 2, "slices"], ["gouda", 2, "slices"], ["mayo", 10, "g"]]);
eq("meal def name", P("sandwich = a 1").name, "sandwich");
eq("meal quoted name", P('"big sandwich" = a 1').name, "big sandwich");
eq("meal no amount", P("x = bread, cheese").ingredients.map(i => [i.name, i.amount === undefined]), [["bread", true], ["cheese", true]]);
eq("meal empty", P("sandwich").ingredients, []);
eq("meal digits name", P("x = 7up").ingredients[0].name, "7up");
eq("meal trailing comma", P("x = a 1, ").ingredients.length, 1);
// compare with OFF (per unit)
const have = { unit: "g", portion: 100, nutrition: { calories: 350, fat: 1, carbohydrates: 77, kilojoules: 1470 } };
eq("compare same", f.compareWithLatest(have, { unit: "g", portion: "100", nutrition: { calories: 350, fat: 1, carbohydrates: 77 } }), []);
eq("compare rescaled portion same", f.compareWithLatest(Object.assign({}, have, { portion: 125, nutrition: { calories: 437.5, fat: 1.25, carbohydrates: 96.25 } }), { unit: "g", portion: "100", nutrition: { calories: 350, fat: 1, carbohydrates: 77 } }), []);
const diff = f.compareWithLatest(have, { unit: "g", portion: "100", nutrition: { calories: 360, fat: 1, carbohydrates: 77 } });
eq("compare change", diff.length, 1);
eq("compare change text", diff[0].startsWith("calories") && diff[0].endsWith("350 \u2192 360"), true);
eq("compare small ignored", f.compareWithLatest(have, { unit: "g", portion: "100", nutrition: { calories: 352, fat: 1, carbohydrates: 77 } }), []);
eq("compare unit mismatch", f.compareWithLatest(have, { unit: "slice", portion: "1", nutrition: { calories: 80 } }), undefined);
eq("compare per serving vs 100g", f.compareWithLatest(have, { unit: "g", portion: "125", nutrition: { calories: 437.5, fat: 1.25, carbohydrates: 96.25 } }), []);
// hints for meals names via cache
d.foodNames = ["Sandwich", "White bread"];
t.cwd = []; t.el.input = { value: "+ sand" };
eq("hint meal name", t.getHint(), "wich");
if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
