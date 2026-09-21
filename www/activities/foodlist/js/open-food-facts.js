/*
  Copyright 2021 David Healey

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

app.OpenFoodFacts = {
  search: function(query, preferDataPer100g) {
    return new Promise(async function(resolve, reject) {
      //Build search string
      let url;

      // If query is a number, assume it's a barcode
      let isSearchQuery = isNaN(query);
      if (isSearchQuery)
        url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(query) + "&search_simple=1&page_size=50&sort_by=unique_scans_n&action=process&json=1";
      else
        url = "https://world.openfoodfacts.org/api/v0/product/" + encodeURIComponent(query) + ".json";

      //Get country name
      let country = app.Settings.get("integration", "search-country") || undefined;

      //Limit search to selected country
      if (isSearchQuery && country && country != "All")
        url += "&tagtype_0=countries&tag_contains_0=contains&tag_0=" + encodeURIComponent(country);

      //Filter by dietary preference
      let dietaryFilter = app.Settings.get("integration", "dietary-filter") || undefined;

      if (isSearchQuery && dietaryFilter && dietaryFilter != "none") {
        let tagIndex = (country && country != "All") ? 1 : 0;
        const labelFilters = new Set(["en:gluten-free", "en:palm-oil-free", "en:organic"]);
        let tagtype = labelFilters.has(dietaryFilter) ? "labels" : "ingredients_analysis";
        url += "&tagtype_" + tagIndex + "=" + tagtype + "&tag_contains_" + tagIndex + "=contains&tag_" + tagIndex + "=" + encodeURIComponent(dietaryFilter);
      }

      //Get language
      let language = app.Settings.get("integration", "search-language") || undefined;

      if (isSearchQuery && language != undefined && language != "Default")
        url += "&lang=" + encodeURIComponent(language) + "&lc=" + encodeURIComponent(language);
      else
        language = app.getLanguage(app.Settings.get("appearance", "locale")).substring(0, 2);

      let response = await app.Utils.timeoutFetch(url, {
        headers: {
          "User-Agent": "Waistline - Android - Version " + app.version + " - https://github.com/davidhealey/waistline"
        }
      }, 30000).catch((err) => {
        resolve(undefined);
      });

      if (response && response.ok) {
        let data = await response.json();
        let result = [];

        // Multiple results (hide results where all nutrition values are undefined)
        if (data.products !== undefined) {
          data.products.forEach((x) => {
            let item = app.OpenFoodFacts.parseItem(x, preferDataPer100g, language);
            if (item != undefined) {
              let nutritionValues = Object.values(item.nutrition).filter((v) => v != undefined);
              if (nutritionValues.length != 0) result.push(item);
            }
          });
        }

        // Single result (presumably from a barcode)
        if (data.product !== undefined) {
          let item = app.OpenFoodFacts.parseItem(data.product, preferDataPer100g, language);
          if (item != undefined) result.push(item);
        }

        resolve(result);
      }
      resolve(undefined);
    });
  },

  parseItem: function(item, preferDataPer100g, preferredLanguage) {
    const nutriments = app.nutriments; // Array of OFF nutriment names
    const units = app.nutrimentUnits;

    let result = {
      "nutrition": {}
    };

    // Ensure nutriments object exists
    item.nutriments = item.nutriments || {};

    // Get item name, try the preferred language first
    let key = "product_name_" + preferredLanguage;
    if (item[key] !== undefined && item[key].length > 1) {
      result.name = he.decode(item[key]);
    } else {
      for (let k in item) {
        if (k.includes("product_name") && item[k].length > 1) {
          result.name = he.decode(item[k]);
          break;
        }
      }
    }

    if (result.name == undefined || result.name == "")
      result.name = item.code;

    result.image_url = escape(item.image_url);

    if (item.code.startsWith("0")) {
      result.barcode = item.code.substring(1); // if barcode begins with a zero, remove it
      result.originalBarcode = item.code;
    } else {
      result.barcode = item.code;
    }

    // Get first brand if there is more than one
    let brands = item.brands || "";
    let n = brands.indexOf(",");
    let brand = brands.substring(0, n != -1 ? n : brands.length);
    result.brand = he.decode(brand);

    let dataAvailablePerServing = false;
    let dataAvailablePer100g = false;

    if (item.serving_size && item.serving_size.match(app.Utils.decimalRegExp())) {
      for (let n in item.nutriments) {
        if (n.endsWith("_serving")) {
          dataAvailablePerServing = true;
          break;
        }
      }
    }
    for (let n in item.nutriments) {
      if (n.endsWith("_100g")) {
        dataAvailablePer100g = true;
        break;
      }
    }

    let perTag = "";
    if (dataAvailablePerServing === true && (preferDataPer100g !== true || dataAvailablePer100g === false)) {
      let fractionMatch = item.serving_size.match(app.Utils.fractionRegExp());
      let decimalMatch = item.serving_size.match(app.Utils.decimalRegExp());
      if (fractionMatch != undefined && fractionMatch.length >= 3)
        result.portion = Math.round(fractionMatch[1] / fractionMatch[2] * 1000) / 1000;
      else if (decimalMatch != undefined && decimalMatch.length >= 1)
        result.portion = parseFloat(decimalMatch[0].replace(",", "."));
      let unitMatch = item.serving_size.match(app.Utils.unitTextRegExp());
      if (unitMatch != undefined && unitMatch.length >= 2)
        result.unit = app.strings["unit-symbols"][unitMatch[1].trim().toLowerCase()] || unitMatch[1].trim();
      if (item.nutriments.energy_serving) {
        result.nutrition.calories = (item.nutriments["energy-kcal_serving"]) ?
          parseInt(item.nutriments["energy-kcal_serving"]) :
          app.Utils.convertUnit(item.nutriments.energy_serving, units.kilojoules, units.calories, 1);
        result.nutrition.kilojoules = item.nutriments.energy_serving;
        perTag = "_serving";
      } else if (item.nutriments.energy_prepared_serving) {
        result.nutrition.calories = (item.nutriments["energy-kcal_prepared_serving"]) ?
          parseInt(item.nutriments["energy-kcal_prepared_serving"]) :
          app.Utils.convertUnit(item.nutriments.energy_prepared_serving, units.kilojoules, units.calories, 1);
        result.nutrition.kilojoules = item.nutriments.energy_prepared_serving;
        perTag = "_prepared_serving";
      } else {
        perTag = "_serving";
      }
    } else if (dataAvailablePer100g === true) {
      result.portion = "100";
      result.unit = app.strings["unit-symbols"]["g"] || "g";
      if (item.serving_size && item.serving_size.match(/\d\s*(ml|cl|l)(\s|\)|\]|,|;|$)/i))
        result.unit = app.strings["unit-symbols"]["ml"] || "ml";
      if (item.nutriments.energy_100g) {
        result.nutrition.calories = (item.nutriments["energy-kcal_100g"]) ?
          item.nutriments["energy-kcal_100g"] :
          app.Utils.convertUnit(item.nutriments.energy_100g, units.kilojoules, units.calories, 1);
        result.nutrition.kilojoules = item.nutriments.energy_100g;
        perTag = "_100g";
      } else if (item.nutriments.energy_prepared_100g) {
        result.nutrition.calories = (item.nutriments["energy-kcal_prepared_100g"]) ?
          item.nutriments["energy-kcal_prepared_100g"] :
          app.Utils.convertUnit(item.nutriments.energy_prepared_100g, units.kilojoules, units.calories, 1);
        result.nutrition.kilojoules = item.nutriments.energy_prepared_100g;
        perTag = "_prepared_100g";
      } else {
        perTag = "_100g";
      }
    } else if (item.quantity) { // If all else fails
      let decimalMatch = item.quantity.match(app.Utils.decimalRegExp());
      if (decimalMatch != undefined && decimalMatch.length >= 1)
        result.portion = parseFloat(decimalMatch[0].replace(",", "."));
      let unitMatch = item.quantity.match(app.Utils.unitTextRegExp());
      if (unitMatch != undefined && unitMatch.length >= 2)
        result.unit = app.strings["unit-symbols"][unitMatch[1].trim().toLowerCase()] || unitMatch[1].trim();
      result.nutrition.calories = (item.nutriments["energy-kcal"]) ?
        item.nutriments["energy-kcal"] :
        item.nutriments.energy;
      result.nutrition.kilojoules = item.nutriments.energy;
    }

    // Each nutriment
    for (let i = 0; i < nutriments.length; i++) {
      let x = nutriments[i];
      if (x != "calories" && x != "kilojoules") {
        let value = item.nutriments[x + perTag];
        result.nutrition[x] = app.Utils.convertUnit(value, "g", units[x]);

        if (x == "alcohol")
          result.nutrition[x] = app.Utils.convertAlcoholVolPercentToGrams(result.nutrition[x], result.portion, result.unit);
      }
    }

    if (result.unit == undefined)
      result.unit = "?";

    if (result.portion == undefined || isNaN(result.portion))
      result = undefined;

    return result;
  }
};
