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
  plan: what you spend in a day, and what to eat to lose, keep or gain weight.

  Everything here is an estimate, and nothing it works out is ever stored as a
  measurement. It reads what you entered: intake from the diary, weight, and (if you
  keep those fields) the metabolic rate from the scale and the day's energy from a
  watch. A day without a value is left out, never filled in.

  What you spend is shown from each source on its own, with its label, and the
  sources are not blended into one number:
    watch    the average of the days you entered your watch's daily energy
    scale    your scale's metabolic rate times your activity level
    data     what your own intake and weight trend imply over the last weeks
    formula  height, age and sex (Mifflin-St Jeor) times your activity level

  Only plan apply writes anything, after you confirm, and as a goal that starts today.
*/
app.TerminalPlan = {

  windowDays: 21, // the weeks used for intake and weight trend
  recentDays: 14, // the days used for averages of scale and watch readings
  kcalPerKg: 7700, // energy in a kilogram of body weight, the usual rough figure
  minLoggedKcal: 1000, // a day only counts as logged from here (a half-logged day would look like a deficit)
  last: undefined, // the last plan worked out, for plan apply

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  // Energy is worked out in kcal and shown in the unit the app is set to
  fmtE: function(kcal) {
    const d = app.TerminalDiary;
    if (app.Settings.get("units", "energy") === app.nutrimentUnits.kilojoules)
      return d.grouped(kcal * 4.184) + " kJ";
    return d.grouped(kcal) + " kcal";
  },

  // A number in the unit goals are written in
  inGoalUnit: function(kcal) {
    return app.Settings.get("units", "energy") === app.nutrimentUnits.kilojoules ? Math.round(kcal * 4.184) : Math.round(kcal);
  },

  fromGoalUnit: function(value) {
    return app.Settings.get("units", "energy") === app.nutrimentUnits.kilojoules ? value / 4.184 : value;
  },

  addDays: function(iso, n) {
    const p = iso.split("-").map(Number);
    return app.Terminal.isoDate(new Date(p[0], p[1] - 1, p[2] + n));
  },

  mean: function(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  },

  // Least-squares slope of value against day, in value per day
  slope: function(points) {
    const b = app.TerminalBody;
    const first = points[0].iso;
    const xs = points.map(p => b.daysBetween(p.iso, first));
    const ys = points.map(p => p.value);
    const n = points.length;
    const sx = xs.reduce((a, c) => a + c, 0);
    const sy = ys.reduce((a, c) => a + c, 0);
    const sxy = xs.reduce((a, c, i) => a + c * ys[i], 0);
    const sxx = xs.reduce((a, c) => a + c * c, 0);
    const denominator = n * sxx - sx * sx;
    return denominator === 0 ? 0 : (n * sxy - sx * sy) / denominator;
  },

  // Mifflin-St Jeor resting energy, kcal per day
  mifflin: function(kg, cm, age, sex) {
    return 10 * kg + 6.25 * cm - 5 * age + (sex === "m" ? 5 : -161);
  },

  // A body field's readings within a range of days, in the unit a formula needs (kg for weight, kcal for energy)
  readings: function(entries, field, from, to, unit) {
    const b = app.TerminalBody;
    if (!field) return [];
    return entries
      .filter(e => e.stats && typeof e.stats[field.name] === "number" && isFinite(e.stats[field.name]))
      .map(e => ({ iso: b.isoOf(e), value: app.Utils.convertUnit(e.stats[field.name], field.internalUnit, unit) }))
      .filter(p => typeof p.value === "number" && p.iso >= from && p.iso <= to)
      .sort((a, b2) => (a.iso < b2.iso ? -1 : 1));
  },

  // ---------------------------------------------------------------------
  // Gathering what you entered
  // ---------------------------------------------------------------------

  gather: async function() {
    const t = app.Terminal;
    const b = app.TerminalBody;
    const today = t.isoDate(new Date());
    const yesterday = this.addDays(today, -1);
    const windowStart = this.addDays(yesterday, -(this.windowDays - 1));
    const recentStart = this.addDays(today, -(this.recentDays - 1));

    const entries = await dbHandler.getAllItems("diary");
    const fields = b.fields();
    const role = (r) => fields.find(f => b.role(f.name) === r);

    // What was eaten, day by day (complete days only: not today)
    const intake = [];
    for (const entry of entries) {
      const iso = b.isoOf(entry);
      if (iso < windowStart || iso > yesterday || !entry.items || entry.items.length === 0) continue;
      const total = await app.FoodsMealsRecipes.getTotalNutrition(entry.items, "ignore");
      intake.push({ iso: iso, kcal: total.calories || 0 });
    }
    const logged = intake.filter(x => x.kcal >= this.minLoggedKcal);

    const weight = this.readings(entries, role("weight"), windowStart, today, "kg");
    const allWeights = this.readings(entries, role("weight"), "0000-01-01", today, "kg");

    return {
      today: today,
      windowStart: windowStart,
      fields: { weight: role("weight"), bmr: role("bmr"), burned: role("burned"), active: role("active") },
      intake: intake,
      logged: logged,
      weight: weight,
      latestWeight: allWeights.length > 0 ? allWeights[allWeights.length - 1] : undefined,
      bmr: this.readings(entries, role("bmr"), recentStart, today, "kcal"),
      burned: this.readings(entries, role("burned"), recentStart, today, "kcal"),
      active: this.readings(entries, role("active"), recentStart, today, "kcal"),
      profile: app.TerminalGoals.getProfile()
    };
  },

  // The weight trend over the window, if there are enough weigh-ins spread over enough days
  trend: function(data) {
    const b = app.TerminalBody;
    const points = data.weight;
    if (points.length < 5) return { ok: false, why: "needs 5 weigh-ins in the last " + this.windowDays + " days, you have " + points.length };

    const span = b.daysBetween(points[points.length - 1].iso, points[0].iso);
    if (span < 10) return { ok: false, why: "the weigh-ins span " + span + " days, 10 are needed" };

    const perDay = this.slope(points);
    return { ok: true, perWeek: perDay * 7, perDay: perDay, count: points.length, span: span };
  },

  // What you spend a day, from each source that has what it needs. Each is { key, kcal, detail }.
  sources: function(data, trend) {
    const d = app.TerminalDiary;
    const out = [];
    const missing = [];
    const profile = data.profile;
    const factor = app.TerminalGoals.activityFactor(profile);
    const level = app.TerminalGoals.activityLevels.find(a => a.level === profile.activity);

    const bmr = data.bmr.length > 0 ? this.mean(data.bmr.map(p => p.value)) : undefined;

    // The watch: its own daily total, or (if all you have is its activity energy) that plus the scale's resting rate
    if (data.burned.length >= 3) {
      out.push({ key: "watch", kcal: this.mean(data.burned.map(p => p.value)), detail: "average of the " + data.burned.length + " days you entered, of the last " + this.recentDays });
    } else if (data.active.length >= 3 && bmr !== undefined) {
      out.push({ key: "watch", kcal: bmr + this.mean(data.active.map(p => p.value)), detail: "scale bmr + the watch's activity energy (" + data.active.length + " days entered)" });
    } else {
      missing.push(data.fields.burned || data.fields.active
        ? "watch (needs 3 days of " + (data.fields.burned ? data.fields.burned.name : data.fields.active.name) + " in the last " + this.recentDays + ")"
        : "watch (add the field with: field add burned kcal, then enter your watch's daily energy)");
    }

    if (bmr !== undefined && factor) {
      out.push({ key: "scale", kcal: bmr * factor, detail: "bmr " + d.grouped(bmr) + " (" + data.bmr.length + " readings) x " + level.name + " " + factor });
    } else {
      missing.push("scale (needs bmr readings" + (factor ? "" : " and an activity level: profile activity 2") + ")");
    }

    if (trend.ok && data.logged.length >= 10) {
      const meanIntake = this.mean(data.logged.map(x => x.kcal));
      out.push({
        key: "data",
        kcal: meanIntake - trend.perDay * this.kcalPerKg,
        detail: "intake " + d.grouped(meanIntake) + " over " + data.logged.length + " days, weight " + (trend.perWeek > 0 ? "+" : "−") + d.fmt(Math.abs(trend.perWeek)) + " kg/week"
      });
    } else {
      missing.push("data (needs " + (trend.ok ? "" : "a weight trend: " + trend.why + "; ") + (data.logged.length >= 10 ? "" : "10 logged days in the last " + this.windowDays + ", you have " + data.logged.length) + ")");
    }

    if (profile.height && profile.dob && profile.sex && factor && data.latestWeight) {
      const age = app.TerminalGoals.ageOf(profile.dob);
      const kg = data.latestWeight.value;
      out.push({ key: "formula", kcal: this.mifflin(kg, profile.height, age, profile.sex) * factor, detail: d.fmt(profile.height) + " cm, " + age + " years, " + d.fmt(kg) + " kg, " + level.name + " " + factor });
    } else {
      missing.push("formula (fill in profile: height, birth date, sex and activity)");
    }

    return { list: out, missing: missing, bmr: bmr };
  },

  // ---------------------------------------------------------------------
  // The plan command
  // ---------------------------------------------------------------------

  run: async function(args) {
    const t = app.Terminal;

    if (args[0] && args[0].toLowerCase() === "apply") {
      await this.apply();
      return;
    }

    const data = await this.gather();
    const trend = this.trend(data);
    const found = this.sources(data, trend);

    if (args.length === 0) {
      this.showStatus(data, trend, found);
      return;
    }

    await this.makePlan(args, data, trend, found);
  },

  showStatus: function(data, trend, found) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;

    t.print("plan: estimates from what you entered, not medical advice", "muted");

    if (data.latestWeight) {
      const age = b.daysBetween(data.today, data.latestWeight.iso);
      t.print("weight".padEnd(10) + d.fmt(data.latestWeight.value) + " kg" + (age > 0 ? " (" + age + " days ago)" : " (today)"));
    } else {
      t.print("weight".padEnd(10) + "none entered yet: weight", "muted");
    }

    t.print("trend".padEnd(10) + (trend.ok ? (trend.perWeek > 0 ? "+" : "−") + d.fmt(Math.abs(trend.perWeek)) + " kg/week over " + trend.count + " weigh-ins in " + trend.span + " days" : "not enough weigh-ins (" + trend.why + ")"), trend.ok ? "" : "muted");

    if (data.logged.length > 0)
      t.print("intake".padEnd(10) + this.fmtE(this.mean(data.logged.map(x => x.kcal))) + " a day, over " + data.logged.length + " logged days of the last " + this.windowDays + " (a day counts from " + this.fmtE(this.minLoggedKcal) + ")");
    else
      t.print("intake".padEnd(10) + "no logged days in the last " + this.windowDays, "muted");

    const goal = app.TerminalGoals.effective(app.TerminalGoals.energyName(), data.today);
    if (goal && goal.value !== undefined)
      t.print("goal".padEnd(10) + app.TerminalGoals.describe(app.TerminalGoals.energyName(), goal));

    if (found.list.length === 0) {
      t.print("what you spend: nothing to go on yet", "accent");
    } else {
      t.print("what you spend a day, each from its own source (not blended):", "accent");
      found.list.forEach((s) => {
        t.print("  " + s.key.padEnd(8) + this.fmtE(s.kcal).padStart(10) + "  " + s.detail);
      });
    }

    // Where two independent sources disagree, say so plainly
    const watch = found.list.find(s => s.key === "watch");
    const own = found.list.find(s => s.key === "data");
    if (watch && own && Math.abs(watch.kcal - own.kcal) > 250)
      t.print("your watch and your own intake and weight differ by " + this.fmtE(Math.abs(watch.kcal - own.kcal)) + " a day. either could be off; the data source only holds if you logged everything you ate", "muted");

    found.missing.forEach(m => t.print("  not available: " + m, "muted"));

    t.print("next: plan lose 0.5 (kg a week), plan gain 0.25, plan maintain. add move 200 to spend 200 more, from watch|scale|data|formula to choose the source", "muted");
  },

  // plan lose|gain|maintain [kg per week] [move N] [from source] [protein]
  makePlan: async function(args, data, trend, found) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const mode = args[0].toLowerCase();

    if (!["lose", "gain", "maintain"].includes(mode)) {
      t.print("usage: plan   |   plan lose 0.5   |   plan gain 0.25   |   plan maintain   (add move 200, from data, protein)   |   plan apply", "err");
      return;
    }

    let pace = mode === "lose" ? 0.5 : mode === "gain" ? 0.25 : 0;
    let move = 0;
    let from;
    let withProtein = false;

    for (let i = 1; i < args.length; i++) {
      const word = args[i].toLowerCase();
      if (word === "move" && args[i + 1] !== undefined) {
        move = parseFloat(args[i + 1].replace(",", "."));
        i++;
      } else if (word === "from" && args[i + 1] !== undefined) {
        from = args[i + 1].toLowerCase();
        i++;
      } else if (word === "protein") {
        withProtein = true;
      } else if (/^\d+(?:[.,]\d+)?(kg)?$/.test(word)) {
        pace = parseFloat(word.replace(",", ".").replace("kg", ""));
      } else {
        t.print("did not understand \"" + args[i] + "\"", "err");
        return;
      }
    }

    if (mode !== "maintain" && !(pace > 0 && pace <= 1.5)) {
      t.print("the pace is kilograms a week, more than 0 and at most 1.5", "err");
      return;
    }
    if (isNaN(move) || move < 0) {
      t.print("move is the extra kcal a day you would spend, e.g. move 200", "err");
      return;
    }
    if (move > 0 && mode !== "lose") {
      t.print("move only makes sense when losing: it is the part of the deficit that comes from spending more", "err");
      return;
    }

    // Which source to build on
    const order = ["data", "watch", "scale", "formula"];
    let ref;
    if (from) {
      if (!order.includes(from)) {
        t.print("from: watch, scale, data or formula", "err");
        return;
      }
      ref = found.list.find(s => s.key === from);
      if (!ref) {
        t.print("there is no " + from + " estimate yet. plan shows what each source needs", "err");
        return;
      }
    } else {
      ref = order.map(k => found.list.find(s => s.key === k)).find(Boolean);
    }
    if (!ref) {
      t.print("nothing to build a plan on yet. run plan to see what is missing", "err");
      return;
    }

    const kg = data.latestWeight ? data.latestWeight.value : undefined;

    // Never plan a loss for someone already under the healthy range
    const height = data.profile.height;
    if (mode === "lose" && kg && height) {
      const bmi = kg / Math.pow(height / 100, 2);
      if (bmi < 18.5) {
        t.print("your body mass index is " + d.fmt(bmi) + ", under 18.5, so no weight-loss plan is offered. maintain or gain work, and a professional can help", "err");
        return;
      }
    }

    const change = pace * this.kcalPerKg / 7; // kcal a day
    const deficit = mode === "lose" ? change : mode === "gain" ? -change : 0;

    if (move > deficit && mode === "lose") {
      t.print("move " + this.fmtE(move) + " is more than the whole deficit of " + this.fmtE(deficit), "err");
      return;
    }

    const eat = ref.kcal - deficit + (mode === "lose" ? move : 0);
    const warnings = [];

    if (kg && pace / kg * 100 > 1) warnings.push("that is " + d.fmt(pace / kg * 100) + "% of your weight a week; more than 1% is hard to keep up");
    if (deficit > ref.kcal * 0.25) warnings.push("the deficit is over a quarter of what you spend; smaller steps last longer");
    if (found.bmr !== undefined && eat < found.bmr) warnings.push("that is below your scale's metabolic rate of " + this.fmtE(found.bmr));
    if (eat < 1200) warnings.push("under 1,200 kcal a day is below what is generally advised for adults without professional guidance");

    t.print("using: " + ref.key + " " + this.fmtE(ref.kcal) + " a day (" + ref.detail + ")", "muted");

    if (mode === "maintain") {
      t.print("to keep your weight: about " + this.fmtE(eat) + " a day", "accent");
    } else {
      t.print((mode === "lose" ? "to lose " : "to gain ") + String(Math.round(pace * 100) / 100) + " kg a week: " + (mode === "lose" ? "a deficit of " : "a surplus of ") + this.fmtE(change) + " a day", "accent");
      t.print("eat about " + this.fmtE(eat) + " a day" + (move > 0 ? ", and spend " + this.fmtE(move) + " more than you do now" : ""), "accent");
      if (move > 0 && kg) {
        const minutes = Math.round(move / (0.044 * kg));
        t.print("  " + this.fmtE(move) + " is about " + minutes + " minutes of brisk walking at " + d.fmt(kg) + " kg (rough)", "muted");
      }
      if (move === 0 && mode === "lose")
        t.print("  to split it, add move 200: eat " + this.fmtE(eat + 200) + " and spend 200 more", "muted");
    }

    // Protein helps keep muscle while losing
    let protein;
    if (mode === "lose" && kg) {
      protein = Math.round(kg * 1.6);
      t.print("protein: at least about " + protein + " g a day helps keep muscle while losing (1.6 g per kg)" + (withProtein ? "" : ". add protein to include it in plan apply"), "muted");
    }

    // How long to a weight goal, if you set one
    const weightGoal = app.TerminalGoals.effective("weight", data.today);
    if (weightGoal && weightGoal.value !== undefined && kg && pace > 0) {
      const target = app.Utils.convertUnit(weightGoal.value, app.TerminalGoals.unitOf("weight").unit, "kg");
      const togo = mode === "lose" ? kg - target : target - kg;
      if (togo > 0) {
        const weeks = togo / pace;
        t.print("your weight goal is " + d.fmt(target) + " kg: " + d.fmt(togo) + " kg to go, about " + Math.ceil(weeks) + " weeks at this pace (around " + this.addDays(data.today, Math.round(weeks * 7)) + ")", "muted");
      } else {
        t.print("your weight goal of " + d.fmt(target) + " kg is " + (mode === "lose" ? "already reached or above where you are" : "already reached or below where you are"), "muted");
      }
    }

    warnings.forEach(w => t.print("(!) " + w, "accent"));
    t.print("estimates, not medical advice. plan apply sets your calorie goal to " + this.fmtE(eat) + (protein && withProtein ? " and protein to at least " + protein + " g" : "") + " from today, after asking", "muted");

    this.last = {
      eat: eat,
      protein: protein && withProtein ? protein : undefined,
      mode: mode,
      pace: mode === "maintain" ? 0 : pace, // kg a week, so stats project can draw it
      text: mode === "maintain" ? "to keep your weight, from " + ref.key : (mode === "lose" ? "lose " : "gain ") + String(Math.round(pace * 100) / 100) + " kg a week" + (move > 0 ? ", move " + move : "") + ", from " + ref.key
    };
  },

  // plan apply: write the last plan as goals that start today
  apply: async function() {
    const t = app.Terminal;
    const goals = app.TerminalGoals;

    if (!this.last) {
      t.print("nothing to apply yet. run plan lose 0.5 (or gain, maintain) first", "err");
      return;
    }

    const plan = this.last;
    const energy = goals.energyName();
    const value = this.inGoalUnit(plan.eat);
    const unit = goals.unitOf(energy).symbol;

    t.print("the last plan you worked out: " + plan.text, "muted");
    t.ask("set your " + (energy === "calories" ? "calorie" : "energy") + " goal to " + value.toLocaleString("en-US") + " " + unit + (plan.protein ? " and protein to at least " + plan.protein + " g" : "") + " from today? days before today keep their goal. y applies", async (line) => {
      if (!/^y(es)?$/i.test(line.trim())) {
        t.print("nothing changed", "muted");
        return;
      }

      const today = t.isoDate(new Date());
      const beforeEnergy = goals.set(energy, { values: [String(value), "", "", "", "", "", ""] }, today);
      t.pushUndo({ kind: "goal", stat: energy, before: beforeEnergy });
      t.print("goal for " + energy + ": " + value.toLocaleString("en-US") + " " + unit + " from " + today, "ok");

      if (plan.protein) {
        const beforeProtein = goals.set("proteins", { values: [String(plan.protein), "", "", "", "", "", ""], min: true }, today);
        t.pushUndo({ kind: "goal", stat: "proteins", before: beforeProtein });
        t.print("goal for proteins: at least " + plan.protein + " g from " + today, "ok");
      }
      t.print("undo puts back the last one" + (plan.protein ? ", and again for the other" : ""), "muted");
    });
  }
};

app.Terminal.commands.plan = {
  usage: "plan [lose|gain|maintain [kg a week]] [move N] [from source] [protein] | plan apply",
  desc: "what you spend a day, from each source you have (watch, scale, your own data, formula), and what to eat to lose or gain: plan lose 0.5, plan lose 0.5 move 200. plan apply sets it as your goal after asking. estimates only",
  complete: (args, partial) => {
    if (args.length === 0) return ["lose", "gain", "maintain", "apply"];
    return ["move", "from", "protein", "watch", "scale", "data", "formula"];
  },
  run: async (args) => { await app.TerminalPlan.run(args); }
};
