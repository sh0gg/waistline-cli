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
  The food log as seen from the terminal: ~/diary lists days, ~/diary/<date>
  lists that day's entries, and + / edit / mv / rm / undo change them.
  Data is stored exactly as the regular diary screen stores it.
*/
app.TerminalDiary = {

  foodNames: undefined, // Cached for autocomplete

  // ---------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------

  norm: function(text) {
    return app.Utils.normalizeText(String(text).toLowerCase());
  },

  // Number, or NaN. Accepts 60, 0.5, 0,5 and 1/2
  parseNumber: function(text) {
    if (/^\d+\/\d+$/.test(text)) {
      const parts = text.split("/").map(Number);
      return parts[1] ? parts[0] / parts[1] : NaN;
    }
    if (/^\d+(?:[.,]\d+)?$/.test(text))
      return parseFloat(text.replace(",", "."));
    return NaN;
  },

  fmt: function(number) {
    return String(Math.round(number * 10) / 10);
  },

  grouped: function(number) {
    return Math.round(number).toLocaleString("en-US");
  },

  energyLabel: function(energy) {
    const unit = app.Settings.get("units", "energy");
    const symbol = (app.strings["unit-symbols"] || {})[unit] || unit;
    return this.grouped(energy) + " " + symbol;
  },

  // ---------------------------------------------------------------------
  // Amounts: 60g, 0.5, 2x, 1/2, 2 slices
  // ---------------------------------------------------------------------

  // Splits an amount off the end of the tokens. Returns { amount, rest }.
  parseAmount: function(tokens) {
    const last = tokens[tokens.length - 1] || "";
    const joined = /^(\d+(?:[.,]\d+)?|\d+\/\d+)([^\d\s.,\/]\S*)?$/.exec(last);

    if (joined) {
      const value = this.parseNumber(joined[1]);
      const unit = joined[2];
      const times = unit === undefined || /^[x×]$/i.test(unit);
      return {
        amount: { value: value, unit: times ? undefined : unit, times: times, bare: unit === undefined },
        rest: tokens.slice(0, -1)
      };
    }

    // "2 slices": number and unit as separate words
    const previous = tokens[tokens.length - 2];
    if (previous !== undefined && /^[^\d\s]+$/.test(last) && !isNaN(this.parseNumber(previous))) {
      const times = /^[x×]$/i.test(last);
      return {
        amount: { value: this.parseNumber(previous), unit: times ? undefined : last, times: times, bare: false },
        rest: tokens.slice(0, -2)
      };
    }

    return { amount: undefined, rest: tokens };
  },

  // Common spellings of units, reduced to a base unit and a factor
  normalizeUnit: function(unit) {
    const u = String(unit || "").toLowerCase();
    const table = {
      g: ["g", 1], gr: ["g", 1], gram: ["g", 1], grams: ["g", 1],
      kg: ["g", 1000],
      ml: ["ml", 1], cl: ["ml", 10], dl: ["ml", 100], l: ["ml", 1000], liter: ["ml", 1000], litre: ["ml", 1000]
    };
    if (table[u]) return { unit: table[u][0], factor: table[u][1] };
    return { unit: u.replace(/s$/, ""), factor: 1 }; // slices -> slice
  },

  // Turns what was typed into the portion and quantity stored in the diary.
  // A bare number multiplies the food's portion (0.5 = half); a number with a
  // unit sets the portion itself (60g).
  toItemAmount: function(food, amount) {
    const base = parseFloat(food.portion);

    // A recipe's portion is the whole batch it makes (4 portions, 800 g), so amounts read differently
    const isRecipe = Array.isArray(food.items);
    const byWeight = ["g", "ml"].includes(this.normalizeUnit(food.unit).unit);

    if (!amount) {
      if (isRecipe && byWeight) return { error: "how much " + food.name + "? e.g. 300g, or 0.25 of the whole" };
      return isRecipe ? { portion: 1, quantity: 1 } : { portion: base, quantity: 1 };
    }
    if (isNaN(amount.value)) return { error: "could not read the amount" };

    // In a recipe made in portions, a plain number is how many portions (not multiples of the whole batch)
    if (isRecipe && !byWeight && amount.times) return { portion: amount.value, quantity: 1 };
    if (amount.times) return { portion: base, quantity: amount.value };

    const typed = this.normalizeUnit(amount.unit);
    const own = this.normalizeUnit(food.unit);

    // A serving with a name ("bag" = 125 g) turns "2 bags" into an amount in the food's own unit
    if (food.serving && this.normalizeUnit(food.serving.name).unit === typed.unit)
      return { portion: amount.value * food.serving.size, quantity: 1 };

    if (typed.unit !== own.unit)
      return { error: food.name + " is counted in " + (food.unit ? (isRecipe ? this.plural(food.unit, 2) : food.unit) : "portions") + ", not " + amount.unit };

    return { portion: (amount.value * typed.factor) / own.factor, quantity: 1 };
  },

  // ---------------------------------------------------------------------
  // Tags: @08:12  @yesterday  @2026-09-18  @lunch
  // ---------------------------------------------------------------------

  splitTags: function(tokens) {
    const t = app.Terminal;
    const result = { plain: [] };

    tokens.forEach((token) => {
      if (!token.startsWith("@") || token.length < 2) {
        result.plain.push(token);
        return;
      }

      const tag = token.slice(1);
      const time = /^(\d{1,2}):(\d{2})$/.exec(tag);
      const alias = t.dateAlias(tag.toLowerCase());

      if (time) {
        if (parseInt(time[1], 10) > 23 || parseInt(time[2], 10) > 59)
          result.error = "not a valid time: " + token;
        else
          result.time = time[1].padStart(2, "0") + ":" + time[2];
      } else if (alias) {
        result.date = alias;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(tag)) {
        if (t.isValidDate(tag)) result.date = tag;
        else result.error = "not a valid date: " + token;
      } else {
        result.meal = tag;
      }
    });

    return result;
  },

  // ---------------------------------------------------------------------
  // Meals (the diary's groups, named in settings)
  // ---------------------------------------------------------------------

  meals: function() {
    const names = app.Settings.get("diary", "meal-names") || [];
    const localized = (app.strings.diary && app.strings.diary["default-meals"]) || {};

    return names
      .map((raw, index) => ({ index: index, raw: raw }))
      .filter(m => m.raw && m.raw !== "")
      .map(m => ({ index: m.index, name: m.raw.toLowerCase(), raw: m.raw.toLowerCase(), alt: (localized[m.raw.toLowerCase()] || m.raw).toLowerCase() }));
  },

  findMeal: function(text) {
    const strip = (x) => this.norm(x).replace(/\s+/g, "");
    const q = strip(text);
    const meals = this.meals();

    // The terminal shows the names as stored (English by default); the translated ones work too
    const exact = meals.find(m => strip(m.name) === q || strip(m.alt) === q);
    if (exact) return exact;

    const partial = meals.filter(m => strip(m.name).startsWith(q) || strip(m.alt).startsWith(q));
    return partial.length === 1 ? partial[0] : undefined;
  },

  mealName: function(index) {
    const meal = this.meals().find(m => m.index === index);
    return meal ? meal.name : "meal " + (index + 1);
  },

  // Morning = first meal, midday = second, evening = third, otherwise the fourth
  mealForHour: function(hour) {
    const meals = this.meals();
    if (meals.length === 0) return { index: 0, name: "meal 1", raw: "" };

    const slot = hour < 11 ? 0 : hour < 16 ? 1 : hour < 21 ? 2 : 3;
    return meals[Math.min(slot, meals.length - 1)];
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------

  dateKey: function(iso) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  },

  localDate: function(iso) {
    const p = iso.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  },

  // The moment an entry is stamped with: that day, at the given time or the current one
  stamp: function(iso, time) {
    const p = iso.split("-").map(Number);
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    if (time) {
      hours = parseInt(time.split(":")[0], 10);
      minutes = parseInt(time.split(":")[1], 10);
      seconds = 0;
    }
    return new Date(p[0], p[1] - 1, p[2], hours, minutes, seconds);
  },

  getEntry: function(iso) {
    return dbHandler.get("diary", "dateTime", this.dateKey(iso));
  },

  newEntry: function(iso) {
    return { dateTime: this.dateKey(iso), items: [], stats: {} };
  },

  saveEntry: function(entry) {
    return new Promise((resolve, reject) => {
      const request = dbHandler.put(entry, "diary");
      request.addEventListener("success", () => { resolve(); });
      request.addEventListener("error", () => { reject(request.error); });
    });
  },

  // Foods that can be logged (not archived, not hidden)
  findFoods: async function(query) {
    const list = await dbHandler.getAllItems("foodList");
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = app.FoodsMealsRecipes.filterList(escaped, [], list);

    // An exact name beats partial matches, so "apple" is not blocked by "apple pie"
    const q = this.norm(query);
    const exact = found.filter(f => this.norm(f.name) === q);
    return exact.length > 0 ? exact : found;
  },

  refreshFoodNames: async function() {
    try {
      const list = await dbHandler.getAllItems("foodList");
      const usable = app.FoodsMealsRecipes.filterList("", [], list);
      const names = usable.map(f => f.name).filter(Boolean);
      const meals = app.TerminalMeals ? await app.TerminalMeals.names() : [];
      const recipes = app.TerminalRecipes ? await app.TerminalRecipes.names() : [];
      this.foodNames = names.concat(meals, recipes);
    } catch (err) {
      this.foodNames = [];
    }
  },

  // Energy of a food for a given portion and quantity, in the user's unit
  foodEnergy: function(food, portion, quantity) {
    const multiplier = (portion / parseFloat(food.portion)) * quantity;
    const nutrition = food.nutrition || {};
    const scaled = { calories: (nutrition.calories || 0) * multiplier };

    if (nutrition.kilojoules !== undefined)
      scaled.kilojoules = nutrition.kilojoules * multiplier;

    return app.FoodsMealsRecipes.getItemEnergy(scaled);
  },

  // ---------------------------------------------------------------------
  // Reading a day
  // ---------------------------------------------------------------------

  // The day's entries in the order shown, numbered from 1. The same order is
  // rebuilt every time, so the numbers in "rm 3" match what ls printed.
  getRows: async function(iso) {
    const entry = await this.getEntry(iso);
    if (!entry || !entry.items) return { entry: entry, rows: [] };

    const rows = await Promise.all(entry.items.map(async (item, index) => {
      const food = await app.FoodsMealsRecipes.getItem(item.id, item.type, item.portion, item.quantity);
      const isQuick = !!food && food.barcode === "quick-add";
      const nutrition = (food && food.nutrition) || {};

      let name = "(deleted food)";
      if (isQuick) name = item.description || "quick add";
      else if (food) name = food.name;

      return {
        index: index,
        item: item,
        food: food,
        isQuick: isQuick,
        name: name,
        brand: food && !isQuick ? food.brand : undefined,
        time: new Date(item.dateTime),
        category: item.category,
        nutrition: nutrition,
        energy: app.FoodsMealsRecipes.getItemEnergy(nutrition),
        amountText: isQuick ? "" : this.amountText(food, item)
      };
    }));

    const sorted = rows.slice().sort((a, b) => {
      const ca = a.category === undefined ? 99 : a.category;
      const cb = b.category === undefined ? 99 : b.category;
      return (ca - cb) || (a.time - b.time) || (a.index - b.index);
    });
    sorted.forEach((row, i) => { row.n = i + 1; });

    return { entry: entry, rows: sorted };
  },

  // "60g", "60g x2", "2x"
  amountText: function(food, item) {
    if (!food) return "";
    const portion = parseFloat(item.portion);
    const quantity = parseFloat(item.quantity);
    const unit = food.unit;

    if (!unit) return this.fmt(portion * quantity) + "×";

    const spaced = app.standardUnits && app.standardUnits.includes(unit) ? unit : " " + this.plural(unit, portion);
    return this.fmt(portion) + spaced + (quantity !== 1 ? " ×" + this.fmt(quantity) : "");
  },

  // "slice" -> "slices" unless the amount is exactly one
  plural: function(unit, amount) {
    const abbreviations = ["tbsp", "tsp", "oz", "lb", "cl", "dl", "kg", "mg"]; // written the same in plural
    if (abbreviations.includes(String(unit).toLowerCase())) return unit;
    return (amount !== 1 && !/s$/i.test(unit)) ? unit + "s" : unit;
  },

  macroText: function(nutrition) {
    const parts = [["fat", "fat"], ["carbohydrates", "carb"], ["proteins", "protein"]]
      .filter(p => nutrition[p[0]] !== undefined && !isNaN(nutrition[p[0]]))
      .map(p => p[1] + " " + this.fmt(nutrition[p[0]]) + "g");
    return parts.join(" · ");
  },

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------

  el: function(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = app.TerminalI18n ? app.TerminalI18n.tr(String(text)) : text;
    return node;
  },

  clock: function(date) {
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  },

  rowNode: function(row) {
    const node = this.el("div", "term-line term-row");
    node.appendChild(this.el("span", "n", String(row.n)));

    const time = this.el("span", "time", this.clock(row.time) + " ");
    time.appendChild(this.el("span", "plus", "+"));
    node.appendChild(time);

    const name = this.el("span", "name", row.name);
    if (row.amountText) {
      name.appendChild(this.el("span", "sep", " · "));
      name.appendChild(this.el("span", "qty", row.amountText));
    }
    node.appendChild(name);

    const pending = row.isQuick && row.energy === 0;
    node.appendChild(this.el("span", pending ? "kcal muted" : "kcal", pending ? "no values yet" : this.energyLabel(row.energy)));

    const sub = [];
    if (row.brand) sub.push(row.brand);
    const macros = row.isQuick ? "" : this.macroText(row.nutrition);
    if (macros) sub.push(macros);
    if (sub.length > 0) node.appendChild(this.el("div", "macros", sub.join(" · ")));

    return node;
  },

  keyValueNode: function(label, valueNodes) {
    const node = this.el("div", "term-line term-kv");
    node.appendChild(this.el("span", "k", label));

    const value = this.el("span", "v");
    valueNodes.forEach((v) => { value.appendChild(typeof v === "string" ? document.createTextNode(v) : v); });
    node.appendChild(value);
    return node;
  },

  // Entries are numbered in display order, so after a change the numbers may have
  // moved. Showing the day again keeps what the user sees in step with rm, mv and edit.
  refreshDay: async function(iso) {
    if (app.Terminal.dayOfCwd() === iso)
      await this.showDay(iso);
  },

  // Print one day: entries grouped by meal, then totals
  showDay: async function(iso) {
    const t = app.Terminal;
    const weekday = app.TerminalI18n.weekday(this.localDate(iso));
    t.print(iso + " " + weekday, "muted");

    const { rows } = await this.getRows(iso);
    if (rows.length === 0) {
      t.print("(no entries. try: + oats 60g)", "muted");
      return;
    }

    let currentCategory;
    rows.forEach((row) => {
      if (row.category !== currentCategory) {
        currentCategory = row.category;
        t.print("# " + (currentCategory === undefined ? "other" : this.mealName(currentCategory)), "muted");
      }

      const node = this.rowNode(row);
      node.addEventListener("click", () => { this.showActions(iso, row); });
      t.printNode(node);
    });

    await this.showTotals(iso);
  },

  showTotals: async function(iso) {
    const t = app.Terminal;
    const entry = await this.getEntry(iso);
    const items = (entry && entry.items) || [];

    const total = await app.FoodsMealsRecipes.getTotalNutrition(items, "ignore");
    const energyUnit = app.Settings.get("units", "energy");
    const energyName = app.Utils.getEnergyUnitName(energyUnit);
    const energy = Math.round(total[energyName] || 0);

    let goal, isMin;
    try {
      const goals = await app.Goals.getGoals([energyName], this.localDate(iso));
      const g = goals[energyName];
      if (g && g.goal !== undefined && !isNaN(g.goal)) {
        goal = g.goal;
        isMin = g.isMin === true;
      }
    } catch (err) {}

    t.printNode(this.el("div", "term-line term-rule"));

    const totalValue = [this.el("b", "num", this.grouped(energy))];
    if (goal !== undefined) totalValue.push(" / " + this.grouped(goal));
    t.printNode(this.keyValueNode("total " + (energyName === "calories" ? "kcal" : "kJ"), totalValue));

    if (goal !== undefined) {
      const diff = Math.round(energy - goal);
      const good = isMin ? diff >= 0 : diff <= 0;
      const balance = this.el("span", good ? "grn" : "bad", (diff > 0 ? "+" : "") + this.grouped(diff) + " " + (energyName === "calories" ? "kcal" : "kJ"));
      t.printNode(this.keyValueNode("balance", [balance]));
    }

    const grams = (name) => this.fmt(total[name] || 0) + "g";
    t.printNode(this.keyValueNode("macros", [
      "fat " + grams("fat") + " / carb " + grams("carbohydrates") + " / ",
      this.el("span", "cy", "protein " + grams("proteins"))
    ]));

    // The day's weight, only when one was measured that day
    if (app.TerminalBody) {
      const weight = await app.TerminalBody.weightRow(iso, entry);
      if (weight) t.printNode(weight);
    }
  },

  // Recent days with entries (or one month, "ls 2026-08"), each tappable
  showDays: async function(args) {
    const t = app.Terminal;
    const month = args && /^\d{4}-\d{2}$/.test(args[0] || "") ? args[0] : undefined;

    const all = await dbHandler.getAllItems("diary");
    let days = all
      .filter(e => e.items && e.items.length > 0)
      .map(e => ({ iso: new Date(e.dateTime).toISOString().slice(0, 10), entry: e }))
      .sort((a, b) => (a.iso < b.iso ? 1 : -1));

    if (month) days = days.filter(d => d.iso.startsWith(month));

    const today = t.isoDate(new Date());
    const total = days.length;
    if (!month) {
      days = days.slice(0, 14);
      if (!days.some(d => d.iso === today))
        days.unshift({ iso: today, entry: undefined });
    }

    if (days.length === 0) {
      t.print("no entries in " + month, "muted");
      return;
    }

    const energyName = app.Utils.getEnergyUnitName(app.Settings.get("units", "energy"));
    const choices = [];

    for (const day of days) {
      let detail = "(empty)";
      if (day.entry) {
        const sum = await app.FoodsMealsRecipes.getTotalNutrition(day.entry.items, "ignore");
        detail = this.energyLabel(sum[energyName] || 0) + "  " + day.entry.items.length + (day.entry.items.length === 1 ? " item" : " items");
      }

      const weekday = app.TerminalI18n.weekday(this.localDate(day.iso));
      choices.push({
        text: day.iso + "  " + weekday + (day.iso === today ? " (today)" : "") + "  " + detail,
        run: () => { t.changeDirectory(["diary", day.iso]); }
      });
    }

    t.printChoices(choices);

    if (!month && total > 14)
      t.print((total - 14) + " older days. ls YYYY-MM shows a month.", "muted");
  },

  // Tapping an entry
  showActions: function(iso, row) {
    const t = app.Terminal;
    const n = row.n;

    const actions = [{
      text: "details",
      run: () => { t.run("cat " + n); }
    }];

    actions.push({
      text: row.isQuick ? "set kcal and name" : "change amount",
      run: () => {
        const question = row.isQuick
          ? "new kcal and name for " + row.name + "? e.g. 800 \"pizza margherita\" (q cancels)"
          : "new amount for " + row.name + "? e.g. 60g, 0.5, 2x (q cancels)";
        t.ask(question, async (line) => {
          await t.run("edit " + n + " " + (row.isQuick ? "kcal " : "") + line);
        });
      }
    });

    actions.push({
      text: "move to another meal",
      run: () => {
        t.printChoices(this.meals().map(meal => ({
          text: meal.name,
          run: () => { t.run("mv " + n + " \"@" + meal.name + "\""); }
        })));
      }
    });

    actions.push({
      text: "move to another day",
      run: () => {
        t.ask("which day for " + row.name + "? YYYY-MM-DD, today or yesterday (q cancels)", async (line) => {
          await t.run("mv " + n + " @" + line.trim());
        });
      }
    });

    actions.push({
      text: "delete",
      run: () => { t.run("rm " + n); }
    });

    t.printChoices(actions);
  },

  // ---------------------------------------------------------------------
  // Changing entries
  // ---------------------------------------------------------------------

  // Number of an entry from what the user typed, or undefined
  pickRows: function(rows, tokens) {
    const picked = [];
    for (const token of tokens) {
      const n = parseInt(token, 10);
      const row = rows.find(r => r.n === n);
      if (!/^\d+$/.test(token) || !row) return { error: "no entry " + token };
      picked.push(row);
    }
    return { picked: picked };
  },

  requireDay: function(command) {
    const iso = app.Terminal.dayOfCwd();
    if (!iso) {
      app.Terminal.print(command + ": go to a day first, e.g. cd diary/today", "err");
      return undefined;
    }
    return iso;
  },

  // Applies @time / @date / @meal (and, for edit, an amount) to entries
  changeEntries: async function(iso, rows, tags, edits) {
    const t = app.Terminal;
    let mealIndex;

    if (tags.meal !== undefined) {
      const meal = this.findMeal(tags.meal);
      if (!meal) {
        t.print("no such meal: " + tags.meal + " (" + this.meals().map(m => m.name).join(", ") + ")", "err");
        return;
      }
      mealIndex = meal.index;
    }

    const targetIso = tags.date || iso;
    const source = await this.getEntry(iso);
    const target = targetIso === iso ? source : ((await this.getEntry(targetIso)) || this.newEntry(targetIso));

    // Work on the stored objects, then remove the moved ones by identity
    const moving = [];
    for (const row of rows) {
      const item = source.items[row.index];
      if (!item) continue;

      if (edits) {
        const changed = edits(row, item);
        if (changed && changed.error) {
          t.print(row.name + ": " + changed.error, "err");
          return;
        }
      }

      if (mealIndex !== undefined) item.category = mealIndex;

      if (tags.time || tags.date) {
        const old = new Date(item.dateTime);
        const time = tags.time || this.clock(old);
        item.dateTime = this.stamp(targetIso, time);
        if (!tags.time) item.dateTime.setSeconds(old.getSeconds());
      }

      if (targetIso !== iso) moving.push(item);
    }

    if (moving.length > 0) {
      source.items = source.items.filter(item => !moving.includes(item));
      target.items = target.items.concat(moving);
      await this.saveEntry(target);
    }
    await this.saveEntry(source);

    t.print("updated " + rows.length + (rows.length === 1 ? " entry" : " entries") + (targetIso !== iso ? " (now on " + targetIso + ")" : ""), "ok");
    await this.refreshDay(iso);
    if (targetIso !== iso) await this.refreshDay(targetIso);
  },

  // ---------------------------------------------------------------------
  // Autocomplete for +
  // ---------------------------------------------------------------------

  completeAdd: function(args, partial) {
    if (partial.startsWith("@")) {
      const names = this.meals().map(m => "@" + m.name.replace(/\s+/g, ""));
      return names.concat(["@today", "@yesterday"]);
    }

    const candidates = args.length === 0 ? ["kcal"] : [];
    (this.foodNames || []).forEach((name) => {
      const words = name.split(/\s+/);
      if (words.length <= args.length) return;

      const matches = args.every((a, i) => this.norm(words[i]) === this.norm(a));
      if (matches) candidates.push(words[args.length]);
    });

    return candidates.filter((c, i) => candidates.indexOf(c) === i);
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

app.Terminal.commands["+"] = {
  usage: "+ <food> [amount] [@when]",
  desc: "log food. amount: 60g, 0.5, 2x, 2 slices. @when: @08:12 @yesterday @2026-09-18 @lunch. quick add: + kcal 650 \"pizza\"",
  complete: (args, partial) => app.TerminalDiary.completeAdd(args, partial),
  run: async (args) => {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const tags = d.splitTags(args);
    if (tags.error) {
      t.print(tags.error, "err");
      return;
    }
    if (tags.plain.length === 0) {
      t.print("usage: + <food> [amount] [@when]", "err");
      return;
    }

    const iso = tags.date || t.dayOfCwd() || t.isoDate(new Date());
    const when = d.stamp(iso, tags.time);

    let meal = d.mealForHour(when.getHours());
    if (tags.meal !== undefined) {
      meal = d.findMeal(tags.meal);
      if (!meal) {
        t.print("no such meal: " + tags.meal + " (" + d.meals().map(m => m.name).join(", ") + ")", "err");
        return;
      }
    }

    const where = meal.name + " " + d.clock(when) + (iso !== t.isoDate(new Date()) ? " on " + iso : "");

    // Quick add: calories without a food
    if (tags.plain[0].toLowerCase() === "kcal") {
      let value = d.parseNumber(tags.plain[1] || "");
      if (isNaN(value)) {
        t.print("usage: + kcal <number> [\"description\"] [@when]", "err");
        return;
      }

      const description = tags.plain.slice(2).join(" ");
      const energyUnit = app.Settings.get("units", "energy");
      if (energyUnit === app.nutrimentUnits.kilojoules)
        value = app.Utils.convertUnit(value, app.nutrimentUnits.kilojoules, app.nutrimentUnits.calories);

      const base = await app.Foodlist.getQuickAddItem();
      const item = { id: base.id, portion: base.portion, type: "food", quantity: value, dateTime: when, category: meal.index };
      if (description) item.description = description;

      const entry = (await d.getEntry(iso)) || d.newEntry(iso);
      entry.items.push(item);
      await d.saveEntry(entry);
      t.pushUndo({ kind: "added", date: iso, t: when.getTime(), id: item.id });

      t.print("+ " + (description || "quick add") + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy({ calories: value })) + " (" + where + ")", "ok");
      if (value === 0) t.print("no values yet. add them later with: edit <n> kcal <number>", "muted");
      return;
    }

    let parsed = d.parseAmount(tags.plain);
    if (parsed.rest.length === 0) parsed = { amount: undefined, rest: tags.plain }; // "7up" is a name, not 7 "up"
    const query = parsed.rest.join(" ").trim();
    if (query === "") {
      t.print("usage: + <food> [amount] [@when]", "err");
      return;
    }

    const register = async (food) => {
      const amount = d.toItemAmount(food, parsed.amount);
      if (amount.error) {
        t.print(amount.error, "err");
        return;
      }

      const item = { id: food.id, portion: amount.portion, quantity: amount.quantity, type: "food", dateTime: when, category: meal.index };
      const entry = (await d.getEntry(iso)) || d.newEntry(iso);
      entry.items.push(item);
      await d.saveEntry(entry);
      t.pushUndo({ kind: "added", date: iso, t: when.getTime(), id: food.id });

      const energy = d.foodEnergy(food, amount.portion, amount.quantity);
      const shown = d.amountText(food, item);
      t.print("+ " + food.name + (shown ? " · " + shown : "") + " → " + d.energyLabel(energy) + " (" + where + ")", "ok");

      if (parsed.amount && parsed.amount.bare && food.unit && app.standardUnits && app.standardUnits.includes(food.unit))
        t.print("that is " + d.fmt(amount.portion * amount.quantity) + food.unit + ". for grams write " + d.fmt(amount.quantity) + food.unit + ". undo takes it back", "muted");
    };

    // Foods and saved meals (templates) can both be logged by name
    const options = [];
    (await d.findFoods(query)).forEach(food => options.push({ kind: "food", food: food, name: food.name }));
    if (app.TerminalMeals)
      (await app.TerminalMeals.find(query)).forEach(template => options.push({ kind: "meal", meal: template, name: template.name }));
    if (app.TerminalRecipes)
      (await app.TerminalRecipes.find(query)).forEach(recipe => options.push({ kind: "recipe", recipe: recipe, name: recipe.name }));

    if (options.length === 0) {
      t.print("nothing matches \"" + query + "\". create a food with new, or quick add: + kcal 300 \"" + query + "\"", "err");
      return;
    }

    // An exact name beats partial matches, whether it is a food or a saved meal
    const exact = options.filter(o => d.norm(o.name) === d.norm(query));
    const shortlist = exact.length > 0 ? exact : options;

    const log = async (option) => {
      if (option.kind === "meal")
        await app.TerminalMeals.log(option.meal, parsed.amount, { iso: iso, when: when, meal: meal, where: where });
      else if (option.kind === "recipe")
        await app.TerminalRecipes.log(option.recipe, parsed.amount, { iso: iso, when: when, meal: meal, where: where });
      else
        await register(option.food);
    };

    if (shortlist.length === 1) {
      await log(shortlist[0]);
      return;
    }

    t.print(shortlist.length + " matches for \"" + query + "\". pick one:", "muted");
    t.printChoices(shortlist.slice(0, 15).map((option) => {
      const food = option.food;
      const text = option.kind === "meal"
        ? option.name + " (meal, " + option.meal.items.length + " items)"
        : option.kind === "recipe"
          ? option.name + " (recipe, makes " + app.TerminalRecipes.yieldText(option.recipe) + ")"
          : food.name + (food.brand ? " (" + food.brand + ")" : "") + " — " + d.energyLabel(d.foodEnergy(food, parseFloat(food.portion), 1)) + " per " + d.fmt(parseFloat(food.portion)) + (food.unit || "");
      return { text: text, run: () => { t.guard(() => log(option)); } };
    }));
  }
};

app.Terminal.commands.undo = {
  usage: "undo",
  desc: "take back the last thing you added or deleted (repeat to go further back)",
  run: async () => {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const operation = t.popUndo();

    if (!operation) {
      t.print("nothing to undo", "muted");
      return;
    }

    // A goal change is in the settings, not in a day
    if (operation.kind === "goal") {
      app.TerminalGoals.restore(operation.stat, operation.before);
      t.print("put the goal for " + operation.stat + " back as it was", "ok");
      return;
    }

    const entry = await d.getEntry(operation.date);
    if (!entry) {
      t.print("nothing to undo: " + operation.date + " has no entries any more", "muted");
      return;
    }

    if (operation.kind === "added") {
      const at = entry.items.findIndex(i => new Date(i.dateTime).getTime() === operation.t && i.id === operation.id && (i.type || "food") === (operation.type || "food"));
      if (at === -1) {
        t.print("that entry is already gone", "muted");
        return;
      }
      entry.items.splice(at, 1);
      await d.saveEntry(entry);
      t.print("removed the last entry you added (" + operation.date + ")", "ok");
      await d.refreshDay(operation.date);
    } else if (operation.kind === "body") {
      await app.TerminalBody.undo(entry, operation);
    } else if (operation.kind === "addedMany") {
      // A whole saved meal that was logged at once
      let removed = 0;
      operation.items.forEach((x) => {
        const at = entry.items.findIndex(i => new Date(i.dateTime).getTime() === x.t && i.id === x.id);
        if (at !== -1) {
          entry.items.splice(at, 1);
          removed++;
        }
      });
      await d.saveEntry(entry);
      t.print("removed the " + removed + " entries of the meal you logged (" + operation.date + ")", "ok");
      await d.refreshDay(operation.date);
    } else if (operation.kind === "deleted") {
      const item = operation.item;
      item.dateTime = new Date(item.dateTime);
      entry.items.push(item);
      await d.saveEntry(entry);
      t.print("restored the entry you deleted (" + operation.date + ")", "ok");
      await d.refreshDay(operation.date);
    }
  }
};

app.Terminal.commands.rm = {
  usage: "rm <n> [n...]",
  desc: "delete entries by the numbers ls shows (undo restores them)",
  run: async (args) => {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const iso = d.requireDay("rm");
    if (!iso) return;

    if (args.length === 0) {
      t.print("usage: rm <n> [n...]", "err");
      return;
    }

    const { entry, rows } = await d.getRows(iso);
    const result = d.pickRows(rows, args);
    if (result.error) {
      t.print("rm: " + result.error, "err");
      return;
    }

    result.picked.forEach((row) => {
      t.pushUndo({ kind: "deleted", date: iso, item: Object.assign({}, row.item, { dateTime: new Date(row.item.dateTime).getTime() }) });
    });

    const doomed = result.picked.map(row => entry.items[row.index]);
    entry.items = entry.items.filter(item => !doomed.includes(item));
    await d.saveEntry(entry);

    t.print("deleted " + result.picked.map(r => r.name).join(", "), "ok");
    await d.refreshDay(iso);
  }
};

app.Terminal.commands.mv = {
  usage: "mv <n> [n...] @meal|@time|@day",
  desc: "move entries to another meal, time or day: mv 3 4 @dinner, mv 2 @19:30, mv 5 @yesterday",
  complete: (args, partial) => (partial.startsWith("@") ? app.TerminalDiary.completeAdd([], partial) : []),
  run: async (args) => {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const iso = d.requireDay("mv");
    if (!iso) return;

    const tags = d.splitTags(args);
    if (tags.error) {
      t.print(tags.error, "err");
      return;
    }
    if (tags.plain.length === 0 || (!tags.meal && !tags.time && !tags.date)) {
      t.print("usage: mv <n> [n...] @meal|@time|@day", "err");
      return;
    }

    const { rows } = await d.getRows(iso);
    const result = d.pickRows(rows, tags.plain);
    if (result.error) {
      t.print("mv: " + result.error, "err");
      return;
    }

    await d.changeEntries(iso, result.picked, tags);
  }
};

app.Terminal.commands.edit = {
  usage: "edit <n> [amount] [@when]",
  desc: "change an entry: edit 3 0.5, edit 3 80g @13:30. quick-add entries: edit 3 kcal 800 \"new name\"",
  complete: (args, partial) => (partial.startsWith("@") ? app.TerminalDiary.completeAdd([], partial) : []),
  run: async (args) => {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const iso = d.requireDay("edit");
    if (!iso) return;

    const tags = d.splitTags(args);
    if (tags.error) {
      t.print(tags.error, "err");
      return;
    }
    if (tags.plain.length < 1) {
      t.print("usage: edit <n> [amount] [@when]", "err");
      return;
    }

    const { rows } = await d.getRows(iso);
    const result = d.pickRows(rows, [tags.plain[0]]);
    if (result.error) {
      t.print("edit: " + result.error, "err");
      return;
    }

    const row = result.picked[0];
    const rest = tags.plain.slice(1);
    let edits;

    if (row.isQuick && rest.length > 0) {
      // Quick add: kcal <number> ["description"], or just the pieces in that order
      const words = rest[0].toLowerCase() === "kcal" ? rest.slice(1) : rest;
      let value = d.parseNumber(words[0] || "");
      if (isNaN(value)) {
        t.print("usage: edit " + row.n + " kcal <number> [\"description\"]", "err");
        return;
      }
      if (app.Settings.get("units", "energy") === app.nutrimentUnits.kilojoules)
        value = app.Utils.convertUnit(value, app.nutrimentUnits.kilojoules, app.nutrimentUnits.calories);

      const description = words.slice(1).join(" ");
      edits = (r, item) => {
        item.quantity = value;
        if (description) item.description = description;
      };
    } else if (rest.length > 0) {
      const parsed = d.parseAmount(rest);
      if (!parsed.amount || parsed.rest.length > 0) {
        t.print("edit: could not read the amount \"" + rest.join(" ") + "\"", "err");
        return;
      }
      edits = (r, item) => {
        if (!r.food) return { error: "its food no longer exists" };
        const amount = d.toItemAmount(r.food, parsed.amount);
        if (amount.error) return { error: amount.error };
        item.portion = amount.portion;
        item.quantity = amount.quantity;
      };
    } else if (!tags.meal && !tags.time && !tags.date) {
      t.print("usage: edit <n> [amount] [@when]", "err");
      return;
    }

    await d.changeEntries(iso, [row], tags, edits);
  }
};

app.Terminal.commands.cat = {
  usage: "cat <n>",
  desc: "show the details and nutrition of an entry",
  run: async (args) => {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const iso = d.requireDay("cat");
    if (!iso) return;

    const { rows } = await d.getRows(iso);
    const result = d.pickRows(rows, args.slice(0, 1));
    if (args.length === 0 || result.error) {
      t.print("cat: " + (result.error || "usage: cat <n>"), "err");
      return;
    }

    const row = result.picked[0];
    t.print(row.name + (row.brand ? " (" + row.brand + ")" : ""), "cyan");
    t.print(d.clock(row.time) + " · " + d.mealName(row.category) + (row.amountText ? " · " + row.amountText : ""), "muted");

    const lines = Object.keys(row.nutrition)
      .filter(n => row.nutrition[n])
      .map((n) => {
        const label = n.replace(/-/g, " ");
        const unit = (app.nutrimentUnits && app.nutrimentUnits[n]) || "";
        return label.toLowerCase().padEnd(20) + d.fmt(row.nutrition[n]) + (unit ? " " + unit : "");
      });

    if (lines.length === 0) t.print("no nutrition values", "muted");
    lines.forEach(line => t.print(line));
  }
};

app.Terminal.commands.today = {
  usage: "today",
  desc: "totals for today: energy, balance against your goal, macros",
  run: async () => {
    const t = app.Terminal;
    const iso = t.isoDate(new Date());
    t.print(iso + " today", "muted");
    await app.TerminalDiary.showTotals(iso);
  }
};

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "diary",
  run: (args) => app.TerminalDiary.showDays(args)
});

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 2 && cwd[0] === "diary",
  run: () => app.TerminalDiary.showDay(app.Terminal.cwd[1])
});

// Arriving in the diary shows its content straight away
app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "diary")
    await app.TerminalDiary.showDays([]);
  else if (cwd.length === 2 && cwd[0] === "diary")
    await app.TerminalDiary.showDay(cwd[1]);
});

document.addEventListener("page:init", function(event) {
  if (event.target.matches(".page[data-name='terminal']"))
    app.TerminalDiary.refreshFoodNames();
});
