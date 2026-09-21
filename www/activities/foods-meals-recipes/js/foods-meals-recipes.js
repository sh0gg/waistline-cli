/*
  Copyright 2018, 2019, 2020, 2021 David Healey

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

app.FoodsMealsRecipes = {
  getFromDB: function(store, sort) {
    return new Promise(function(resolve, reject) {

      let list = [];

      if (sort == "alpha")
        dbHandler.getIndex("name", store).openCursor(null).onsuccess = processResult; //Sort foods alphabetically
      else
        dbHandler.getIndex("dateTime", store).openCursor(null, "prev").onsuccess = processResult; //Sort foods by date

      function processResult(e) {
        var cursor = e.target.result;

        if (cursor) {
          list.push(cursor.value);
          cursor.continue();
        } else {
          resolve(list);
        }
      }
    });
  },

  getTotalNutrition: function(items, handleBurnedEnergy) {
    return new Promise(async function(resolve, reject) {
      let ids = {};
      let entries = {};
      let result = {
        calories: 0
      };

      // Get item ids and quick-add items
      items.forEach((item) => {
        let type = item.type || "food";

        if (item.id !== undefined && ("category" in item == false || item.category !== undefined)) {
          ids[type] = ids[type] || [];
          ids[type].push(item.id);
        }
      });

      // Get relevant database entries
      entries["food"] = [];
      if (ids.food !== undefined && ids.food.length > 0)
        entries["food"] = await dbHandler.getByMultipleKeys(ids.food, "foodList");

      entries["recipe"] = [];
      if (ids.recipe !== undefined && ids.recipe.length > 0)
        entries["recipe"] = await dbHandler.getByMultipleKeys(ids.recipe, "recipes");

      // Prepare a list of items to be summed
      let data = [];
      items.forEach((item) => {
        let type = item.type || "food";
        let match = entries[type].find(x => x !== undefined && x.id === item.id);
        data.push(match);
      });

      const units = app.nutrimentUnits;
      if (data.length > 0) {
        // Sum item nutrition
        data.forEach((x, i) => {
          if (x !== undefined) {
            let dataPortion = parseFloat(x.portion);
            let itemPortion = parseFloat(items[i].portion);
            let itemQuantity = parseFloat(items[i].quantity) || 0;
            let multiplier = (itemPortion / dataPortion) * itemQuantity;

            for (let n in x.nutrition) {
              let value = (Math.round(x.nutrition[n] * multiplier * 100) / 100) || 0;

              let isBurnedEnergy = false;
              if (value < 0) {
                if (n !== "calories" && n !== "kilojoules") continue; // Negative values are only allowed for energy
                if (handleBurnedEnergy === "ignore") continue; // Skip negative energy values if parameter is set to "ignore"

                if (handleBurnedEnergy === "disclose")
                  isBurnedEnergy = true; // Compute separate sum for burned energy if parameter is set to "disclose"
              }

              let nutrimentName = (isBurnedEnergy) ? "burned-" + n : n;
              let nutrimentValue = (isBurnedEnergy) ? Math.abs(value) : value;

              result[nutrimentName] = result[nutrimentName] || 0;
              result[nutrimentName] += nutrimentValue;

              if (n === "calories" && x.nutrition["kilojoules"] === undefined) {
                let kilojoules = app.Utils.convertUnit(x.nutrition[n], units.calories, units.kilojoules);
                kilojoules = (Math.round(kilojoules * multiplier * 100) / 100) || 0;

                let kilojoulesName = (isBurnedEnergy) ? "burned-kilojoules" : "kilojoules";
                let kilojoulesValue = (isBurnedEnergy) ? Math.abs(kilojoules) : kilojoules;

                result[kilojoulesName] = result[kilojoulesName] || 0;
                result[kilojoulesName] += kilojoulesValue;
              }
            }
          }
        });
      }

      resolve(result);
    });
  },

  filterList: function(query, categories, list) {
    let result = list;

    let queryRegExp = app.Utils.normalizeText(query).trim().split(/\s+/).map((w) => new RegExp(w, "i"));
    let categoriesFilter = categories || [];

    // Hidden items should only be shown when a category filter is active
    let showHiddenItems = (categoriesFilter.length !== 0);

    // Check if the Archived category filter is selected
    let archivedFilter = categoriesFilter.indexOf(app.FoodsCategories.archivedLabel);
    if (archivedFilter !== -1)
      categoriesFilter.splice(archivedFilter, 1); // Remove it since it's not an actual food category

    let noCategoryFilter = categoriesFilter.indexOf(app.FoodsCategories.noCategoryLabel);

    // Filter the list of items
    result = result.filter((item) => {
      if (item) {
        if (archivedFilter !== -1 && item.archived !== true) {
          return false; // Archived filter is selected but the item is not archived
        }
        if (archivedFilter === -1 && item.archived === true) {
          return false; // Archived filter is not selected but the item is archived
        }
        if (showHiddenItems === false && item.hidden === true) {
          return false; // Hidden items should not be shown but the item is hidden
        }
        if (item.name && item.brand) {
          const itemName = app.Utils.normalizeText(item.name);
          const itemBrand = app.Utils.normalizeText(item.brand);
          for (let regExp of queryRegExp) {
            if (!itemName.match(regExp) && !itemBrand.match(regExp))
              return false;
          }
        } else if (item.name) {
          const itemName = app.Utils.normalizeText(item.name);
          for (let regExp of queryRegExp) {
            if (!itemName.match(regExp))
              return false;
          }
        }
        for (let category of categoriesFilter) {
          if (item.categories) {
            if (!item.categories.includes(category))
              return false;
          } else if (noCategoryFilter === -1 || categoriesFilter.length >= 2) {
            return false;
          }
        }
        return true;
      }
      return false;
    });
    return result;
  },

  getItem: function(id, type, portion, quantity) {
    return new Promise(async function(resolve, reject) {

      let store = app.FoodsMealsRecipes.getStoreForItemType(type);
      let data = await dbHandler.getByKey(id, store);

      if (data !== undefined) {
        // Get nutriments for given portion/quantity
        let dataPortion = parseFloat(data.portion);
        let itemPortion = parseFloat(portion);
        let itemQuantity = parseFloat(quantity) || 0;
        let multiplier = (itemPortion / dataPortion) * itemQuantity;

        for (let n in data.nutrition) {
          let value = data.nutrition[n] || 0;
          data.nutrition[n] = Math.round(value * multiplier * 100) / 100;
        }

        resolve(data);
      } else {
        resolve();
      }
    });
  },

  getItemEnergy: function(nutrition) {
    let energy = nutrition.calories;

    if (energy !== undefined) {
      const units = app.nutrimentUnits;
      const energyUnit = app.Settings.get("units", "energy");

      if (energyUnit == units.kilojoules)
        energy = nutrition.kilojoules || app.Utils.convertUnit(energy, units.calories, units.kilojoules);

      return energy;
    }
    return 0;
  },

  getStoreForItemType: function(type) {
    switch (type) {
      case "food":
        return "foodList";
      case "meal":
        return "meals";
      case "recipe":
        return "recipes";
      default:
    }
  }
};
