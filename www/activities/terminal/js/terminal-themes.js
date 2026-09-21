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
  Colour themes and the accent colour.

  A theme is a palette: background, bars, text and the four colours the output uses
  (accent, cyan, green, red). Applying one sets the --terminal-* variables on <body>,
  which the terminal screen, the title bar and the charts all read. The accent can be
  replaced on top of any theme without changing the rest.

  Stored in the app's settings under "terminal": { theme, accent }.
*/
app.TerminalThemes = {

  themes: {
    terminal: {
      desc: "the default: near-black with orange",
      bg: "#111116", bar: "#1c1c22", border: "#3a3a44", text: "#e8e8e8", muted: "#8a8a92",
      accent: "#f07a30", cyan: "#5bc8e0", green: "#4cb86a", red: "#ef5b5b"
    },
    oled: {
      desc: "pure black, for OLED screens",
      bg: "#000000", bar: "#000000", border: "#2a2a2e", text: "#e8e8e8", muted: "#85858c",
      accent: "#f07a30", cyan: "#5bc8e0", green: "#4cb86a", red: "#ef5b5b"
    },
    "solarized-dark": {
      desc: "Solarized, dark",
      bg: "#002b36", bar: "#073642", border: "#586e75", text: "#93a1a1", muted: "#657b83",
      accent: "#cb4b16", cyan: "#2aa198", green: "#859900", red: "#dc322f"
    },
    "solarized-light": {
      desc: "Solarized, light",
      light: true,
      bg: "#fdf6e3", bar: "#eee8d5", border: "#93a1a1", text: "#586e75", muted: "#839496",
      accent: "#cb4b16", cyan: "#2aa198", green: "#859900", red: "#dc322f"
    },
    monokai: {
      desc: "Monokai",
      bg: "#272822", bar: "#1e1f1c", border: "#49483e", text: "#f8f8f2", muted: "#75715e",
      accent: "#fd971f", cyan: "#66d9ef", green: "#a6e22e", red: "#f92672"
    },
    dracula: {
      desc: "Dracula",
      bg: "#282a36", bar: "#21222c", border: "#44475a", text: "#f8f8f2", muted: "#6272a4",
      accent: "#bd93f9", cyan: "#8be9fd", green: "#50fa7b", red: "#ff5555"
    }
  },

  // Names for the accent command, plus any #rgb or #rrggbb
  accents: {
    orange: "#f07a30",
    red: "#ef5b5b",
    yellow: "#e5c34a",
    green: "#4cb86a",
    cyan: "#5bc8e0",
    blue: "#5b8def",
    purple: "#b48ef0",
    pink: "#f06fb0",
    white: "#e8e8e8"
  },

  defaultTheme: "terminal",

  // ---------------------------------------------------------------------
  // Reading and writing the choice. Reads the raw settings so it works before the app's
  // Settings module has loaded (it is applied as soon as this file runs).
  // ---------------------------------------------------------------------

  read: function() {
    try {
      const settings = JSON.parse(window.localStorage.getItem("settings")) || {};
      return settings.terminal || {};
    } catch (err) {
      return {};
    }
  },

  currentName: function() {
    const name = this.read().theme;
    return this.themes[name] ? name : this.defaultTheme;
  },

  currentAccent: function() {
    const accent = this.read().accent;
    return this.parseColor(accent);
  },

  // ---------------------------------------------------------------------
  // Colours
  // ---------------------------------------------------------------------

  // "orange", "#f80" or "#ff8800" to "#rrggbb", or undefined
  parseColor: function(text) {
    if (typeof text !== "string") return undefined;
    const t = text.trim().toLowerCase();
    if (this.accents[t]) return this.accents[t];
    let m = /^#?([0-9a-f]{6})$/.exec(t);
    if (m) return "#" + m[1];
    m = /^#?([0-9a-f]{3})$/.exec(t);
    if (m) return "#" + m[1].split("").map(c => c + c).join("");
    return undefined;
  },

  rgb: function(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  },

  hex: function(rgb) {
    return "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  },

  // Move a colour towards black (negative) or white (positive)
  shade: function(hex, amount) {
    const target = amount < 0 ? 0 : 255;
    return this.hex(this.rgb(hex).map(v => v + (target - v) * Math.abs(amount)));
  },

  luminance: function(hex) {
    const c = this.rgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  },

  // WCAG contrast ratio between two colours (1 to 21)
  contrast: function(a, b) {
    const x = this.luminance(a);
    const y = this.luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  },

  // ---------------------------------------------------------------------
  // Applying
  // ---------------------------------------------------------------------

  apply: function() {
    const body = document.body;
    if (!body) return;

    const theme = this.themes[this.currentName()];
    const accent = this.currentAccent() || theme.accent;
    const set = (name, value) => { body.style.setProperty(name, value); };

    set("--terminal-bg", theme.bg);
    set("--terminal-bar", theme.bar);
    set("--terminal-border", theme.border);
    set("--terminal-text", theme.text);
    set("--terminal-muted", theme.muted);
    set("--terminal-accent", accent);
    set("--terminal-cyan", theme.cyan);
    set("--terminal-green", theme.green);
    set("--terminal-red", theme.red);
    set("--terminal-press", theme.light ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.05)");

    // The framework's own accent, bars and inputs follow
    set("--f7-theme-color", accent);
    set("--f7-theme-color-rgb", this.rgb(accent).join(", "));
    set("--f7-theme-color-shade", this.shade(accent, -0.12));
    set("--f7-theme-color-tint", this.shade(accent, 0.2));
    set("--f7-bars-bg-color-rgb", this.rgb(theme.bar).join(", "));
    set("--f7-input-placeholder-color", "rgba(" + this.rgb(theme.text).join(", ") + ", 0.35)");

    // Light or dark for whatever the framework draws itself (dialogs, pickers)
    const html = document.documentElement;
    html.classList.toggle("theme-dark", !theme.light);
    body.style.colorScheme = theme.light ? "light" : "dark";

    const meta = document.querySelector("meta[name='theme-color']");
    if (meta) meta.setAttribute("content", theme.bar);
  },

  // ---------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------

  // A line of coloured blocks that shows a palette. Static styles, so it survives a reload.
  swatch: function(theme, accent) {
    const line = document.createElement("div");
    line.className = "term-line";
    const chip = (color, text) => {
      const span = document.createElement("span");
      span.textContent = text;
      span.style.background = color;
      span.style.color = theme.text;
      span.style.padding = "0 4px";
      return span;
    };
    line.appendChild(chip(theme.bg, "bg"));
    line.appendChild(document.createTextNode(" "));
    line.appendChild(chip(accent || theme.accent, "  "));
    line.appendChild(chip(theme.cyan, "  "));
    line.appendChild(chip(theme.green, "  "));
    line.appendChild(chip(theme.red, "  "));
    return line;
  },

  save: function(key, value) {
    if (value === undefined) {
      const current = app.Settings.getField("terminal") || {};
      delete current[key];
      app.Settings.putField("terminal", current);
    } else {
      app.Settings.put("terminal", key, value);
    }
    this.apply();
  },

  listThemes: function() {
    const t = app.Terminal;
    const now = this.currentName();
    Object.keys(this.themes).forEach((name) => {
      const theme = this.themes[name];
      const line = t.print((name === now ? "* " : "  ") + name + "  " + theme.desc, "choice", false);
      line.addEventListener("click", () => { this.runTheme([name]); });
    });
    t.print("theme <name> switches (it keeps your accent colour). accent <colour> changes just the highlight", "muted");
  },

  runTheme: function(args) {
    const t = app.Terminal;
    if (args.length === 0) {
      this.listThemes();
      return;
    }

    const name = args[0].toLowerCase().replace(/[\s_]+/g, "-");
    if (!this.themes[name]) {
      // "solarized" alone is ambiguous; "dark" and "light" pick the obvious variant
      const options = Object.keys(this.themes).filter(n => n.startsWith(name));
      if (options.length !== 1) {
        t.print(options.length > 1 ? "which one? " + options.join(", ") : "no theme called " + args[0] + ". theme lists them", "err");
        return;
      }
      this.runTheme([options[0]]);
      return;
    }

    this.save("theme", name);
    t.print("theme: " + name, "ok");
    t.printNode(this.swatch(this.themes[name], this.currentAccent()));
    if (this.currentAccent()) t.print("your accent colour " + this.currentAccent() + " is kept. accent default goes back to this theme's own", "muted");
  },

  runAccent: function(args) {
    const t = app.Terminal;
    const theme = this.themes[this.currentName()];

    if (args.length === 0) {
      const own = this.currentAccent();
      t.print("accent: " + (own || theme.accent) + (own ? "" : " (the theme's own)"), "");
      t.print("names: " + Object.keys(this.accents).join(", ") + " · or a hex colour like #ff8800 · accent default", "muted");
      return;
    }

    const word = args.join(" ").trim().toLowerCase();
    if (["default", "reset", "none", "theme"].includes(word)) {
      this.save("accent", undefined);
      t.print("accent: " + theme.accent + " (the theme's own)", "ok");
      return;
    }

    const color = this.parseColor(word);
    if (!color) {
      t.print("not a colour: " + args.join(" ") + ". use a name (" + Object.keys(this.accents).join(", ") + ") or hex like #ff8800", "err");
      return;
    }

    this.save("accent", color);
    t.print("accent: " + color, "ok");
    t.printNode(this.swatch(theme, color));
    if (this.contrast(color, theme.bg) < 3)
      t.print("this is hard to see on the " + this.currentName() + " background. accent default undoes it", "err");
  }
};

app.Terminal.commands.theme = {
  usage: "theme [name]",
  desc: "colour theme: terminal, oled (pure black), solarized-dark, solarized-light, monokai, dracula. on its own it lists them. your accent colour is kept",
  complete: (args) => (args.length === 0 ? Object.keys(app.TerminalThemes.themes) : []),
  run: async (args) => { app.TerminalThemes.runTheme(args); }
};

app.Terminal.commands.accent = {
  usage: "accent [colour|default]",
  desc: "the highlight colour (kcal, prompt, cursor, charts): accent orange, accent #ff8800, accent default. works on top of any theme",
  complete: (args) => (args.length === 0 ? Object.keys(app.TerminalThemes.accents).concat(["default"]) : []),
  run: async (args) => { app.TerminalThemes.runAccent(args); }
};

// Applied as soon as this file runs, so the colours are right from the first frame
app.TerminalThemes.apply();
