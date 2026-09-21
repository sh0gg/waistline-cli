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
  The terminal is a small shell. Areas of the app are directories:
  "cd" moves between them, "ls" lists what is in the current one, and the
  prompt shows where you are. Commands are registered in app.Terminal.commands.
*/
app.Terminal = {

  el: {},
  commands: {},
  cwd: [], // Path segments below home, e.g. ["diary", "2026-09-19"]
  history: [],
  historyIndex: 0,
  pending: undefined, // Numbered choices waiting for the user to pick one
  awaiting: undefined, // Handler that takes the next line typed (follow-up questions)
  awaitingBlank: false, // Whether that question wants to hear an empty line too
  listers: [], // { match(cwd), run(args) } contributed by modules, used by ls
  onEnter: [], // functions called with the new cwd after every cd
  afterHooks: [], // functions called when a follow-up answer has been handled (see afterInput)
  maxLines: 300,
  maxHistory: 100,
  storageKeys: { log: "terminal-log", history: "terminal-history", cwd: "terminal-cwd", undo: "terminal-undo" },

  // Top-level directories. The diary also has one directory per day.
  tree: {
    diary: "food log, one folder per day",
    foods: "your food list",
    meals: "saved meals",
    recipes: "recipes",
    body: "weight and body measurements",
    stats: "charts and averages",
    goals: "targets and the plan calculator",
    settings: "preferences"
  },

  init: function() {
    this.getComponents();
    this.bindUIActions();
    this.history = this.load(this.storageKeys.history);
    this.historyIndex = this.history.length;
    this.pending = undefined;
    this.awaiting = undefined;
    this.cwd = this.restoreCwd();
    this.renderPrompt();
    this.applyEnterMode();
    this.restoreLog();

    // Small delay so the page transition has finished before focusing
    setTimeout(() => { this.el.input.focus(); }, 300);

    // The very first start of the app goes straight into the guided setup
    let first = false;
    try {
      first = window.localStorage.getItem("terminal-first-run") === "1";
      if (first) window.localStorage.removeItem("terminal-first-run");
    } catch (err) {}
    if (first && app.TerminalOnboarding) this.guard(() => app.TerminalOnboarding.start());
    else if (first && app.TerminalSettings) this.guard(() => app.TerminalSettings.setup(true));
  },

  getComponents: function() {
    const page = document.querySelector(".page[data-name='terminal']");
    this.el.page = page;
    this.el.out = page.querySelector("#term-out");
    this.el.form = page.querySelector("#term-form");
    this.el.input = page.querySelector("#term-input");
    this.el.tab = page.querySelector("#term-tab");
    this.el.send = page.querySelector("#term-send");
    this.el.wrap = page.querySelector(".term-input-wrap");
    this.el.row = page.querySelector(".term-input-row");
    this.el.ghostAfter = page.querySelector(".term-ghost-after");
    this.el.cwd = page.querySelector(".term-cwd");
    this.el.ghostTyped = page.querySelector(".term-ghost-typed");
    this.el.ghostHint = page.querySelector(".term-ghost-hint");
  },

  bindUIActions: function() {
    const el = this.el;

    // Enter (or the keyboard's send key) submits the form. With "set enter button" it does not:
    // only the send button does (it sets forceSend), so a stray Enter cannot run a command.
    el.form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!this.enterSends() && !this.forceSend) return;
      this.forceSend = false;
      this.submit(el.input.value);
      el.input.value = "";
      this.updateGhost();
    });

    el.send.addEventListener("mousedown", (e) => { e.preventDefault(); });
    el.send.addEventListener("click", () => {
      this.forceSend = true;
      el.form.requestSubmit ? el.form.requestSubmit() : el.form.dispatchEvent(new Event("submit", { cancelable: true }));
      this.forceSend = false;
      el.input.focus();
    });

    el.input.addEventListener("input", () => { this.updateGhost(true); });

    // The block cursor follows the caret and only shows while the input has focus
    ["keyup", "click", "select", "focus"].forEach((name) => { el.input.addEventListener(name, () => { this.updateGhost(); }); });
    el.input.addEventListener("focus", () => { el.wrap.classList.add("focused"); });
    el.input.addEventListener("blur", () => { el.wrap.classList.remove("focused"); });
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === el.input) this.updateGhost();
    });

    el.input.addEventListener("keydown", (e) => {
      const atEnd = el.input.selectionStart === el.input.value.length;

      if (e.key === "Tab" || (e.key === "ArrowRight" && atEnd && this.getHint())) {
        e.preventDefault();
        this.complete();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.browseHistory(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.browseHistory(1);
      }
    });

    // Keep the keyboard open when using the tab button
    el.tab.addEventListener("mousedown", (e) => { e.preventDefault(); });
    el.tab.addEventListener("click", () => {
      this.complete();
      el.input.focus();
    });

    // Tapping empty output space focuses the input, unless the user is selecting text
    el.out.addEventListener("click", (e) => {
      if (window.getSelection().toString() === "" && !e.target.closest(".choice"))
        el.input.focus();
    });
  },

  // ---------------------------------------------------------------------
  // Paths
  // ---------------------------------------------------------------------

  // "~", "~/diary", "~/diary/2026-09-19"
  pathToString: function(segments) {
    return "~" + segments.map(s => "/" + s).join("");
  },

  promptPath: function() {
    return this.pathToString(this.cwd);
  },

  isoDate: function(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  },

  // True for a real calendar date written as YYYY-MM-DD
  isValidDate: function(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!m) return false;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return this.isoDate(d) === text;
  },

  // Aliases the diary understands in place of a date
  dateAlias: function(name) {
    const d = new Date();
    if (name === "today") return this.isoDate(d);
    if (name === "yesterday") {
      d.setDate(d.getDate() - 1);
      return this.isoDate(d);
    }
    return undefined;
  },

  // Names that can follow the given directory (used for cd and autocomplete)
  childNames: function(segments) {
    if (segments.length === 0) return Object.keys(this.tree);
    if (segments.length === 1 && segments[0] === "diary") return ["today", "yesterday"];
    return [];
  },

  // Returns the canonical child name for what the user typed, or undefined
  lookupChild: function(segments, part) {
    const lower = part.toLowerCase();

    if (segments.length === 0)
      return Object.keys(this.tree).find(name => name === lower);

    if (segments.length === 1 && segments[0] === "diary") {
      if (this.isValidDate(part)) return part;
      return this.dateAlias(lower);
    }
    return undefined;
  },

  // Turns typed text into path segments relative to "from"
  resolve: function(input, from) {
    let segments = from.slice();
    let text = input;

    if (text.startsWith("~") || text.startsWith("/")) {
      segments = [];
      text = text.replace(/^~/, "");
    }

    for (const part of text.split("/").filter(Boolean)) {
      if (part === ".") continue;

      if (part === "..") {
        segments.pop();
        continue;
      }

      const child = this.lookupChild(segments, part);
      if (child === undefined)
        return { error: "no such directory: " + input };
      segments.push(child);
    }
    return { segments: segments };
  },

  // Directory-name candidates for the word being typed (autocomplete)
  completePath: function(partial) {
    const slash = partial.lastIndexOf("/");
    const dirText = slash === -1 ? "" : partial.slice(0, slash + 1);

    let base = this.cwd;
    if (dirText !== "") {
      const resolved = this.resolve(dirText, this.cwd);
      if (resolved.error) return [];
      base = resolved.segments;
    }

    return this.childNames(base).map(name => dirText + name);
  },

  changeDirectory: function(segments) {
    this.cwd = segments;
    this.save(this.storageKeys.cwd, segments);
    this.renderPrompt();
    this.describeDirectory();
    this.onEnter.forEach((hook) => { this.guard(() => hook(segments)); });
  },

  // The date (YYYY-MM-DD) of the day folder we are in, if any
  dayOfCwd: function() {
    return (this.cwd.length === 2 && this.cwd[0] === "diary") ? this.cwd[1] : undefined;
  },

  describeDirectory: function() {
    if (this.cwd.length === 0) {
      this.print("~ — home. ls lists what is here.", "muted");
    } else if (this.cwd.length === 1) {
      this.print(this.promptPath() + " — " + this.tree[this.cwd[0]], "muted");
    } else {
      this.print(this.promptPath(), "muted");
    }
  },

  restoreCwd: function() {
    const saved = this.load(this.storageKeys.cwd);
    const resolved = this.resolve("~/" + saved.join("/"), []);
    return resolved.error ? [] : resolved.segments;
  },

  renderPrompt: function() {
    this.el.cwd.textContent = this.promptPath();
  },

  // ---------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------

  print: function(text, cls, persist) {
    const line = document.createElement("div");
    line.className = "term-line" + (cls ? " " + cls : "");
    line.textContent = app.TerminalI18n ? app.TerminalI18n.tr(text) : text; // the log below keeps the English
    this.appendLine(line);

    if (persist !== false)
      this.appendToLog({ t: text, c: cls });

    return line;
  },

  // The echo of a command the user typed, prefixed with the prompt it ran under
  printCommand: function(prompt, text, persist) {
    const line = document.createElement("div");
    line.className = "term-line cmd";

    const path = document.createElement("span");
    path.className = "term-cwd";
    path.textContent = prompt;
    line.appendChild(path);

    const dollar = document.createElement("span");
    dollar.className = "term-dollar";
    dollar.textContent = " $ ";
    line.appendChild(dollar);

    line.appendChild(document.createTextNode(text));
    this.appendLine(line);

    if (persist !== false)
      this.appendToLog({ t: text, c: "cmd", p: prompt });
  },

  appendLine: function(line) {
    this.el.out.appendChild(line);

    while (this.el.out.childElementCount > this.maxLines)
      this.el.out.removeChild(this.el.out.firstElementChild);

    this.el.out.scrollTop = this.el.out.scrollHeight;
  },

  // Numbered list the user can pick from by tapping a line or typing its number.
  // items: [{ text: "label", run: function() {} }]
  printChoices: function(items) {
    this.pending = items;

    items.forEach((item, i) => {
      const line = this.print((i + 1) + ") " + item.text, "choice", false);
      line.addEventListener("click", () => { this.choose(i); });
    });
  },

  choose: function(index) {
    const item = this.pending && this.pending[index];
    if (!item) return false;

    this.pending = undefined;
    this.print("> " + item.text, "muted");
    item.run();

    // Keep typing where it is expected, e.g. when the choice asks a follow-up question
    this.el.input.focus();
    return true;
  },

  // Adds a ready-made element to the output. Its HTML is kept so it survives
  // a reload, but any click handlers do not (restored nodes get .stale).
  printNode: function(node, persist) {
    this.appendLine(node);

    if (persist !== false)
      this.appendToLog({ h: node.outerHTML });

    return node;
  },

  // Takes over the next line the user types, e.g. to answer a question
  // options.blank: the handler also receives an empty line (Enter on its own)
  ask: function(question, handler, options) {
    this.awaiting = handler;
    this.awaitingBlank = !!(options && options.blank);
    this.print(/q cancels/.test(question) ? question : question + " (q cancels)", "accent");
  },

  // Runs a function, showing any error in the terminal instead of losing it
  guard: async function(fn) {
    try {
      await fn();
    } catch (err) {
      console.error(err);
      this.print("error: " + (err && err.message ? err.message : err), "err");
    }
  },

  // After an answer to a follow-up question is handled (or cancelled). A module that is walking the user
  // through several things uses it to carry on once the last question is done
  afterInput: function() {
    this.afterHooks.forEach((hook) => { this.guard(hook); });
  },

  // Last things the user added, most recent last, so undo can take them back
  pushUndo: function(operation) {
    const stack = this.load(this.storageKeys.undo);
    stack.push(operation);
    this.save(this.storageKeys.undo, stack.slice(-50));
  },

  popUndo: function() {
    const stack = this.load(this.storageKeys.undo);
    const operation = stack.pop();
    this.save(this.storageKeys.undo, stack);
    return operation;
  },

  clear: function() {
    this.el.out.textContent = "";
    this.save(this.storageKeys.log, []);
  },

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  submit: function(raw) {
    const line = raw.trim();

    // An empty line is normally ignored, but a question can ask to hear it ("leave this one blank")
    const blankAnswer = line === "" && this.awaiting !== undefined && this.awaitingBlank === true;
    if (line === "" && !blankAnswer) return;

    this.printCommand(this.promptPath(), line);

    if (line !== "" && this.history[this.history.length - 1] !== line) {
      this.history.push(line);
      this.history = this.history.slice(-this.maxHistory);
      this.save(this.storageKeys.history, this.history);
    }
    this.historyIndex = this.history.length;

    // A follow-up answer goes to whoever asked the question. reset always works as a way out.
    if (this.awaiting && !/^reset$/i.test(line)) {
      const handler = this.awaiting;
      this.awaiting = undefined;

      if (/^(q|quit|cancel)$/i.test(line)) {
        this.print("cancelled", "muted");
        this.afterInput();
        return;
      }
      this.guard(() => handler(line)).then(() => this.afterInput());
      return;
    }

    // A bare number picks from the last list of choices
    if (this.pending && /^\d+$/.test(line)) {
      if (this.choose(parseInt(line, 10) - 1)) return;
      this.print("no option " + line, "err");
      return;
    }
    this.pending = undefined;

    this.run(line);
  },

  run: async function(line) {
    const tokens = this.tokenize(line);
    const name = tokens[0].toLowerCase();
    const command = this.commands[name];

    if (!command) {
      this.print("unknown command: " + name + " (try help)", "err");
      return;
    }

    try {
      await command.run(tokens.slice(1), line);
    } catch (err) {
      console.error(err);
      this.print("error: " + (err && err.message ? err.message : err), "err");
    }
  },

  // Splits on whitespace, keeping "quoted phrases" together
  tokenize: function(line) {
    const tokens = [];
    const re = /"([^"]*)"|(\S+)/g;
    let match;
    while ((match = re.exec(line)) !== null)
      tokens.push(match[1] !== undefined ? match[1] : match[2]);
    return tokens;
  },

  browseHistory: function(step) {
    if (this.history.length === 0) return;

    this.historyIndex = Math.min(Math.max(this.historyIndex + step, 0), this.history.length);
    this.el.input.value = this.history[this.historyIndex] || "";
    this.updateGhost();
  },

  // ---------------------------------------------------------------------
  // Autocomplete (ghost text)
  // ---------------------------------------------------------------------

  // Returns the text that would complete the current input, or ""
  getHint: function() {
    const value = this.el.input.value;
    if (value === "") return "";

    const endsWithSpace = /\s$/.test(value);
    const tokens = this.tokenize(value);
    const partial = endsWithSpace ? "" : tokens[tokens.length - 1];

    let candidates = [];
    if (tokens.length === 1 && !endsWithSpace) {
      candidates = Object.keys(this.commands).sort((x, y) => x.length - y.length); // shortest first
    } else {
      const command = this.commands[tokens[0].toLowerCase()];
      if (command && command.complete) {
        const args = endsWithSpace ? tokens.slice(1) : tokens.slice(1, -1);
        candidates = command.complete(args, partial) || [];
      }
    }

    const lower = partial.toLowerCase();
    const match = candidates.find(c => c.length > partial.length && c.toLowerCase().startsWith(lower));
    return match ? match.slice(partial.length) : "";
  },

  // Whether Enter on the keyboard sends the command (set enter send|button)
  enterSends: function() {
    return app.Settings.get("terminal", "enter") !== "button";
  },

  applyEnterMode: function() {
    const sends = this.enterSends();
    this.el.row.classList.toggle("enter-button", !sends);
    this.el.input.enterKeyHint = sends ? "send" : "enter";
  },

  updateGhost: function(typing) {
    const input = this.el.input;
    const hint = input.scrollWidth > input.clientWidth ? "" : this.getHint();

    // Text before the caret, the block cursor, then the text after it (which only holds the space)
    const caret = input.selectionStart === null ? input.value.length : input.selectionStart;
    this.el.ghostTyped.textContent = input.value.slice(0, caret);
    this.el.ghostAfter.textContent = input.value.slice(caret);
    if (typing === true) {
      this.el.wrap.classList.add("typing");
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => { this.el.wrap.classList.remove("typing"); }, 600);
    }
    this.el.ghostHint.textContent = hint;
    this.el.tab.style.opacity = hint ? "1" : "0.4";
  },

  complete: function() {
    const hint = this.getHint();
    if (!hint) return;

    this.el.input.value += hint;
    this.updateGhost();
  },

  // ---------------------------------------------------------------------
  // Persistence (localStorage may be unavailable, so never let it throw)
  // ---------------------------------------------------------------------

  load: function(key) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (err) {
      return [];
    }
  },

  save: function(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  },

  appendToLog: function(entry) {
    const log = this.load(this.storageKeys.log);
    log.push(entry);
    this.save(this.storageKeys.log, log.slice(-this.maxLines));
  },

  restoreLog: function() {
    this.el.out.textContent = "";
    const log = this.load(this.storageKeys.log);

    if (log.length === 0) {
      this.banner();
      return;
    }

    log.forEach((x) => {
      if (x.h) {
        const template = document.createElement("template");
        template.innerHTML = x.h;
        const node = template.content.firstElementChild;
        if (node) {
          node.classList.add("stale");
          this.appendLine(node);
        }
      } else if (x.c === "cmd")
        this.printCommand(x.p || "~", x.p ? x.t : x.t.replace(/^\$ /, ""), false); // entries saved before prompts had a path
      else
        this.print(x.t, x.c, false);
    });
  },

  banner: function() {
    this.print("waistline-cli", "accent");
    this.print("type help for commands, ls to look around, tap ⇥ to autocomplete", "muted");
    if (app.TerminalOnboarding) this.guard(() => app.TerminalOnboarding.hint());
  }
};

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

app.Terminal.commands.help = {
  usage: "help [command]",
  desc: "list commands, or show details for one",
  complete: (args) => (args.length === 0 ? Object.keys(app.Terminal.commands) : []),
  run: async (args) => {
    const t = app.Terminal;

    if (args.length > 0) {
      const command = t.commands[args[0].toLowerCase()];
      if (!command) {
        t.print("no such command: " + args[0], "err");
        return;
      }
      t.print(command.usage, "cyan");
      t.print(command.desc, "muted sub");
      return;
    }

    Object.keys(t.commands).sort().forEach((name) => {
      t.print(t.commands[name].usage, "cyan");
      t.print(t.commands[name].desc, "muted sub");
    });
  }
};

app.Terminal.commands.clear = {
  usage: "clear",
  desc: "clear the screen",
  run: async () => { app.Terminal.clear(); }
};

app.Terminal.commands.reset = {
  usage: "reset",
  desc: "clear screen and command history, and go home",
  run: async () => {
    const t = app.Terminal;
    t.history = [];
    t.historyIndex = 0;
    t.pending = undefined;
    t.awaiting = undefined;
    t.save(t.storageKeys.history, []);
    t.cwd = [];
    t.save(t.storageKeys.cwd, []);
    t.renderPrompt();
    t.clear();
    t.banner();
  }
};

app.Terminal.commands.pwd = {
  usage: "pwd",
  desc: "print the current directory",
  run: async () => { app.Terminal.print(app.Terminal.promptPath()); }
};

app.Terminal.commands.cd = {
  usage: "cd [path]",
  desc: "change directory: cd diary, cd .., cd ~, cd diary/2026-09-19, cd diary/yesterday",
  complete: (args, partial) => (args.length === 0 ? app.Terminal.completePath(partial) : []),
  run: async (args) => {
    const t = app.Terminal;

    if (args.length === 0) {
      t.changeDirectory([]);
      return;
    }

    const result = t.resolve(args[0], t.cwd);
    if (result.error) {
      t.print("cd: " + result.error, "err");
      return;
    }
    t.changeDirectory(result.segments);
  }
};

app.Terminal.commands.ls = {
  usage: "ls",
  desc: "list what is in the current directory (tap an item to open it)",
  run: async (args) => {
    const t = app.Terminal;
    const open = (segments) => () => { t.changeDirectory(segments); };

    // Modules can take over listing for their own directories
    const lister = t.listers.find(l => l.match(t.cwd));
    if (lister) {
      await lister.run(args);
      return;
    }

    // Home: the areas of the app
    if (t.cwd.length === 0) {
      t.printChoices(Object.keys(t.tree).map(name => ({
        text: name + "/  " + t.tree[name],
        run: open([name])
      })));
      return;
    }

    t.print("(nothing here yet)", "muted");
  }
};

document.addEventListener("page:init", function(event) {
  if (event.target.matches(".page[data-name='terminal']")) {
    app.Terminal.init();
  }
});
