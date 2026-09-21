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
  Body measurements: weight and whatever else the scale reports (fat, water, muscle,
  bone, metabolic rate...). They live on the diary day, as in the regular screen.

  The rule here is that only what you type is ever stored. A field you leave blank
  stays empty that day: nothing is worked out, filled in or averaged.

  Estimates are used in exactly one way: to notice a probable mistake before saving.
  A value far from your recent ones, or out of step with the others (water against
  fat, muscle + fat + bone over 100 %, metabolic rate against weight), is pointed out
  and you decide. A suggestion such as "did you mean 74.2?" is never applied for you.
*/
app.TerminalBody = {

  // ---------------------------------------------------------------------
  // Fields and units
  // ---------------------------------------------------------------------

  // The body fields defined in the app, in its order. unit is the one you see; internalUnit is how it is stored.
  fields: function() {
    const order = app.BodyStats.getBodyStats();
    const internal = app.BodyStats.getBodyStatsUnits();
    const visibility = app.Settings.getField("bodyStatsVisibility") || {};

    return order.map((name) => {
      const internalUnit = internal[name];
      const unit = app.Goals.getGoalUnit(name, false) || internalUnit;
      return { name: name, internalUnit: internalUnit, unit: unit, visible: visibility[name] === true };
    });
  },

  symbol: function(unit) {
    return ((app.strings && app.strings["unit-symbols"]) || {})[unit] || unit || "";
  },

  toDisplay: function(field, value) {
    return app.Utils.convertUnit(value, field.internalUnit, field.unit);
  },

  toInternal: function(field, value) {
    return app.Utils.convertUnit(value, field.unit, field.internalUnit);
  },

  // "74.2 kg", "18.4%"
  format: function(field, internal) {
    const shown = this.toDisplay(field, internal);
    const symbol = this.symbol(field.unit);
    return app.TerminalDiary.fmt(shown) + (symbol === "%" ? "%" : (symbol ? " " + symbol : ""));
  },

  // The field a word refers to: the whole name, one of its words ("fat" for "body fat"), or a unique start
  findField: function(text, fields) {
    const d = app.TerminalDiary;
    const q = d.norm(text);
    const list = fields || this.fields();

    const exact = list.find(f => d.norm(f.name) === q);
    if (exact) return exact;

    const byWord = list.filter(f => d.norm(f.name).split(/\s+/).includes(q));
    if (byWord.length === 1) return byWord[0];

    const byStart = list.filter(f => d.norm(f.name).startsWith(q));
    return byStart.length === 1 ? byStart[0] : undefined;
  },

  // What a field means, judged by its name, so the checks can compare related ones
  role: function(name) {
    const n = String(name).toLowerCase();
    if (n === "weight") return "weight";
    if (/\bfat\b/.test(n)) return "fat";
    if (n.includes("muscle")) return "muscle";
    if (n.includes("bone")) return "bone";
    if (n.includes("water")) return "water";
    if (/bmr|basal|metabol/.test(n)) return "bmr";
    if (/burn|expend|tdee/.test(n)) return "burned"; // total energy spent in a day, e.g. from a watch
    if (/(^|[^a-z])active([^a-z]|$)/.test(n)) return "active"; // only the energy spent on activity
    return undefined;
  },

  // ---------------------------------------------------------------------
  // Reading what was typed
  // ---------------------------------------------------------------------

  // A value for a field: 74.2, 74,2, 163lb, or "-" to clear. Returns { internal } | { clear } | { error }.
  parseValue: function(field, text) {
    if (text === "-") return { clear: true };

    const m = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z%]*)$/.exec(text);
    if (!m) return { error: "\"" + text + "\" is not a number" };

    let value = parseFloat(m[1].replace(",", "."));
    const typed = m[2];

    if (typed && typed.toLowerCase() !== String(field.unit || "").toLowerCase()) {
      const converted = app.Utils.convertUnit(value, typed, field.unit);
      if (typeof converted !== "number" || !isFinite(converted))
        return { error: field.name + " is in " + (this.symbol(field.unit) || "plain numbers") + ", not " + typed };
      value = converted;
    }

    if (!(value > 0)) return { error: "the value must be more than 0" };

    // Conversions leave float noise (73.9355612); four decimals keep it exact enough to convert back
    return { internal: Math.round(this.toInternal(field, value) * 10000) / 10000 };
  },

  // ---------------------------------------------------------------------
  // Reading what is stored
  // ---------------------------------------------------------------------

  daysBetween: function(a, b) {
    const t = (iso) => { const p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
    return Math.round((t(a) - t(b)) / 86400000);
  },

  isoOf: function(entry) {
    return new Date(entry.dateTime).toISOString().slice(0, 10);
  },

  // Every day that has a value for a field, oldest first: [{ iso, value }] (internal units)
  series: async function(name) {
    const entries = await dbHandler.getAllItems("diary");
    return entries
      .filter(e => e.stats && typeof e.stats[name] === "number" && isFinite(e.stats[name]))
      .map(e => ({ iso: this.isoOf(e), value: e.stats[name] }))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1));
  },

  // The measurement of a field nearest to a day, not counting that day itself
  reference: function(series, iso) {
    let best;
    series.forEach((point) => {
      if (point.iso === iso) return;
      const gap = Math.abs(this.daysBetween(point.iso, iso));
      if (!best || gap < best.gap) best = { iso: point.iso, value: point.value, gap: gap };
    });
    return best;
  },

  // ---------------------------------------------------------------------
  // Noticing probable mistakes. These only ever produce a message.
  // ---------------------------------------------------------------------

  // How far from the last value is normal, in stored units
  tolerance: function(field, gapDays) {
    const unit = String(field.internalUnit || "").toLowerCase();
    const extra = Math.max(0, gapDays - 1);

    if (unit === "kg") return { abs: Math.min(6, 1.5 + 0.3 * extra) };
    if (unit === "lb") return { abs: Math.min(13, 3.3 + 0.66 * extra) };
    if (unit === "%") return { abs: Math.min(8, 2.5 + 0.25 * extra) };
    if (unit === "cm") return { abs: Math.min(8, 3 + 0.3 * extra) };
    // What a day spends varies a lot from one day to the next
    const role = this.role(field.name);
    if (role === "burned" || role === "active") return { rel: 0.3 };
    if (unit === "kcal" || unit === "kj") return { rel: 0.08 };
    return { rel: 0.3 };
  },

  // Values that cannot be right for what the field measures
  plausible: function(field) {
    const unit = String(field.internalUnit || "").toLowerCase();
    if (unit === "kg") return [25, 300];
    if (unit === "lb") return [55, 660];
    if (unit === "%") return [0.5, 90];
    if (unit === "cm") return [10, 250];
    if (unit === "kcal") return this.role(field.name) === "active" ? [10, 3500] : [700, 4500];
    return undefined;
  },

  withinTolerance: function(field, value, ref) {
    const tol = this.tolerance(field, ref.gap);
    const diff = Math.abs(value - ref.value);
    return tol.abs !== undefined ? diff <= tol.abs : diff <= tol.rel * Math.abs(ref.value);
  },

  // A typo that would make the value fit: 742 -> 74.2. Only ever offered, never applied.
  suggest: function(field, value, ref) {
    const range = this.plausible(field);
    const fits = (c) => {
      if (range && (c < range[0] || c > range[1])) return false;
      if (ref) return this.withinTolerance(field, c, ref);
      return !!range;
    };
    const found = [value / 10, value * 10, value / 100, value * 100].find(fits);
    return found === undefined ? undefined : Math.round(found * 10) / 10;
  },

  // Messages about a value about to be saved. ctx: { iso, ref, byRole } with byRole in stored units,
  // including this value. Returns { warnings: [...], suggestion }.
  assess: function(field, internal, ctx) {
    const d = app.TerminalDiary;
    const warnings = [];
    const show = (v) => this.format(field, v);

    // A slip of the decimal point can explain being out of range or far from usual, but not a clash between fields
    let typoLikely = false;

    const range = this.plausible(field);
    if (range && (internal < range[0] || internal > range[1])) {
      warnings.push(show(internal) + " is outside what " + field.name + " normally is (" + show(range[0]) + " to " + show(range[1]) + ")");
      typoLikely = true;
    }

    if (ctx.ref) {
      const tol = this.tolerance(field, ctx.ref.gap);
      const diff = Math.abs(internal - ctx.ref.value);
      const far = tol.abs !== undefined ? diff > tol.abs : diff > tol.rel * Math.abs(ctx.ref.value);
      if (far) {
        const when = ctx.ref.gap === 0 ? "" : ctx.ref.gap === 1 ? ", a day away" : ", " + ctx.ref.gap + " days away";
        warnings.push(show(internal) + " is far from your nearest " + field.name + " (" + show(ctx.ref.value) + " on " + ctx.ref.iso + when + ")");
        typoLikely = true;
      }
    }

    // Related fields should agree with each other
    const role = this.role(field.name);
    const v = ctx.byRole || {};

    if ((role === "fat" || role === "muscle" || role === "bone") && v.fat !== undefined && v.muscle !== undefined) {
      const total = v.fat + v.muscle + (v.bone || 0);
      if (total > 100)
        warnings.push("fat + muscle" + (v.bone !== undefined ? " + bone" : "") + " add up to " + d.fmt(total) + "%, which is more than 100%");
    }

    if ((role === "fat" || role === "water") && v.fat !== undefined && v.water !== undefined) {
      const typical = (100 - v.fat) * 0.7;
      if (Math.abs(v.water - typical) > 12)
        warnings.push("water " + d.fmt(v.water) + "% does not fit " + d.fmt(v.fat) + "% body fat (about " + d.fmt(typical) + "% would be usual)");
    }

    if ((role === "bmr" || role === "weight") && v.bmr !== undefined && v.weight !== undefined) {
      const ratio = v.bmr / v.weight;
      if (ratio < 14 || ratio > 34)
        warnings.push("a metabolic rate of " + d.fmt(v.bmr) + " for " + d.fmt(v.weight) + " kg is " + d.fmt(ratio) + " per kg (scales usually give 15 to 30)");
    }

    // A day cannot spend less than the body burns at rest
    if (role === "burned" && v.burned !== undefined && v.bmr !== undefined && v.burned < v.bmr * 0.95)
      warnings.push("a day's energy of " + d.fmt(v.burned) + " is less than your metabolic rate of " + d.fmt(v.bmr) + " (was the watch worn all day?)");

    return { warnings: warnings, suggestion: typoLikely ? this.suggest(field, internal, ctx.ref) : undefined };
  },

  // ---------------------------------------------------------------------
  // Saving. Only the fields that were given are touched.
  // ---------------------------------------------------------------------

  // changes: { fieldName: number | null }  (null removes the value)
  save: async function(iso, changes) {
    const d = app.TerminalDiary;
    const entry = (await d.getEntry(iso)) || d.newEntry(iso);
    entry.stats = entry.stats || {};

    const before = [];
    Object.keys(changes).forEach((name) => {
      before.push({ field: name, before: entry.stats[name] });
      if (changes[name] === null) delete entry.stats[name];
      else entry.stats[name] = changes[name];
    });

    // A value you set replaces a sample one, so demo clear must not remove it
    if (entry.demoStats) entry.demoStats = entry.demoStats.filter(k => !(k in changes));

    await d.saveEntry(entry);
    app.Terminal.pushUndo({ kind: "body", date: iso, changes: before });
    return entry;
  },

  // Put back what an undo remembers
  undo: async function(entry, operation) {
    const t = app.Terminal;
    entry.stats = entry.stats || {};
    operation.changes.forEach((c) => {
      if (c.before === undefined) delete entry.stats[c.field];
      else entry.stats[c.field] = c.before;
    });
    await app.TerminalDiary.saveEntry(entry);
    t.print("put the measurements of " + operation.date + " back as they were", "ok");
  },

  summary: function(iso, changes, fields) {
    const t = app.Terminal;
    const set = [];
    const removed = [];

    Object.keys(changes).forEach((name) => {
      const field = fields.find(f => f.name === name);
      if (changes[name] === null) removed.push(name);
      else set.push(name + " " + (field ? this.format(field, changes[name]) : changes[name]));
    });

    if (set.length > 0) t.print("saved " + iso + ": " + set.join(" · "), "ok");
    if (removed.length > 0) t.print("cleared " + removed.join(", ") + " on " + iso, "ok");
    if (set.length === 0 && removed.length === 0) t.print("nothing changed", "muted");
  },

  // ---------------------------------------------------------------------
  // Entering measurements
  // ---------------------------------------------------------------------

  // The values of a day by role, in stored units (used to compare related fields)
  byRoleOf: function(fields, values) {
    const byRole = {};
    fields.forEach((f) => {
      const role = this.role(f.name);
      if (role && typeof values[f.name] === "number") byRole[role] = values[f.name];
    });
    return byRole;
  },

  // Context for checking one value: the nearest measurement and the day's other values
  contextFor: async function(field, iso, values, fields, cache) {
    if (!cache[field.name]) cache[field.name] = await this.series(field.name);
    return { iso: iso, ref: this.reference(cache[field.name], iso), byRole: this.byRoleOf(fields, values) };
  },

  // Command: weight [value] [field value ...] [@day]
  enter: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const tags = d.splitTags(args);
    if (tags.error) {
      t.print(tags.error, "err");
      return;
    }
    if (tags.time || tags.meal !== undefined) {
      t.print("a measurement belongs to a day, not to a time or a meal. use @yesterday or @2026-09-18", "err");
      return;
    }

    const iso = tags.date || t.dayOfCwd() || t.isoDate(new Date());
    const fields = this.fields();

    if (fields.length === 0) {
      t.print("no body fields are defined. add one with: field add weight kg", "err");
      return;
    }

    if (tags.plain.length === 0)
      await this.guided(iso, fields);
    else
      await this.oneLine(iso, fields, tags.plain);
  },

  // Everything typed at once: weight 74.2 fat 18.5 water 55, or just weight 74.2
  oneLine: async function(iso, fields, tokens) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const changes = {};
    const values = {};
    let i = 0;

    // A bare first number is the weight
    if (!isNaN(d.parseNumber(tokens[0].replace(/[a-zA-Z%]+$/, "")))) {
      const weight = this.findField("weight", fields);
      if (!weight) {
        t.print("there is no weight field. add one with: field add weight kg", "err");
        return;
      }
      const parsed = this.parseValue(weight, tokens[0]);
      if (parsed.error) {
        t.print(parsed.error, "err");
        return;
      }
      changes[weight.name] = parsed.clear ? null : parsed.internal;
      i = 1;
    }

    while (i < tokens.length) {
      const field = this.findField(tokens[i], fields);
      if (!field) {
        t.print("no field called \"" + tokens[i] + "\". you have: " + fields.map(f => f.name).join(", "), "err");
        return;
      }
      if (tokens[i + 1] === undefined) {
        t.print(field.name + " needs a value, e.g. " + field.name + " 18.5 (or - to clear it)", "err");
        return;
      }
      const parsed = this.parseValue(field, tokens[i + 1]);
      if (parsed.error) {
        t.print(field.name + ": " + parsed.error, "err");
        return;
      }
      changes[field.name] = parsed.clear ? null : parsed.internal;
      i += 2;
    }

    // Check what was typed against what is stored, and against each other
    const entry = await d.getEntry(iso);
    const stored = Object.assign({}, (entry && entry.stats) || {});
    Object.keys(changes).forEach((name) => { if (changes[name] === null) delete stored[name]; else stored[name] = changes[name]; });

    const cache = {};
    const problems = [];
    for (const name of Object.keys(changes)) {
      if (changes[name] === null) continue;
      const field = fields.find(f => f.name === name);
      const ctx = await this.contextFor(field, iso, stored, fields, cache);
      const result = this.assess(field, changes[name], ctx);
      const add = (message) => { if (!problems.includes(message)) problems.push(message); }; // two fields can raise the same clash
      result.warnings.forEach(add);
      if (result.suggestion !== undefined)
        add("did you mean " + d.fmt(result.suggestion) + " for " + name + "? type it again if so; it is not applied for you");
    }

    if (problems.length === 0) {
      await this.save(iso, changes);
      this.summary(iso, changes, fields);
      return;
    }

    problems.forEach(p => t.print("(!) " + p, "accent"));
    t.ask("save what you typed anyway? y saves, anything else cancels", async (line) => {
      if (/^y(es)?$/i.test(line.trim())) {
        await this.save(iso, changes);
        this.summary(iso, changes, fields);
      } else {
        t.print("nothing saved", "muted");
      }
    });
  },

  // Field by field. Enter leaves a field empty (or keeps what is there), "-" clears it.
  guided: async function(iso, allFields) {
    const t = app.Terminal;
    const d = app.TerminalDiary;

    const fields = allFields.filter(f => f.visible);
    if (fields.length === 0) {
      t.print("no body field is shown. show one with: field show weight", "err");
      return;
    }

    const entry = await d.getEntry(iso);
    const stored = Object.assign({}, (entry && entry.stats) || {});
    const changes = {};
    const values = Object.assign({}, stored);
    const cache = {};

    const weekday = app.TerminalI18n.weekday(d.localDate(iso));
    t.print("measurements for " + iso + " " + weekday + ". Enter leaves a field empty, - clears it, q cancels", "muted");
    if (allFields.length > fields.length)
      t.print("asking for: " + fields.map(f => f.name).join(", ") + ". more with: fields", "muted");

    const finish = async () => {
      if (Object.keys(changes).length > 0) await this.save(iso, changes);
      this.summary(iso, changes, allFields);

      const empty = fields.filter(f => values[f.name] === undefined).map(f => f.name);
      if (empty.length > 0) t.print("left empty: " + empty.join(", "), "muted");
    };

    const accept = (field, internal) => {
      if (internal === null) {
        if (stored[field.name] !== undefined) changes[field.name] = null;
        delete values[field.name];
      } else {
        changes[field.name] = internal;
        values[field.name] = internal;
      }
    };

    const next = async (index) => {
      if (index >= fields.length) {
        await finish();
        return;
      }

      const field = fields[index];
      const cacheKey = field.name;
      if (!cache[cacheKey]) cache[cacheKey] = await this.series(field.name);
      const ref = this.reference(cache[cacheKey], iso);

      let label = field.name + " (" + (this.symbol(field.unit) || "number") + ")";
      if (stored[field.name] !== undefined) label += " · now " + this.format(field, stored[field.name]);
      if (ref) label += " · " + (ref.iso < iso ? "last " : "next ") + this.format(field, ref.value) + " on " + ref.iso.slice(5);

      const ask = () => {
        t.ask(label + "?", async (line) => {
          if (line === "") {
            await next(index + 1);
            return;
          }

          const parsed = this.parseValue(field, line);
          if (parsed.error) {
            t.print(parsed.error, "err");
            ask();
            return;
          }
          if (parsed.clear) {
            accept(field, null);
            await next(index + 1);
            return;
          }

          await review(field, parsed.internal, index, ask);
        }, { blank: true });
      };
      ask();
    };

    // A value that looks off is pointed out; the answer decides
    const review = async (field, internal, index, retry) => {
      const ctx = await this.contextFor(field, iso, Object.assign({}, values, { [field.name]: internal }), fields, cache);
      const result = this.assess(field, internal, ctx);

      if (result.warnings.length === 0) {
        accept(field, internal);
        await next(index + 1);
        return;
      }

      result.warnings.forEach(w => t.print("(!) " + w, "accent"));
      if (result.suggestion !== undefined)
        t.print("did you mean " + d.fmt(result.suggestion) + "? type it if so; it is not applied for you", "muted");

      t.ask("keep " + this.format(field, internal) + "? y keeps it, type another value, Enter leaves " + field.name + " empty", async (line) => {
        if (/^y(es)?$/i.test(line.trim())) {
          accept(field, internal);
          await next(index + 1);
        } else if (line === "") {
          await next(index + 1);
        } else {
          const parsed = this.parseValue(field, line);
          if (parsed.error) {
            t.print(parsed.error, "err");
            await review(field, internal, index, retry);
          } else if (parsed.clear) {
            accept(field, null);
            await next(index + 1);
          } else {
            await review(field, parsed.internal, index, retry);
          }
        }
      }, { blank: true });
    };

    await next(0);
  },

  // ---------------------------------------------------------------------
  // Showing measurements
  // ---------------------------------------------------------------------

  // All days that have any measurement, newest first: [{ iso, stats }]
  days: async function() {
    const entries = await dbHandler.getAllItems("diary");
    return entries
      .filter(e => e.stats && Object.keys(e.stats).length > 0)
      .map(e => ({ iso: this.isoOf(e), stats: e.stats }))
      .sort((a, b) => (a.iso < b.iso ? 1 : -1));
  },

  showDays: async function(args) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const fields = this.fields();

    // ls weight: the history of one field
    if (args[0] && !/^\d{4}-\d{2}$/.test(args[0])) {
      const field = this.findField(args[0], fields);
      if (!field) {
        t.print("no field called \"" + args[0] + "\". you have: " + fields.map(f => f.name).join(", "), "err");
        return;
      }
      await this.showHistory(field, parseInt(args[1], 10) || 20);
      return;
    }

    const month = args[0];
    let days = await this.days();
    if (month) days = days.filter(x => x.iso.startsWith(month));

    if (days.length === 0) {
      t.print(month ? "no measurements in " + month : "(no measurements yet. try: weight)", "muted");
      return;
    }

    const total = days.length;
    if (!month) days = days.slice(0, 14);

    const weight = this.findField("weight", fields);
    days.forEach((day, i) => {
      // The change against the day before this one in the list, for the main field
      const main = weight && day.stats[weight.name] !== undefined ? weight : fields.find(f => day.stats[f.name] !== undefined);
      const older = days[i + 1];

      const node = d.el("div", "term-line term-food");
      node.appendChild(d.el("span", "n", String(i + 1)));

      const weekday = app.TerminalI18n.weekday(d.localDate(day.iso));
      const name = d.el("span", "name", day.iso + " " + weekday);
      if (main) {
        name.appendChild(d.el("span", "sep", " · "));
        name.appendChild(d.el("span", "qty", main.name + " " + this.format(main, day.stats[main.name])));
      }
      node.appendChild(name);

      let change = "";
      // Only against a measurement close enough to mean something (not one from weeks before)
      if (main && older && typeof older.stats[main.name] === "number" && this.daysBetween(day.iso, older.iso) <= 10) {
        const delta = this.toDisplay(main, day.stats[main.name]) - this.toDisplay(main, older.stats[main.name]);
        change = (delta > 0 ? "+" : delta < 0 ? "−" : "±") + d.fmt(Math.abs(delta));
      }
      node.appendChild(d.el("span", "kcal muted", change));

      const others = fields
        .filter(f => f !== main && typeof day.stats[f.name] === "number")
        .map(f => f.name + " " + this.format(f, day.stats[f.name]));
      if (others.length > 0) node.appendChild(d.el("div", "macros", others.join(" · ")));

      node.addEventListener("click", () => { t.run("weight @" + day.iso); });
      t.printNode(node, true);
    });

    if (!month && total > 14)
      t.print((total - 14) + " older days. ls YYYY-MM shows a month. tap a day to change it.", "muted");
    else
      t.print("tap a day to change it. ls <field> shows one field's history.", "muted");
  },

  showHistory: async function(field, limit) {
    const t = app.Terminal;
    const d = app.TerminalDiary;
    const series = await this.series(field.name);

    if (series.length === 0) {
      t.print("no " + field.name + " recorded yet", "muted");
      return;
    }

    const shown = series.slice(-limit);
    const first = series.length - shown.length;
    shown.forEach((point, i) => {
      const before = series[first + i - 1];
      let change = "";
      if (before) {
        const delta = this.toDisplay(field, point.value) - this.toDisplay(field, before.value);
        change = "  " + (delta > 0 ? "+" : delta < 0 ? "−" : "±") + d.fmt(Math.abs(delta));
      }
      t.print(point.iso + "  " + this.format(field, point.value) + change);
    });
    t.print(series.length + " measurements" + (series.length > shown.length ? ", showing the last " + shown.length : ""), "muted");
  },

  // The weight row of a day's totals, with the change over about a week. Undefined without a weight that day.
  weightRow: async function(iso, entry) {
    const d = app.TerminalDiary;
    const field = this.findField("weight", this.fields());
    if (!field || !entry || !entry.stats || typeof entry.stats[field.name] !== "number") return undefined;

    const value = entry.stats[field.name];
    const series = await this.series(field.name);

    // The measurement closest to a week earlier, from 5 to 9 days before. No such day, no change is shown.
    let week;
    series.forEach((point) => {
      const gap = this.daysBetween(iso, point.iso);
      if (gap < 5 || gap > 9) return;
      if (!week || Math.abs(gap - 7) < Math.abs(week.gap - 7)) week = { gap: gap, value: point.value };
    });

    const parts = [d.el("span", "cy", this.format(field, value))];
    if (week) {
      const delta = this.toDisplay(field, value) - this.toDisplay(field, week.value);
      const small = d.el("small", "", " (" + (delta > 0 ? "+" : delta < 0 ? "−" : "±") + d.fmt(Math.abs(delta)) + " wk)");
      small.style.opacity = "0.65";
      parts.push(small);
    }
    return d.keyValueNode("weight", parts);
  },

  // ---------------------------------------------------------------------
  // Which fields exist
  // ---------------------------------------------------------------------

  listFields: function() {
    const t = app.Terminal;
    const fields = this.fields();
    fields.forEach((f) => {
      t.print(f.name.padEnd(16) + (this.symbol(f.unit) || "-").padEnd(6) + (f.visible ? "asked for" : "hidden"), f.visible ? "" : "muted");
    });
    t.print("field add <name> [unit] adds one. field hide|show <name> chooses which are asked for.", "muted");
  },

  changeField: async function(args) {
    const t = app.Terminal;
    const action = (args[0] || "").toLowerCase();

    if (!["add", "hide", "show"].includes(action) || args.length < 2) {
      t.print("usage: field add <name> [unit]   field hide <name>   field show <name>", "err");
      return;
    }

    // Copies, so the app's default lists are never changed
    const order = app.BodyStats.getBodyStats().slice();
    const units = Object.assign({}, app.Settings.get("bodyStats", "units") || {});
    const visibility = Object.assign({}, app.Settings.getField("bodyStatsVisibility") || {});

    if (action === "add") {
      const name = args[1];
      const unit = args[2] || "";
      const taken = app.Nutriments.getNutriments().includes(name) || order.some(x => x.toLowerCase() === name.toLowerCase());
      if (taken) {
        t.print("\"" + name + "\" is already a field or a nutriment name. pick another, e.g. \"body fat\"", "err");
        return;
      }

      order.push(name);
      if (unit) units[name] = unit;
      visibility[name] = true;
      app.Settings.put("bodyStats", "order", order);
      app.Settings.put("bodyStats", "units", units);
      app.Settings.putField("bodyStatsVisibility", visibility);
      t.print("added " + name + (unit ? " (" + unit + ")" : "") + ". weight will ask for it from now on", "ok");
      return;
    }

    const field = this.findField(args.slice(1).join(" "), this.fields());
    if (!field) {
      t.print("no field called \"" + args.slice(1).join(" ") + "\"", "err");
      return;
    }

    visibility[field.name] = action === "show";
    app.Settings.putField("bodyStatsVisibility", visibility);
    t.print(field.name + (action === "show" ? " is asked for again" : " is hidden. its values stay where they are"), "ok");
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

app.Terminal.commands.weight = {
  usage: "weight [value] [field value ...] [@day]",
  desc: "log body measurements. on its own it asks field by field: Enter leaves one empty, - clears it. or all at once: weight 74.2 fat 18.5 water 55. a value far from your usual is pointed out before saving. blank fields are never filled in",
  complete: (args, partial) => {
    if (partial.startsWith("@")) return ["@today", "@yesterday"];
    const words = [];
    app.TerminalBody.fields().forEach((f) => {
      const parts = f.name.toLowerCase().split(/\s+/);
      words.push(parts[0], parts[parts.length - 1]);
    });
    return words.filter((w, i) => words.indexOf(w) === i);
  },
  run: async (args) => { await app.TerminalBody.enter(args); }
};

app.Terminal.commands.fields = {
  usage: "fields",
  desc: "the body measurement fields, and which ones are asked for",
  run: async () => { app.TerminalBody.listFields(); }
};

app.Terminal.commands.field = {
  usage: "field add <name> [unit] | hide <name> | show <name>",
  desc: "add a body measurement field (field add water %) or choose which are asked for. hiding never deletes values",
  complete: (args) => {
    if (args.length === 0) return ["add", "hide", "show"];
    if (["hide", "show"].includes(args[0])) return app.TerminalBody.fields().map(f => f.name);
    return [];
  },
  run: async (args) => { await app.TerminalBody.changeField(args); }
};

// Inside ~/body, rm removes measurements: rm <day> [field...]
(function() {
  const command = app.Terminal.commands.rm;
  const previous = command.run;

  command.run = async (args, line) => {
    const t = app.Terminal;
    if (!(t.cwd.length === 1 && t.cwd[0] === "body")) {
      await previous(args, line);
      return;
    }

    const b = app.TerminalBody;
    const d = app.TerminalDiary;
    const day = args[0] === undefined ? undefined : (t.dateAlias(args[0].toLowerCase()) || (t.isValidDate(args[0]) ? args[0] : undefined));
    if (!day) {
      t.print("usage: rm <day> [field...]   e.g. rm 2026-09-18 water", "err");
      return;
    }

    const entry = await d.getEntry(day);
    const stats = (entry && entry.stats) || {};
    const fields = b.fields();

    let names = Object.keys(stats);
    if (args.length > 1) {
      names = [];
      for (const word of args.slice(1)) {
        const field = b.findField(word, fields);
        if (!field) {
          t.print("no field called \"" + word + "\"", "err");
          return;
        }
        names.push(field.name);
      }
    }

    const changes = {};
    names.filter(n => stats[n] !== undefined).forEach((n) => { changes[n] = null; });
    if (Object.keys(changes).length === 0) {
      t.print("no measurements to remove on " + day, "muted");
      return;
    }

    await b.save(day, changes);
    b.summary(day, changes, fields);
  };

  command.desc += " (in ~/body: removes the measurements of a day, or just some fields)";
})();

// ---------------------------------------------------------------------
// Hooks into the terminal
// ---------------------------------------------------------------------

app.Terminal.listers.push({
  match: (cwd) => cwd.length === 1 && cwd[0] === "body",
  run: (args) => app.TerminalBody.showDays(args)
});

app.Terminal.onEnter.push(async (cwd) => {
  if (cwd.length === 1 && cwd[0] === "body")
    await app.TerminalBody.showDays([]);
});
