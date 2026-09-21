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
  Saved meals ("templates") for things you eat often, like a sandwich made of
  several foods. + <meal> logs every ingredient as its own entry, so the diary
  stays detailed and each one can be edited later.

  A meal remembers its ingredients by name, and looks up the current version of
  each food when it is used. When a food changes (a new version), the meal picks
  it up, and days already logged are not touched.

  Meals are stored in the app's own meals store, so they are part of backups
  and visible in the regular meals screen.
*/
app.TerminalMeals = {

  lastList: undefined, // Meals in the order the last ls showed them

  // ---------------------------------------------------------------------
  // Reading what the user typed
  // ---------------------------------------------------------------------

  // "sandwich = white bread 2 slices, gouda 2 slices, mayo 10g"
  // The text is what follows the command word.
  parseDefinition: function(text) {
    const d = app.TerminalDiary;
    const at = text.indexOf("=");
    const left = (at === -1 ? text : text.slice(0, at)).trim().replace(/^"(.*)"$/, "$1");
    const right = at === -1 ? "" : text.slice(at + 1);

    const ingredients = [];
    for (const part of right.split(",")) {
      const tokens = app.Terminal.tokenize(part);
      if (tokens.length === 0) continue;

      let parsed = d.parseAmount(tokens);
      if (parsed.rest.length === 0) parsed = { amount: undefined, rest: tokens }; // a name that looks like an amount

      ingredients.push({ name: parsed.rest.join(" "), amount: parsed.amount });
    }
    return { name: left, ingredients: ingredients };
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------

  saveMeal: function(meal) {
    return new Promise((resolve, reject) => {
      const request = dbHandler.put(meal, "meals");
      request.addEventListener("success", () => { resolve(request.result); });
      request.addEventListener("error", () => { reject(request.error); });
    });
  },

  allMeals: async function() {
    const d = app.TerminalDiary;
    const all = await dbHandler.getAllItems("meals");
    return all
      .filter(m => m && m.name && !m.archived)
      .sort((a, b) => (d.norm(a.name) < d.norm(b.name) ? -1 : 1));
  },

  // Meals whose name contains what was typed
  find: async function(query) {
    const d = app.TerminalDiary;
    const q = d.norm(query);
    return (await this.allMeals()).filter(m => d.norm(m.name).includes(q));
  },

  names: async function() {
    try {
      return (await this.allMeals()).map(m => m.name);
    } catch (err) {
      return [];
    }
  },

  // ---------------------------------------------------------------------
  // Working out what a meal is made of right now
  // ---------------------------------------------------------------------

  // The current food for a name: exactly one match, or an error message
  resolveFood: async function(name) {
    const d = app.TerminalDiary;
    const found = await d.findFoods(name);

    if (found.length === 1) return { food: found[0] };
    if (found.length === 0) return { error: "no food named \"" + name + "\". create it with new" };
    return { error: "several foods match \"" + name + "\" (" + found.slice(0, 4).map(f => f.name).join(", ") + "). use the full name" };
  },

  // Ingredients with their food and stored amount, using the latest version of each food.
  // Meals made in the regular screen have no names, so their food ids are used instead.
  resolveIngredients: async function(meal) {
    const d = app.TerminalDiary;
    const result = [];

    if (meal.refs && meal.refs.length > 0) {
      for (const ref of meal.refs) {
        const found = await this.resolveFood(ref.name);
        if (found.error) return { error: meal.name + ": " + found.error };

        const amount = d.toItemAmount(found.food, ref.amount);
        if (amount.error) return { error: meal.name + ": " + amount.error };
        result.push({ food: found.food, portion: amount.portion, quantity: amount.quantity });
      }
      return { ingredients: result };
    }

    for (const item of (meal.items || [])) {
      const food = await dbHandler.getByKey(item.id, "foodList");
      if (!food) return { error: meal.name + ": one of its foods no longer exists" };
      result.push({ food: food, portion: parseFloat(item.portion), quantity: parseFloat(item.quantity) || 1 });
    }
    return { ingredients: result };
  },

  totalEnergy: function(ingredients) {
    const d = app.TerminalDiary;
    return ingredients.reduce((sum, x) => sum + d.foodEnergy(x.food, x.portion, x.quantity), 0);
  },

  // ---------------------------------------------------------------------
  // Creating and changing
  // ---------------------------------------------------------------------

  // Build the stored meal from typed ingredients, checking that each food exists
  build: async function(name, typed) {
    const d = app.TerminalDiary;
    const refs = [];
    const items = [];

    for (const ingredient of typed) {
      const found = await this.resolveFood(ingredient.name);
      if (found.error) return { error: found.error };

      const amount = d.toItemAmount(found.food, ingredient.amount);
      if (amount.error) return { error: amount.error };

      refs.push({ name: found.food.name, amount: ingredient.amount || null });
      items.push({ id: found.food.id, type: "food", portion: amount.portion, quantity: amount.quantity });
    }
    return { refs: refs, items: items };
  },

  create: async function(text) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const def = this.parseDefinition(text);

    if (def.name === "") {
      t.print("usage: new <name> = <food> [amount], <food> [amount], ...   e.g. new sandwich = white bread 2 slices, gouda 2 slices, mayo 10g", "err");
      return;
    }

    if (def.ingredients.length === 0) {
      t.print("what is in " + def.name + "? e.g. new " + def.name + " = white bread 2 slices, gouda 2 slices", "muted");
      return;
    }

    const existing = (await this.allMeals()).find(m => d.norm(m.name) === d.norm(def.name));
    if (existing) {
      t.print("you already have a meal called " + def.name + ". change it with: edit " + def.name + " = ...", "err");
      return;
    }

    const built = await this.build(def.name, def.ingredients);
    if (built.error) {
      t.print("new: " + built.error, "err");
      return;
    }

    await this.saveMeal({ name: def.name, items: built.items, refs: built.refs, archived: false, dateTime: new Date() });
    d.refreshFoodNames();

    const resolved = await this.resolveIngredients({ name: def.name, refs: built.refs });
    t.print("saved meal " + def.name + " · " + built.items.length + " items" + (resolved.ingredients ? " → " + d.energyLabel(this.totalEnergy(resolved.ingredients)) : ""), "ok");
    t.print("log it with: + " + def.name, "muted");
  },

  replace: async function(meal, text) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const def = this.parseDefinition(text);

    if (def.ingredients.length === 0) {
      t.print("usage: edit <n|name> = <food> [amount], <food> [amount], ...", "err");
      return;
    }

    const built = await this.build(meal.name, def.ingredients);
    if (built.error) {
      t.print("edit: " + built.error, "err");
      return;
    }

    meal.items = built.items;
    meal.refs = built.refs;
    meal.dateTime = new Date();
    await this.saveMeal(meal);
    d.refreshFoodNames();

    t.print("updated meal " + meal.name + " · " + built.items.length + " items", "ok");
  },

  archive: async function(meal) {
    meal.archived = true;
    await this.saveMeal(meal);
    app.TerminalDiary.refreshFoodNames();
    app.Terminal.print("deleted meal " + meal.name + ". days already logged are not affected", "ok");
  },

  // ---------------------------------------------------------------------
  // Using a meal
  // ---------------------------------------------------------------------

  // Log every ingredient of a meal. amount is a plain number of times (2x, 0.5), or none.
  // ctx: { iso, when, meal, where } from the + command.
  log: async function(meal, amount, ctx) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    let times = 1;
    if (amount) {
      if (!amount.times || isNaN(amount.value)) {
        t.print("a meal is scaled with a plain number: + " + meal.name + " 2x, or 0.5", "err");
        return;
      }
      times = amount.value;
    }

    const resolved = await this.resolveIngredients(meal);
    if (resolved.error) {
      t.print(resolved.error, "err");
      return;
    }

    const entry = (await d.getEntry(ctx.iso)) || d.newEntry(ctx.iso);
    const undoItems = [];
    let energy = 0;

    resolved.ingredients.forEach((x) => {
      const item = { id: x.food.id, portion: x.portion, quantity: x.quantity * times, type: "food", dateTime: ctx.when, category: ctx.meal.index };
      entry.items.push(item);
      undoItems.push({ t: ctx.when.getTime(), id: x.food.id });
      energy += d.foodEnergy(x.food, x.portion, x.quantity * times);
    });

    await d.saveEntry(entry);
    t.pushUndo({ kind: "addedMany", date: ctx.iso, items: undoItems });

    t.print("+ " + meal.name + (times !== 1 ? " ×" + d.fmt(times) : "") + " (" + resolved.ingredients.length + " items) → " + d.energyLabel(energy) + " (" + ctx.where + ")", "ok");
    resolved.ingredients.forEach((x) => {
      const shown = d.amountText(x.food, { portion: x.portion, quantity: x.quantity * times });
      t.print("  " + x.food.name + (shown ? " · " + shown : ""), "muted");
    });
  },

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------

  summary: async function(meal) {
    const resolved = await this.resolveIngredients(meal);
    if (resolved.error) return { text: resolved.error, energy: undefined };

    const d = app.TerminalDiary;
    const names = resolved.ingredients.map((x) => {
      const shown = d.amountText(x.food, { portion: x.portion, quantity: x.quantity });
      return x.food.name + (shown ? " " + shown : "");
    });
    return { text: names.join(" · "), energy: this.totalEnergy(resolved.ingredients), count: resolved.ingredients.length };
  },

  showMeals: async function() {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const meals = await this.allMeals();
    this.lastList = meals;

    if (meals.length === 0) {
      t.print("(no meals yet. try: new sandwich = white bread 2 slices, gouda 2 slices)", "muted");
      return;
    }

    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      const info = await this.summary(meal);

      const node = d.el("div", "term-line term-food");
      node.appendChild(d.el("span", "n", String(i + 1)));

      const name = d.el("span", "name", meal.name);
      name.appendChild(d.el("span", "sep", " · "));
      name.appendChild(d.el("span", "qty", (info.count !== undefined ? info.count : (meal.items || []).length) + " items"));
      node.appendChild(name);

      node.appendChild(d.el("span", info.energy === undefined ? "kcal muted" : "kcal", info.energy === undefined ? "check" : d.energyLabel(info.energy)));
      node.appendChild(d.el("div", "macros", info.text));

      node.addEventListener("click", () => { this.showActions(meal); });
      t.printNode(node, true);
    }
  },

  printDetails: async function(meal) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const resolved = await this.resolveIngredients(meal);

    t.print(meal.name, "cyan");
    if (resolved.error) {
      t.print(resolved.error, "err");
      return;
    }

    resolved.ingredients.forEach((x) => {
      const shown = d.amountText(x.food, { portion: x.portion, quantity: x.quantity });
      t.print(x.food.name.padEnd(22) + (shown || "").padEnd(12) + d.energyLabel(d.foodEnergy(x.food, x.portion, x.quantity)));
    });
    t.print("total".padEnd(34) + d.energyLabel(this.totalEnergy(resolved.ingredients)), "accent");
  },

  showActions: function(meal) {
    const t = app.Terminal;

    t.printChoices([{
      text: "details",
      run: () => { this.printDetails(meal); }
    }, {
      text: "log it",
      run: () => {
        t.ask("how many " + meal.name + "? e.g. 1, 0.5, 2x", async (line) => {
          await t.run("+ \"" + meal.name + "\" " + line);
        });
      }
    }, {
      text: "delete (days already logged are not affected)",
      run: () => { t.guard(() => this.archive(meal)); }
    }]);
  },

  // Finds a meal from a number in the last ls, or from a name
  pick: async function(text) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (/^\d+$/.test(text)) {
      if (!this.lastList) this.lastList = await this.allMeals();
      const meal = this.lastList[parseInt(text, 10) - 1];
      if (!meal) t.print("no meal " + text + " in the last list", "err");
      return meal;
    }

    const found = await this.find(text);
    const exact = found.filter(m => d.norm(m.name) === d.norm(text));
    const pool = exact.length > 0 ? exact : found;

    if (pool.length === 0) t.print("no meal matches \"" + text + "\"", "err");
    else if (pool.length > 1) t.print("several meals match \"" + text + "\". use its number from ls", "err");
    else return pool[0];
    return undefined;
  }
};

// ---------------------------------------------------------------------
// Commands: inside ~/meals, new/cat/rm/edit act on meals
// ---------------------------------------------------------------------

(function() {
  const inMeals = () => app.Terminal.cwd.length === 1 && app.Terminal.cwd[0] === "meals";
  const m = app.TerminalMeals;

  const share = (name, mealsRun, note) => {
    const command = app.Terminal.commands[name];
    const previous = command.run;
    command.run = async (args, line) => {
      if (inMeals()) await mealsRun(args, line);
      else await previous(args, line);
    };
    command.desc += " " + note;
  };

  // The text after the command word, exactly as typed
  const afterCommand = (line) => line.replace(/^\s*\S+\s*/, "");

  share("new", async (args, line) => { await m.create(afterCommand(line)); },
    "(in ~/meals: a meal. new sandwich = white bread 2 slices, gouda 2 slices, mayo 10g)");

  share("cat", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: cat <n|name>", "err");
      return;
    }
    const meal = await m.pick(args.join(" "));
    if (meal) await m.printDetails(meal);
  }, "(in ~/meals: a meal)");

  share("rm", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: rm <n|name>", "err");
      return;
    }
    const meal = await m.pick(args.join(" "));
    if (meal) await m.archive(meal);
  }, "(in ~/meals: deletes a meal)");

  share("edit", async (args, line) => {
    const text = afterCommand(line);
    const at = text.indexOf("=");
    if (at === -1) {
      app.Terminal.print("usage: edit <n|name> = <food> [amount], <food> [amount], ...", "err");
      return;
    }
    const meal = await m.pick(text.slice(0, at).trim().replace(/^"(.*)"$/, "$1"));
    if (meal) await m.replace(meal, meal.name + " " + text.slice(at));
  }, "(in ~/meals: replaces a meal's ingredients)");
})();

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "meals",
  run: () => app.TerminalMeals.showMeals()
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "meals")
    await app.TerminalMeals.showMeals();
});
