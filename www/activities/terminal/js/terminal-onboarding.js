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
  The first start and the "tour" command. After the preference questions (setup) it shows a checklist of the
  things worth entering (profile, weight, goal, first food, first meal), so you are led to them instead of having
  to know where they live. Each item runs the real command, and is ticked by looking at what is stored:
  nothing is filled in for you, and no sample data is loaded unless you ask for it (demo load).
*/
app.TerminalOnboarding = {

  seenKey: "terminal-tour-seen",
  active: false, // a checklist item is being done: show the list again when it ends

  toursSeen: function() {
    try { return window.localStorage.getItem(this.seenKey) === "1"; } catch (err) { return false; }
  },

  markToursSeen: function() {
    try { window.localStorage.setItem(this.seenKey, "1"); } catch (err) {}
  },

  // The items, each with whether the data behind it exists. Reads only; changes nothing
  steps: async function() {
    const t = app.Terminal;
    const goals = app.TerminalGoals;
    const today = t.isoDate(new Date());

    const profile = goals.getProfile();
    const weights = await app.TerminalBody.series("weight");
    const calories = goals.effective("calories", today);
    const foods = await app.TerminalFoods.allFoods();
    const days = await dbHandler.getAllItems("diary");

    // The watch's energy: done once a reading of either kind is stored
    const body = app.TerminalBody;
    const watchField = (role) => body.fields().find(f => body.role(f.name) === role);
    let watchReadings = 0;
    for (const role of ["burned", "active"]) {
      const field = watchField(role);
      if (field) watchReadings += (await body.series(field.name)).length;
    }

    return [
      {
        text: "your profile: height, birth date, sex, activity (only for the plan's formula; every field is optional)",
        done: Object.keys(profile || {}).length > 0,
        run: async () => { await goals.guidedProfile(); }
      },
      {
        text: "your weight today (and whatever your scale gives you)",
        done: weights.length > 0,
        run: async () => { await app.TerminalBody.enter([]); }
      },
      {
        text: "a daily calorie goal (or plan lose 0.5 later, to have one worked out from your data)",
        done: !!(calories && calories.value !== undefined),
        run: async () => {
          t.print("goal calories 2000 sets it from today. plan works one out from your data, and asks before applying it", "muted");
          t.ask("daily calories (a number; Enter skips)", async (line) => {
            if (line === "") return;
            await t.run("goal calories " + line);
          }, { blank: true });
        }
      },
      {
        text: "your first food: name, portion and values, asked one at a time",
        done: foods.length > 0,
        run: async () => {
          t.print("new asks what it needs. search <text> and scan find foods online instead", "muted");
          await t.run("new");
        }
      },
      {
        text: "log something you ate: + <food> [amount] [@when]",
        done: days.some(day => (day.items || []).length > 0),
        run: async () => {
          t.print("for example + oats 60g   or   + oats 60g @yesterday @08:12", "muted");
          t.ask("what did you eat? (a food you created, and an amount; Enter skips)", async (line) => {
            if (line === "") return;
            await t.run("+ " + line);
          }, { blank: true });
        }
      },
      {
        text: "a daily reminder to weigh yourself, at a time you choose (rings on the phone)",
        done: app.TerminalReminder.get() !== "",
        optional: true,
        run: async () => {
          t.ask("what time? e.g. 07:00 (Enter skips)", async (line) => {
            if (line === "") return;
            await t.run("set reminder " + line);
          }, { blank: true });
        }
      },
      {
        text: "your watch's daily energy, if you have a watch: its total for the day, or only its activity",
        done: watchReadings > 0,
        optional: true,
        run: async () => {
          t.print("which one your watch shows matters. a day's total includes your resting energy, so it is already high before you have moved; activity only counts movement", "muted");
          t.print("activity entered as a total makes plan think you burn far less than you do. to tell them apart, look at the number first thing in the morning: hundreds already means total, close to 0 means activity", "muted");
          t.ask("which is it: total or activity (Enter skips)", async (line) => {
            const answer = line.trim().toLowerCase();
            if (answer === "") return;

            const role = answer.startsWith("t") ? "burned" : answer.startsWith("a") ? "active" : "";
            if (role === "") {
              t.print("type total or activity", "err");
              return;
            }

            if (!watchField(role)) await t.run("field add " + role + " kcal");
            t.print("enter each finished day with weight, e.g.  weight " + role + " 802 @yesterday  (a day counts once it is over)", "muted");
            if (role === "active") t.print("activity needs your scale's bmr on the same day to make a total, so enter bmr too when you weigh yourself", "muted");
          }, { blank: true });
        }
      },
      {
        text: "how the areas work: a short tour",
        done: this.toursSeen(),
        run: async () => { this.areas(); }
      },
      {
        text: "already use Waistline? import your backup",
        done: false,
        optional: true,
        run: async () => { await t.run("import"); }
      }
    ];
  },

  // The checklist, as choices you can tap
  checklist: async function() {
    const t = app.Terminal;
    const steps = await this.steps();
    const required = steps.filter(s => !s.optional);
    const left = required.filter(s => !s.done).length;

    if (left === 0) t.print("all set: everything on the list is done. tour shows it again; help lists every command", "ok");
    else t.print("to get started (" + (required.length - left) + " of " + required.length + " done). tap one or type its number; skip what you do not need", "accent");

    t.printChoices(steps.map(step => ({
      text: (step.done ? "[x] " : "[ ] ") + step.text,
      run: async () => {
        this.active = true;
        await step.run();
        await this.afterStep();
      }
    })));

    t.print("nothing here is filled in for you, and no sample data is loaded. demo load adds some if you only want to look around (demo clear removes it)", "muted");
  },

  // Called when an item ends. If it asked questions, the terminal calls it again when the last one is answered
  afterStep: async function() {
    const t = app.Terminal;
    if (!this.active || t.awaiting !== undefined) return;

    this.active = false;
    await this.checklist();
  },

  // The short tour of the areas, with the one command each is for
  areas: function() {
    const t = app.Terminal;
    this.markToursSeen();

    t.print("the app is a set of folders. cd goes in, cd .. comes back, ls looks around, and + logs from anywhere", "accent");
    t.print("diary    + oats 60g   logs a meal. edit, mv, rm and undo fix it. today shows the totals", "");
    t.print("foods    new, search and scan build your list. changing a food never rewrites past days", "");
    t.print("meals    a saved set: new sandwich = bread 2 slices, cheese 2 slices. then + sandwich", "");
    t.print("recipes  a whole batch logged as one line. new stew yield 4 portions", "");
    t.print("body     weight 74.2 fat 18.5 logs measurements. odd values are pointed out, never changed", "");
    t.print("goals    goal calories 2100, and plan lose 0.5 to work out what to eat", "");
    t.print("stats    stats weight 90d draws a chart. a gap stays a gap", "");
    t.print("settings set lists units, meal names, theme and language. export saves a backup", "");
    t.print("help lists every command, help <command> explains one, and tour brings the checklist back", "muted");
  },

  // First start: the preference questions, then the checklist
  start: async function() {
    await app.TerminalSettings.setup(true, async () => {
      app.Terminal.print("preferences saved. change them any time with set", "ok");
      await this.checklist();
    });
  },

  // A line under the banner while the checklist is unfinished
  hint: async function() {
    const t = app.Terminal;
    const steps = await this.steps();
    const required = steps.filter(s => !s.optional);
    const left = required.filter(s => !s.done).length;
    if (left > 0) t.print("getting started: " + (required.length - left) + " of " + required.length + " done · tour", "muted");
  }
};

app.Terminal.commands.tour = {
  usage: "tour [areas]",
  desc: "the getting-started checklist: your profile, weight, goal, first food and first meal, each one guided. tour areas is a short explanation of the folders",
  complete: (args) => (args.length === 0 ? ["areas"] : []),
  run: async (args) => {
    if (args.length > 0 && args[0].toLowerCase() === "areas") {
      app.TerminalOnboarding.areas();
      return;
    }
    await app.TerminalOnboarding.checklist();
  }
};

// When a question ends, a checklist item that was running gets its list back
app.Terminal.afterHooks.push(() => app.TerminalOnboarding.afterStep());
