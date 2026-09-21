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
  Goals, in the app's own settings. A goal has versions, each with a date it takes
  effect from, and the version in effect on a day is the one that day uses. Changing a
  goal adds a version that starts today (or later), so past days keep the goal they
  had, like everything else here that must not rewrite the past.

  Also the profile (height, birth date, sex, activity) that the plan can use for its
  formula estimate. It is optional, and a field left blank stays blank.
*/
app.TerminalGoals = {

  // ---------------------------------------------------------------------
  // Which stats a goal can be for
  // ---------------------------------------------------------------------

  energyName: function() {
    return app.Utils.getEnergyUnitName(app.Settings.get("units", "energy"));
  },

  // A word for a stat: calories, kcal, protein, "body fat", weight...
  findStat: function(text) {
    const d = app.TerminalDiary;
    const q = d.norm(text);

    const aliases = {
      kcal: this.energyName(), calories: this.energyName(), energy: this.energyName(), kj: "kilojoules", kilojoules: "kilojoules",
      protein: "proteins", carb: "carbohydrates", carbs: "carbohydrates", sat: "saturated-fat", sugar: "sugars", fibre: "fiber"
    };
    if (aliases[q]) return aliases[q];

    const nutriments = app.Nutriments.getNutriments();
    const exact = nutriments.find(n => n === q);
    if (exact) return exact;

    const body = app.TerminalBody.findField(text);
    if (body) return body.name;

    const starts = nutriments.filter(n => n.startsWith(q));
    return starts.length === 1 ? starts[0] : undefined;
  },

  isBodyStat: function(stat) {
    return app.BodyStats.getBodyStats().includes(stat);
  },

  // The unit a goal is written in, and its symbol
  unitOf: function(stat) {
    const unit = app.Goals.getGoalUnit(stat, true);
    return { unit: unit, symbol: ((app.strings && app.strings["unit-symbols"]) || {})[unit] || unit || "" };
  },

  // ---------------------------------------------------------------------
  // Reading goals
  // ---------------------------------------------------------------------

  utcDate: function(iso) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  },

  isoOfDate: function(value) {
    return new Date(value).toISOString().slice(0, 10);
  },

  // 0-6, counted from the first day of the week set in the app
  dayIndex: function(date) {
    const first = Number(app.Settings.get("goals", "first-day-of-week") || 0);
    return (date.getDay() - first + 7) % 7;
  },

  // The version of a stat's goal in effect on a day (the app's own rule), with what it says for that day
  effective: function(stat, iso) {
    const local = app.TerminalDiary.localDate(iso);
    const entry = app.Goals.getStatDateGoal(stat, local);
    if (!entry || !entry.goal) return undefined;

    const shared = entry["shared-goal"] === true || this.isBodyStat(stat);
    const raw = shared ? entry.goal[0] : entry.goal[this.dayIndex(local)];
    const value = parseFloat(raw);

    return {
      entry: entry,
      value: isNaN(value) ? undefined : value,
      shared: shared,
      min: entry["minimum-goal"] === true,
      auto: entry["auto-adjust"] === true,
      pct: entry["percent-goal"] === true,
      since: entry["effective-from"] ? this.isoOfDate(entry["effective-from"]) : undefined
    };
  },

  // "2,000 kcal", "70 g", "30% of energy", with "at least" for minimums
  describe: function(stat, info) {
    const d = app.TerminalDiary;
    if (!info || info.value === undefined) return "no goal";

    const unit = this.unitOf(stat).symbol;
    let text = info.pct ? this.number(info.value) + "% of energy" : this.number(info.value) + (unit ? (unit === "%" ? "%" : " " + unit) : "");
    if (info.min) text = "at least " + text;
    return text;
  },

  number: function(value) {
    const rounded = Math.round(value * 10) / 10;
    return rounded.toLocaleString("en-US");
  },

  // All stats that have a goal today, energy first
  withGoals: function(iso) {
    const goals = app.Settings.getField("goals") || {};
    const energy = this.energyName();
    const stats = Object.keys(goals).filter((key) => {
      const item = goals[key];
      return item && typeof item === "object" && Array.isArray(item["goal-list"]);
    });

    // The app keeps a goal for both energy units; only the one you use matters
    const otherEnergy = energy === "calories" ? "kilojoules" : "calories";

    const rank = (s) => (s === energy ? 0 : ["fat", "carbohydrates", "proteins"].includes(s) ? 1 : this.isBodyStat(s) ? 3 : 2);
    return stats
      .filter(s => s !== otherEnergy)
      .filter(s => (this.effective(s, iso) || {}).value !== undefined)
      .sort((a, b) => (rank(a) - rank(b)) || (a < b ? -1 : 1));
  },

  // ---------------------------------------------------------------------
  // Changing goals
  // ---------------------------------------------------------------------

  // change: { values: [7 strings] | null, min, auto, pct }. Only what is given is changed; a flag not
  // mentioned stays as it was. The change starts on effectiveIso and earlier days keep their goal.
  // Returns what the stat's settings were, so it can be undone.
  set: function(stat, change, effectiveIso) {
    const before = JSON.parse(JSON.stringify(app.Settings.get("goals", stat) || {}));
    const settings = JSON.parse(JSON.stringify(before));
    const list = (settings["goal-list"] || []).slice();
    const when = this.utcDate(effectiveIso);

    // The version in effect that day supplies the flags that were not mentioned
    let inEffect;
    for (let i = list.length - 1; i >= 0; i--) {
      const from = list[i] && list[i]["effective-from"];
      if (!from || new Date(from) <= when) {
        inEffect = list[i];
        break;
      }
    }

    const next = JSON.parse(JSON.stringify(inEffect || {}));
    delete next["effective-from"];

    if (change.values !== undefined) {
      next.goal = change.values === null ? ["", "", "", "", "", "", ""] : change.values;
      next["shared-goal"] = change.values === null ? true : change.values.slice(1).every(v => v === "");
    }
    if (change.min !== undefined) next["minimum-goal"] = change.min;
    if (change.auto !== undefined) next["auto-adjust"] = change.auto;
    if (change.pct !== undefined) next["percent-goal"] = change.pct;

    const sameDay = list.findIndex(e => e && e["effective-from"] && this.isoOfDate(e["effective-from"]) === effectiveIso);
    if (sameDay !== -1) {
      next["effective-from"] = list[sameDay]["effective-from"];
      list[sameDay] = next;
    } else {
      next["effective-from"] = when.toISOString();
      list.push(next);
    }

    settings["goal-list"] = list;
    if (settings["show-in-diary"] === undefined) settings["show-in-diary"] = false;
    if (settings["show-in-stats"] === undefined) settings["show-in-stats"] = false;
    app.Settings.put("goals", stat, settings);
    return before;
  },

  restore: function(stat, before) {
    app.Settings.put("goals", stat, before);
  },

  // ---------------------------------------------------------------------
  // The goal command
  // ---------------------------------------------------------------------

  // goal <stat> <value> [7 values] [min|max] [auto|noauto] [pct|abs] [@date]   |   goal <stat> none
  run: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    if (args.length === 0) {
      await this.show([]);
      return;
    }

    const tags = d.splitTags(args);
    if (tags.error) {
      t.print(tags.error, "err");
      return;
    }
    if (tags.time || tags.meal !== undefined) {
      t.print("a goal starts on a day: @2026-10-01 or @tomorrow. not a time or a meal", "err");
      return;
    }

    const today = t.isoDate(new Date());
    const effective = tags.date || today;
    if (effective < today) {
      t.print("a goal starts today or later, so the days already lived keep the goal they had. use @" + today + " or a later day", "err");
      return;
    }

    const stat = this.findStat(tags.plain[0]);
    if (!stat) {
      t.print("no stat called \"" + tags.plain[0] + "\". try calories, protein, carbs, fat, weight...", "err");
      return;
    }

    const change = {};
    const numbers = [];
    for (const word of tags.plain.slice(1)) {
      const w = word.toLowerCase();
      if (w === "none") change.values = null;
      else if (w === "min") change.min = true;
      else if (w === "max") change.min = false;
      else if (w === "auto") change.auto = true;
      else if (w === "noauto") change.auto = false;
      else if (w === "pct") change.pct = true;
      else if (w === "abs") change.pct = false;
      else numbers.push(word);
    }

    if (numbers.length > 0) {
      if (numbers.length !== 1 && numbers.length !== 7) {
        t.print("give one value, or seven for the days of the week starting on your first day (" + (app.Settings.get("goals", "first-day-of-week") === "1" ? "monday" : "sunday") + ")", "err");
        return;
      }

      const parsed = numbers.map(n => this.parseGoalValue(stat, n));
      const bad = parsed.find(p => p.error);
      if (bad) {
        t.print(bad.error, "err");
        return;
      }
      change.values = numbers.length === 1
        ? [String(parsed[0].value), "", "", "", "", "", ""]
        : parsed.map(p => String(p.value));
    }

    if (Object.keys(change).length === 0) {
      await this.show([stat]);
      return;
    }

    if (change.pct === true && !app.energyMacroNutriments.includes(stat)) {
      t.print("only fat, carbohydrates, proteins, sugars, saturated fat and alcohol can be a percentage of energy", "err");
      return;
    }

    const before = this.set(stat, change, effective);
    t.pushUndo({ kind: "goal", stat: stat, before: before });

    const info = this.effective(stat, effective);
    t.print("goal for " + stat + ": " + this.describe(stat, info) + (info.auto ? " (auto-adjusted)" : "") + " from " + effective, "ok");
    if (effective === today)
      t.print("days before today keep the goal they had", "muted");
  },

  // A goal value in the unit the goal is written in, or an error
  parseGoalValue: function(stat, text) {
    const d = app.TerminalDiary;
    const m = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z%]*)$/.exec(text);
    if (!m) return { error: "\"" + text + "\" is not a number" };

    let value = parseFloat(m[1].replace(",", "."));
    const typed = m[2];
    const unit = this.unitOf(stat).unit;

    if (typed && typed.toLowerCase() !== String(unit || "").toLowerCase()) {
      const converted = app.Utils.convertUnit(value, typed, unit);
      if (typeof converted !== "number" || !isFinite(converted))
        return { error: stat + " goals are in " + (this.unitOf(stat).symbol || "plain numbers") + ", not " + typed };
      value = converted;
    }
    if (!(value >= 0)) return { error: "the goal cannot be negative" };
    return { value: Math.round(value * 100) / 100 };
  },

  // ---------------------------------------------------------------------
  // Showing goals
  // ---------------------------------------------------------------------

  show: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const today = t.isoDate(new Date());

    if (args[0]) {
      const stat = this.findStat(args[0]);
      if (!stat) {
        t.print("no stat called \"" + args[0] + "\"", "err");
        return;
      }
      this.details(stat);
      return;
    }

    const stats = this.withGoals(today);
    if (stats.length === 0) {
      t.print("(no goals yet. try: goal calories 2000)", "muted");
      return;
    }

    stats.forEach((stat, i) => {
      const info = this.effective(stat, today);
      const node = d.el("div", "term-line term-food");
      node.appendChild(d.el("span", "n", String(i + 1)));

      const name = d.el("span", "name", stat);
      name.appendChild(d.el("span", "sep", " · "));
      name.appendChild(d.el("span", "qty", this.describe(stat, info)));
      node.appendChild(name);

      node.appendChild(d.el("span", "kcal muted", info.since ? "since " + info.since.slice(5) : ""));

      const notes = [];
      if (info.auto) notes.push("auto-adjusted");
      if (!info.shared) notes.push("different each day");
      if ((app.Settings.get("goals", stat) || {})["goal-list"].length > 1) notes.push("has earlier versions");
      if (notes.length > 0) node.appendChild(d.el("div", "macros", notes.join(" · ")));

      node.addEventListener("click", () => { this.details(stat); });
      t.printNode(node, true);
    });

    t.print("tap one for its history. goal <stat> <value> changes it from today.", "muted");
  },

  details: function(stat) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const versions = (app.Settings.get("goals", stat) || {})["goal-list"] || [];

    t.print(stat + " (" + (this.unitOf(stat).symbol || "no unit") + ")", "cyan");
    if (versions.length === 0) {
      t.print("no goal", "muted");
      return;
    }

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const first = Number(app.Settings.get("goals", "first-day-of-week") || 0);

    versions.forEach((v, i) => {
      const from = v["effective-from"] ? "from " + this.isoOfDate(v["effective-from"]) : "from the start";
      const values = v.goal || [];
      const shared = v["shared-goal"] === true || this.isBodyStat(stat);
      const flags = [v["minimum-goal"] ? "minimum" : "", v["auto-adjust"] ? "auto-adjust" : "", v["percent-goal"] ? "% of energy" : ""].filter(Boolean).join(", ");

      let text;
      if (shared) text = values[0] === "" || values[0] === undefined ? "none" : this.number(parseFloat(values[0]));
      else text = days.map((_, k) => days[(first + k) % 7].slice(0, 3) + " " + (values[k] === "" || values[k] === undefined ? "-" : this.number(parseFloat(values[k])))).join("  ");

      const current = i === versions.length - 1 ? "  ← now" : "";
      t.print(from.padEnd(22) + text + (flags ? "  (" + flags + ")" : "") + current);
    });
  },

  // ---------------------------------------------------------------------
  // Profile: what the plan may use for its formula estimate. Optional; blank stays blank.
  // ---------------------------------------------------------------------

  activityLevels: [
    { level: 1, name: "sedentary", factor: 1.2, text: "little or no exercise, desk job" },
    { level: 2, name: "light", factor: 1.375, text: "light exercise 1 to 3 days a week" },
    { level: 3, name: "moderate", factor: 1.55, text: "moderate exercise 3 to 5 days a week" },
    { level: 4, name: "very active", factor: 1.725, text: "hard exercise 6 to 7 days a week" },
    { level: 5, name: "extra active", factor: 1.9, text: "hard exercise and a physical job" }
  ],

  getProfile: function() {
    return app.Settings.getField("profile") || {};
  },

  saveProfile: function(profile) {
    app.Settings.putField("profile", profile);
  },

  ageOf: function(dob) {
    const born = new Date(dob);
    return Math.floor((Date.now() - born.getTime()) / 31557600000);
  },

  activityFactor: function(profile) {
    const found = this.activityLevels.find(a => a.level === profile.activity);
    return found ? found.factor : undefined;
  },

  // One profile value from what was typed. Returns { value } | { clear } | { error }.
  parseProfileValue: function(key, text) {
    const t = app.Terminal;
    if (text === "-") return { clear: true };

    if (key === "height") {
      const m = /^(\d+(?:[.,]\d+)?)\s*(cm|in|inch|m)?$/i.exec(text);
      if (!m) return { error: "height looks like 178 or 178cm or 70in" };
      let cm = parseFloat(m[1].replace(",", "."));
      const unit = (m[2] || "cm").toLowerCase();
      if (unit === "in" || unit === "inch") cm *= 2.54;
      if (unit === "m") cm *= 100;
      if (cm < 100 || cm > 250) return { error: "that height is outside 100 to 250 cm" };
      return { value: Math.round(cm * 10) / 10 };
    }

    if (key === "dob") {
      if (!t.isValidDate(text)) return { error: "birth date looks like 1990-05-12" };
      const age = this.ageOf(text);
      if (age < 10 || age > 110) return { error: "that gives an age of " + age + ", which looks wrong" };
      return { value: text };
    }

    if (key === "sex") {
      const s = text.toLowerCase();
      if (["m", "male", "man"].includes(s)) return { value: "m" };
      if (["f", "female", "woman"].includes(s)) return { value: "f" };
      return { error: "sex for the formula: m or f (or - to clear it)" };
    }

    if (key === "activity") {
      const n = parseInt(text, 10);
      const byName = this.activityLevels.find(a => a.name === text.toLowerCase());
      const level = byName ? byName.level : n;
      if (!this.activityLevels.some(a => a.level === level)) return { error: "activity is 1 to 5: " + this.activityLevels.map(a => a.level + " " + a.name).join(", ") };
      return { value: level };
    }
    return { error: "unknown profile field" };
  },

  showProfile: function() {
    const t = app.Terminal;
    const p = this.getProfile();
    const level = this.activityLevels.find(a => a.level === p.activity);

    t.print("profile (only used for the plan's formula estimate; blank stays blank)", "muted");
    t.print("height".padEnd(12) + (p.height ? p.height + " cm" : "-"));
    t.print("birth date".padEnd(12) + (p.dob ? p.dob + " (" + this.ageOf(p.dob) + " years)" : "-"));
    t.print("sex".padEnd(12) + (p.sex || "-"));
    t.print("activity".padEnd(12) + (level ? level.level + " " + level.name + " (x" + level.factor + ")" : "-"));
  },

  // profile: guided. profile height 178 dob 1990-05-12 sex m activity 3: all at once. profile clear.
  runProfile: async function(args) {
    const t = app.Terminal;

    if (args.length === 0) {
      await this.guidedProfile();
      return;
    }
    if (args[0].toLowerCase() === "show") {
      this.showProfile();
      return;
    }
    if (args[0].toLowerCase() === "clear") {
      this.saveProfile({});
      t.print("profile cleared", "ok");
      return;
    }

    const keys = { height: "height", dob: "dob", birth: "dob", sex: "sex", activity: "activity" };
    const profile = Object.assign({}, this.getProfile());
    let i = 0;
    while (i < args.length) {
      const key = keys[args[i].toLowerCase()];
      if (!key || args[i + 1] === undefined) {
        t.print("usage: profile height 178 dob 1990-05-12 sex m activity 3   (or profile on its own to be asked)", "err");
        return;
      }
      const parsed = this.parseProfileValue(key, args[i + 1]);
      if (parsed.error) {
        t.print(key + ": " + parsed.error, "err");
        return;
      }
      if (parsed.clear) delete profile[key];
      else profile[key] = parsed.value;
      i += 2;
    }

    this.saveProfile(profile);
    this.showProfile();
  },

  guidedProfile: async function() {
    const t = app.Terminal;
    const profile = Object.assign({}, this.getProfile());
    const steps = [
      { key: "height", question: "height in cm (178, or 70in)" },
      { key: "dob", question: "birth date (1990-05-12)" },
      { key: "sex", question: "sex, for the formula only (m or f)" },
      { key: "activity", question: "activity: " + this.activityLevels.map(a => a.level + " " + a.name).join(", ") }
    ];

    t.print("profile: only what the plan's formula estimate needs. Enter leaves a field as it is, - clears it, q cancels", "muted");

    const next = async (index) => {
      if (index >= steps.length) {
        this.saveProfile(profile);
        this.showProfile();
        return;
      }

      const step = steps[index];
      const now = profile[step.key];
      const ask = () => {
        t.ask(step.question + (now !== undefined ? " · now " + now : "") + "?", async (line) => {
          if (line === "") {
            await next(index + 1);
            return;
          }
          const parsed = this.parseProfileValue(step.key, line);
          if (parsed.error) {
            t.print(parsed.error, "err");
            ask();
            return;
          }
          if (parsed.clear) delete profile[step.key];
          else profile[step.key] = parsed.value;
          await next(index + 1);
        }, { blank: true });
      };
      ask();
    };
    await next(0);
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

app.Terminal.commands.goal = {
  usage: "goal <stat> <value> [min] [auto] [pct] [@date]",
  desc: "set a goal from today (past days keep theirs): goal calories 2100, goal protein 120 min, goal fat 30 pct, goal weight 70, goal calories none. seven values set each day of the week. on its own it lists goals",
  complete: (args, partial) => {
    if (partial.startsWith("@")) return ["@today", "@tomorrow"];
    if (args.length === 0) return ["calories", "protein", "carbohydrates", "fat", "weight", "sugars", "fiber", "salt"];
    return ["min", "max", "auto", "noauto", "pct", "abs", "none"];
  },
  run: async (args) => { await app.TerminalGoals.run(args); }
};

app.Terminal.commands.profile = {
  usage: "profile [height 178 dob 1990-05-12 sex m activity 3]",
  desc: "your height, birth date, sex and activity level, only for the plan's formula estimate. on its own it asks; Enter skips a field. profile show / clear",
  complete: (args) => (args.length === 0 ? ["show", "clear", "height", "dob", "sex", "activity"] : []),
  run: async (args) => { await app.TerminalGoals.runProfile(args); }
};

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "goals",
  run: (args) => app.TerminalGoals.show(args)
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "goals")
    await app.TerminalGoals.show([]);
});

// cat <stat> inside ~/goals shows that goal's history
(function() {
  const command = app.Terminal.commands.cat;
  const previous = command.run;
  command.run = async (args, line) => {
    const t = app.Terminal;
    if (!(t.cwd.length === 1 && t.cwd[0] === "goals")) {
      await previous(args, line);
      return;
    }
    if (args.length === 0) {
      t.print("usage: cat <stat>", "err");
      return;
    }
    await app.TerminalGoals.show([args.join(" ")]);
  };
  command.desc += " (in ~/goals: a goal's history)";
})();
