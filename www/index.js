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
  along with Waistline.  If not, see <http://www.gnu.org/licenses/>.
*/

const app = {
  mode: "release",
  version: "%%VERSION%%", // Will be set on build by Cordova hook
  data: {}, // App wide object that can be used to store stuff
  strings: {}, // Localization strings
  standardUnits: ["kcal", "kJ", "ug", "µg", "mg", "g", "kg", "ul", "µl", "ml", "dl", "dL", "cl", "cL", "l", "L"],
  bodyStats: ["weight", "neck", "waist", "hips", "body fat"],
  bodyStatsUnits: {
    "weight": "kg",
    "neck": "cm",
    "waist": "cm",
    "hips": "cm",
    "body fat": "%"
  },
  energyMacroNutriments: ["fat", "saturated-fat", "carbohydrates", "sugars", "proteins", "alcohol"],
  nutriments: ["kilojoules", "calories", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber", "proteins", "salt", "sodium", "cholesterol", "trans-fat", "monounsaturated-fat", "polyunsaturated-fat", "omega-3-fat", "omega-6-fat", "omega-9-fat", "vitamin-a", "vitamin-b1", "vitamin-b2", "vitamin-pp", "pantothenic-acid", "vitamin-b6", "biotin", "vitamin-b9", "vitamin-b12", "vitamin-c", "vitamin-d", "vitamin-e", "vitamin-k", "potassium", "chloride", "calcium", "phosphorus", "iron", "magnesium", "zinc", "copper", "manganese", "fluoride", "selenium", "iodine", "caffeine", "alcohol", "sucrose", "glucose", "fructose", "lactose"],
  nutrimentUnits: {
    "kilojoules": "kJ",
    "calories": "kcal",
    "fat": "g",
    "saturated-fat": "g",
    "carbohydrates": "g",
    "sugars": "g",
    "fiber": "g",
    "proteins": "g",
    "salt": "g",
    "sodium": "mg",
    "cholesterol": "mg",
    "trans-fat": "g",
    "monounsaturated-fat": "g",
    "polyunsaturated-fat": "g",
    "omega-3-fat": "g",
    "omega-6-fat": "g",
    "omega-9-fat": "g",
    "vitamin-a": "µg",
    "vitamin-b1": "mg",
    "vitamin-b2": "mg",
    "vitamin-pp": "mg",
    "pantothenic-acid": "mg",
    "vitamin-b6": "mg",
    "biotin": "µg",
    "vitamin-b9": "µg",
    "vitamin-b12": "µg",
    "vitamin-c": "mg",
    "vitamin-d": "µg",
    "vitamin-e": "mg",
    "vitamin-k": "µg",
    "potassium": "mg",
    "chloride": "mg",
    "calcium": "mg",
    "phosphorus": "mg",
    "iron": "mg",
    "magnesium": "mg",
    "zinc": "mg",
    "copper": "mg",
    "manganese": "mg",
    "fluoride": "mg",
    "selenium": "µg",
    "iodine": "µg",
    "caffeine": "mg",
    "alcohol": "g",
    "sucrose": "g",
    "glucose": "g",
    "fructose": "g",
    "lactose": "g"
  },

  getLanguage: function(locale) {
    if (locale == undefined || locale == "auto") {
      locale = navigator.language.replace(/_/, '-').toLowerCase();

      if (locale.length > 3)
        locale = locale.substring(0, 3) + locale.substring(3, 5).toUpperCase();
    }
    return locale;
  },

  localize: function() {
    let lang = app.getLanguage(app.Settings.get("appearance", "locale"));

    if (app.Settings.ready === false) {

      // Get default/fallback locale strings
      $.getJSON("assets/locales/locale-en.json", (enStrings) => {
        app.strings = enStrings;
        app.Settings.ready = true;
        app.doLocalize(lang, (localeStrings, defaultCallback) => {
          // Merge default strings with locale strings in case there are any missing values
          app.strings = app.Utils.concatObjects(app.strings, localeStrings);
          defaultCallback(localeStrings);
        });
      });

    } else {
      app.doLocalize(lang);
    }
  },

  doLocalize: function(lang, callback) {
    $("[data-localize]").localize("assets/locales/locale", {
      language: lang,
      skipLanguage: /^en/,
      callback: callback
    });
  },

  setRtlWritingDirection: function() {
    $("#framework7").get(0).setAttribute("href", "assets/framework7/framework7-bundle-rtl.min.css");
    $("html").get(0).setAttribute("dir", "rtl");
  },

  f7: new Framework7({
    // App root element
    root: "#app",
    // App Name
    name: "Waistline",
    // App id
    id: "com.waist.line",
    version: "2.9.2",
    calendar: {
      url: 'calendar/',
      dateFormat: 'dd.mm.yyyy',
    },
    touch: {
      tapHold: true, //enable tap hold events
      disableContextMenu: false
    },
    // Add default routes
    routes: [{
      name: "Terminal",
      path: "/terminal/",
      url: "activities/terminal/views/terminal.html"
    }
    ]
  })
};

// Create main view
let animate = true;
let rtl = false;
let settings = JSON.parse(window.localStorage.getItem("settings"));

if (settings != undefined && settings.appearance !== undefined) {
  if (settings.appearance.animations !== undefined)
    animate = !settings.appearance.animations;
  if (settings.appearance.locale !== undefined)
    rtl = app.getLanguage(settings.appearance.locale).startsWith("he");
}

let viewOptions = {
  animate: animate
};

if (rtl)
  app.setRtlWritingDirection();

const mainView = app.f7.views.create("#main-view", viewOptions);

app.f7.on("init", async function(event) {});

app.f7.on("darkThemeChange", function(isDark) {
  let appMode = isDark ? "dark" : "light";
  app.Settings.applyAppMode(appMode);
});

document.addEventListener("page:beforein", (e) => {
  app.localize();
});

let isAutoBackupDue = function() {
  let autoBackup = app.Settings.get("import-export", "auto-backup");
  let lastBackup = window.localStorage.getItem("last-backup");
  let now = Date.now();
  if (autoBackup === true && (lastBackup == undefined || now - lastBackup > 60 * 60 * 1000)) {
    window.localStorage.setItem("last-backup", now);
    return true;
  }
  return false;
}

let triggerAutoBackup = function() {
  if (device.platform !== "browser" && isAutoBackupDue()) {
    setTimeout(async () => {
      let data = await dbHandler.export();
      let settings = JSON.parse(window.localStorage.getItem("settings"));
      data.settings = settings;
      let json = JSON.stringify(data);

      let weekday = (new Date()).toLocaleDateString("en", {weekday: "long"}).toLowerCase();
      let filename = "waistline_backup_" + weekday + ".json";
      let path = await app.Utils.writeFile(json, filename);
    }, 2000);
  }
}

document.addEventListener("deviceready", async function() {
  app.localize();

  await dbHandler.initializeDb();

  if (settings == undefined || settings.firstTimeSetup == undefined) {
    app.Settings.firstTimeSetup();
    try { window.localStorage.setItem("terminal-first-run", "1"); } catch (err) {}
    app.f7.views.main.router.navigate("/terminal/");
  } else {
    settings = app.Settings.migrateSettings(settings);
    app.Settings.changeTheme(settings.appearance.mode, settings.appearance.theme);
    app.f7.views.main.router.navigate("/terminal/");
  }

  triggerAutoBackup();
});

document.addEventListener("resume", async function() {
  triggerAutoBackup();
});

// Prevent chrome displaying context menu on long click
window.addEventListener("contextmenu", (e) => {
  let target = e.target.nodeName.toLowerCase();
  if (target !== "input" && target !== "textarea")
    e.preventDefault();
});

// Auto-select text in input fields on focus
let focusedElement;
$(document).on("focus", "input.auto-select", (e) => {
  e.preventDefault();
  let target = e.target;
  if (focusedElement == target) return;
  focusedElement = target;
  focusedElement.select();
});
$(document).on("blur", "input.auto-select", (e) => {
  focusedElement = undefined;
});

// Android back button
let backButtonPressedFlag = false;
const handleBackButtonWithConfirm = (confirmMessage, backAction) => {
  if (backButtonPressedFlag === true) {
    backAction();
    backButtonPressedFlag = false;
  } else {
    app.Utils.toast(confirmMessage, 2500, "bottom", () => {
      backButtonPressedFlag = false;
    });
    backButtonPressedFlag = true;
  }
}

document.addEventListener("backbutton", (e) => {

  let dialogs = document.querySelectorAll(".dialog");
  if (dialogs.length) {
    app.f7.dialog.close(".dialog");
    return false;
  }

  let smartSelects = document.querySelectorAll(".smart-select-popover,.smart-select-sheet");
  if (smartSelects.length) {
    document.querySelectorAll(".smart-select").forEach((el) => { app.f7.smartSelect.close(el) });
    return false;
  }

  let actions = document.querySelectorAll(".actions-modal");
  if (actions.length) {
    app.f7.actions.close(".actions-modal");
    return false;
  }

  let calendar = document.querySelectorAll(".calendar");
  if (calendar.length) {
    app.f7.calendar.close(".calendar");
    return false;
  }

  let loginScreen = document.querySelectorAll(".login-screen.modal-in");
  if (loginScreen.length) {
    app.f7.loginScreen.close(".login-screen");
    return false;
  }

  let searchField = document.querySelector(".page-current input[type='search']");
  if (searchField && searchField.value) {
    $(".page-current .page-content").scrollTop(0);
    app.f7.searchbar.disable(".searchbar");
    return false;
  }

  let selection = app.FoodsMealsRecipes.selection;
  if (searchField && selection && selection.length) {
    app.FoodsMealsRecipes.clearSelection();
    return false;
  }

  let history = new Set(app.f7.views.main.history);
  if (history.size < 2) {
    let confirmMessage = app.strings.dialogs["press-back-again-exit"] || "Press Back again to exit the app";
    handleBackButtonWithConfirm(confirmMessage, () => navigator.app.exitApp());
  } else if (document.querySelector('.page-current').hasAttribute('confirm-backbutton')) {
    let confirmMessage = app.strings.dialogs["press-back-again-editor"] || "Press Back again to leave the editor";
    handleBackButtonWithConfirm(confirmMessage, () => app.f7.views.main.router.back());
  } else {
    app.f7.views.main.router.back();
  }
});

// Defocus search field when Android keyboard is hidden
window.addEventListener("keyboardDidHide", (e) => {
  let searchField = document.querySelector("input[type='search']");
  if (searchField) {
    if (searchField.value)
      searchField.blur();
    else
      app.f7.searchbar.disable(".searchbar");
  }
});

window.addEventListener("keydown", (e) => {
	if (e.code == "AltRight" || e.code == "AltLeft") {
		e.preventDefault();
	}
});
