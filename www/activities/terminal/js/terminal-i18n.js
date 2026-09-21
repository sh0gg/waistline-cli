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
  Translation of what the terminal prints. The code keeps writing English and every line goes through
  tr() on its way to the screen, so no command had to change. The log keeps the English original, which
  means switching language also translates what is already on screen after a reload.

  Commands, flags and words you type stay in English on purpose: only the text around them is translated.

  A dictionary is { "english": "translation" }. An English key can hold {} for the parts that change
  ("no such directory: {}"); the translation may use {} in the same order, or {1} {2} to reorder them.
  A line with no entry is shown in English and remembered in missing, so the gaps can be found by using the app:
  app.TerminalI18n.missing in the console.
*/
app.TerminalI18n = {

  languages: { en: "English", es: "Español" },
  dictionaries: {}, // lang -> { exact: {}, patterns: [] }
  missing: {},

  // "auto" follows the phone: Spanish if the phone is in Spanish, English otherwise
  setting: function() {
    let value;
    try { value = app.Settings.get("terminal", "lang"); } catch (err) {}
    return value || "auto";
  },

  current: function() {
    const chosen = this.setting();
    if (chosen !== "auto") return this.languages[chosen] ? chosen : "en";

    const phone = ((typeof navigator !== "undefined" && navigator.language) || "en").toLowerCase();
    return phone.startsWith("es") ? "es" : "en";
  },

  // Registers translations for a language. May be called several times (one file per area)
  add: function(lang, entries) {
    const dict = this.dictionaries[lang] || (this.dictionaries[lang] = { exact: {}, patterns: [] });

    Object.keys(entries).forEach((key) => {
      if (key.indexOf("{}") === -1) {
        dict.exact[key] = entries[key];
        return;
      }
      const source = key.split("{}").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)");
      dict.patterns.push({ re: new RegExp("^" + source + "$"), out: entries[key], key: key });
    });

    // Longest templates first, so "{} is {}" does not shadow "the value {} is not a number"
    dict.patterns.sort((a, b) => b.key.length - a.key.length);
  },

  // Words that label a line, like "usage": { usage: "uso" }. Any other label stays as it is (command names)
  labels: function(lang, map) {
    const dict = this.dictionaries[lang] || (this.dictionaries[lang] = { exact: {}, patterns: [] });
    dict.labels = Object.assign(dict.labels || {}, map);
  },

  // Looks a whole piece of text up. Returns undefined when there is no entry
  lookup: function(dict, text) {
    if (Object.prototype.hasOwnProperty.call(dict.exact, text)) return dict.exact[text];

    for (const p of dict.patterns) {
      const m = p.re.exec(text);
      if (!m) continue;

      const parts = m.slice(1).map(part => this.translate(dict, part));
      let n = 0;
      return p.out.replace(/\{(\d*)\}/g, (all, index) => {
        const i = index === "" ? n++ : parseInt(index, 10) - 1;
        return parts[i] !== undefined ? parts[i] : "";
      });
    }
    return undefined;
  },

  // Whole text, then the bits around things that vary: a leading "3) " or "> ", a trailing [default]
  // or " (q cancels)", and lines built from pieces joined by " · " or " — "
  translate: function(dict, text) {
    const whole = this.lookup(dict, text);
    if (whole !== undefined) return whole;

    const indent = /^(\s+)(\S.*)$/.exec(text);
    if (indent) return indent[1] + this.translate(dict, indent[2]);

    const lead = /^(\s*(?:\d+\) |> |\[[x ]\] ))/.exec(text);
    if (lead) return lead[1] + this.translate(dict, text.slice(lead[1].length));

    const tail = /^(.*?)(\s*\[[^\]]*\])$/.exec(text) || /^(.*?)( \(q (?:cancels|cancela)\))$/.exec(text);
    if (tail && tail[1] !== "") {
      const inner = this.translate(dict, tail[1]);
      const suffix = tail[2] === " (q cancels)" ? " (q cancela)" : tail[2];
      return inner + suffix;
    }

    // A folder note that commands append to their description: "... (in ~/foods: a food)"
    const note = /^(.*?) (\(in ~\/[^)]*\))$/.exec(text);
    if (note) return this.translate(dict, note[1]) + " " + this.translate(dict, note[2]);

    for (const glue of ["   ·   ", " · ", " — ", "; ", "  "]) {
      if (text.indexOf(glue) === -1) continue;
      return text.split(glue).map(part => this.translate(dict, part)).join(glue);
    }

    // "cd: no such directory", "usage: rm <n>", "error: ...": a one-word label, then the message
    const label = /^([a-z][a-z-]*): (.+)$/.exec(text);
    if (label) return ((dict.labels && dict.labels[label[1]]) || label[1]) + ": " + this.translate(dict, label[2]);
    return text;
  },

  // Short weekday in the terminal's language, lowercase: sat / sáb
  weekday: function(date) {
    return date.toLocaleDateString(this.current() === "es" ? "es" : "en", { weekday: "short" }).toLowerCase().replace(/\.$/, "");
  },

  // What the terminal calls on every line it prints
  tr: function(text) {
    if (typeof text !== "string" || text === "") return text;

    const lang = this.current();
    if (lang === "en") return text;

    const dict = this.dictionaries[lang];
    if (!dict) return text;

    const out = this.translate(dict, text);
    if (out === text && /[A-Za-z]{3,}/.test(text) && /[\s:]|[A-Z]/.test(text) && !/^usage: /.test(text) && !this.missing[text]) {
      this.missing[text] = true;
      if (typeof console !== "undefined" && console.debug) console.debug("[i18n] untranslated:", text);
    }
    return out;
  }
};
