/*
  Copyright 2020-2026 David Healey

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

// After a breaking change to the settings schema, increment this constant
// and implement the migration in the migrateSettings() function below
const currentSettingsSchemaVersion = 9;

app.Settings = {

  settings: {},
  ready: false,

  put: function(field, setting, value) {
    let settings = JSON.parse(window.localStorage.getItem("settings")) || {};
    settings[field] = settings[field] || {};
    settings[field][setting] = value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
  },

  get: function(field, setting) {
    let settings = JSON.parse(window.localStorage.getItem("settings"));
    if (settings && settings[field] && settings[field][setting] !== undefined) {
      return settings[field][setting];
    }
    return undefined;
  },

  getField: function(field) {
    let settings = JSON.parse(window.localStorage.getItem("settings"));
    if (settings && settings[field] !== undefined) {
      return settings[field];
    }
    return undefined;
  },

  putField: function(field, value) {
    let settings = JSON.parse(window.localStorage.getItem("settings")) || {};
    settings[field] = settings[field] || {};
    settings[field] = value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
  },

  // Only the terminal look exists now: the colour theme and accent are applied by TerminalThemes
  changeTheme: function() {
    document.body.className = "color-theme-terminal";
    app.f7.disableAutoDarkTheme();
    if (app.TerminalThemes) app.TerminalThemes.apply();
  },

  applyAppMode: function(appMode) {
    let html = document.getElementsByTagName("html")[0];

    if (appMode === "dark")
      html.classList.add("theme-dark");
    else if (appMode === "light")
      html.classList.remove("theme-dark");
  },

  resetModuleReadyStates: function() {
    app.Settings.ready = false;
  },

  writeDatabaseBackupToFile: async function() {
    app.f7.preloader.show();

    let data = await dbHandler.export();
    data.settings = JSON.parse(window.localStorage.getItem("settings"));

    if ("off-password" in data.settings.integration) {
      data.settings.integration["off-password"] = "";
    }

    if ("usda-key" in data.settings.integration) {
      data.settings.integration["usda-key"] = "";
    }

    if ("icu-key" in data.settings.integration) {
      data.settings.integration["icu-key"] = "";
    }
    let json = JSON.stringify(data);

    let filename = "waistline_export.json";
    let path = await app.Utils.writeFile(json, filename);

    app.f7.preloader.hide();

    return path;
  },

  // Diary days between two dates, as parallel lists (moved here from the old Statistics screen)
  getDiaryData: function(from, to) {
    return new Promise(async function(resolve, reject) {
      let result = {
        "timestamps": [],
        "items": [],
        "stats": []
      };

      if (!to)
        to = new Date();

      // Make date range inclusive of the whole days at either end
      let toDate = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()));
      toDate.setHours(0, 0, 0, 0);
      let fromDate = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
      fromDate.setHours(0, 0, 0, 0);
      toDate.setUTCHours(toDate.getUTCHours() + 24);

      dbHandler.getIndex("dateTime", "diary").openCursor(IDBKeyRange.bound(fromDate, toDate, false, true)).onsuccess = function(e) {
        let cursor = e.target.result;

        if (cursor) {
          let value = cursor.value;

          if (value.items.length > 0 || value.stats.weight != undefined) {
            result.timestamps.push(value.dateTime);
            result.items.push(value.items);
            result.stats.push(value.stats);
          }

          cursor.continue();
        } else {
          resolve(result);
        }
      };
    }).catch(err => {
      throw (err);
    });
  },

  writeDiaryToCsvFile: async function() {
    app.f7.preloader.show();

    const nutriments = app.Nutriments.getNutriments();
    const bodyStats =  app.BodyStats.getBodyStats();
    const nutrimentUnits = app.Nutriments.getNutrimentUnits();
    const bodyStatsUnits = app.BodyStats.getBodyStatsUnits();
    const energyUnit = app.Settings.get("units", "energy");
    const energyName = app.Utils.getEnergyUnitName(energyUnit);
    const nutrimentVisibility = app.Settings.getField("nutrimentVisibility");
    const bodyStatsVisibility = app.Settings.getField("bodyStatsVisibility");

    // Collect relevant nutriments and stats to be included in the CSV
    let relevantFields = [];

    nutriments.forEach((x) => {
      if (x !== energyName && nutrimentVisibility[x] !== true) return;

      let displayName = app.strings.nutriments[x] || x;
      let unitSymbol = app.strings["unit-symbols"][nutrimentUnits[x]] || nutrimentUnits[x];

      let nutriment = {
        name: x,
        unit: nutrimentUnits[x],
        displayName: displayName,
        unitSymbol: unitSymbol
      }
      relevantFields.push(nutriment);
    });

    bodyStats.forEach((x) => {
      if (bodyStatsVisibility[x] !== true) return;

      let displayName = app.strings.statistics[x] || x;
      let unit = app.Goals.getGoalUnit(x, false);
      let unitSymbol = app.strings["unit-symbols"][unit] || unit;

      let stat = {
        name: x,
        unit: unit,
        displayName: displayName,
        unitSymbol: unitSymbol
      }
      relevantFields.push(stat);
    });

    // Get diary data
    let diaryData = await app.Settings.getDiaryData(new Date(0), undefined);
    let csv = "";

    // CSV header row
    csv += app.strings.settings["import-export"]["date"] || "Date";
    relevantFields.forEach((field) => {
      csv += ";" + field.displayName;
      if (field.unitSymbol !== undefined)
        csv += " (" + field.unitSymbol + ")";
    });

    // CSV data rows
    for (let i = 0; i < diaryData.timestamps.length; i++) {
      csv += "\n";

      let timestamp = diaryData.timestamps[i];
      csv += app.Utils.dateToLocaleDateString(timestamp);

      let nutrition = await app.FoodsMealsRecipes.getTotalNutrition(diaryData.items[i], "subtract");
      relevantFields.forEach((x) => {
        csv += ";"

        let field = x.name;
        let unit = x.unit;

        let value;
        if (bodyStats.includes(field))
          value = app.Utils.convertUnit(diaryData.stats[i][field], bodyStatsUnits[field], unit);
        else
          value = nutrition[field];

        if (value !== undefined)
          csv += (Math.round(value * 100) / 100).toLocaleString([], { useGrouping: false });
      });
    }

    // Write CSV to file
    let filename = "diary_export.csv";
    let path = await app.Utils.writeFile(csv, filename);

    app.f7.preloader.hide();

    return path;
  },

  firstTimeSetup: function() {
    let defaults = {
      appearance: {
        mode: (window.matchMedia) ? "system" : "light",
        theme: "color-theme-terminal",
        animations: false,
        locale: "auto",
        "start-page": "/terminal/"
      },
      statistics: {
        "y-zero": false,
        "average-line": true,
        "goal-line": true,
        "trend-line": false,
        "moving-average": false,
        "moving-average-period": 7
      },
      diary: {
        "meal-names": ["Breakfast", "Lunch", "Dinner", "Snacks", "", "", ""],
        timestamps: false,
        "show-brands": true,
        "show-thumbnails": false,
        "wifi-thumbnails": true,
        "show-all-nutriments": false,
        "show-macro-nutriments-summary": false,
        "show-nutrition-units": false,
        "prompt-add-items": false,
        "show-total-portion-size": false
      },
      foodlist: {
        labels: app.FoodsCategories.defaultLabels,
        categories: app.FoodsCategories.defaultCategories,
        sort: "alpha",
        "show-category-labels": false,
        "show-thumbnails": false,
        "wifi-thumbnails": true,
        "show-images": true,
        "wifi-images": true,
        "show-notes": false,
        "add-leftovers": false,
      },
      goals: {
        migrated: true,
        "first-day-of-week": "0",
        "average-goal-base": "week",
        kilojoules: {
          "show-in-diary": true,
          "show-in-stats": true,
          "goal-list": [] // no goal until you set one (waistline-cli does not start with sample values)
        },
        calories: {
          "show-in-diary": true,
          "show-in-stats": true,
          "goal-list": [] // no goal until you set one (waistline-cli does not start with sample values)
        },
        fat: {
          "show-in-diary": true,
          "show-in-stats": true,
          "goal-list": [] // no goal until you set one (waistline-cli does not start with sample values)
        },
        carbohydrates: {
          "show-in-diary": true,
          "show-in-stats": true,
          "goal-list": [] // no goal until you set one (waistline-cli does not start with sample values)
        },
        proteins: {
          "show-in-diary": true,
          "show-in-stats": true,
          "goal-list": [] // no goal until you set one (waistline-cli does not start with sample values)
        }
      },
      units: {
        energy: "kcal",
        weight: "kg",
        length: "cm"
      },
      nutriments: {
        order: app.nutriments,
        units: {}
      },
      bodyStats: {
        order: app.bodyStats,
        units: {}
      },
      nutrimentVisibility: {
        "fat": true,
        "saturated-fat": true,
        "carbohydrates": true,
        "sugars": true,
        "proteins": true,
        "salt": true
      },
      bodyStatsVisibility: {
        "weight": true
      },
      integration: {
        "barcode-flashlight": false,
        "barcode-sound": false,
        "edit-images": false,
        "search-language": "Default",
        "search-country": "All",
        "upload-country": "Auto",
        usda: false,
        icu: false
      },
      tts: {
        "speed": 1,
        "pitch": 1,
        "voice": "",
        "locale": ""
      },
      "import-export": {
        "auto-backup": true
      },
      developer: {
        "data-sharing-active": false,
        "data-sharing-wifi-only": true,
        "data-sharing-address": "",
        "data-sharing-authorization": ""
      },
      firstTimeSetup: true,
      schemaVersion: currentSettingsSchemaVersion
    };

    app.Settings.changeTheme(defaults.appearance.mode, defaults.appearance.theme);

    window.localStorage.setItem("settings", JSON.stringify(defaults));
  },

  migrateSettings: function(settings, saveChanges = true) {
    if (settings !== undefined && (settings.schemaVersion === undefined || settings.schemaVersion < currentSettingsSchemaVersion)) {

      // Theme settings must be renamed to Appearance
      if (settings.theme !== undefined && settings.appearance === undefined) {
        settings.appearance = settings.theme;
        delete settings.theme;
      }

      // New nutriments must be added
      if (settings.nutriments !== undefined && settings.nutriments.order !== undefined) {
        app.nutriments.forEach((x) => {
          if (!settings.nutriments.order.includes(x))
            settings.nutriments.order.push(x);
        });
      }

      // Default food labels and categories must be added
      if (settings.foodlist !== undefined && settings.foodlist.labels === undefined && settings.foodlist.categories === undefined) {
        settings.foodlist.labels = app.FoodsCategories.defaultLabels;
        settings.foodlist.categories = app.FoodsCategories.defaultCategories;
      }

      // First Day of Week and Average Base settings must be added
      if (settings.goals !== undefined && settings.goals["first-day-of-week"] === undefined && settings.goals["average-goal-base"] === undefined) {
        settings.goals["first-day-of-week"] = "0";
        settings.goals["average-goal-base"] = "week";
      }

      // Goals must be migrated to new format
      if (settings.goals !== undefined && settings.goals.migrated === undefined) {
        let oldGoals = settings.goals;
        let nutriments = app.nutriments;
        if (settings.nutriments !== undefined && settings.nutriments.order !== undefined)
          nutriments = settings.nutriments.order;
        settings.goals = app.Settings.migrateGoalSettings(oldGoals, nutriments);
      }

      // Boolean value for dark-mode must be replaced with string value
      if (settings.appearance !== undefined && settings.appearance["dark-mode"] !== undefined) {
        if (settings.appearance["dark-mode"] === true)
          settings.appearance.mode = "dark";
        else
          settings.appearance.mode = "light";
        delete settings.appearance["dark-mode"];
      }

      // Body stats 'Show in Statistics' must be migrated to bodyStatsVisibility
      if (settings.bodyStatsVisibility === undefined) {
        settings.bodyStatsVisibility = {};
        if (settings.goals !== undefined) {
          for (let key in settings.goals) {
            if (app.bodyStats.includes(key) && settings.goals[key]["show-in-stats"] !== undefined) {
              if (settings.goals[key]["show-in-stats"] === true)
                settings.bodyStatsVisibility[key] = true;
              delete settings.goals[key]["show-in-stats"];
            }
          }
        }
      }

      // "last-stat" from localStorage must be migrated to settings
      const lastStat = window.localStorage.getItem("last-stat");
      if (lastStat && settings.statistics !== undefined) {
        settings.statistics["last-stat"] = lastStat;
      }
      window.localStorage.removeItem("last-stat");

      // Show Brands setting should be initialized to "true", as is the historical default behaviour
      if (settings.diary["show-brands"] === undefined) {
        settings.diary["show-brands"] = true;
      }

      settings.schemaVersion = currentSettingsSchemaVersion;

      if (saveChanges)
        window.localStorage.setItem("settings", JSON.stringify(settings));
    }

    return settings;
  },

  migrateGoalSettings: function (oldGoals, nutriments) {

    let newGoals = {
      migrated: true
    };

    for (let key in oldGoals) {
      for (let setting of ["first-day-of-week", "average-goal-base"]) {
        if (key == setting) {
          newGoals[setting] = oldGoals[key];
          continue;
        }
      }
      for (let setting of ["-show-in-diary", "-show-in-stats"]) {
        if (key.endsWith(setting)) {
          let stat = key.replace(setting, "");
          let settingName = setting.substring(1);
          newGoals[stat] = newGoals[stat] || {};
          newGoals[stat][settingName] = oldGoals[key];
          continue;
        }
      }
      for (let setting of ["-shared-goal", "-auto-adjust", "-minimum-goal", "-percent-goal"]) {
        if (key.endsWith(setting)) {
          let stat = key.replace(setting, "");
          let settingName = setting.substring(1);
          newGoals[stat] = newGoals[stat] || {};
          newGoals[stat]["goal-list"] = newGoals[stat]["goal-list"] || [{}];
          newGoals[stat]["goal-list"][0][settingName] = oldGoals[key];
          continue;
        }
      }
      if (nutriments.includes(key) || app.bodyStats.includes(key)) {
        newGoals[key] = newGoals[key] || {};
        newGoals[key]["goal-list"] = newGoals[key]["goal-list"] || [{}];
        newGoals[key]["goal-list"][0]["goal"] = oldGoals[key];
        continue;
      }
    }

    return newGoals;
  }
};
