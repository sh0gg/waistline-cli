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
  Your food list from the terminal: ~/foods lists it, new creates a food,
  search and scan bring foods in from Open Food Facts.

  Changing the values of a food never rewrites the past. The old food is
  archived (hidden but kept) and a new one is created, so days that used the
  old one keep their old values.
*/
app.TerminalFoods = {

  lastList: undefined, // Foods in the order the last ls showed them

  // What can follow a nutrient word in "new" and "edit"
  nutrientWords: {
    kcal: "calories", kj: "kilojoules",
    fat: "fat", sat: "saturated-fat", saturated: "saturated-fat",
    carb: "carbohydrates", carbs: "carbohydrates", carbohydrates: "carbohydrates",
    sugar: "sugars", sugars: "sugars",
    fiber: "fiber", fibre: "fiber",
    protein: "proteins", proteins: "proteins",
    salt: "salt", sodium: "sodium"
  },

  textWords: ["name", "brand", "barcode"],

  // ---------------------------------------------------------------------
  // Reading what the user typed
  // ---------------------------------------------------------------------

  // Reads "guiso 350g kcal 420 fat 18 brand \"casa\"" into a description of a food.
  // With needName the words before the amount are the name; without it (edit)
  // only keywords and an amount are accepted.
  parseSpec: function(tokens, needName) {
    const d = app.TerminalDiary;
    const spec = { nutrition: {} };
    const nameWords = [];
    let i = 0;

    while (i < tokens.length) {
      const word = tokens[i].toLowerCase();
      const next = tokens[i + 1];

      if (this.nutrientWords[word] && next !== undefined && !isNaN(d.parseNumber(next))) {
        spec.nutrition[this.nutrientWords[word]] = d.parseNumber(next);
        i += 2;
        continue;
      }

      if (this.textWords.includes(word) && next !== undefined && (nameWords.length > 0 || !needName)) {
        spec[word] = next;
        i += 2;
        continue;
      }

      // serving bag=125g : a named serving that means 125 of the food's unit. "serving none" removes it.
      if (word === "serving" && next !== undefined && (nameWords.length > 0 || !needName)) {
        if (next.toLowerCase() === "none") {
          spec.serving = null;
        } else {
          const named = /^(.+)=(\d+(?:[.,]\d+)?)([a-zA-Z]*)$/.exec(next);
          if (!named) return { error: "a serving looks like: serving bag=125g" };
          spec.serving = { name: named[1], value: d.parseNumber(named[2]), unit: named[3] };
        }
        i += 2;
        continue;
      }

      // per 125g : rescale an existing food's values to another portion (edit only)
      if (word === "per" && !needName && next !== undefined) {
        const read = this.readPortion(tokens, i + 1);
        if (!read) return { error: "per needs an amount, e.g. per 125g" };
        spec.per = read;
        i += 1 + read.step;
        continue;
      }

      // The amount: 350g, 1 slice, 100 ml, 2
      if (spec.portion === undefined && (nameWords.length > 0 || !needName)) {
        const read = this.readPortion(tokens, i);
        if (read) {
          spec.portion = read.portion;
          spec.unit = read.unit;
          i += read.step;
          continue;
        }
      }

      if (needName && spec.portion === undefined && Object.keys(spec.nutrition).length === 0) {
        nameWords.push(tokens[i]);
        i++;
        continue;
      }

      return { error: "did not understand \"" + tokens[i] + "\"" };
    }

    if (nameWords.length > 0) spec.name = nameWords.join(" ");
    return spec;
  },

  // Reads a portion at tokens[i]: 350g, 1 slice, 100 ml, 2.
  // Returns { portion, unit, step } (step = how many tokens it used), or undefined.
  readPortion: function(tokens, i) {
    const d = app.TerminalDiary;
    const amount = /^(\d+(?:[.,]\d+)?)([^\d\s.,]\S*)?$/.exec(tokens[i] || "");
    if (!amount) return undefined;

    const next = tokens[i + 1];
    let unit = amount[2];
    let step = 1;

    const reserved = Object.keys(this.nutrientWords).concat(this.textWords, ["serving", "per"]);
    if (unit === undefined && next !== undefined && /^[^\d\s]+$/.test(next) && !reserved.includes(next.toLowerCase())) {
      unit = next;
      step = 2;
    }

    const normal = unit ? d.normalizeUnit(unit) : { unit: "", factor: 1 };
    const known = ["g", "ml"].includes(normal.unit);
    return {
      portion: d.parseNumber(amount[1]) * (known ? normal.factor : 1),
      unit: known ? normal.unit : (unit || ""),
      step: step
    };
  },

  // A typed serving {name, value, unit} as {name, size}, with size in the food's own unit
  resolveServing: function(serving, foodUnit) {
    const d = app.TerminalDiary;

    if (!foodUnit)
      return { error: "this food has no unit to measure a serving in" };

    const typed = d.normalizeUnit(serving.unit || foodUnit);
    const own = d.normalizeUnit(foodUnit);

    if (typed.unit !== own.unit)
      return { error: "a serving of " + serving.name + " must be measured in " + foodUnit + ", not " + serving.unit };

    return { name: serving.name, size: (serving.value * typed.factor) / own.factor };
  },

  // ---------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------

  saveFood: function(food) {
    return new Promise((resolve, reject) => {
      const request = dbHandler.put(food, "foodList");
      request.addEventListener("success", () => { resolve(request.result); });
      request.addEventListener("error", () => { reject(request.error); });
    });
  },

  // Foods you can log: not archived, not hidden, not the quick-add helper
  allFoods: async function(query) {
    const list = await dbHandler.getAllItems("foodList");
    const escaped = (query || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const foods = app.FoodsMealsRecipes.filterList(escaped, [], list);
    const d = app.TerminalDiary;
    return foods.sort((a, b) => (d.norm(a.name) < d.norm(b.name) ? -1 : 1));
  },

  findByBarcode: async function(code) {
    let found = await dbHandler.getFirstNonArchived("foodList", "barcode", code);
    if (!found && code.startsWith("0"))
      found = await dbHandler.getFirstNonArchived("foodList", "barcode", code.substring(1));
    return found;
  },

  // A stored food from a finished description
  buildFood: function(spec) {
    const nutrition = Object.assign({}, spec.nutrition);

    if (nutrition.calories === undefined && nutrition.kilojoules !== undefined) {
      const units = app.nutrimentUnits;
      nutrition.calories = app.Utils.convertUnit(nutrition.kilojoules, units.kilojoules, units.calories, 1);
    }

    const food = {
      name: spec.name,
      brand: spec.brand || "",
      portion: spec.portion,
      unit: spec.unit || "",
      nutrition: nutrition,
      archived: false,
      dateTime: new Date()
    };
    if (spec.barcode) food.barcode = spec.barcode;
    if (spec.originalBarcode) food.originalBarcode = spec.originalBarcode;
    if (spec.servingResolved) food.serving = spec.servingResolved;
    return food;
  },

  // Removes empty and non-numeric values that Open Food Facts sometimes returns
  cleanNutrition: function(nutrition) {
    const clean = {};
    Object.keys(nutrition || {}).forEach((key) => {
      const value = parseFloat(nutrition[key]);
      if (isFinite(value)) clean[key] = value;
    });
    return clean;
  },

  // Open Food Facts spells some units out ("gram", "?"); use the short form
  shortUnit: function(unit) {
    if (!unit || unit === "?") return "";
    const short = app.TerminalDiary.normalizeUnit(unit);
    return (short.factor === 1 && ["g", "ml"].includes(short.unit)) ? short.unit : unit;
  },

  portionText: function(food) {
    const d = app.TerminalDiary;
    const portion = parseFloat(food.portion);
    if (!food.unit) return d.fmt(portion);
    return d.fmt(portion) + (app.standardUnits && app.standardUnits.includes(food.unit) ? food.unit : " " + d.plural(food.unit, portion));
  },

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------

  foodNode: function(food, n) {
    const d = app.TerminalDiary;
    const node = d.el("div", "term-line term-food");
    node.appendChild(d.el("span", "n", String(n)));

    const name = d.el("span", "name", food.name);
    name.appendChild(d.el("span", "sep", " · "));
    name.appendChild(d.el("span", "qty", this.portionText(food)));
    node.appendChild(name);

    node.appendChild(d.el("span", "kcal", d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(food.nutrition || {}))));

    const sub = [];
    if (food.brand) sub.push(food.brand);
    const macros = d.macroText(food.nutrition || {});
    if (macros) sub.push(macros);
    if (sub.length > 0) node.appendChild(d.el("div", "macros", sub.join(" · ")));

    return node;
  },

  // Print a food's details (per portion)
  printDetails: function(food) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    t.print(food.name + (food.brand ? " (" + food.brand + ")" : ""), "cyan");
    t.print("per " + this.portionText(food) + (food.barcode ? " · barcode " + food.barcode : ""), "muted");
    if (food.serving)
      t.print("serving: 1 " + food.serving.name + " = " + d.fmt(food.serving.size) + (food.unit || ""), "muted");

    const nutrition = food.nutrition || {};
    const lines = Object.keys(nutrition)
      .filter(n => nutrition[n])
      .map((n) => {
        const label = n.replace(/-/g, " ");
        const unit = (app.nutrimentUnits && app.nutrimentUnits[n]) || "";
        return label.toLowerCase().padEnd(20) + d.fmt(nutrition[n]) + (unit ? " " + unit : "");
      });

    if (lines.length === 0) t.print("no nutrition values", "muted");
    lines.forEach(line => t.print(line));
  },

  showFoods: async function(query) {
    const t = app.Terminal;
    const foods = await this.allFoods(query);
    this.lastList = foods;

    if (foods.length === 0) {
      t.print(query ? "no foods match \"" + query + "\"" : "(no foods yet. try new, search or scan)", "muted");
      return;
    }

    const shown = foods.slice(0, 40);
    shown.forEach((food, i) => {
      const node = this.foodNode(food, i + 1);
      node.addEventListener("click", () => { this.showActions(food); });
      t.printNode(node, true);
    });

    if (foods.length > shown.length)
      t.print((foods.length - shown.length) + " more. ls <text> narrows the list.", "muted");
  },

  showActions: function(food) {
    const t = app.Terminal;

    t.printChoices([{
      text: "details",
      run: () => { this.printDetails(food); }
    }, {
      text: "log it",
      run: () => {
        t.ask("how much " + food.name + "? e.g. 60g, 0.5, 2x (q cancels)", async (line) => {
          await t.run("+ \"" + food.name + "\" " + line);
        });
      }
    }, {
      text: "change its values (keeps past days as they were)",
      run: () => {
        t.ask("what changes for " + food.name + "? e.g. kcal 900 fat 30 (q cancels)", async (line) => {
          await this.editFood(food, t.tokenize(line));
        });
      }
    }, {
      text: "archive (hide from lists, past days keep it)",
      run: () => { this.archiveFood(food); }
    }]);
  },

  // ---------------------------------------------------------------------
  // Creating and changing foods
  // ---------------------------------------------------------------------

  // Asks for whatever is missing, then saves. "start" is what was already typed.
  createFood: async function(spec) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (!spec.name) {
      t.ask("name of the food?", async (line) => {
        spec.name = line.trim();
        await this.createFood(spec);
      });
      return;
    }

    if (spec.portion === undefined || isNaN(spec.portion) || spec.portion <= 0) {
      t.ask((spec.questions && spec.questions.portion) || "portion the values are for? e.g. 100g, 1 slice, 350g (q cancels)", async (line) => {
        const parsed = this.parseSpec(["x"].concat(t.tokenize(line)), true);
        if (parsed.error || parsed.portion === undefined) {
          t.print("could not read a portion from \"" + line + "\"", "err");
          await this.createFood(spec);
          return;
        }
        spec.portion = parsed.portion;
        spec.unit = parsed.unit;
        await this.createFood(spec);
      });
      return;
    }

    if (spec.nutrition.calories === undefined && spec.nutrition.kilojoules === undefined) {
      t.ask((spec.questions && spec.questions.kcal) ? spec.questions.kcal(this.portionText(spec)) : "kcal in " + this.portionText(spec) + "?", async (line) => {
        const value = d.parseNumber(line.trim());
        if (isNaN(value)) {
          t.print("that is not a number", "err");
          await this.createFood(spec);
          return;
        }
        spec.nutrition.calories = value;
        await this.createFood(spec);
      });
      return;
    }

    // Once, offer the optional values (skipped when the user typed any macro or answered)
    if (!spec.askedMacros && !["fat", "carbohydrates", "proteins"].some(k => spec.nutrition[k] !== undefined)) {
      spec.askedMacros = true;
      t.ask("macros? e.g. fat 18 carb 30 protein 25 (- to skip)", async (line) => {
        if (line.trim() !== "-") {
          const parsed = this.parseSpec(t.tokenize(line), false);
          if (parsed.error) {
            t.print(parsed.error, "err");
          } else {
            Object.assign(spec.nutrition, parsed.nutrition);
            if (parsed.brand) spec.brand = parsed.brand;
          }
        }
        await this.createFood(spec);
      });
      return;
    }

    // Recipes hand over their own way of saving; a food is saved by default
    await (spec.finish ? spec.finish(spec) : this.saveNew(spec));
  },

  // Saves a finished description, asking first if the name is taken
  saveNew: async function(spec) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    if (spec.serving) {
      const resolved = this.resolveServing(spec.serving, spec.unit);
      if (resolved.error) {
        t.print(resolved.error, "err");
        return;
      }
      spec.servingResolved = resolved;
    }

    const food = this.buildFood(spec);

    const existing = (await this.allFoods("")).filter(f => d.norm(f.name) === d.norm(food.name));

    const save = async (archive) => {
      if (archive) {
        // A new version keeps the old serving if it still makes sense for the new unit
        if (!food.serving && existing[0] && existing[0].serving && d.normalizeUnit(existing[0].unit).unit === d.normalizeUnit(food.unit).unit)
          food.serving = existing[0].serving;

        for (const old of existing) {
          old.archived = true;
          await this.saveFood(old);
        }
      }
      await this.saveFood(food);
      d.refreshFoodNames();
      t.print("saved " + food.name + " · " + this.portionText(food) + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(food.nutrition)), "ok");
      t.print("log it with: + " + food.name, "muted");
    };

    if (existing.length === 0) {
      await save(false);
      return;
    }

    t.print("you already have \"" + food.name + "\". what should the new one be?", "accent");
    t.printChoices([{
      text: "a new version of it: the old one is archived and days already logged keep their old values",
      run: () => { t.guard(() => save(true)); }
    }, {
      text: "a separate food with the same name",
      run: () => { t.guard(() => save(false)); }
    }, {
      text: "cancel",
      run: () => { t.print("nothing saved", "muted"); }
    }]);
  },

  // Change a food. New values make a new version (the old one is archived so past days keep
  // their values). Name, brand and serving are changed in place. "per 125g" rescales the same
  // food to another portion, which changes no nutrition, so it is also done in place.
  editFood: async function(food, tokens) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const spec = this.parseSpec(tokens, false);
    if (spec.error) {
      t.print("edit: " + spec.error, "err");
      return;
    }

    const hasValues = Object.keys(spec.nutrition).length > 0;
    const hasPortion = spec.portion !== undefined;

    if (spec.per) {
      if (hasValues || hasPortion) {
        t.print("edit: per rescales the values you have. use it on its own, or give the new values instead", "err");
        return;
      }
      await this.rescaleFood(food, spec);
      return;
    }

    // The stored numbers are "per portion", so a new portion without new numbers would falsify them
    if (hasPortion && !hasValues) {
      t.print("edit: the values are for " + this.portionText(food) + ". give the new values too (edit <food> " + d.fmt(spec.portion) + (spec.unit || "") + " kcal ...), or rescale them with: edit <food> per " + d.fmt(spec.portion) + (spec.unit || ""), "err");
      return;
    }

    const valuesChange = hasPortion || hasValues;
    if (!valuesChange && !spec.name && spec.brand === undefined && spec.serving === undefined) {
      t.print("edit: nothing to change. e.g. edit 2 kcal 900 fat 30", "err");
      return;
    }

    if (!valuesChange) {
      if (spec.serving) {
        const resolved = this.resolveServing(spec.serving, food.unit);
        if (resolved.error) {
          t.print("edit: " + resolved.error, "err");
          return;
        }
        food.serving = resolved;
      } else if (spec.serving === null) {
        delete food.serving;
      }

      if (spec.name) food.name = spec.name;
      if (spec.brand !== undefined) food.brand = spec.brand;
      await this.saveFood(food);
      d.refreshFoodNames();
      t.print("updated " + food.name + ". days already logged are not affected by a serving; a new name shows there too", "ok");
      return;
    }

    const merged = {
      name: spec.name || food.name,
      brand: spec.brand !== undefined ? spec.brand : food.brand,
      portion: hasPortion ? spec.portion : parseFloat(food.portion),
      unit: hasPortion ? spec.unit : food.unit,
      nutrition: Object.assign({}, this.cleanNutrition(food.nutrition), spec.nutrition),
      barcode: food.barcode,
      originalBarcode: food.originalBarcode
    };

    // Changing the calories alone must not keep an old kilojoule figure
    if (spec.nutrition.calories !== undefined && spec.nutrition.kilojoules === undefined) delete merged.nutrition.kilojoules;
    if (spec.nutrition.kilojoules !== undefined && spec.nutrition.calories === undefined) delete merged.nutrition.calories;

    // The serving carries over when the unit is still the same kind, unless the user changed it
    if (spec.serving) {
      const resolved = this.resolveServing(spec.serving, merged.unit);
      if (resolved.error) {
        t.print("edit: " + resolved.error, "err");
        return;
      }
      merged.servingResolved = resolved;
    } else if (spec.serving !== null && food.serving && d.normalizeUnit(food.unit).unit === d.normalizeUnit(merged.unit).unit) {
      merged.servingResolved = food.serving;
    }

    const replacement = this.buildFood(merged);
    food.archived = true;
    await this.saveFood(food);
    await this.saveFood(replacement);
    d.refreshFoodNames();

    t.print("saved as a new version: " + replacement.name + " · " + this.portionText(replacement) + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(replacement.nutrition)), "ok");
    t.print("the old one is archived. days already logged keep their old values", "muted");
  },

  // Express the same food per another portion of the same unit: values scale in proportion.
  // Days already logged come out the same, because their maths divides by the portion.
  rescaleFood: async function(food, spec) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const own = d.normalizeUnit(food.unit);
    const wanted = d.normalizeUnit(spec.per.unit || food.unit);

    if (own.unit !== wanted.unit) {
      t.print("edit: cannot rescale " + (food.unit || "portions") + " to " + spec.per.unit + ". give the new values instead", "err");
      return;
    }

    const oldPortion = parseFloat(food.portion);
    const newPortion = spec.per.portion;
    if (!(newPortion > 0) || !(oldPortion > 0)) {
      t.print("edit: the portion must be more than zero", "err");
      return;
    }

    const ratio = newPortion / oldPortion;
    const scaled = {};
    Object.keys(food.nutrition || {}).forEach((key) => {
      const value = parseFloat(food.nutrition[key]);
      if (isFinite(value)) scaled[key] = Math.round(value * ratio * 1000) / 1000;
    });

    food.nutrition = scaled;
    food.portion = newPortion;
    food.dateTime = new Date();
    await this.saveFood(food);
    d.refreshFoodNames();

    t.print("rescaled " + food.name + ": values are now per " + this.portionText(food) + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(food.nutrition)), "ok");
    t.print("same food, nothing else changes. days already logged stay the same", "muted");
  },

  archiveFood: async function(food) {
    food.archived = true;
    await this.saveFood(food);
    app.TerminalDiary.refreshFoodNames();
    app.Terminal.print("archived " + food.name + ". days already logged still show it", "ok");
  },

  // Finds a food from a number in the last ls, or from a name
  pickFood: async function(text) {
    const t = app.Terminal;

    if (/^\d+$/.test(text)) {
      if (!this.lastList) this.lastList = await this.allFoods("");
      const food = this.lastList[parseInt(text, 10) - 1];
      if (!food) t.print("no food " + text + " in the last list", "err");
      return food;
    }

    const found = await app.TerminalDiary.findFoods(text);
    if (found.length === 0) t.print("no food matches \"" + text + "\"", "err");
    else if (found.length > 1) t.print("several foods match \"" + text + "\". use its number from ls", "err");
    else return found[0];
    return undefined;
  },

  // ---------------------------------------------------------------------
  // Open Food Facts
  // ---------------------------------------------------------------------

  // Store one search result unless that product is already in the list
  importResult: async function(item) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (item.barcode) {
      const have = await this.findByBarcode(item.barcode);
      if (have) {
        t.print("already in your foods: " + have.name + (have.brand ? " (" + have.brand + ")" : ""), "muted");
        return have;
      }
    }

    const food = this.buildFood({
      name: item.name,
      brand: item.brand,
      portion: parseFloat(item.portion),
      unit: this.shortUnit(item.unit),
      nutrition: this.cleanNutrition(item.nutrition),
      barcode: item.barcode,
      originalBarcode: item.originalBarcode
    });

    await this.saveFood(food);
    d.refreshFoodNames();
    t.print("saved " + food.name + (food.brand ? " (" + food.brand + ")" : "") + " · " + this.portionText(food) + " → " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(food.nutrition)), "ok");
    t.print("log it with: + " + food.name, "muted");
    return food;
  },

  // Camera scan (phone only). Resolves to the code, or undefined.
  scanCamera: function() {
    return new Promise((resolve) => {
      const plugin = window.cordova && cordova.plugins && cordova.plugins.barcodeScanner;
      if (!plugin || (window.device && device.platform === "browser")) {
        resolve(undefined);
        return;
      }

      plugin.scan((data) => {
        resolve(data && !data.cancelled ? data.text : undefined);
      }, () => { resolve(undefined); }, {
        showTorchButton: true,
        torchOn: app.Settings.get("integration", "barcode-flashlight"),
        disableSuccessBeep: !app.Settings.get("integration", "barcode-sound"),
        prompt: "Place a barcode inside the scan area"
      });
    });
  },

  // How Open Food Facts' current values differ from a food you have, as printable lines.
  // Compared per unit of weight/volume, so a portion you rescaled does not count as a change.
  // Returns undefined when the two use different units and cannot be compared.
  compareWithLatest: function(have, latest) {
    const d = app.TerminalDiary;
    const mine = d.normalizeUnit(have.unit);
    const theirs = d.normalizeUnit(this.shortUnit(latest.unit));
    if (mine.unit !== theirs.unit) return undefined;

    const myBase = parseFloat(have.portion) * mine.factor;
    const theirBase = parseFloat(latest.portion) * theirs.factor;
    if (!(myBase > 0) || !(theirBase > 0)) return undefined;

    const mineNutrition = this.cleanNutrition(have.nutrition);
    const theirNutrition = this.cleanNutrition(latest.nutrition);
    const keys = Object.keys(mineNutrition).concat(Object.keys(theirNutrition)).filter((k, i, all) => all.indexOf(k) === i && k !== "kilojoules");

    const lines = [];
    keys.forEach((key) => {
      const before = (mineNutrition[key] || 0) / myBase;
      const after = (theirNutrition[key] || 0) / theirBase;
      const change = Math.abs(after - before);
      const shownAfter = after * theirBase;

      // A change worth mentioning: over 2%, and more than 0.05 in the units shown
      if (change > 0.02 * Math.max(Math.abs(before), Math.abs(after)) && change * theirBase > 0.05)
        lines.push(key.replace(/-/g, " ").padEnd(20) + d.fmt(before * theirBase) + " → " + d.fmt(shownAfter));
    });

    return lines;
  },

  // Best effort: does Open Food Facts now say something different about a product you have?
  checkForUpdate: async function(have, code) {
    const t = app.Terminal;
    if (navigator.onLine === false) return;

    let result;
    try {
      result = await app.OpenFoodFacts.search(code);
    } catch (err) {
      return;
    }

    const latest = result && result[0];
    if (!latest) return;

    const lines = this.compareWithLatest(have, latest);
    if (lines === undefined) {
      t.print("could not compare with Open Food Facts: it uses a different unit", "muted");
      return;
    }
    if (lines.length === 0) {
      t.print("Open Food Facts has the same values", "muted");
      return;
    }

    t.print("Open Food Facts now says (per " + this.portionText({ portion: latest.portion, unit: this.shortUnit(latest.unit) }) + "):", "accent");
    lines.forEach(line => t.print(line));

    t.printChoices([{
      text: "save as a new version (days already logged keep the old values)",
      run: () => {
        t.guard(async () => {
          const carried = have.serving && app.TerminalDiary.normalizeUnit(have.unit).unit === app.TerminalDiary.normalizeUnit(this.shortUnit(latest.unit)).unit ? have.serving : undefined;
          have.archived = true;
          await this.saveFood(have);
          const food = this.buildFood({
            name: latest.name,
            brand: latest.brand,
            portion: parseFloat(latest.portion),
            unit: this.shortUnit(latest.unit),
            nutrition: this.cleanNutrition(latest.nutrition),
            barcode: latest.barcode,
            originalBarcode: latest.originalBarcode,
            servingResolved: carried
          });
          await this.saveFood(food);
          app.TerminalDiary.refreshFoodNames();
          t.print("saved the new version of " + food.name + ". the old one is archived", "ok");
        });
      }
    }, {
      text: "keep what I have",
      run: () => { t.print("kept", "muted"); }
    }]);
  },

  handleBarcode: async function(code) {
    const t = app.Terminal;

    const have = await this.findByBarcode(code);
    if (have) {
      t.print("already in your foods:", "muted");
      this.printDetails(have);
      await this.checkForUpdate(have, code);
      return;
    }

    if (!app.Utils.isInternetConnected()) {
      t.print("no internet. you can still create it: new <name> <portion> kcal <n> barcode " + code, "err");
      return;
    }

    t.print("looking up " + code + " in Open Food Facts...", "muted");
    const result = await app.OpenFoodFacts.search(code);

    if (result === undefined) {
      t.print("no answer from Open Food Facts. try again later", "err");
      return;
    }

    if (result[0] !== undefined) {
      await this.importResult(result[0]);
      return;
    }

    t.print("not in Open Food Facts. let's create it", "accent");
    await this.createFood({ nutrition: {}, barcode: code });
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

app.Terminal.commands.new = {
  usage: "new [name] [portion] [kcal n] [fat n] [carb n] [protein n]",
  desc: "create a food. all in one line: new \"chicken stew\" 350g kcal 420 fat 18 carb 30 protein 25. words also: sat sugar fiber salt sodium brand barcode, and serving bag=125g (so + food 1 bag works). leave things out and it asks",
  complete: (args, partial) => (args.length >= 1 ? Object.keys(app.TerminalFoods.nutrientWords).concat(app.TerminalFoods.textWords) : []),
  run: async (args, line) => {
    const f = app.TerminalFoods;
    const t = app.Terminal;

    // "new name = a 10g, b 2 slices" builds a recipe or a saved meal. Those live in ~/recipes and ~/meals, but the
    // list is clear enough to work from anywhere: yield means a recipe, and otherwise it asks which one is meant
    if (args.includes("=") && line !== undefined) {
      const list = line.replace(/^\s*\S+\s*/, "");
      if (/(^|[\s,])yield\b/i.test(list)) {
        await app.TerminalRecipes.create(list);
        return;
      }
      t.print("a list of ingredients can be a recipe (one line in the diary; asks how much it makes) or a saved meal (each ingredient is logged on its own). which one?", "muted");
      t.printChoices([
        { text: "recipe", run: () => { t.guard(() => app.TerminalRecipes.create(list)); } },
        { text: "saved meal", run: () => { t.guard(() => app.TerminalMeals.create(list)); } }
      ]);
      return;
    }

    const spec = f.parseSpec(args, true);

    if (spec.error) {
      app.Terminal.print("new: " + spec.error, "err");
      return;
    }
    await f.createFood(spec);
  }
};

app.Terminal.commands.search = {
  usage: "search <text>",
  desc: "look a food up in Open Food Facts and add it to your foods. a barcode number works too",
  run: async (args) => {
    const t = app.Terminal;
    const f = app.TerminalFoods;
    const d = app.TerminalDiary;
    const query = args.join(" ").trim();

    if (query === "") {
      t.print("usage: search <text>", "err");
      return;
    }
    if (!app.Utils.isInternetConnected()) {
      t.print("no internet connection", "err");
      return;
    }

    t.print("searching Open Food Facts...", "muted");
    const results = await app.OpenFoodFacts.search(query);

    if (results === undefined) {
      t.print("no answer from Open Food Facts. try again later", "err");
      return;
    }

    const usable = results.filter(r => r !== undefined && r.name);
    if (usable.length === 0) {
      t.print("no results for \"" + query + "\"", "muted");
      return;
    }

    const shown = usable.slice(0, 15);
    t.print(shown.length + " results. pick one to add it to your foods:", "muted");
    t.printChoices(shown.map(item => ({
      text: item.name + (item.brand ? " (" + item.brand + ")" : "") + " — " + d.energyLabel(app.FoodsMealsRecipes.getItemEnergy(f.cleanNutrition(item.nutrition))) + " per " + f.portionText({ portion: item.portion, unit: f.shortUnit(item.unit) }),
      run: () => { t.guard(() => f.importResult(item)); }
    })));
  }
};

app.Terminal.commands.scan = {
  usage: "scan [barcode]",
  desc: "scan a barcode with the camera (phone) or type its number. adds the product to your foods",
  run: async (args) => {
    const t = app.Terminal;
    const f = app.TerminalFoods;

    let code = args[0];

    if (!code) {
      code = await f.scanCamera();
      if (!code) {
        t.print("no code scanned. the camera only works on the phone; here type: scan <barcode>", "muted");
        return;
      }
    }

    if (!/^\d{6,14}$/.test(code)) {
      t.print("a barcode is 6 to 14 digits", "err");
      return;
    }

    await f.handleBarcode(code);
  }
};

// cat, rm and edit mean something else inside ~/foods: they act on foods, not diary entries
(function() {
  const inFoods = () => app.Terminal.cwd.length === 1 && app.Terminal.cwd[0] === "foods";
  const f = app.TerminalFoods;

  const share = (name, foodsRun, note) => {
    const command = app.Terminal.commands[name];
    const original = command.run;
    command.run = async (args, line) => {
      if (inFoods()) await foodsRun(args, line);
      else await original(args, line);
    };
    command.desc += " " + note;
  };

  share("cat", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: cat <n|name>", "err");
      return;
    }
    const food = await f.pickFood(args.join(" "));
    if (food) f.printDetails(food);
  }, "(in ~/foods: a food)");

  share("rm", async (args) => {
    if (args.length === 0) {
      app.Terminal.print("usage: rm <n|name>", "err");
      return;
    }
    const food = await f.pickFood(args.join(" "));
    if (food) await f.archiveFood(food);
  }, "(in ~/foods: archives a food)");

  share("edit", async (args) => {
    if (args.length < 2) {
      app.Terminal.print("usage: edit <n|name> kcal 900 fat 30 ...", "err");
      return;
    }
    // A name may be several words, so it is the first word unless it is a number
    const food = await f.pickFood(args[0]);
    if (food) await f.editFood(food, args.slice(1));
  }, "(in ~/foods: changes a food. new values make a new version. per 125g rescales the same food. serving bag=125g sets a named serving)");
})();

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "foods",
  run: (args) => app.TerminalFoods.showFoods(args.join(" "))
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "foods")
    await app.TerminalFoods.showFoods("");
});
