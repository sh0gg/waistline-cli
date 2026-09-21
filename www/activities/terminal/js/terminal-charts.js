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
  Charts for the terminal, drawn without any library: text sparklines for a quick look
  and inline SVG for the real thing. The SVG follows the terminal's own palette
  (dashed grid lines, muted labels, soft area under the line, no chart borders).

  A line is never drawn across days without a value: that would be inventing points,
  and nothing in this app fills in what you did not enter. Long gaps break the line and
  the readings stay visible as dots.
*/
app.TerminalCharts = {

  nextId: 0,
  blocks: "▁▂▃▄▅▆▇█",

  // ---------------------------------------------------------------------
  // Text sparklines
  // ---------------------------------------------------------------------

  // Shrink a list of values (or undefined for days without one) to at most n by averaging what each part has
  bucket: function(values, n) {
    if (values.length <= n) return values.slice();

    const out = [];
    for (let i = 0; i < n; i++) {
      const from = Math.floor(i * values.length / n);
      const to = Math.floor((i + 1) * values.length / n);
      const part = values.slice(from, to).filter(v => typeof v === "number");
      out.push(part.length > 0 ? part.reduce((a, b) => a + b, 0) / part.length : undefined);
    }
    return out;
  },

  // "▁▃▅▇" for a list of values, "·" where there is none. min/max fix the scale.
  spark: function(values, width, min, max) {
    const list = this.bucket(values, width || 28);
    const nums = list.filter(v => typeof v === "number");
    if (nums.length === 0) return "";

    const lo = min !== undefined ? min : Math.min.apply(null, nums);
    const hi = max !== undefined ? max : Math.max.apply(null, nums);
    const span = hi - lo;

    return list.map((v) => {
      if (typeof v !== "number") return "·";
      if (span <= 0) return this.blocks[3];
      const level = Math.round((v - lo) / span * (this.blocks.length - 1));
      return this.blocks[Math.max(0, Math.min(this.blocks.length - 1, level))];
    }).join("");
  },

  // A horizontal bar of a share of a whole, in text: "██████░░░░"
  bar: function(fraction, width) {
    const w = width || 10;
    const filled = Math.max(0, Math.min(w, Math.round(fraction * w)));
    return "█".repeat(filled) + "░".repeat(w - filled);
  },

  // ---------------------------------------------------------------------
  // Scales
  // ---------------------------------------------------------------------

  // Round-number ticks that cover min..max
  niceTicks: function(min, max, count) {
    const target = count || 4;
    if (!(max > min)) {
      const pad = Math.abs(min) * 0.05 || 1;
      min -= pad;
      max += pad;
    }

    const rawStep = (max - min) / target;
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const scaled = rawStep / power;
    const step = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * power;

    const first = Math.floor(min / step) * step;
    const last = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = first; v <= last + step / 2; v += step) ticks.push(Math.round(v / step * 1e6) / 1e6 * step);
    return { min: first, max: last, step: step, ticks: ticks };
  },

  days: function(a, b) {
    const t = (iso) => { const p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
    return Math.round((t(a) - t(b)) / 86400000);
  },

  addDays: function(iso, n) {
    const p = iso.split("-").map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.toISOString().slice(0, 10);
  },

  // ---------------------------------------------------------------------
  // SVG
  // ---------------------------------------------------------------------

  svg: function(tag, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    if (text !== undefined) node.textContent = text;
    return node;
  },

  // Spec:
  //   title, subtitle, from, to (ISO days, inclusive), decimals, unit
  //   now: ISO day to mark with a dashed vertical line (used by projections)
  //   series: [{ name, kind: "line" | "bars" | "step", color, points: [{ iso, value, light }],
  //              dashed, area, dots, maxGap, width }]
  //   zero: true to start the scale at zero (bars always do)
  // Returns an element; nothing is drawn for a series with no points.
  chart: function(spec) {
    // Titles, subtitles and legend names are text like any other line
    const tr = (text) => (app.TerminalI18n && text ? app.TerminalI18n.tr(text) : text);
    spec = Object.assign({}, spec, {
      title: tr(spec.title),
      subtitle: tr(spec.subtitle),
      series: (spec.series || []).map(s => Object.assign({}, s, { name: tr(s.name) }))
    });
    const d = app.TerminalDiary;
    const id = "tc" + (++this.nextId);

    const W = 360;
    const H = 210;
    const m = { left: 38, right: 12, top: 12, bottom: 24 };
    const plotW = W - m.left - m.right;
    const plotH = H - m.top - m.bottom;

    const nDays = Math.max(1, this.days(spec.to, spec.from) + 1);
    const hasBars = spec.series.some(s => s.kind === "bars");
    const xOf = (iso) => {
      const i = this.days(iso, spec.from);
      return hasBars ? m.left + (i + 0.5) / nDays * plotW : m.left + (nDays === 1 ? plotW / 2 : i / (nDays - 1) * plotW);
    };

    // The value range from every point, plus a little air
    const values = [];
    spec.series.forEach(s => s.points.forEach(p => { if (typeof p.value === "number") values.push(p.value); }));

    const wrap = document.createElement("div");
    wrap.className = "term-line term-chart";

    if (spec.title) wrap.appendChild(d.el("div", "chart-title", spec.title));
    if (spec.subtitle) wrap.appendChild(d.el("div", "chart-sub", spec.subtitle));

    if (values.length === 0) {
      wrap.appendChild(d.el("div", "chart-empty", "nothing to draw in this range"));
      return wrap;
    }

    let lo = Math.min.apply(null, values);
    let hi = Math.max.apply(null, values);
    if (hasBars || spec.zero) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    } else {
      const air = (hi - lo) * 0.12 || Math.abs(hi) * 0.02 || 1;
      lo -= air;
      hi += air;
    }
    const scale = this.niceTicks(lo, hi, 4);
    const yOf = (v) => m.top + plotH - (v - scale.min) / (scale.max - scale.min) * plotH;

    // Legend
    const legend = d.el("div", "chart-legend");
    spec.series.forEach((s) => {
      if (s.points.length === 0 || s.hideLegend) return;
      const item = d.el("span", "chart-key");
      const swatch = d.el("span", "chart-swatch");
      swatch.style.background = s.dashed ? "transparent" : s.color;
      swatch.style.borderTop = s.dashed ? "2px dashed " + s.color : "none";
      swatch.style.height = s.dashed ? "0" : "8px";
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(" " + s.name));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    const svg = this.svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img", "aria-label": spec.title || "chart" });

    // Gradient for the soft area under a line
    const defs = this.svg("defs");
    spec.series.forEach((s, i) => {
      if (!s.area) return;
      const gradient = this.svg("linearGradient", { id: id + "g" + i, x1: "0", y1: "0", x2: "0", y2: "1" });
      gradient.appendChild(this.svg("stop", { offset: "0", style: "stop-color:" + s.color + ";stop-opacity:0.32" }));
      gradient.appendChild(this.svg("stop", { offset: "1", style: "stop-color:" + s.color + ";stop-opacity:0" }));
      defs.appendChild(gradient);
    });
    svg.appendChild(defs);

    // Dashed grid and y labels
    scale.ticks.forEach((tick) => {
      const y = yOf(tick);
      svg.appendChild(this.svg("line", { x1: m.left, x2: W - m.right, y1: y, y2: y, class: "chart-grid" }));
      svg.appendChild(this.svg("text", { x: m.left - 5, y: y + 3, class: "chart-label", "text-anchor": "end" },
        tick.toLocaleString("en-US", { maximumFractionDigits: spec.decimals === undefined ? 1 : spec.decimals })));
    });

    // x labels: a few dates
    const wanted = Math.min(5, nDays);
    for (let i = 0; i < wanted; i++) {
      const dayIndex = wanted === 1 ? 0 : Math.round(i * (nDays - 1) / (wanted - 1));
      const iso = this.addDays(spec.from, dayIndex);
      const label = nDays > 150 ? iso.slice(0, 7) : iso.slice(5);
      svg.appendChild(this.svg("text", { x: xOf(iso), y: H - 7, class: "chart-label", "text-anchor": i === 0 ? "start" : i === wanted - 1 ? "end" : "middle" }, label));
    }

    // Where "now" is, for projections
    if (spec.now && this.days(spec.now, spec.from) >= 0 && this.days(spec.to, spec.now) >= 0) {
      const x = xOf(spec.now);
      svg.appendChild(this.svg("line", { x1: x, x2: x, y1: m.top, y2: m.top + plotH, class: "chart-now" }));
      svg.appendChild(this.svg("text", { x: x + 3, y: m.top + 8, class: "chart-label" }, "today"));
    }

    // Series
    spec.series.forEach((s, index) => {
      const points = s.points.filter(p => typeof p.value === "number").sort((a, b) => (a.iso < b.iso ? -1 : 1));
      if (points.length === 0) return;
      const style = "color:" + s.color;

      if (s.kind === "bars") {
        const bandW = plotW / nDays;
        const barW = Math.max(1.5, bandW * 0.68);
        points.forEach((p) => {
          // From the zero line up (or down, for a negative value)
          const y1 = yOf(p.value);
          const y0 = yOf(0);
          const rect = this.svg("rect", { x: xOf(p.iso) - barW / 2, y: Math.min(y0, y1), width: barW, height: Math.max(0.5, Math.abs(y1 - y0)), rx: 1.5 });
          rect.setAttribute("style", "fill:" + s.color + ";opacity:" + (p.light ? 0.35 : 0.9));
          svg.appendChild(rect);
        });
        return;
      }

      // Lines and steps are split where days are missing, so nothing is drawn across a gap
      const maxGap = s.maxGap === undefined ? 3 : s.maxGap;
      const runs = [];
      let run = [];
      points.forEach((p) => {
        if (run.length > 0 && this.days(p.iso, run[run.length - 1].iso) > maxGap) {
          runs.push(run);
          run = [];
        }
        run.push(p);
      });
      runs.push(run);

      runs.forEach((r) => {
        if (r.length >= 2) {
          let d;
          if (s.kind === "step") {
            d = "M" + xOf(r[0].iso) + "," + yOf(r[0].value);
            for (let i = 1; i < r.length; i++) d += " H" + xOf(r[i].iso) + " V" + yOf(r[i].value);
          } else {
            d = r.map((p, i) => (i === 0 ? "M" : "L") + xOf(p.iso).toFixed(1) + "," + yOf(p.value).toFixed(1)).join(" ");
          }

          if (s.area && s.kind !== "step") {
            const closed = d + " L" + xOf(r[r.length - 1].iso).toFixed(1) + "," + (m.top + plotH) + " L" + xOf(r[0].iso).toFixed(1) + "," + (m.top + plotH) + " Z";
            const area = this.svg("path", { d: closed });
            area.setAttribute("style", "fill:url(#" + id + "g" + index + ");stroke:none");
            svg.appendChild(area);
          }

          const line = this.svg("path", { d: d, class: "chart-line" });
          line.setAttribute("style", "stroke:" + s.color + ";stroke-width:" + (s.width || 1.8) + (s.dashed ? ";stroke-dasharray:4 3" : ""));
          svg.appendChild(line);
        }
      });

      if (s.dots) {
        points.forEach((p) => {
          const dot = this.svg("circle", { cx: xOf(p.iso).toFixed(1), cy: yOf(p.value).toFixed(1), r: 2.2 });
          dot.setAttribute("style", "fill:var(--t-bg);stroke:" + s.color + ";stroke-width:1.5");
          svg.appendChild(dot);
        });
      }

      // The last value, marked
      if (s.lastLabel) {
        const p = points[points.length - 1];
        const x = xOf(p.iso);
        const y = yOf(p.value);
        const dot = this.svg("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 3 });
        dot.setAttribute("style", "fill:" + s.color);
        svg.appendChild(dot);
        // Below the point unless that would run off the bottom: lines above it (an average) do not cover it
        const below = y + 14 < m.top + plotH;
        svg.appendChild(this.svg("text", { x: Math.min(x, W - m.right), y: below ? y + 14 : y - 6, class: "chart-value", "text-anchor": x > W - 60 ? "end" : "middle" }, s.lastLabel));
      }
    });

    wrap.appendChild(svg);
    return wrap;
  }
};
