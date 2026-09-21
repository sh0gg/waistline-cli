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
  stats: your numbers over time, drawn in the terminal.

  Everything shown comes from what you entered. A day without a value is a gap, never a
  guess: no line is drawn across it and no average counts it. Things worked out from your
  entries (a 7-day average, fat mass = weight x fat %, the balance of intake and the
  watch's energy) are for looking at and are never stored.

  The projections (stats project) are the one place that looks ahead. They are estimates,
  drawn dashed and labelled as such: a straight line at the pace of your plan or of your
  current trend, and a body fat that follows from how much of the weight change is fat.
*/
app.TerminalStats = {

  cache: {}, // per-day intake, kept while one command runs

  // ---------------------------------------------------------------------
  // Ranges: 7d 14d 30d 12w 6m all
  // ---------------------------------------------------------------------

  // Splits a range off the words. Returns { from, to, days, label, rest }.
  parseRange: async function(tokens) {
    const t = app.Terminal;
    const b = app.TerminalBody;
    const to = t.isoDate(new Date());
    let days = 30;
    const rest = [];

    for (const token of tokens) {
      const m = /^(\d+)([dwm])$/i.exec(token);
      if (m) {
        days = parseInt(m[1], 10) * ({ d: 1, w: 7, m: 30 })[m[2].toLowerCase()];
      } else if (token.toLowerCase() === "all") {
        const entries = await dbHandler.getAllItems("diary");
        const isos = entries.filter(e => (e.items && e.items.length) || (e.stats && Object.keys(e.stats).length)).map(e => b.isoOf(e)).sort();
        days = isos.length > 0 ? b.daysBetween(to, isos[0]) + 1 : 30;
      } else {
        rest.push(token);
      }
    }

    days = Math.max(2, Math.min(days, 1500));
    const from = app.TerminalCharts.addDays(to, -(days - 1));
    return { from: from, to: to, days: days, label: days === 30 ? "last 30 days" : "last " + days + " days", rest: rest };
  },

  // ---------------------------------------------------------------------
  // Energy in the unit the app is set to
  // ---------------------------------------------------------------------

  eFactor: function() {
    return app.Settings.get("units", "energy") === app.nutrimentUnits.kilojoules ? 4.184 : 1;
  },

  eUnit: function() {
    return this.eFactor() === 1 ? "kcal" : "kJ";
  },

  e: function(kcal) {
    return kcal * this.eFactor();
  },

  fmtE: function(kcal) {
    return app.TerminalDiary.grouped(this.e(kcal)) + " " + this.eUnit();
  },

  // ---------------------------------------------------------------------
  // Reading the data
  // ---------------------------------------------------------------------

  fields: function() {
    return app.TerminalBody.fields();
  },

  role: function(r) {
    const b = app.TerminalBody;
    return this.fields().find(f => b.role(f.name) === r);
  },

  // A body field's readings in a range, in the unit you see: [{ iso, value }]
  points: async function(field, from, to) {
    if (!field) return [];
    const b = app.TerminalBody;
    const series = await b.series(field.name);
    return series
      .filter(p => p.iso >= from && p.iso <= to)
      .map(p => ({ iso: p.iso, value: b.toDisplay(field, p.value) }));
  },

  // Every day's intake in a range: [{ iso, kcal, protein, fat, carbs, logged }]. A day is "logged" from 1,000 kcal;
  // one with less is drawn light and left out of averages, as it is probably a day that was not finished.
  daily: async function(from, to) {
    const key = from + ">" + to;
    if (this.cache[key]) return this.cache[key];

    const b = app.TerminalBody;
    const entries = await dbHandler.getAllItems("diary");
    const out = [];

    for (const entry of entries) {
      const iso = b.isoOf(entry);
      if (iso < from || iso > to || !entry.items || entry.items.length === 0) continue;

      const total = await app.FoodsMealsRecipes.getTotalNutrition(entry.items, "ignore");
      const kcal = total.calories || 0;
      out.push({ iso: iso, kcal: kcal, protein: total.proteins || 0, fat: total.fat || 0, carbs: total.carbohydrates || 0, logged: kcal >= app.TerminalPlan.minLoggedKcal });
    }

    out.sort((a, c) => (a.iso < c.iso ? -1 : 1));
    this.cache[key] = out;
    return out;
  },

  mean: function(values) {
    return values.reduce((a, c) => a + c, 0) / values.length;
  },

  // The mean of the readings in a trailing window, only where there are enough of them
  movingAverage: function(points, windowDays, minCount) {
    const charts = app.TerminalCharts;
    const out = [];
    points.forEach((p) => {
      const inWindow = points.filter(q => q.iso <= p.iso && charts.days(p.iso, q.iso) < windowDays);
      if (inWindow.length >= minCount) out.push({ iso: p.iso, value: this.mean(inWindow.map(q => q.value)) });
    });
    return out;
  },

  // One value per day from first to last (undefined where there is none), for a sparkline
  perDay: function(points, from, to) {
    const charts = app.TerminalCharts;
    const n = charts.days(to, from) + 1;
    const values = new Array(n).fill(undefined);
    points.forEach((p) => { values[charts.days(p.iso, from)] = p.value; });
    return values;
  },

  // A goal as a step series over a range (it can change on a date), or none
  goalPoints: function(stat, from, to) {
    const goals = app.TerminalGoals;
    const charts = app.TerminalCharts;
    const out = [];
    const n = charts.days(to, from) + 1;
    for (let i = 0; i < n; i++) {
      const iso = charts.addDays(from, i);
      const info = goals.effective(stat, iso);
      if (info && info.value !== undefined && !info.pct) out.push({ iso: iso, value: info.value, min: info.min });
    }
    return out;
  },

  sign: function(delta) {
    return delta > 0 ? "+" : delta < 0 ? "−" : "±";
  },

  // ---------------------------------------------------------------------
  // The stats command
  // ---------------------------------------------------------------------

  run: async function(args) {
    this.cache = {};
    const t = app.Terminal;
    const range = await this.parseRange(args);
    const what = (range.rest[0] || "").toLowerCase();

    if (what === "") return this.overview(range);
    if (what === "energy") return this.energyChart(range);
    if (what === "balance") return this.balanceChart(range);
    if (what === "intake") return this.intakeChart(range);
    if (what === "protein") return this.proteinChart(range);
    if (what === "composition") return this.compositionChart(range);
    if (what === "weeks") return this.weeks(range, parseInt(range.rest[1], 10) || 8);
    if (what === "top") return this.top(range, (range.rest[1] || "kcal").toLowerCase());
    if (what === "project") return this.project(range.rest.slice(1));

    // Any body field: weight, fat, "body fat", muscle, bmr, burned...
    const aliases = { fat: "fat", weight: "weight", muscle: "muscle", water: "water", bmr: "bmr", burned: "burned", watch: "burned", active: "active" };
    const b = app.TerminalBody;
    const field = aliases[what] ? this.role(aliases[what]) : b.findField(range.rest.join(" "));
    if (field) return this.fieldChart(field, range);

    t.print("no chart called \"" + range.rest.join(" ") + "\". try: " + this.available().join(", "), "err");
  },

  available: function() {
    const names = ["intake", "protein", "energy", "balance", "composition", "weeks", "top", "project"];
    return this.fields().map(f => f.name).concat(names);
  },

  // ---------------------------------------------------------------------
  // The overview
  // ---------------------------------------------------------------------

  overview: async function(range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;
    const charts = app.TerminalCharts;

    t.print("stats · " + range.from + " → " + range.to + " (" + range.label + ")", "muted");

    const rows = [];
    const add = (row) => { if (row) rows.push(row); };

    // Body fields, with a change over the range
    const fieldRow = async (role, label, color) => {
      const field = this.role(role);
      const pts = await this.points(field, range.from, range.to);
      if (!field || pts.length === 0) return undefined;

      const latest = pts[pts.length - 1];
      const change = pts.length >= 2 ? latest.value - pts[0].value : undefined;
      const unit = b.symbol(field.unit);
      return {
        key: field.name,
        label: label,
        value: d.fmt(latest.value) + (unit === "%" ? "%" : unit ? " " + unit : ""),
        change: change === undefined ? "" : this.sign(change) + d.fmt(Math.abs(change)),
        spark: charts.spark(this.perDay(pts, range.from, range.to)),
        note: pts.length + " reading" + (pts.length === 1 ? "" : "s"),
        color: color
      };
    };

    add(await fieldRow("weight", "weight", "var(--t-cyan)"));
    add(await fieldRow("fat", "body fat", "var(--t-text)"));
    add(await fieldRow("muscle", "muscle", "var(--t-green)"));
    add(await fieldRow("water", "water", "var(--t-cyan)"));

    // Intake, and how often it matched the goal
    const days = await this.daily(range.from, range.to);
    const complete = days.filter(x => x.logged && x.iso < range.to);
    const spanDays = charts.days(range.to, range.from) + 1;
    const intakeByDay = this.perDay(complete.map(x => ({ iso: x.iso, value: x.kcal })), range.from, range.to);

    if (complete.length > 0) {
      const avg = this.mean(complete.map(x => x.kcal));
      const goalPts = this.goalPoints(app.TerminalGoals.energyName(), range.from, range.to);
      let onGoal = "";
      if (goalPts.length > 0) {
        // Goals are in your energy unit; intake is worked out in kcal
        const goalOn = (iso) => { const g = goalPts.find(p => p.iso === iso); return g ? g.value / this.eFactor() : undefined; };
        const judged = complete.filter(x => goalOn(x.iso) !== undefined);
        const hits = judged.filter(x => Math.abs(x.kcal - goalOn(x.iso)) <= goalOn(x.iso) * 0.1).length;
        if (judged.length > 0) onGoal = ", within 10% of goal on " + hits + " of " + judged.length;
      }

      add({
        key: "intake",
        label: "intake",
        value: this.fmtE(avg) + "/day",
        change: "",
        spark: charts.spark(intakeByDay, 28, 0),
        note: "logged " + complete.length + " of " + (spanDays - 1) + " finished days" + onGoal,
        color: "var(--t-accent)"
      });

      const protein = complete.map(x => x.protein);
      add({
        key: "protein",
        label: "protein",
        value: d.fmt(this.mean(protein)) + " g/day",
        change: "",
        spark: charts.spark(this.perDay(complete.map(x => ({ iso: x.iso, value: x.protein })), range.from, range.to), 28, 0),
        note: "average of " + complete.length + " logged days",
        color: "var(--t-cyan)"
      });
    }

    // What the watch says you spent, and the balance on days with both
    const burnedField = this.role("burned");
    const burned = await this.points(burnedField, range.from, range.to);
    if (burned.length > 0) {
      add({
        key: burnedField.name,
        label: "burned",
        value: this.fmtE(this.mean(burned.map(p => p.value))) + "/day",
        change: "",
        spark: charts.spark(this.perDay(burned, range.from, range.to), 28, 0),
        note: burned.length + " days from the watch",
        color: "var(--t-green)"
      });

      const both = complete.filter(x => burned.some(p => p.iso === x.iso));
      if (both.length >= 3) {
        const balances = both.map(x => x.kcal - burned.find(p => p.iso === x.iso).value);
        const avgBalance = this.mean(balances);
        add({
          key: "balance",
          label: "balance",
          value: this.sign(avgBalance) + this.fmtE(Math.abs(avgBalance)).replace(/ .*/, "") + " " + this.eUnit() + "/day",
          change: "",
          spark: charts.spark(this.perDay(both.map((x, i) => ({ iso: x.iso, value: balances[i] })), range.from, range.to)),
          note: "intake minus the watch, on " + both.length + " days that have both",
          color: avgBalance <= 0 ? "var(--t-green)" : "var(--t-red)"
        });
      }
    }

    add(await fieldRow("bmr", "bmr", "var(--t-muted)"));

    if (rows.length === 0) {
      t.print("nothing to show in this range yet. log meals and measurements first", "muted");
      return;
    }

    rows.forEach((row, i) => {
      const node = d.el("div", "term-line term-food");
      node.appendChild(d.el("span", "n", String(i + 1)));

      const name = d.el("span", "name", row.label);
      name.appendChild(d.el("span", "sep", " · "));
      name.appendChild(d.el("span", "qty", row.value));
      node.appendChild(name);

      node.appendChild(d.el("span", "kcal muted", row.change));

      const sub = d.el("div", "macros stat-spark");
      const spark = d.el("span", "spark", row.spark);
      spark.style.color = row.color;
      sub.appendChild(spark);
      sub.appendChild(document.createTextNode("  " + row.note));
      node.appendChild(sub);

      node.addEventListener("click", () => { t.run("stats " + row.key + " " + range.days + "d"); });
      t.printNode(node, true);
    });

    t.print("tap a row for its chart. also: stats energy, composition, weeks, top, project. add 7d, 12w, 6m or all for the range", "muted");
  },

  // ---------------------------------------------------------------------
  // Chart of one body field
  // ---------------------------------------------------------------------

  fieldChart: async function(field, range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;
    const charts = app.TerminalCharts;

    const pts = await this.points(field, range.from, range.to);
    if (pts.length === 0) {
      t.print("no " + field.name + " readings in this range", "muted");
      return;
    }

    const role = b.role(field.name);
    const color = { weight: "var(--t-cyan)", fat: "var(--t-text)", muscle: "var(--t-green)", water: "var(--t-cyan)", bmr: "var(--t-muted)", burned: "var(--t-green)" }[role] || "var(--t-cyan)";
    const unit = b.symbol(field.unit);
    const latest = pts[pts.length - 1];

    // Energy from a watch is per worn day: never bridge a missing one. Body readings may skip a day or two.
    const daily = role === "burned" || role === "active";
    const series = [{ name: field.name, kind: "line", color: color, points: pts, dots: true, area: true, maxGap: daily ? 1 : 3, lastLabel: d.fmt(latest.value) + (unit === "%" ? "%" : "") }];

    const average = this.movingAverage(pts, 7, 3);
    if (average.length >= 3)
      series.push({ name: "7-day average", kind: "line", color: color, points: average, width: 2.6, maxGap: 3, hideLegend: false });

    const goal = this.goalPoints(field.name, range.from, range.to);
    if (goal.length > 0)
      series.push({ name: "goal", kind: "step", color: "var(--t-accent)", points: goal, dashed: true, maxGap: 1, width: 1.3 });

    t.printNode(charts.chart({ title: field.name + (unit ? " (" + unit + ")" : ""), subtitle: range.from + " → " + range.to, from: range.from, to: range.to, decimals: 1, series: series }), true);

    // The numbers behind it
    const values = pts.map(p => p.value);
    const first = pts[0];
    const parts = ["latest " + d.fmt(latest.value) + (unit === "%" ? "%" : " " + unit) + " on " + latest.iso.slice(5)];
    if (pts.length >= 2) parts.push(this.sign(latest.value - first.value) + d.fmt(Math.abs(latest.value - first.value)) + " since " + first.iso.slice(5));
    parts.push("low " + d.fmt(Math.min.apply(null, values)) + ", high " + d.fmt(Math.max.apply(null, values)));
    parts.push(pts.length + " readings");
    t.print(parts.join(" · "), "muted");

    const days = charts.days(range.to, range.from) + 1;
    if (pts.length < days * 0.5)
      t.print("no line is drawn across gaps longer than 3 days, and the average needs 3 readings a week", "muted");
  },

  // ---------------------------------------------------------------------
  // Intake, protein, energy and balance
  // ---------------------------------------------------------------------

  intakeChart: async function(range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const days = await this.daily(range.from, range.to);
    if (days.length === 0) {
      t.print("no meals logged in this range", "muted");
      return;
    }

    const bars = days.map(x => ({ iso: x.iso, value: this.e(x.kcal), light: !x.logged || x.iso === range.to }));
    const goal = this.goalPoints(app.TerminalGoals.energyName(), range.from, range.to);

    const series = [{ name: "intake", kind: "bars", color: "var(--t-accent)", points: bars }];
    if (goal.length > 0) series.push({ name: "goal", kind: "step", color: "var(--t-text)", points: goal, dashed: true, maxGap: 1, width: 1.3 });

    t.printNode(app.TerminalCharts.chart({ title: "intake (" + this.eUnit() + " a day)", subtitle: range.from + " → " + range.to, from: range.from, to: range.to, decimals: 0, series: series }), true);

    const complete = days.filter(x => x.logged && x.iso < range.to);
    if (complete.length === 0) return;

    const kcal = complete.map(x => x.kcal);
    t.print("average " + this.fmtE(this.mean(kcal)) + " · low " + this.fmtE(Math.min.apply(null, kcal)) + ", high " + this.fmtE(Math.max.apply(null, kcal)) + " · " + complete.length + " logged days", "muted");
    t.print("light bars: today, or a day under " + this.fmtE(app.TerminalPlan.minLoggedKcal) + " (probably not finished); they are left out of the average", "muted");
  },

  proteinChart: async function(range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const days = await this.daily(range.from, range.to);
    if (days.length === 0) {
      t.print("no meals logged in this range", "muted");
      return;
    }

    const bars = days.map(x => ({ iso: x.iso, value: x.protein, light: !x.logged || x.iso === range.to }));
    const goal = this.goalPoints("proteins", range.from, range.to);

    const series = [{ name: "protein", kind: "bars", color: "var(--t-cyan)", points: bars }];
    if (goal.length > 0) series.push({ name: goal[0].min ? "goal (at least)" : "goal", kind: "step", color: "var(--t-text)", points: goal, dashed: true, maxGap: 1, width: 1.3 });

    t.printNode(app.TerminalCharts.chart({ title: "protein (g a day)", subtitle: range.from + " → " + range.to, from: range.from, to: range.to, decimals: 0, series: series }), true);

    const complete = days.filter(x => x.logged && x.iso < range.to);
    if (complete.length > 0)
      t.print("average " + d.fmt(this.mean(complete.map(x => x.protein))) + " g over " + complete.length + " logged days", "muted");
  },

  // Intake as bars against what the watch says was spent, with the balance underneath
  energyChart: async function(range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const days = await this.daily(range.from, range.to);
    const burnedField = this.role("burned");
    const burned = await this.points(burnedField, range.from, range.to);

    const bars = days.map(x => ({ iso: x.iso, value: this.e(x.kcal), light: !x.logged || x.iso === range.to }));
    const series = [{ name: "intake", kind: "bars", color: "var(--t-accent)", points: bars }];
    if (burned.length > 0)
      series.push({ name: "burned (watch)", kind: "line", color: "var(--t-green)", points: burned.map(p => ({ iso: p.iso, value: this.e(p.value) })), dots: true, maxGap: 1 }); // a day without it is a day not worn: no line across

    t.printNode(app.TerminalCharts.chart({ title: "energy: eaten and spent (" + this.eUnit() + " a day)", subtitle: range.from + " → " + range.to, from: range.from, to: range.to, decimals: 0, series: series }), true);

    if (burned.length === 0) {
      t.print("no watch energy entered in this range. add it with: field add burned kcal, then weight", "muted");
      return;
    }

    const both = days.filter(x => x.logged && x.iso < range.to && burned.some(p => p.iso === x.iso));
    if (both.length === 0) {
      t.print("no day has both a finished intake and the watch's energy", "muted");
      return;
    }

    const balances = both.map(x => x.kcal - burned.find(p => p.iso === x.iso).value);
    const avg = this.mean(balances);
    t.print("on the " + both.length + " days with both: intake minus the watch averages " + this.sign(avg) + this.fmtE(Math.abs(avg)) + " a day. stats balance draws it day by day", "muted");
  },

  balanceChart: async function(range) {
    const t = app.Terminal;
    const days = await this.daily(range.from, range.to);
    const burned = await this.points(this.role("burned"), range.from, range.to);
    const both = days.filter(x => x.logged && x.iso < range.to && burned.some(p => p.iso === x.iso));

    if (both.length === 0) {
      t.print("no day has both a finished intake and the watch's energy in this range", "muted");
      return;
    }

    const deficit = [];
    const surplus = [];
    both.forEach((x) => {
      const value = this.e(x.kcal - burned.find(p => p.iso === x.iso).value);
      (value <= 0 ? deficit : surplus).push({ iso: x.iso, value: value });
    });

    t.printNode(app.TerminalCharts.chart({
      title: "balance: intake minus the watch (" + this.eUnit() + ")",
      subtitle: range.from + " → " + range.to + " · only days with both",
      from: range.from, to: range.to, decimals: 0,
      series: [{ name: "deficit", kind: "bars", color: "var(--t-green)", points: deficit }, { name: "surplus", kind: "bars", color: "var(--t-red)", points: surplus }]
    }), true);

    const balances = both.map(x => x.kcal - burned.find(p => p.iso === x.iso).value);
    t.print("average " + this.sign(this.mean(balances)) + this.fmtE(Math.abs(this.mean(balances))) + " a day over " + both.length + " days. a watch can over- or under-count, so compare it with your weight trend", "muted");
  },

  // Fat mass and lean mass, from weight and fat % on the days that have both. For looking at, never stored.
  compositionChart: async function(range) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;

    const weightField = this.role("weight");
    const fatField = this.role("fat");
    if (!weightField || !fatField) {
      t.print("composition needs a weight field and a body fat field", "err");
      return;
    }

    const weights = await this.points(weightField, range.from, range.to);
    const fats = await this.points(fatField, range.from, range.to);
    const fatMass = [];
    const lean = [];

    weights.forEach((w) => {
      const f = fats.find(p => p.iso === w.iso);
      if (!f) return;
      fatMass.push({ iso: w.iso, value: w.value * f.value / 100 });
      lean.push({ iso: w.iso, value: w.value - w.value * f.value / 100 });
    });

    if (fatMass.length === 0) {
      t.print("no day in this range has both a weight and a body fat", "muted");
      return;
    }

    const unit = b.symbol(weightField.unit);
    t.printNode(app.TerminalCharts.chart({
      title: "composition (" + unit + ")",
      subtitle: range.from + " → " + range.to + " · fat mass = weight x fat %, on days with both",
      from: range.from, to: range.to, decimals: 1,
      series: [
        { name: "lean mass", kind: "line", color: "var(--t-cyan)", points: lean, dots: true, area: true, maxGap: 3 },
        { name: "fat mass", kind: "line", color: "var(--t-text)", points: fatMass, dots: true, maxGap: 3 }
      ]
    }), true);

    if (fatMass.length >= 2) {
      const df = fatMass[fatMass.length - 1].value - fatMass[0].value;
      const dl = lean[lean.length - 1].value - lean[0].value;
      t.print("since " + fatMass[0].iso.slice(5) + ": fat mass " + this.sign(df) + d.fmt(Math.abs(df)) + " " + unit + ", lean mass " + this.sign(dl) + d.fmt(Math.abs(dl)) + " " + unit + ". scales measure fat and water by electrical resistance, so read the direction over weeks, not single days", "muted");
    }
  },

  // ---------------------------------------------------------------------
  // Week by week
  // ---------------------------------------------------------------------

  weeks: async function(range, count) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;
    const charts = app.TerminalCharts;

    const first = Number(app.Settings.get("goals", "first-day-of-week") || 0);
    const today = t.isoDate(new Date());
    const todayDate = d.localDate(today);
    const thisWeekStart = charts.addDays(today, -((todayDate.getDay() - first + 7) % 7));
    const from = charts.addDays(thisWeekStart, -7 * (count - 1));

    const days = await this.daily(from, today);
    const weight = await this.points(this.role("weight"), from, today);
    const burned = await this.points(this.role("burned"), from, today);

    t.print("week of    weight   change   intake  burned  balance  logged", "muted");
    let previous;

    for (let w = 0; w < count; w++) {
      const start = charts.addDays(from, 7 * w);
      const end = charts.addDays(start, 6);
      const inWeek = (p) => p.iso >= start && p.iso <= end;

      const ws = weight.filter(inWeek);
      const avgWeight = ws.length > 0 ? this.mean(ws.map(p => p.value)) : undefined;

      const ds = days.filter(x => inWeek(x) && x.logged && x.iso < today);
      const avgIntake = ds.length > 0 ? this.mean(ds.map(x => x.kcal)) : undefined;

      const bs = burned.filter(inWeek);
      const avgBurned = bs.length > 0 ? this.mean(bs.map(p => p.value)) : undefined;

      const both = ds.filter(x => bs.some(p => p.iso === x.iso));
      const avgBalance = both.length > 0 ? this.mean(both.map(x => x.kcal - bs.find(p => p.iso === x.iso).value)) : undefined;

      const cell = (v, width, fmt) => (v === undefined ? "-" : fmt(v)).padStart(width);
      const change = avgWeight !== undefined && previous !== undefined ? this.sign(avgWeight - previous) + d.fmt(Math.abs(avgWeight - previous)) : undefined;

      t.print(
        start.slice(5).padEnd(10) +
        cell(avgWeight, 6, v => v.toFixed(1)) +
        cell(change, 9, v => v) +
        cell(avgIntake, 9, v => d.grouped(this.e(v))) +
        cell(avgBurned, 8, v => d.grouped(this.e(v))) +
        cell(avgBalance, 9, v => this.sign(v) + d.grouped(Math.abs(this.e(v)))) +
        (ds.length + "/7").padStart(8)
      );
      if (avgWeight !== undefined) previous = avgWeight;
    }

    t.print("weights and averages count only days you entered. intake counts finished days. " + this.eUnit() + " a day", "muted");
  },

  // ---------------------------------------------------------------------
  // What you eat the most
  // ---------------------------------------------------------------------

  top: async function(range, by) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const charts = app.TerminalCharts;
    const key = by === "protein" ? "proteins" : "calories";

    if (!["kcal", "calories", "protein", "energy"].includes(by)) {
      t.print("usage: stats top [kcal|protein] [30d]", "err");
      return;
    }

    const entries = await dbHandler.getAllItems("diary");
    const totals = {};

    for (const entry of entries) {
      const iso = app.TerminalBody.isoOf(entry);
      if (iso < range.from || iso > range.to || !entry.items) continue;

      for (const item of entry.items) {
        const food = await app.FoodsMealsRecipes.getItem(item.id, item.type, item.portion, item.quantity);
        if (!food || !food.nutrition) continue;

        const isQuick = food.barcode === "quick-add";
        const name = isQuick ? "quick add" : food.name;
        const id = (item.type || "food") + ":" + (isQuick ? "quick" : item.id);
        totals[id] = totals[id] || { name: name, value: 0, count: 0 };
        totals[id].value += food.nutrition[key] || 0;
        totals[id].count += 1;
      }
    }

    const list = Object.keys(totals).map(k => totals[k]).filter(x => x.value > 0).sort((a, c) => c.value - a.value);
    if (list.length === 0) {
      t.print("nothing logged in this range", "muted");
      return;
    }

    const sum = list.reduce((a, c) => a + c.value, 0);
    const shown = list.slice(0, 10);
    const most = shown[0].value;

    t.print("what gave the most " + (key === "proteins" ? "protein" : "energy") + " · " + range.from + " → " + range.to, "muted");
    shown.forEach((x, i) => {
      const amount = key === "proteins" ? d.fmt(x.value) + " g" : d.grouped(this.e(x.value)) + " " + this.eUnit();
      t.print(String(i + 1).padStart(2) + " " + charts.bar(x.value / most, 8) + " " + amount.padStart(9) + " " + Math.round(x.value / sum * 100).toString().padStart(3) + "%  " + x.name + " (" + x.count + "×)");
    });
    if (list.length > shown.length) t.print((list.length - shown.length) + " more foods gave the remaining " + Math.round((1 - shown.reduce((a, c) => a + c.value, 0) / sum) * 100) + "%", "muted");
  },

  // ---------------------------------------------------------------------
  // Projections. Estimates only, drawn dashed.
  // ---------------------------------------------------------------------

  // The weight the trend line says you are at on a day: less noisy than the last reading
  fitAt: function(points, iso) {
    const charts = app.TerminalCharts;
    const xs = points.map(p => charts.days(p.iso, points[0].iso));
    const ys = points.map(p => p.value);
    const n = points.length;
    const mx = xs.reduce((a, c) => a + c, 0) / n;
    const my = ys.reduce((a, c) => a + c, 0) / n;
    const sxx = xs.reduce((a, c) => a + (c - mx) * (c - mx), 0);
    const slope = sxx === 0 ? 0 : xs.reduce((a, c, i) => a + (c - mx) * (ys[i] - my), 0) / sxx;
    return my + slope * (charts.days(iso, points[0].iso) - mx);
  },

  // How much of a weight change was fat. Your own readings if there are enough, otherwise a stated default.
  fatShare: function(weights, fats, losing) {
    const pairs = [];
    weights.forEach((w) => {
      const f = fats.find(p => p.iso === w.iso);
      if (f) pairs.push({ w: w.value, fm: w.value * f.value / 100 });
    });

    const fallback = losing ? 0.75 : 0.5;
    if (pairs.length < 6) return { share: fallback, source: "a usual figure (" + Math.round(fallback * 100) + "%), you have " + pairs.length + " days with weight and fat, 6 are needed" };

    const wRange = Math.max.apply(null, pairs.map(p => p.w)) - Math.min.apply(null, pairs.map(p => p.w));
    if (wRange < 1) return { share: fallback, source: "a usual figure (" + Math.round(fallback * 100) + "%), your weight moved under 1 kg in that time" };

    const n = pairs.length;
    const mx = pairs.reduce((a, c) => a + c.w, 0) / n;
    const my = pairs.reduce((a, c) => a + c.fm, 0) / n;
    const sxx = pairs.reduce((a, c) => a + (c.w - mx) * (c.w - mx), 0);
    const slope = pairs.reduce((a, c) => a + (c.w - mx) * (c.fm - my), 0) / sxx;

    if (slope < 0.2 || slope > 1) return { share: fallback, source: "a usual figure (" + Math.round(fallback * 100) + "%), your readings gave " + Math.round(slope * 100) + "%, which is too noisy to use" };
    return { share: slope, source: "your own readings (" + Math.round(slope * 100) + "%, from " + n + " days)" };
  },

  // stats project [weight|fat] [lose|gain|maintain [kg a week]] [weeks N]
  project: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const b = app.TerminalBody;
    const charts = app.TerminalCharts;
    const plan = app.TerminalPlan;

    let only;
    let mode;
    let pace;
    let weeks;

    for (let i = 0; i < args.length; i++) {
      const w = args[i].toLowerCase();
      if (w === "weight" || w === "fat") only = w;
      else if (["lose", "gain", "maintain"].includes(w)) mode = w;
      else if (w === "weeks" && args[i + 1]) { weeks = parseInt(args[i + 1], 10); i++; }
      else if (/^\d+(?:[.,]\d+)?(kg)?$/.test(w)) pace = parseFloat(w.replace(",", ".").replace("kg", ""));
      else {
        t.print("usage: stats project [weight|fat] [lose|gain|maintain [kg a week]] [weeks 12]", "err");
        return;
      }
    }

    const weightField = this.role("weight");
    const fatField = this.role("fat");
    if (!weightField) {
      t.print("projections need a weight field", "err");
      return;
    }

    const today = t.isoDate(new Date());
    const from = charts.addDays(today, -44);
    const allWeights = await this.points(weightField, "0000-01-01", today);
    const weights = allWeights.filter(p => p.iso >= from);
    const fats = fatField ? await this.points(fatField, from, today) : [];

    if (weights.length < 3) {
      t.print("a projection needs at least 3 weigh-ins in the last 6 weeks, you have " + weights.length, "err");
      return;
    }

    // Where you are: the trend line's value today, not one noisy reading
    const start =weights.length >= 5 ? this.fitAt(weights, today) : weights[weights.length - 1].value;

    // The two scenarios, each a change in kg a week (negative when losing)
    const data = await plan.gather();
    const trend = plan.trend(data);
    const scenarios = [];

    if (trend.ok) scenarios.push({ key: "trend", label: "your trend", perWeek: app.Utils.convertUnit(trend.perWeek, "kg", weightField.unit), color: "var(--t-muted)" });

    let planWeek;
    if (mode) planWeek = mode === "maintain" ? 0 : (mode === "lose" ? -1 : 1) * (pace || (mode === "lose" ? 0.5 : 0.25));
    else if (plan.last && plan.last.pace !== undefined) planWeek = (plan.last.mode === "lose" ? -1 : plan.last.mode === "gain" ? 1 : 0) * plan.last.pace;

    if (planWeek !== undefined) scenarios.push({ key: "plan", label: "plan", perWeek: app.Utils.convertUnit(planWeek, "kg", weightField.unit), color: "var(--t-green)" });

    if (scenarios.length === 0) {
      t.print("no trend yet (needs 5 weigh-ins over 10 days) and no plan to follow. try: stats project lose 0.5", "err");
      return;
    }

    // How far ahead: until a weight goal is reached, else 12 weeks
    const goal = app.TerminalGoals.effective("weight", today);
    const goalWeight = goal && goal.value !== undefined ? goal.value : undefined;
    if (!weeks) {
      weeks = 12;
      const towards = scenarios.find(s => s.key === "plan") || scenarios[0];
      if (goalWeight !== undefined && towards.perWeek !== 0 && (goalWeight - start) * towards.perWeek > 0)
        weeks = Math.max(4, Math.min(26, Math.ceil((goalWeight - start) / towards.perWeek) + 1));
    }
    weeks = Math.max(1, Math.min(weeks, 52));

    // Fat share and the starting fat %
    let fatStart;
    const recentFats = fats.filter(p => p.iso >= charts.addDays(today, -6));
    if (fats.length > 0) fatStart = recentFats.length > 0 ? this.mean(recentFats.map(p => p.value)) : (charts.days(today, fats[fats.length - 1].iso) <= 14 ? fats[fats.length - 1].value : undefined);

    const losing = scenarios.some(s => s.perWeek < 0);
    const share = this.fatShare(weights, fats, losing);

    const project = (perWeek) => {
      const out = [];
      for (let w = 0; w <= weeks; w++) {
        const wt = start + perWeek * w;
        const point = { iso: charts.addDays(today, 7 * w), weight: wt };
        if (fatStart !== undefined) {
          const fatMass0 = start * fatStart / 100;
          const fatMass = Math.max(0.03 * wt, fatMass0 + share.share * (wt - start));
          point.fat = fatMass / wt * 100;
          point.lean = wt - fatMass;
        }
        out.push(point);
      }
      return out;
    };

    const lines = scenarios.map(s => Object.assign({}, s, { points: project(s.perWeek) }));
    const to = charts.addDays(today, 7 * weeks);
    const unit = b.symbol(weightField.unit);

    const weightSeries = [
      { name: "weight", kind: "line", color: "var(--t-cyan)", points: allWeights.filter(p => p.iso >= from), dots: true, maxGap: 3 },
      { name: "7-day average", kind: "line", color: "var(--t-cyan)", points: this.movingAverage(allWeights.filter(p => p.iso >= from), 7, 3), width: 2.6, maxGap: 3 }
    ];
    lines.forEach(l => weightSeries.push({ name: l.label + " (estimate)", kind: "line", color: l.color, dashed: true, points: l.points.map(p => ({ iso: p.iso, value: p.weight })), maxGap: 8, width: 2 }));
    if (goalWeight !== undefined) weightSeries.push({ name: "goal " + d.fmt(goalWeight) + " " + unit, kind: "step", color: "var(--t-accent)", dashed: true, points: [{ iso: from, value: goalWeight }, { iso: to, value: goalWeight }], maxGap: 100, width: 1.2 });

    if (only !== "fat")
      t.printNode(charts.chart({ title: "weight (" + unit + ") and where it is heading", subtitle: from + " → " + to + " · dashed lines are estimates", from: from, to: to, now: today, decimals: 1, series: weightSeries }), true);

    if (fatStart !== undefined && only !== "weight") {
      const fatSeries = [{ name: "body fat", kind: "line", color: "var(--t-text)", points: fats, dots: true, maxGap: 3 }];
      lines.forEach(l => fatSeries.push({ name: l.label + " (estimate)", kind: "line", color: l.color, dashed: true, points: l.points.map(p => ({ iso: p.iso, value: p.fat })), maxGap: 8, width: 2 }));
      t.printNode(charts.chart({ title: "body fat (%) and where it is heading", subtitle: from + " → " + to + " · dashed lines are estimates", from: from, to: to, now: today, decimals: 1, series: fatSeries }), true);
    } else if (only === "fat" || (fatField === undefined)) {
      t.print("no body fat readings in the last 2 weeks, so there is no body fat projection", "muted");
    }

    // The numbers at the end
    const end = (l) => l.points[l.points.length - 1];
    t.print("in " + weeks + " weeks (" + to + "), an estimate:", "accent");
    lines.forEach((l) => {
      const e = end(l);
      let text = l.label.padEnd(11) + e.weight.toFixed(1) + " " + unit + " (" + this.sign(e.weight - start) + Math.abs(e.weight - start).toFixed(1) + ")";
      if (e.fat !== undefined) text += "  fat " + d.fmt(e.fat) + "%  lean " + d.fmt(e.lean) + " " + unit;
      t.print(text);
    });

    if (fatStart !== undefined) t.print("start: " + d.fmt(start) + " " + unit + " (trend line today), " + d.fmt(fatStart) + "% fat. share of a weight change that is fat: " + share.source, "muted");

    if (goalWeight !== undefined) {
      lines.forEach((l) => {
        if (l.perWeek === 0 || (goalWeight - start) * l.perWeek <= 0) return;
        const w = Math.ceil((goalWeight - start) / l.perWeek);
        t.print(l.label + " reaches your goal of " + d.fmt(goalWeight) + " " + unit + " in about " + w + " weeks (around " + charts.addDays(today, w * 7) + ")", "muted");
      });
    }

    t.print("straight lines: real progress slows and wobbles. body fat comes from a scale that reads electrical resistance. use this as a direction, not a promise", "muted");
  }
};

// ---------------------------------------------------------------------
// Command and hooks
// ---------------------------------------------------------------------

app.Terminal.commands.stats = {
  usage: "stats [chart] [7d|30d|12w|6m|all]",
  desc: "your numbers over time. on its own: an overview. charts: weight, fat, muscle, water, bmr, burned, intake, protein, energy (eaten vs watch), balance, composition. also: weeks (table), top [kcal|protein], project [lose 0.5] (where weight and body fat are heading). gaps are left as gaps",
  complete: (args, partial) => (args.length === 0 ? app.TerminalStats.available().map(x => x.split(" ")[0]) : ["7d", "14d", "30d", "12w", "6m", "all"]),
  run: async (args) => { await app.TerminalStats.run(args); }
};

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "stats",
  run: async (args) => { await app.TerminalStats.run(args); }
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "stats")
    await app.TerminalStats.run([]);
});
