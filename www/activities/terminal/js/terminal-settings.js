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
  ~/settings: the preferences the terminal needs, written to the app's own settings
  (same keys, same format), so the regular screens and the backups see them too.

  Nothing here rewrites the past. Changing the energy unit only changes how numbers are
  shown, and renaming a meal keeps its slot, so old entries stay where they were.

  Also the first start: a short guided setup that replaces the old Settings screen.
*/
app.TerminalSettings = {

  // Every setting the terminal can change. get() gives the text shown, set() takes the words typed
  // and returns { error } or { ok, note }.
  keys: {
    energy: {
      desc: "unit for energy: kcal or kj",
      options: ["kcal", "kj"],
      get: () => (app.Settings.get("units", "energy") === "kJ" ? "kj" : "kcal"),
      set: (v) => {
        if (!["kcal", "kj"].includes(v)) return { error: "energy is kcal or kj" };
        app.Settings.put("units", "energy", v === "kj" ? "kJ" : "kcal");
        return { ok: true, note: "only how numbers are shown changes; stored values are untouched" };
      }
    },
    weight: {
      desc: "unit for body weight: kg, lb or st",
      options: ["kg", "lb", "st"],
      get: () => app.Settings.get("units", "weight") || "kg",
      set: (v) => {
        if (!["kg", "lb", "st"].includes(v)) return { error: "weight is kg, lb or st" };
        app.Settings.put("units", "weight", v);
        return { ok: true, note: "measurements you already saved are converted when shown" };
      }
    },
    length: {
      desc: "unit for lengths: cm or inch",
      options: ["cm", "inch"],
      get: () => app.Settings.get("units", "length") || "cm",
      set: (v) => {
        if (v === "in" || v === "inches") v = "inch";
        if (!["cm", "inch"].includes(v)) return { error: "length is cm or inch" };
        app.Settings.put("units", "length", v);
        return { ok: true };
      }
    },
    week: {
      desc: "first day of the week: sunday or monday",
      options: ["sunday", "monday"],
      get: () => (app.Settings.get("goals", "first-day-of-week") === "1" ? "monday" : "sunday"),
      set: (v) => {
        if (!["sunday", "monday"].includes(v)) return { error: "week is sunday or monday" };
        app.Settings.put("goals", "first-day-of-week", v === "monday" ? "1" : "0");
        return { ok: true, note: "seven-value goals start on this day" };
      }
    },
    theme: {
      desc: "colour theme: terminal, oled, solarized-dark, solarized-light, monokai, dracula (the theme command lists them)",
      options: ["terminal", "oled", "solarized-dark", "solarized-light", "monokai", "dracula"],
      get: () => app.TerminalThemes.currentName(),
      set: (v) => {
        if (!app.TerminalThemes.themes[v]) return { error: "themes: " + Object.keys(app.TerminalThemes.themes).join(", ") };
        app.TerminalThemes.save("theme", v);
        return { ok: true };
      }
    },
    accent: {
      desc: "highlight colour: a name (orange, red, yellow, green, cyan, blue, purple, pink, white), a hex like #ff8800, or default",
      options: ["default"].concat(Object.keys(app.TerminalThemes.accents)),
      get: () => app.TerminalThemes.currentAccent() || "default",
      set: (v) => {
        if (v === "default") {
          app.TerminalThemes.save("accent", undefined);
          return { ok: true };
        }
        const color = app.TerminalThemes.parseColor(v);
        if (!color) return { error: "not a colour. use a name or hex like #ff8800" };
        app.TerminalThemes.save("accent", color);
        return { ok: true };
      }
    },
    enter: {
      desc: "what the keyboard's Enter key does: send (runs the command) or button (does nothing; a send button appears next to the tab button)",
      options: ["send", "button"],
      get: () => (app.Settings.get("terminal", "enter") === "button" ? "button" : "send"),
      set: (v) => {
        if (!["send", "button"].includes(v)) return { error: "enter is send or button" };
        app.Settings.put("terminal", "enter", v);
        app.Terminal.applyEnterMode();
        return { ok: true, note: v === "button" ? "Enter no longer runs commands; use the ⏎ button" : "Enter runs the command" };
      }
    },
    flashlight: {
      desc: "torch on while scanning a barcode: on or off",
      options: ["on", "off"],
      get: () => (app.Settings.get("integration", "barcode-flashlight") ? "on" : "off"),
      set: (v) => app.TerminalSettings.toggle("integration", "barcode-flashlight", v, "flashlight")
    },
    sound: {
      desc: "beep after a barcode scan: on or off",
      options: ["on", "off"],
      get: () => (app.Settings.get("integration", "barcode-sound") ? "on" : "off"),
      set: (v) => app.TerminalSettings.toggle("integration", "barcode-sound", v, "sound")
    },
    backup: {
      desc: "automatic weekly backup file on the phone: on or off",
      options: ["on", "off"],
      get: () => (app.Settings.get("import-export", "auto-backup") ? "on" : "off"),
      set: (v) => app.TerminalSettings.toggle("import-export", "auto-backup", v, "backup")
    },
    country: {
      desc: "country for Open Food Facts searches (a country name, or all)",
      get: () => app.Settings.get("integration", "search-country") || "All",
      set: (v, raw) => {
        app.Settings.put("integration", "search-country", v === "all" ? "All" : raw);
        return { ok: true };
      }
    },
    lang: {
      desc: "language of the terminal's own text: auto (follows the phone), en or es. Commands stay in English",
      options: ["auto", "en", "es"],
      get: () => app.Settings.get("terminal", "lang") || "auto",
      set: (v) => {
        if (!["auto", "en", "es"].includes(v)) return { error: "lang is auto, en or es" };
        app.Settings.put("terminal", "lang", v);
        return { ok: true };
      }
    },
    reminder: {
      desc: "daily reminder to weigh yourself, on the phone: a time such as 07:00, or off",
      options: ["off"],
      get: () => app.TerminalReminder.get() || "off",
      set: (v) => {
        if (v === "off" || v === "none") {
          app.Settings.put("terminal", "reminder", "");
          app.TerminalReminder.apply();
          return { ok: true, note: "no more reminders" };
        }
        const time = app.TerminalReminder.parse(v);
        if (!time) return { error: "reminder is a time like 07:00, or off" };

        app.Settings.put("terminal", "reminder", time);
        app.TerminalReminder.apply();
        return { ok: true, note: "it rings every day at " + time + ". change the time, or set reminder off, whenever you like" };
      }
    },
    language: {
      desc: "language for Open Food Facts searches (a language code such as en or es, or default)",
      get: () => app.Settings.get("integration", "search-language") || "Default",
      set: (v, raw) => {
        app.Settings.put("integration", "search-language", v === "default" ? "Default" : raw);
        return { ok: true };
      }
    }
  },

  toggle: function(field, setting, word, name) {
    if (!["on", "off"].includes(word)) return { error: name + " is on or off" };
    app.Settings.put(field, setting, word === "on");
    return { ok: true };
  },

  // ---------------------------------------------------------------------
  // Meals: the diary's groups. Entries point at a slot number, so a name can change freely,
  // and a slot with entries in it cannot be emptied
  // ---------------------------------------------------------------------

  mealSlots: function() {
    const names = (app.Settings.get("diary", "meal-names") || []).slice(0, 7);
    while (names.length < 7) names.push("");
    return names;
  },

  mealsText: function() {
    return this.mealSlots().filter(n => n !== "").join(", ") || "(none)";
  },

  // Which slots have entries in them
  usedSlots: async function() {
    const days = await dbHandler.getAllItems("diary");
    const used = new Set();
    days.forEach((day) => { (day.items || []).forEach((item) => { used.add(item.category); }); });
    return used;
  },

  setMeals: async function(text) {
    const t = app.Terminal;
    const wanted = text.split(",").map(s => s.trim()).filter(s => s !== "");

    if (wanted.length === 0 || wanted.length > 7) {
      t.print("give between 1 and 7 names, separated by commas: set meals breakfast, lunch, dinner, snacks", "err");
      return;
    }
    if (new Set(wanted.map(s => s.toLowerCase())).size !== wanted.length) {
      t.print("two meals have the same name", "err");
      return;
    }

    const current = this.mealSlots();
    const next = wanted.map(s => s.charAt(0).toUpperCase() + s.slice(1));
    while (next.length < 7) next.push("");

    // A slot that has entries keeps a name, or they would vanish from the diary
    const used = await this.usedSlots();
    const lost = [];
    next.forEach((name, i) => { if (name === "" && current[i] !== "" && used.has(i)) lost.push(current[i]); });
    if (lost.length > 0) {
      t.print("cannot remove " + lost.join(", ") + ": there are entries in " + (lost.length === 1 ? "it" : "them") + ". move them first with mv <n> @meal", "err");
      return;
    }

    app.Settings.put("diary", "meal-names", next);
    t.print("meals: " + this.mealsText(), "ok");
    if (wanted.some((n, i) => current[i] !== "" && current[i].toLowerCase() !== n.toLowerCase()))
      t.print("renamed meals keep their place, so old entries stay in the same group", "muted");
  },

  // ---------------------------------------------------------------------
  // Showing and changing
  // ---------------------------------------------------------------------

  show: function() {
    const t = app.Terminal;
    const width = Math.max(...Object.keys(this.keys).map(k => k.length), 5);
    const pad = (s) => s + " ".repeat(width - s.length);

    t.print(pad("meals") + "  " + this.mealsText(), "");
    Object.keys(this.keys).forEach((key) => {
      const line = t.print(pad(key) + "  " + this.keys[key].get(), "choice", false);
      line.addEventListener("click", () => { t.print("set " + key + " <value>: " + this.keys[key].desc, "muted"); });
    });
    t.print("change one with: set <name> <value>   (set meals breakfast, lunch, dinner)   ·   setup runs the guided questions", "muted");
  },

  run: async function(args) {
    const t = app.Terminal;
    if (args.length === 0) {
      this.show();
      return;
    }

    const key = args[0].toLowerCase();
    const rest = args.slice(1).join(" ").trim();

    if (key === "meals") {
      if (rest === "") {
        t.print("meals: " + this.mealsText(), "");
        return;
      }
      await this.setMeals(rest);
      return;
    }

    const setting = this.keys[key];
    if (!setting) {
      t.print("no setting called " + key + ". set on its own lists them", "err");
      return;
    }
    if (rest === "") {
      t.print(key + ": " + setting.get() + "   (" + setting.desc + ")", "");
      return;
    }

    const result = setting.set(rest.toLowerCase(), rest);
    if (result.error) {
      t.print(result.error, "err");
      return;
    }
    t.print(key + ": " + setting.get(), "ok");
    if (result.note) t.print(result.note, "muted");
  },

  // ---------------------------------------------------------------------
  // The first start. Each step is a question with a default in [brackets] that Enter accepts
  // ---------------------------------------------------------------------

  // done: what to do after the last question. Without it the closing lines are printed here
  setup: async function(first, done) {
    const t = app.Terminal;

    t.print(first ? "welcome. a few questions to set things up. Enter keeps what is in [brackets]; q stops (you can run setup again any time)" : "setup: Enter keeps what is in [brackets]", "accent");

    const steps = [
      { key: "lang", text: "language of the terminal's text (auto, en or es)" },
      { key: "energy", text: "energy unit (kcal or kj)" },
      { key: "weight", text: "body weight unit (kg, lb or st)" },
      { key: "length", text: "length unit (cm or inch)" },
      { key: "week", text: "first day of the week (sunday or monday)" },
      { key: "meals", text: "meals of the day, separated by commas" }
    ];

    const next = async (index) => {
      if (index >= steps.length) {
        if (done) {
          await done();
          return;
        }
        t.print("all set. type help to see what you can do; + <food> logs something, new <food> creates one", "ok");
        if (first) t.print("goals: goal calories 2000 · body: weight 70 · import a backup: import", "muted");
        return;
      }

      const step = steps[index];
      const current = step.key === "meals" ? this.mealSlots().filter(n => n !== "").join(", ") : this.keys[step.key].get();
      t.ask(step.text + " [" + current + "]", async (line) => {
        const answer = line.trim();
        if (answer !== "") {
          if (step.key === "meals") {
            await this.setMeals(answer);
          } else {
            const result = this.keys[step.key].set(answer.toLowerCase(), answer);
            if (result.error) {
              t.print(result.error, "err");
              await next(index);
              return;
            }
            t.print(step.key + ": " + this.keys[step.key].get(), "ok");
          }
        }
        await next(index + 1);
      }, { blank: true });
    };
    await next(0);
  }
};

app.Terminal.commands.set = {
  usage: "set [name] [value]",
  desc: "your preferences: set lists them, set energy kj, set weight lb, set week monday, set meals breakfast, lunch, dinner, set theme terminal, set sound off. set <name> shows one",
  complete: (args) => {
    if (args.length === 0) return ["meals"].concat(Object.keys(app.TerminalSettings.keys));
    const setting = app.TerminalSettings.keys[(args[0] || "").toLowerCase()];
    return setting && setting.options ? setting.options : [];
  },
  run: async (args) => { await app.TerminalSettings.run(args); }
};

app.Terminal.commands.setup = {
  usage: "setup",
  desc: "the guided questions of the first start: units, first day of the week and meal names. Enter keeps the current value",
  run: async () => { await app.TerminalSettings.setup(false); }
};

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "settings",
  run: () => app.TerminalSettings.show()
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "settings")
    app.TerminalSettings.show();
});
