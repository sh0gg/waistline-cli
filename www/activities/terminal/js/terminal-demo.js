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
  Sample data for showing the app off: demo load / demo clear / demo status.

  Nothing is loaded on its own, so a fresh install starts empty. Everything the
  demo adds is marked (demo: true on foods, meals and diary items, and the body
  measurements it wrote are listed on the day), so demo clear removes only that
  and leaves your own data alone.
*/
app.TerminalDemo = {

  days: 30, // Today and the 29 days before it

  // Foods. Values are per portion; "serving" is a named serving in the food's unit.
  foods: [
    { name: "oats", portion: 100, unit: "g", nutrition: { calories: 380, fat: 7, carbohydrates: 67, proteins: 17 }, serving: { name: "bowl", size: 60 } },
    { name: "banana", portion: 1, unit: "", nutrition: { calories: 89, fat: 0.3, carbohydrates: 22.8, proteins: 1.1 } },
    { name: "eggs boiled", portion: 1, unit: "", nutrition: { calories: 77.5, fat: 5.3, carbohydrates: 0.55, proteins: 6.3 } },
    { name: "rye bread", portion: 1, unit: "slice", nutrition: { calories: 80 } },
    { name: "apple", portion: 1, unit: "", nutrition: { calories: 78 } },
    { name: "chicken breast", portion: 100, unit: "g", nutrition: { calories: 165, fat: 3.6, carbohydrates: 0, proteins: 31 } },
    { name: "white rice", portion: 100, unit: "g", nutrition: { calories: 130, fat: 0.3, carbohydrates: 28, proteins: 2.7 }, serving: { name: "bag", size: 125 } },
    { name: "whole milk", portion: 100, unit: "ml", nutrition: { calories: 64, fat: 3.6, carbohydrates: 4.7, proteins: 3.3 }, serving: { name: "glass", size: 250 } },
    { name: "greek yogurt", portion: 100, unit: "g", nutrition: { calories: 97, fat: 5, carbohydrates: 4, proteins: 9 }, serving: { name: "pot", size: 125 } },
    { name: "olive oil", portion: 100, unit: "g", nutrition: { calories: 884, fat: 100, carbohydrates: 0, proteins: 0 }, serving: { name: "tbsp", size: 13 } },
    { name: "tuna", portion: 100, unit: "g", nutrition: { calories: 116, fat: 1, carbohydrates: 0, proteins: 26 }, serving: { name: "can", size: 80 } },
    { name: "pasta", portion: 100, unit: "g", nutrition: { calories: 350, fat: 2.5, carbohydrates: 68, proteins: 13 } },
    { name: "tomato sauce", portion: 100, unit: "g", nutrition: { calories: 45, fat: 1.5, carbohydrates: 6, proteins: 1.5 } },
    { name: "white bread", portion: 100, unit: "g", nutrition: { calories: 265, fat: 3.5, carbohydrates: 49, proteins: 8 }, serving: { name: "slice", size: 30 } },
    { name: "gouda", portion: 100, unit: "g", nutrition: { calories: 356, fat: 27, carbohydrates: 2, proteins: 25 }, serving: { name: "slice", size: 20 } },
    { name: "salchichon", portion: 100, unit: "g", nutrition: { calories: 450, fat: 38, carbohydrates: 1, proteins: 26 }, serving: { name: "slice", size: 6 } },
    { name: "mayonnaise", portion: 100, unit: "g", nutrition: { calories: 680, fat: 75, carbohydrates: 1, proteins: 1 }, serving: { name: "tbsp", size: 15 } }
  ],

  meals: [
    "sandwich = white bread 2 slices, gouda 2 slices, salchichon 4 slices, mayonnaise 10g",
    "pasta with tuna = pasta 80g, tuna 1 can, tomato sauce 100g, olive oil 1 tbsp"
  ],

  // Recipes: one line in the diary. "yield" is what the whole batch makes.
  recipes: [
    "chicken stew = chicken breast 600g, white rice 1 bag, tomato sauce 200g, olive oil 2 tbsp, yield 4 portions"
  ],

  // What a day looks like: [time, meal, what]. "meal:" entries are saved meals.
  breakfast: [["08:12", "breakfast", "oats 60g"], ["08:14", "breakfast", "banana"]],
  lunches: [
    [["13:04", "lunch", "white rice 1 bag"], ["13:04", "lunch", "chicken breast 180g"]],
    [["13:10", "lunch", "meal:sandwich"], ["13:12", "lunch", "apple"]],
    [["13:04", "lunch", "meal:pasta with tuna"]]
  ],
  snacks: [
    [["16:30", "snacks", "apple"]],
    [["16:30", "snacks", "greek yogurt 1 pot"]],
    [["16:30", "snacks", "rye bread 1 slice"], ["16:31", "snacks", "greek yogurt 0.5 pot"]]
  ],
  dinners: [
    [["19:22", "dinner", "eggs boiled 2x"], ["19:22", "dinner", "rye bread 2 slices"]],
    [["19:22", "dinner", "chicken breast 150g"], ["19:22", "dinner", "white rice 0.5 bag"], ["19:24", "dinner", "olive oil 1 tbsp"]],
    [["19:30", "dinner", "recipe:chicken stew 1 portion"], ["19:32", "dinner", "rye bread 1 slice"]]
  ],

  // Body measurements by day, drifting slowly the right way. i = 0 is today.
  // Today weighs 74.2 kg and a week ago 75.0 (as in the mockup)
  body: function(i) {
    const wobble = [0, 0.1, -0.1, 0.15, -0.05, 0.1, -0.1, 0, 0.1, -0.15, 0.05, 0, -0.1, 0.1][i % 14];
    const round = (n) => Math.round(n * 10) / 10;
    const values = {
      "weight": round(74.2 + i * 0.114 + wobble),
      "body fat": round(18.4 + i * 0.03),
      "water": round(55.6 - i * 0.03),
      "muscle": round(41.3 - i * 0.015),
      "bone": 3.1,
      "bmr": 1720 + (i % 3) * 2
    };

    // The watch's daily energy, on the days it was worn (every fourth day it was not, and that day stays empty)
    if (i % 4 !== 3) values["burned"] = 2450 + [30, -60, 90, -20, 50, -80, 10][i % 7];
    return values;
  },

  // The scale and watch fields the sample measurements use
  bodyFields: [["water", "%"], ["muscle", "%"], ["bone", "%"], ["bmr", "kcal"], ["burned", "kcal"]],
  shownFields: ["weight", "body fat"],

  // Add or show the body fields that are missing, and remember what was changed so clear can undo it
  prepareBodyFields: function() {
    const order = app.BodyStats.getBodyStats().slice();
    const units = Object.assign({}, app.Settings.get("bodyStats", "units") || {});
    const visibility = Object.assign({}, app.Settings.getField("bodyStatsVisibility") || {});
    const added = [];
    const shown = [];
    const previous = {}; // what each field's visibility was before (null = not set)

    this.bodyFields.forEach((f) => {
      if (!order.includes(f[0])) {
        order.push(f[0]);
        units[f[0]] = f[1];
        added.push(f[0]);
      }
      if (visibility[f[0]] !== true) {
        previous[f[0]] = visibility[f[0]] === undefined ? null : visibility[f[0]];
        visibility[f[0]] = true;
        shown.push(f[0]);
      }
    });

    this.shownFields.forEach((name) => {
      if (order.includes(name) && visibility[name] !== true) {
        previous[name] = visibility[name] === undefined ? null : visibility[name];
        visibility[name] = true;
        shown.push(name);
      }
    });

    app.Settings.put("bodyStats", "order", order);
    app.Settings.put("bodyStats", "units", units);
    app.Settings.putField("bodyStatsVisibility", visibility);
    app.Settings.put("bodyStats", "demo", { added: added, shown: shown, previous: previous });
  },

  // Undo prepareBodyFields, except for fields that now hold values of yours
  restoreBodyFields: async function() {
    const marker = app.Settings.get("bodyStats", "demo");
    if (!marker) return;

    const entries = await dbHandler.getAllItems("diary");
    const inUse = (name) => entries.some(e => e.stats && e.stats[name] !== undefined);

    const order = app.BodyStats.getBodyStats().slice();
    const units = Object.assign({}, app.Settings.get("bodyStats", "units") || {});
    const visibility = Object.assign({}, app.Settings.getField("bodyStatsVisibility") || {});

    (marker.added || []).forEach((name) => {
      if (inUse(name)) return;
      const at = order.indexOf(name);
      if (at !== -1) order.splice(at, 1);
      delete units[name];
      delete visibility[name];
    });

    // Back to exactly what it was: not set, or the value it had
    (marker.shown || []).forEach((name) => {
      if ((marker.added || []).includes(name) || inUse(name)) return;
      const was = (marker.previous || {})[name];
      if (was === null || was === undefined) delete visibility[name];
      else visibility[name] = was;
    });

    app.Settings.put("bodyStats", "order", order);
    app.Settings.put("bodyStats", "units", units);
    app.Settings.putField("bodyStatsVisibility", visibility);
    app.Settings.put("bodyStats", "demo", undefined);
  },

  // ---------------------------------------------------------------------

  isLoaded: async function() {
    const foods = await dbHandler.getAllItems("foodList");
    if (foods.some(f => f && f.demo === true)) return true;

    const entries = await dbHandler.getAllItems("diary");
    return entries.some(e => e.demo === true || (e.items || []).some(i => i.demo === true));
  },

  remove: function(id, store) {
    return new Promise((resolve) => {
      const request = dbHandler.deleteItem(id, store);
      request.addEventListener("success", () => { resolve(); });
      request.addEventListener("error", () => { resolve(); });
    });
  },

  load: async function() {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const f = app.TerminalFoods;
    const m = app.TerminalMeals;

    if (await this.isLoaded()) {
      t.print("demo data is already loaded. demo clear removes it first", "err");
      return;
    }

    // Foods. One you already have with the same name is used as it is, so nothing is duplicated.
    this.byName = {};
    const have = await f.allFoods("");
    let created = 0;
    for (const spec of this.foods) {
      const existing = have.find(x => d.norm(x.name) === d.norm(spec.name));
      if (existing) {
        this.byName[d.norm(spec.name)] = existing;
        continue;
      }

      const food = f.buildFood({
        name: spec.name,
        portion: spec.portion,
        unit: spec.unit,
        nutrition: spec.nutrition,
        servingResolved: spec.serving
      });
      food.demo = true;
      food.id = await f.saveFood(food);
      this.byName[d.norm(spec.name)] = food;
      created++;
    }

    // Meals (skipped if you already have one with that name, or an ingredient does not fit)
    const skipped = [];
    const haveMeals = await m.allMeals();
    let mealsCreated = 0;
    for (const line of this.meals) {
      const def = m.parseDefinition(line);
      if (haveMeals.some(x => d.norm(x.name) === d.norm(def.name))) continue;

      const built = await m.build(def.name, def.ingredients);
      if (built.error) {
        skipped.push("meal " + def.name + " (" + built.error + ")");
        continue;
      }
      await m.saveMeal({ name: def.name, items: built.items, refs: built.refs, archived: false, dateTime: new Date(), demo: true });
      mealsCreated++;
    }

    // Recipes (skipped if you already have one with that name, or an ingredient does not fit)
    const r = app.TerminalRecipes;
    const haveRecipes = await r.allRecipes("");
    let recipesCreated = 0;
    for (const line of this.recipes) {
      const def = r.parseDefinition(line);
      if (haveRecipes.some(x => d.norm(x.name) === d.norm(def.name))) continue;

      const built = await m.build(def.name, def.ingredients);
      const parsed = r.parseYield(def.yieldTokens || []);
      if (built.error || !parsed) {
        skipped.push("recipe " + def.name + " (" + (built.error || "no yield") + ")");
        continue;
      }

      const recipe = await r.fromBuilt(def.name, built, "ingredients");
      recipe.portion = parsed.portion;
      recipe.unit = parsed.unit;
      recipe.demo = true;
      await r.saveRecipe(recipe);
      recipesCreated++;
    }

    this.prepareBodyFields();

    // Days
    let items = 0;
    const today = t.isoDate(new Date());
    const now = new Date();
    const nowClock = d.clock(now);

    for (let i = 0; i < this.days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const iso = t.isoDate(date);
      const lastDay = i === 0;

      let plan = this.breakfast
        .concat(this.lunches[i % 3])
        .concat(this.snacks[(i + 1) % 3])
        .concat(this.dinners[i % this.dinners.length]);

      // Today only has what would already have happened
      if (lastDay) plan = plan.filter(p => p[0] <= nowClock);

      // Now and then a day with nothing logged, as happens
      if (i % 9 === 8) plan = [];

      const existing = await d.getEntry(iso);
      const entry = existing || d.newEntry(iso);
      if (!existing) entry.demo = true;

      for (const step of plan) {
        try {
          items += await this.addStep(entry, iso, step);
        } catch (err) {
          const why = step[2] + " (" + err.message + ")";
          if (!skipped.includes(why)) skipped.push(why);
        }
      }

      // An occasional restaurant meal that was only a rough estimate
      if (i === 4 || i === 11) {
        const base = await app.Foodlist.getQuickAddItem();
        entry.items.push({ id: base.id, portion: base.portion, type: "food", quantity: 700, dateTime: d.stamp(iso, "21:05"), category: this.mealIndex("dinner"), description: "pizza at the restaurant", demo: true });
        items++;
      }

      entry.stats = entry.stats || {};
      entry.demoStats = entry.demoStats || [];
      const body = this.body(i);
      Object.keys(body).forEach((key) => {
        if (entry.stats[key] === undefined) {
          entry.stats[key] = body[key];
          entry.demoStats.push(key);
        }
      });

      await d.saveEntry(entry);
    }

    d.refreshFoodNames();
    t.print("loaded " + created + " foods, " + mealsCreated + " meals, " + recipesCreated + " recipes, " + this.days + " days of entries (" + items + " items) and body measurements", "ok");
    if (skipped.length > 0)
      t.print("skipped, because your own foods differ: " + skipped.join("; "), "muted");
    t.print("try: cd diary, cd today, ls, cd ../foods, cd ../meals. demo clear removes it all", "muted");
  },

  mealIndex: function(name) {
    const meal = app.TerminalDiary.findMeal(name);
    return meal ? meal.index : 0;
  },

  // Add one line of a day's plan to an entry. Returns how many items were added.
  addStep: async function(entry, iso, step) {
    const d = app.TerminalDiary;
    const f = app.TerminalFoods;
    const m = app.TerminalMeals;
    const when = d.stamp(iso, step[0]);
    const category = this.mealIndex(step[1]);
    const what = step[2];

    if (what.startsWith("recipe:")) {
      const parsedRecipe = d.parseAmount(app.Terminal.tokenize(what.slice(7)));
      const recipeName = parsedRecipe.rest.join(" ");
      const recipe = (await app.TerminalRecipes.find(recipeName)).find(x => d.norm(x.name) === d.norm(recipeName));
      if (!recipe) throw new Error("recipe not available");

      const chosen = d.toItemAmount(recipe, parsedRecipe.amount);
      if (chosen.error) throw new Error(chosen.error);

      entry.items.push({ id: recipe.id, portion: chosen.portion, quantity: chosen.quantity, type: "recipe", dateTime: when, category: category, demo: true });
      return 1;
    }

    if (what.startsWith("meal:")) {
      const name = what.slice(5);
      const found = (await m.find(name)).find(x => d.norm(x.name) === d.norm(name));
      if (!found) throw new Error("meal not available");
      const resolved = await m.resolveIngredients(found);
      if (resolved.error) throw new Error(resolved.error);

      resolved.ingredients.forEach((x) => {
        entry.items.push({ id: x.food.id, portion: x.portion, quantity: x.quantity, type: "food", dateTime: when, category: category, demo: true });
      });
      return resolved.ingredients.length;
    }

    const parsed = d.parseAmount(app.Terminal.tokenize(what));
    const query = parsed.rest.join(" ");
    const food = this.byName[d.norm(query)];
    if (!food) throw new Error("food missing");

    const amount = d.toItemAmount(food, parsed.amount);
    if (amount.error) throw new Error(amount.error);

    entry.items.push({ id: food.id, portion: amount.portion, quantity: amount.quantity, type: "food", dateTime: when, category: category, demo: true });
    return 1;
  },

  clear: async function() {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    let items = 0;
    let days = 0;
    let kept = 0;
    let keptActive = 0;

    // Diary: take out the demo items and demo body values
    const entries = await dbHandler.getAllItems("diary");
    for (const entry of entries) {
      const before = entry.items.length;
      entry.items = entry.items.filter(i => !i.demo);
      items += before - entry.items.length;

      const hadStats = (entry.demoStats || []).length > 0;
      (entry.demoStats || []).forEach((key) => { delete entry.stats[key]; });
      delete entry.demoStats;

      const changed = before !== entry.items.length || hadStats;
      if (!changed && !entry.demo) continue;

      if (entry.demo && entry.items.length === 0 && Object.keys(entry.stats || {}).length === 0) {
        await this.remove(entry.id, "diary");
        days++;
      } else {
        delete entry.demo;
        await d.saveEntry(entry);
      }
    }

    // Meals made by the demo
    const meals = await dbHandler.getAllItems("meals");
    let mealCount = 0;
    for (const meal of meals) {
      if (meal && meal.demo === true) {
        await this.remove(meal.id, "meals");
        mealCount++;
      }
    }

    // Recipes and foods are deleted, unless something of yours still points at one:
    // - your meals and recipes find their foods by name, so those foods stay active;
    // - if only days you logged use one, it is archived (hidden from lists, kept for the history).
    const stillUsed = new Set();
    const inTemplates = new Set();
    const recipesUsed = new Set();
    (await dbHandler.getAllItems("diary")).forEach(e => e.items.forEach((i) => {
      if (i.type === "recipe") recipesUsed.add(i.id);
      else stillUsed.add(i.id);
    }));
    (await dbHandler.getAllItems("meals")).forEach(ml => (ml.items || []).forEach(i => inTemplates.add(i.id)));
    (await dbHandler.getAllItems("recipes")).forEach(rc => { if (!rc.demo) (rc.items || []).forEach(i => inTemplates.add(i.id)); });

    let recipeCount = 0;
    for (const recipe of await dbHandler.getAllItems("recipes")) {
      if (!recipe || recipe.demo !== true) continue;

      if (recipesUsed.has(recipe.id)) {
        recipe.archived = true;
        delete recipe.demo;
        await app.TerminalRecipes.saveRecipe(recipe);
        kept++;
      } else {
        await this.remove(recipe.id, "recipes");
        recipeCount++;
      }
    }

    const foods = await dbHandler.getAllItems("foodList");
    let foodCount = 0;
    for (const food of foods) {
      if (!food || food.demo !== true) continue;

      if (inTemplates.has(food.id)) {
        delete food.demo;
        await app.TerminalFoods.saveFood(food);
        keptActive++;
      } else if (stillUsed.has(food.id)) {
        food.archived = true;
        delete food.demo;
        await app.TerminalFoods.saveFood(food);
        kept++;
      } else {
        await this.remove(food.id, "foodList");
        foodCount++;
      }
    }

    await this.restoreBodyFields();

    d.refreshFoodNames();
    t.print("removed " + foodCount + " foods, " + mealCount + " meals, " + recipeCount + " recipes, " + items + " diary items and " + days + " demo days", "ok");
    if (keptActive > 0)
      t.print(keptActive + " demo foods stay, because your own meals or recipes use them", "muted");
    if (kept > 0)
      t.print(kept + " demo foods or recipes are in days you logged, so they were archived instead of deleted", "muted");
  }
};

app.Terminal.commands.demo = {
  usage: "demo load | clear | status",
  desc: "sample foods, meals, 14 days of entries and body data for showing the app. clear removes only the sample data",
  complete: (args) => (args.length === 0 ? ["load", "clear", "status"] : []),
  run: async (args) => {
    const t = app.Terminal;
    const demo = app.TerminalDemo;
    const action = (args[0] || "").toLowerCase();

    if (action === "status") {
      t.print((await demo.isLoaded()) ? "demo data is loaded" : "no demo data", "muted");
    } else if (action === "load") {
      if (await demo.isLoaded()) {
        t.print("demo data is already loaded. demo clear removes it first", "err");
        return;
      }
      t.ask("this adds sample foods, meals, 14 days of entries and body data. your own data stays. continue? (y)", async (line) => {
        if (/^y(es)?$/i.test(line.trim())) await demo.load();
        else t.print("cancelled", "muted");
      });
    } else if (action === "clear") {
      t.ask("this removes only the sample data. your own data stays. continue? (y)", async (line) => {
        if (/^y(es)?$/i.test(line.trim())) await demo.clear();
        else t.print("cancelled", "muted");
      });
    } else {
      t.print("usage: demo load | clear | status", "err");
    }
  }
};
