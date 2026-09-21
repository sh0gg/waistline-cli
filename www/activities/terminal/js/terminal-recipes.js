/*
  Copyright 2018, 2019, 2020, 2021 David Healey
  This version, waistline-cli, is a fork of Waistline created by sh0gg_.

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with app.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
  Recipes: a dish saved as ONE thing that is logged as ONE diary line, with the
  values of the whole batch and how much it makes (1 portion, 4 portions, 800 g).
  (A saved meal in ~/meals is different: it logs each ingredient separately.)

  A recipe can be made four ways:
    new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion   from ingredients
    new stew yield 4 portions kcal 1600 fat 60 ...                          from values worked out elsewhere
    save 3 4 5 as sandwich                                                  from entries already in the diary
    cp sandwich ~/recipes                                                   from a saved meal (and back)

  Like the app's own recipes, the values are frozen when the recipe is saved.
  refresh recalculates them from the current foods as a new version; the old
  version is archived, so days already logged keep the values they had.
*/
app.TerminalRecipes = {

  lastList: undefined, // Recipes in the order the last ls showed them

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  isWeight: function(unit) {
    return ["g", "ml"].includes(app.TerminalDiary.normalizeUnit(unit).unit);
  },

  // "portions" -> "portion", but "glass" stays "glass"
  singular: function(unit) {
    const u = String(unit || "").trim().toLowerCase();
    if (["g", "ml"].includes(u)) return u;
    const irregular = { glasses: "glass", boxes: "box", dishes: "dish", batches: "batch" };
    if (irregular[u]) return irregular[u];
    if (u.endsWith("ss")) return u;
    return u.endsWith("s") ? u.slice(0, -1) : u;
  },

  // What a recipe makes: "4 portions", "800g"
  yieldText: function(recipe) {
    const d = app.TerminalDiary;
    const portion = parseFloat(recipe.portion);
    if (!recipe.unit) return d.fmt(portion);
    return d.fmt(portion) + (this.isWeight(recipe.unit) ? recipe.unit : " " + d.plural(recipe.unit, portion));
  },

  // "4 portions" / "800g" typed after "yield" or in answer to the question
  parseYield: function(tokens) {
    const read = app.TerminalFoods.readPortion(tokens, 0);
    if (!read || read.step !== tokens.length || !(read.portion > 0)) return undefined;
    return { portion: read.portion, unit: this.singular(read.unit) };
  },

  // Energy for one portion, or for 100 g when it is made by weight
  perUnit: function(recipe) {
    const d = app.TerminalDiary;
    const energy = app.FoodsMealsRecipes.getItemEnergy(recipe.nutrition || {});
    const portion = parseFloat(recipe.portion);
    if (!(portion > 0)) return { energy: energy, label: "" };

    if (this.isWeight(recipe.unit))
      return { energy: energy * 100 / portion, label: "/100" + recipe.unit };
    return { energy: energy / portion, label: "/" + (recipe.unit || "portion") };
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------

  saveRecipe: function(recipe) {
    return new Promise((resolve, reject) => {
      const request = dbHandler.put(recipe, "recipes");
      request.addEventListener("success", () => { resolve(request.result); });
      request.addEventListener("error", () => { reject(request.error); });
    });
  },

  // Recipes you can log: not archived, name contains the text
  allRecipes: async function(query) {
    const d = app.TerminalDiary;
    const list = await dbHandler.getAllItems("recipes");
    const escaped = (query || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return app.FoodsMealsRecipes.filterList(escaped, [], list)
      .sort((a, b) => (d.norm(a.name) < d.norm(b.name) ? -1 : 1));
  },

  find: async function(query) {
    return this.allRecipes(query);
  },

  names: async function() {
    try {
      return (await this.allRecipes("")).map(r => r.name);
    } catch (err) {
      return [];
    }
  },

  // ---------------------------------------------------------------------
  // Reading what the user typed
  // ---------------------------------------------------------------------

  // "sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion"
  // "yield" is its own comma-separated part. Returns undefined without an "=".
  parseDefinition: function(text) {
    const t = app.Terminal;
    const at = text.indexOf("=");
    if (at === -1) return undefined;

    let yieldTokens;
    const kept = [];
    text.slice(at + 1).split(",").forEach((part) => {
      const tokens = t.tokenize(part);
      if (tokens.length > 0 && tokens[0].toLowerCase() === "yield") yieldTokens = tokens.slice(1);
      else kept.push(part);
    });

    const def = app.TerminalMeals.parseDefinition(text.slice(0, at) + "=" + kept.join(","));
    def.yieldTokens = yieldTokens;
    return def;
  },

  // ---------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------

  // Asks how much a recipe makes until it is understood, then saves it
  askYield: function(recipe) {
    const t = app.Terminal;
    t.ask("how much does " + recipe.name + " make? e.g. 1 portion, 4 portions, 800g", async (line) => {
      const parsed = this.parseYield(t.tokenize(line));
      if (!parsed) {
        t.print("could not read that. try 4 portions, or 800g", "err");
        this.askYield(recipe);
        return;
      }
      recipe.portion = parsed.portion;
      recipe.unit = parsed.unit;
      await this.saveNew(recipe);
    });
  },

  // Save a finished recipe, asking first if the name is taken
  saveNew: async function(recipe) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const existing = (await this.allRecipes("")).filter(r => d.norm(r.name) === d.norm(recipe.name));

    const save = async (archive) => {
      if (archive)
        for (const old of existing) {
          old.archived = true;
          await this.saveRecipe(old);
        }
      await this.saveRecipe(recipe);
      d.refreshFoodNames();

      const per = this.perUnit(recipe);
      t.print("saved recipe " + recipe.name + " · makes " + this.yieldText(recipe) + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(recipe.nutrition || {})) + " in all, " + d.energyLabel(per.energy) + per.label, "ok");
      t.print("log it with: + " + recipe.name, "muted");
    };

    if (existing.length === 0) {
      await save(false);
      return;
    }

    t.print("you already have a recipe called \"" + recipe.name + "\". what should the new one be?", "accent");
    t.printChoices([{
      text: "a new version of it: the old one is archived and days already logged keep their old values",
      run: () => { t.guard(() => save(true)); }
    }, {
      text: "a separate recipe with the same name",
      run: () => { t.guard(() => save(false)); }
    }, {
      text: "cancel",
      run: () => { t.print("nothing saved", "muted"); }
    }]);
  },

  // A recipe record from resolved ingredients
  fromBuilt: async function(name, built, source) {
    const nutrition = await app.FoodsMealsRecipes.getTotalNutrition(built.items, "subtract");
    return { name: name, items: built.items, refs: built.refs, nutrition: nutrition, archived: false, dateTime: new Date(), source: source };
  },

  // ---------------------------------------------------------------------
  // The four ways to make one
  // ---------------------------------------------------------------------

  // new <name> = <ingredients>[, yield ...]   or   new <name> yield <amount> kcal ... (values)
  create: async function(text) {
    const t = app.Terminal;
    const f = app.TerminalFoods;

    const def = this.parseDefinition(text);

    // From ingredients
    if (def) {
      if (def.name === "") {
        t.print("usage: new <name> = <food> [amount], <food> [amount], yield <amount>   e.g. new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion", "err");
        return;
      }
      if (def.ingredients.length === 0) {
        t.print("what is in " + def.name + "? e.g. new " + def.name + " = white bread 2 slices, gouda 2 slices, yield 1 portion", "muted");
        return;
      }

      const built = await app.TerminalMeals.build(def.name, def.ingredients);
      if (built.error) {
        t.print("new: " + built.error, "err");
        return;
      }

      const recipe = await this.fromBuilt(def.name, built, "ingredients");

      if (def.yieldTokens) {
        const parsed = this.parseYield(def.yieldTokens);
        if (!parsed) {
          t.print("new: could not read the yield. try yield 4 portions, or yield 800g", "err");
          return;
        }
        recipe.portion = parsed.portion;
        recipe.unit = parsed.unit;
        await this.saveNew(recipe);
        return;
      }

      this.askYield(recipe);
      return;
    }

    // From values worked out elsewhere: the same words as a food, "yield" is optional
    const tokens = t.tokenize(text).filter(x => x.toLowerCase() !== "yield");
    const spec = f.parseSpec(tokens, true);
    if (spec.error) {
      t.print("new: " + spec.error, "err");
      return;
    }

    spec.questions = {
      portion: "how much does it make? e.g. 1 portion, 4 portions, 800g",
      kcal: (portion) => "kcal in the whole recipe (" + portion + ")?"
    };
    spec.finish = async (finished) => {
      const base = f.buildFood(finished);
      base.unit = this.singular(base.unit);
      base.items = [];
      base.refs = [];
      base.source = "values";
      await this.saveNew(base);
    };

    await f.createFood(spec);
  },

  // save <n> [n...] as <name>: turn entries of the day into a recipe
  saveFromEntries: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const iso = d.requireDay("save");
    if (!iso) return;

    const at = args.findIndex(x => x.toLowerCase() === "as");
    const numbers = at === -1 ? [] : args.slice(0, at);
    const name = at === -1 ? "" : args.slice(at + 1).join(" ").trim();

    if (numbers.length === 0 || name === "") {
      t.print("usage: save <n> [n...] as <name>   e.g. save 3 4 5 as sandwich", "err");
      return;
    }

    const { rows } = await d.getRows(iso);
    const result = d.pickRows(rows, numbers);
    if (result.error) {
      t.print("save: " + result.error, "err");
      return;
    }

    const items = [];
    const refs = [];
    for (const row of result.picked) {
      if (row.isQuick) {
        t.print("save: " + row.name + " is a quick add with no food behind it, so it cannot be part of a recipe", "err");
        return;
      }
      if (!row.food || row.item.type === "recipe") {
        t.print("save: " + row.name + " is not a plain food, so it cannot be part of a recipe", "err");
        return;
      }

      const total = parseFloat(row.item.portion) * parseFloat(row.item.quantity);
      items.push({ id: row.item.id, type: "food", portion: parseFloat(row.item.portion), quantity: parseFloat(row.item.quantity) });
      refs.push({ name: row.food.name, amount: this.amountRef(row.food, total) });
    }

    const recipe = await this.fromBuilt(name, { items: items, refs: refs }, "entries");
    this.askYield(recipe);
  },

  // The ingredients of a saved meal as recipe-style references, or an error
  refsOfMeal: async function(meal) {
    if (meal.refs && meal.refs.length > 0) return { refs: meal.refs };

    // A meal made in the regular screen only knows food ids
    const refs = [];
    for (const item of (meal.items || [])) {
      const food = await dbHandler.getByKey(item.id, "foodList");
      if (!food) return { error: "one of its foods no longer exists" };
      const total = parseFloat(item.portion) * (parseFloat(item.quantity) || 1);
      refs.push({ name: food.name, amount: this.amountRef(food, total) });
    }
    return { refs: refs };
  },

  // A total amount of a food (in its own unit) written the way ingredients are stored.
  // Foods with no unit are counted in multiples of their portion.
  amountRef: function(food, total) {
    if (food.unit) return { value: total, unit: food.unit, times: false, bare: false };
    return { value: total / parseFloat(food.portion), unit: undefined, times: true, bare: true };
  },

  // cp <name> ~/recipes (from ~/meals) or cp <name> ~/meals (from ~/recipes)
  copy: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const m = app.TerminalMeals;

    const here = t.cwd.length === 1 ? t.cwd[0] : "";
    if (here !== "meals" && here !== "recipes") {
      t.print("cp: go to ~/meals or ~/recipes first. cp <n|name> ~/recipes turns a meal into a recipe, and back", "err");
      return;
    }
    if (args.length < 2) {
      t.print("usage: cp <n|name> " + (here === "meals" ? "~/recipes" : "~/meals"), "err");
      return;
    }

    const target = t.resolve(args[args.length - 1], t.cwd);
    const wanted = target.segments && target.segments.length === 1 ? target.segments[0] : "";
    if (wanted === here || (wanted !== "meals" && wanted !== "recipes")) {
      t.print("cp: the destination must be ~/" + (here === "meals" ? "recipes" : "meals"), "err");
      return;
    }

    const name = args.slice(0, -1).join(" ");

    if (here === "meals") {
      const meal = await m.pick(name);
      if (!meal) return;

      const found = await this.refsOfMeal(meal);
      if (found.error) {
        t.print("cp: " + meal.name + ": " + found.error, "err");
        return;
      }

      const built = await m.build(meal.name, found.refs.map(r => ({ name: r.name, amount: r.amount || undefined })));
      if (built.error) {
        t.print("cp: " + built.error, "err");
        return;
      }

      const recipe = await this.fromBuilt(meal.name, built, "meal");
      this.askYield(recipe);
      return;
    }

    // recipe -> meal
    const recipe = await this.pick(name);
    if (!recipe) return;

    if (!recipe.refs || recipe.refs.length === 0) {
      t.print("cp: " + recipe.name + " was made from values, so it has no ingredient list to make a meal from", "err");
      return;
    }

    const existing = (await m.allMeals()).find(x => d.norm(x.name) === d.norm(recipe.name));
    if (existing) {
      t.print("cp: you already have a meal called " + recipe.name, "err");
      return;
    }

    const built = await m.build(recipe.name, recipe.refs.map(r => ({ name: r.name, amount: r.amount || undefined })));
    if (built.error) {
      t.print("cp: " + built.error, "err");
      return;
    }

    await m.saveMeal({ name: recipe.name, items: built.items, refs: built.refs, archived: false, dateTime: new Date() });
    d.refreshFoodNames();
    t.print("saved meal " + recipe.name + " · " + built.items.length + " items. + " + recipe.name + " will now ask which one you mean", "ok");
  },

  // ---------------------------------------------------------------------
  // Changing recipes
  // ---------------------------------------------------------------------

  // A fresh record for a new version of a recipe: same content, no id
  copyOf: function(recipe) {
    const copy = JSON.parse(JSON.stringify(recipe));
    delete copy.id;
    copy.archived = false;
    copy.dateTime = new Date();
    return copy;
  },

  replaceVersion: async function(old, replacement) {
    const t = app.Terminal;
    old.archived = true;
    await this.saveRecipe(old);
    await this.saveRecipe(replacement);
    app.TerminalDiary.refreshFoodNames();

    const per = this.perUnit(replacement);
    t.print("saved as a new version: " + replacement.name + " · makes " + this.yieldText(replacement) + " → " + app.TerminalDiary.energyLabel(per.energy) + per.label, "ok");
    t.print("the old one is archived. days already logged keep their old values", "muted");
  },

  // refresh <recipe>: recalculate from the foods as they are now
  refresh: async function(recipe) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (!recipe.refs || recipe.refs.length === 0) {
      t.print("refresh: " + recipe.name + " was made from values, so there are no ingredients to recalculate from", "err");
      return;
    }

    const built = await app.TerminalMeals.build(recipe.name, recipe.refs.map(r => ({ name: r.name, amount: r.amount || undefined })));
    if (built.error) {
      t.print("refresh: " + built.error, "err");
      return;
    }

    const fresh = this.copyOf(recipe);
    fresh.items = built.items;
    fresh.refs = built.refs;
    fresh.nutrition = await app.FoodsMealsRecipes.getTotalNutrition(built.items, "subtract");

    const before = app.FoodsMealsRecipes.getItemEnergy(recipe.nutrition || {});
    const after = app.FoodsMealsRecipes.getItemEnergy(fresh.nutrition);
    if (Math.abs(after - before) < Math.max(1, before * 0.005)) {
      t.print(recipe.name + " already matches the current foods (" + d.energyLabel(before) + ")", "muted");
      return;
    }

    t.print(recipe.name + " in all: " + d.energyLabel(before) + " → " + d.energyLabel(after), "accent");
    await this.replaceVersion(recipe, fresh);
  },

  // edit <n|name> = <ingredients>[, yield ...]    or    edit <n|name> yield 6 portions kcal 1700 ...
  edit: async function(recipe, text) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const f = app.TerminalFoods;

    // New ingredient list
    const def = text.includes("=") ? this.parseDefinition(recipe.name + " " + text.slice(text.indexOf("="))) : undefined;
    if (def) {
      if (def.ingredients.length === 0) {
        t.print("edit: give the ingredients, e.g. edit " + recipe.name + " = white bread 2 slices, gouda 2 slices", "err");
        return;
      }
      const built = await app.TerminalMeals.build(recipe.name, def.ingredients);
      if (built.error) {
        t.print("edit: " + built.error, "err");
        return;
      }

      const fresh = this.copyOf(recipe);
      fresh.items = built.items;
      fresh.refs = built.refs;
      fresh.nutrition = await app.FoodsMealsRecipes.getTotalNutrition(built.items, "subtract");
      fresh.source = "ingredients";

      if (def.yieldTokens) {
        const parsed = this.parseYield(def.yieldTokens);
        if (!parsed) {
          t.print("edit: could not read the yield", "err");
          return;
        }
        fresh.portion = parsed.portion;
        fresh.unit = parsed.unit;
      }
      await this.replaceVersion(recipe, fresh);
      return;
    }

    // Values and yield: the same words as a food
    const spec = f.parseSpec(t.tokenize(text).filter(x => x.toLowerCase() !== "yield"), false);
    if (spec.error) {
      t.print("edit: " + spec.error, "err");
      return;
    }

    const hasValues = Object.keys(spec.nutrition).length > 0;
    const hasYield = spec.portion !== undefined;

    if (!hasValues && !hasYield) {
      if (!spec.name && spec.brand === undefined) {
        t.print("edit: nothing to change. e.g. edit 1 yield 6 portions, edit 1 kcal 1700, edit 1 = white bread 2 slices, yield 1 portion", "err");
        return;
      }
      if (spec.name) recipe.name = spec.name;
      if (spec.brand !== undefined) recipe.brand = spec.brand;
      await this.saveRecipe(recipe);
      d.refreshFoodNames();
      t.print("renamed. days already logged show the new name", "ok");
      return;
    }

    const fresh = this.copyOf(recipe);
    if (spec.name) fresh.name = spec.name;
    if (hasYield) {
      fresh.portion = spec.portion;
      fresh.unit = this.singular(spec.unit);
    }
    if (hasValues) {
      fresh.nutrition = Object.assign({}, f.cleanNutrition(recipe.nutrition), spec.nutrition);
      if (spec.nutrition.calories !== undefined && spec.nutrition.kilojoules === undefined) delete fresh.nutrition.kilojoules;
      if (spec.nutrition.kilojoules !== undefined && spec.nutrition.calories === undefined) delete fresh.nutrition.calories;
    }
    await this.replaceVersion(recipe, fresh);
  },

  archive: async function(recipe) {
    recipe.archived = true;
    await this.saveRecipe(recipe);
    app.TerminalDiary.refreshFoodNames();
    app.Terminal.print("deleted recipe " + recipe.name + ". days already logged still show it", "ok");
  },

  // ---------------------------------------------------------------------
  // Using and showing recipes
  // ---------------------------------------------------------------------

  // Log a recipe as one diary entry. ctx: { iso, when, meal, where } from the + command.
  log: async function(recipe, amount, ctx) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const chosen = d.toItemAmount(recipe, amount);
    if (chosen.error) {
      t.print(chosen.error, "err");
      return;
    }

    const item = { id: recipe.id, portion: chosen.portion, quantity: chosen.quantity, type: "recipe", dateTime: ctx.when, category: ctx.meal.index };
    const entry = (await d.getEntry(ctx.iso)) || d.newEntry(ctx.iso);
    entry.items.push(item);
    await d.saveEntry(entry);
    t.pushUndo({ kind: "added", date: ctx.iso, t: ctx.when.getTime(), id: recipe.id, type: "recipe" });

    const energy = d.foodEnergy(recipe, chosen.portion, chosen.quantity);
    const shown = d.amountText(recipe, item);
    t.print("+ " + recipe.name + (shown ? " · " + shown : "") + " → " + d.energyLabel(energy) + " (" + ctx.where + ")", "ok");
  },

  printDetails: function(recipe) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const per = this.perUnit(recipe);

    t.print(recipe.name, "cyan");
    t.print("makes " + this.yieldText(recipe) + " · " + d.energyLabel(per.energy) + per.label + " · made from " + (recipe.source || "the regular screen"), "muted");

    if (recipe.refs && recipe.refs.length > 0) {
      recipe.refs.forEach((ref) => {
        const a = ref.amount;
        const shown = !a ? "" : (a.times ? d.fmt(a.value) + "×" : d.fmt(a.value) + (a.unit && ["g", "ml"].includes(d.normalizeUnit(a.unit).unit) ? a.unit : " " + d.plural(a.unit || "", a.value)));
        t.print("  " + ref.name + (shown ? " · " + shown.trim() : ""), "muted");
      });
    }

    const nutrition = recipe.nutrition || {};
    const lines = Object.keys(nutrition)
      .filter(n => nutrition[n])
      .map((n) => {
        const unit = (app.nutrimentUnits && app.nutrimentUnits[n]) || "";
        return n.replace(/-/g, " ").padEnd(20) + d.fmt(nutrition[n]) + (unit ? " " + unit : "");
      });

    t.print("the whole recipe:", "muted");
    if (lines.length === 0) t.print("no nutrition values", "muted");
    lines.forEach(line => t.print(line));
  },

  showRecipes: async function() {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const recipes = await this.allRecipes("");
    this.lastList = recipes;

    if (recipes.length === 0) {
      t.print("(no recipes yet. try: new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion)", "muted");
      return;
    }

    recipes.forEach((recipe, i) => {
      const per = this.perUnit(recipe);
      const node = d.el("div", "term-line term-food");
      node.appendChild(d.el("span", "n", String(i + 1)));

      const name = d.el("span", "name", recipe.name);
      name.appendChild(d.el("span", "sep", " · "));
      name.appendChild(d.el("span", "qty", "makes " + this.yieldText(recipe)));
      node.appendChild(name);

      node.appendChild(d.el("span", "kcal", d.energyLabel(per.energy) + per.label));

      const sub = recipe.refs && recipe.refs.length > 0 ? recipe.refs.map(r => r.name).join(" · ") : "values only";
      node.appendChild(d.el("div", "macros", sub));

      node.addEventListener("click", () => { this.showActions(recipe); });
      t.printNode(node, true);
    });
  },

  showActions: function(recipe) {
    const t = app.Terminal;
    const choices = [{
      text: "details",
      run: () => { this.printDetails(recipe); }
    }, {
      text: "log it",
      run: () => {
        t.ask("how much " + recipe.name + "? e.g. 1, 2 portions, 0.5, 300g", async (line) => {
          await t.run("+ \"" + recipe.name + "\" " + line);
        });
      }
    }];

    if (recipe.refs && recipe.refs.length > 0)
      choices.push({ text: "recalculate from the current foods", run: () => { t.guard(() => this.refresh(recipe)); } });

    choices.push({ text: "delete (days already logged still show it)", run: () => { t.guard(() => this.archive(recipe)); } });
    t.printChoices(choices);
  },

  // Finds a recipe from a number in the last ls, or from a name
  pick: async function(text) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (/^\d+$/.test(text)) {
      if (!this.lastList) this.lastList = await this.allRecipes("");
      const recipe = this.lastList[parseInt(text, 10) - 1];
      if (!recipe) t.print("no recipe " + text + " in the last list", "err");
      return recipe;
    }

    const found = await this.find(text);
    const exact = found.filter(r => d.norm(r.name) === d.norm(text));
    const pool = exact.length > 0 ? exact : found;

    if (pool.length === 0) t.print("no recipe matches \"" + text + "\"", "err");
    else if (pool.length > 1) t.print("several recipes match \"" + text + "\". use its number from ls", "err");
    else return pool[0];
    return undefined;
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

// Inside ~/recipes, new/cat/rm/edit act on recipes
(function() {
  const inRecipes = () => app.Terminal.cwd.length === 1 && app.Terminal.cwd[0] === "recipes";
  const r = app.TerminalRecipes;

  const share = (name, recipesRun, note) => {
    const command = app.Terminal.commands[name];
    const previous = command.run;
    command.run = async (args, line) => {
      if (inRecipes()) await recipesRun(args, line);
      else await previous(args, line);
    };
    command.desc += " " + note;
  };

  const afterCommand = (line) => line.replace(/^\s*\S+\s*/, "");

  share("new", async (args, line) => { await r.create(afterCommand(line)); },
    "(in ~/recipes: a recipe. new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion. or from values: new stew yield 4 portions kcal 1600 fat 60)");

  share("cat", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: cat <n|name>", "err");
      return;
    }
    const recipe = await r.pick(args.join(" "));
    if (recipe) r.printDetails(recipe);
  }, "(in ~/recipes: a recipe)");

  share("rm", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: rm <n|name>", "err");
      return;
    }
    const recipe = await r.pick(args.join(" "));
    if (recipe) await r.archive(recipe);
  }, "(in ~/recipes: deletes a recipe)");

  share("edit", async (args, line) => {
    const text = afterCommand(line);
    if (args.length < 2) {
      app.Terminal.print("usage: edit <n|name> = <ingredients>, yield ...   or   edit <n|name> yield 6 portions kcal 1700", "err");
      return;
    }

    // The target is the text before "=" when there is one, otherwise the first word
    const at = text.indexOf("=");
    const target = at === -1 ? args[0] : text.slice(0, at).trim().replace(/^"(.*)"$/, "$1");
    const recipe = await r.pick(target);
    if (!recipe) return;

    await r.edit(recipe, at === -1 ? text.replace(/^\s*("[^"]*"|\S+)\s*/, "") : text.slice(at));
  }, "(in ~/recipes: changes a recipe, as a new version)");
})();

app.Terminal.commands.refresh = {
  usage: "refresh <n|name>",
  desc: "in ~/recipes: recalculate a recipe from the foods as they are now, as a new version (past days keep the old values)",
  run: async (args) => {
    const t = app.Terminal;
    if (!(t.cwd.length === 1 && t.cwd[0] === "recipes")) {
      t.print("refresh: go to ~/recipes first", "err");
      return;
    }
    if (args.length === 0) {
      t.print("usage: refresh <n|name>", "err");
      return;
    }
    const recipe = await app.TerminalRecipes.pick(args.join(" "));
    if (recipe) await app.TerminalRecipes.refresh(recipe);
  }
};

app.Terminal.commands.save = {
  usage: "save <n> [n...] as <name>",
  desc: "in a day: turn entries into a recipe. save 3 4 5 as sandwich",
  run: async (args) => { await app.TerminalRecipes.saveFromEntries(args); }
};

app.Terminal.commands.cp = {
  usage: "cp <n|name> <destination>",
  desc: "in ~/meals: cp sandwich ~/recipes makes a recipe from a saved meal. in ~/recipes: cp sandwich ~/meals makes a meal from a recipe",
  complete: (args) => (args.length >= 1 ? ["~/recipes", "~/meals"] : []),
  run: async (args) => { await app.TerminalRecipes.copy(args); }
};

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "recipes",
  run: () => app.TerminalRecipes.showRecipes()
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "recipes")
    await app.TerminalRecipes.showRecipes();
});
