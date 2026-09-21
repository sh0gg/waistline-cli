global.document = { addEventListener() {} };
global.window = { localStorage: { getItem: () => null, setItem() {} } };
global.app = {
  Utils: { normalizeText: (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, ""), convertUnit: (v) => v },
  Settings: { get: () => undefined }, strings: { diary: { "default-meals": {} } }, standardUnits: ["g", "ml"],
  nutrimentUnits: { kilojoules: "kJ", calories: "kcal" },
  FoodsMealsRecipes: { getItemEnergy: (n) => (n && n.calories) || 0 },
};
const vm = require("vm"), fs = require("fs"), path = require("path");
const load = (f) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../../www/activities/terminal/js", f), "utf8"));
["terminal.js", "terminal-diary.js", "terminal-foods.js", "terminal-meals.js", "terminal-recipes.js"].forEach(load);
const t = app.Terminal, d = app.TerminalDiary, r = app.TerminalRecipes;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };
const Y = (s) => r.parseYield(t.tokenize(s));

// singular
eq("singular portions", r.singular("portions"), "portion");
eq("singular glass", r.singular("glass"), "glass");
eq("singular glasses", r.singular("glasses"), "glass");
eq("singular g", r.singular("g"), "g");
eq("singular empty", r.singular(""), "");
eq("singular servings", r.singular("Servings"), "serving");
// yield
eq("yield 4 portions", Y("4 portions"), { portion: 4, unit: "portion" });
eq("yield 800g", Y("800g"), { portion: 800, unit: "g" });
eq("yield 1kg", Y("1kg"), { portion: 1000, unit: "g" });
eq("yield 1 portion", Y("1 portion"), { portion: 1, unit: "portion" });
eq("yield bare", Y("4"), { portion: 4, unit: "" });
eq("yield junk", Y("lots"), undefined);
eq("yield trailing junk", Y("4 portions extra"), undefined);
eq("yield zero", Y("0 portions"), undefined);
// text
eq("yieldText portions", r.yieldText({ portion: 4, unit: "portion" }), "4 portions");
eq("yieldText one", r.yieldText({ portion: 1, unit: "portion" }), "1 portion");
eq("yieldText g", r.yieldText({ portion: 800, unit: "g" }), "800g");
eq("yieldText none", r.yieldText({ portion: 2, unit: "" }), "2");
// per unit
eq("perUnit portions", r.perUnit({ portion: 4, unit: "portion", nutrition: { calories: 1600 } }), { energy: 400, label: "/portion" });
eq("perUnit weight", r.perUnit({ portion: 800, unit: "g", nutrition: { calories: 1600 } }), { energy: 200, label: "/100g" });
// definitions
const P = (s) => r.parseDefinition(s);
eq("def none", P("sandwich"), undefined);
const p1 = P("sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion");
eq("def name", p1.name, "sandwich");
eq("def ingredients", p1.ingredients.map(i => i.name), ["white bread", "gouda"]);
eq("def yield", p1.yieldTokens, ["1", "portion"]);
eq("def no yield", P("x = a 1, b 2").yieldTokens, undefined);
eq("def yield first-ish", P("x = yield 4 portions, a 1").ingredients.map(i => i.name), ["a"]);
eq("def yield weight", P("stew = a 100g, yield 800g").yieldTokens, ["800g"]);
// amounts when logging a recipe
const A = (recipe, s) => d.toItemAmount(recipe, d.parseAmount(t.tokenize(s)).amount);
const stew = { name: "stew", portion: 4, unit: "portion", items: [], nutrition: { calories: 1600 } };
eq("stew none = 1 portion", A(stew, ""), { portion: 1, quantity: 1 });
eq("stew 2 = 2 portions", A(stew, "2"), { portion: 2, quantity: 1 });
eq("stew 2x", A(stew, "2x"), { portion: 2, quantity: 1 });
eq("stew 0.5", A(stew, "0.5"), { portion: 0.5, quantity: 1 });
eq("stew 2 portions", A(stew, "2 portions"), { portion: 2, quantity: 1 });
eq("stew 1 portion", A(stew, "1 portion"), { portion: 1, quantity: 1 });
eq("stew 300g rejected", !!A(stew, "300g").error, true);
eq("stew energy 1 portion", d.foodEnergy(stew, 1, 1), 400);
eq("stew energy 2 portions", d.foodEnergy(stew, 2, 1), 800);
const soup = { name: "soup", portion: 800, unit: "g", items: [], nutrition: { calories: 1600 } };
eq("soup none asks", !!A(soup, "").error, true);
eq("soup 300g", A(soup, "300g"), { portion: 300, quantity: 1 });
eq("soup 0.25 of the whole", A(soup, "0.25"), { portion: 800, quantity: 0.25 });
eq("soup energy 300g", d.foodEnergy(soup, 300, 1), 600);
eq("soup energy quarter", d.foodEnergy(soup, 800, 0.25), 400);
const sandwich = { name: "sandwich", portion: 1, unit: "portion", items: [{}], nutrition: { calories: 487 } };
eq("sandwich none", A(sandwich, ""), { portion: 1, quantity: 1 });
eq("sandwich 2", A(sandwich, "2"), { portion: 2, quantity: 1 });
eq("sandwich energy 0.5", d.foodEnergy(sandwich, 0.5, 1), 243.5);
// a plain food is unchanged
const oats = { name: "oats", portion: 100, unit: "g", nutrition: { calories: 380 } };
eq("food none = base", A(oats, ""), { portion: 100, quantity: 1 });
eq("food 0.5 = half base", A(oats, "0.5"), { portion: 100, quantity: 0.5 });
// ingredient amounts saved from entries
const bananaLike = { name: "eggs", portion: 2, unit: "" };
eq("amountRef unitless", r.amountRef(bananaLike, 4), { value: 2, unit: undefined, times: true, bare: true });
eq("amountRef unit", r.amountRef({ name: "oats", portion: 100, unit: "g" }, 60), { value: 60, unit: "g", times: false, bare: false });
eq("amountRef roundtrip unitless", d.toItemAmount(bananaLike, r.amountRef(bananaLike, 4)), { portion: 2, quantity: 2 });
// completion
d.foodNames = ["Stew"];
t.cwd = []; t.el.input = { value: "+ st" };
eq("hint recipe name", t.getHint(), "ew");
t.el.input = { value: "cp x ~/r" };
eq("hint cp dest", t.getHint(), "ecipes");
if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
