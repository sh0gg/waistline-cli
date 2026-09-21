global.document = { addEventListener() {} };
global.window = { localStorage: { getItem: () => null, setItem() {} } };
global.app = {
  Utils: { normalizeText: (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), convertUnit: (v, a, b) => (a === "kJ" && b === "kcal" ? Math.round(v / 4.184 * 10) / 10 : v) },
  Settings: { get: () => undefined }, strings: { diary: { "default-meals": {} } }, standardUnits: ["g", "ml"],
  nutrimentUnits: { kilojoules: "kJ", calories: "kcal" },
  FoodsMealsRecipes: {}, 
};
const vm = require("vm"), fs = require("fs");
const load = (f) => vm.runInThisContext(fs.readFileSync(require("path").join(__dirname, "../../www/activities/terminal/js", f), "utf8"));
load("terminal.js"); load("terminal-diary.js"); load("terminal-foods.js");
const t = app.Terminal, f = app.TerminalFoods;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };
const S = (s, needName = true) => f.parseSpec(t.tokenize(s), needName);

eq("full", S('guiso 350g kcal 420 fat 18 carb 30 protein 25'), { nutrition: { calories: 420, fat: 18, carbohydrates: 30, proteins: 25 }, portion: 350, unit: "g", name: "guiso" });
eq("quoted name", S('"chicken stew" 350g kcal 420').name, "chicken stew");
eq("multiword name", S("rye bread 1 slice kcal 80"), { nutrition: { calories: 80 }, portion: 1, unit: "slice", name: "rye bread" });
eq("no unit", S("banana 1 kcal 89"), { nutrition: { calories: 89 }, portion: 1, unit: "", name: "banana" });
eq("name w/ digits", S("7up 330ml kcal 140"), { nutrition: { calories: 140 }, portion: 330, unit: "ml", name: "7up" });
eq("kg conversion", S("rice 1kg kcal 3500").portion, 1000);
eq("l conversion", S("milk 1l kcal 460").unit, "ml");
eq("protein bar keyword-as-name", S("protein bar 45g kcal 180 protein 20"), { nutrition: { calories: 180, proteins: 20 }, portion: 45, unit: "g", name: "protein bar" });
eq("fat free yogurt", S("fat free yogurt 125g kcal 60").name, "fat free yogurt");
eq("brand & barcode", S('milk 1l kcal 460 brand "Hacendado" barcode 8480000123456').brand, "Hacendado");
eq("barcode", S("milk 1l kcal 460 barcode 8480000123456").barcode, "8480000123456");
eq("decimal comma", S("oats 100g kcal 380 fat 7,5").nutrition.fat, 7.5);
eq("kj", S("x 100g kj 1600").nutrition, { kilojoules: 1600 });
eq("name only", S("guiso"), { nutrition: {}, name: "guiso" });
eq("empty", S(""), { nutrition: {} });
eq("amount first is a name", S("350g").name, "350g");
eq("trailing keyword err", !!S("x 100g fat 5 kcal").error, true);
eq("stray word err", !!S("x 100g kcal 5 hello").error, true);
eq("edit: keywords", S("kcal 900 fat 30", false), { nutrition: { calories: 900, fat: 30 } });
eq("edit: amount", S("100g kcal 380", false), { nutrition: { calories: 380 }, portion: 100, unit: "g" });
eq("edit: name", S('name "New name"', false).name, "New name");

const b = f.buildFood({ name: "x", portion: 100, unit: "g", nutrition: { kilojoules: 1600 }, barcode: "1" });
eq("build kj->kcal", b.nutrition.calories, 382.4);
eq("build fields", [b.archived, b.brand, b.barcode], [false, "", "1"]);
eq("clean", f.cleanNutrition({ a: "5", b: NaN, c: undefined, d: 2.5, e: "x" }), { a: 5, d: 2.5 });
eq("portionText g", f.portionText({ portion: 100, unit: "g" }), "100g");
eq("portionText slice", f.portionText({ portion: 1, unit: "slice" }), "1 slice");
eq("portionText none", f.portionText({ portion: 1, unit: "" }), "1");

const hint = (v) => { t.cwd = []; t.el.input = { value: v }; return t.getHint(); };
eq("hint new kw", hint("new x 100g kc"), "al");
eq("hint scan", hint("sc"), "an");
eq("hint search", hint("sea"), "rch");
if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
