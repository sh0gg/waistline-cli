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
  export and import: your data out of the app and back in.

  These call what the app already has (its backup writer, its CSV writer, its share
  sheet, its file chooser and its import), so a backup made here is the same file the
  regular screen makes, and the official app's backup can be imported here.

  On a phone, export saves the file and opens the device's share sheet so you choose
  where it goes: every device keeps its folders differently. import opens the device's
  file chooser. In a desktop browser there is no phone to write to, so export is a
  download and import uses the browser's file picker.
*/
app.TerminalBackup = {

  onDevice: function() {
    return !!(window.device && device.platform !== "browser" && app.mode !== "development");
  },

  // ---------------------------------------------------------------------
  // Reading and describing
  // ---------------------------------------------------------------------

  counts: async function() {
    const [diary, foods, meals, recipes] = await Promise.all(["diary", "foodList", "meals", "recipes"].map(s => dbHandler.getAllItems(s)));
    return {
      days: diary.filter(e => (e.items && e.items.length) || (e.stats && Object.keys(e.stats).length)).length,
      foods: foods.filter(f => f && f.barcode !== "quick-add" && !f.archived).length,
      meals: meals.filter(m => m && !m.archived).length,
      recipes: recipes.filter(r => r && !r.archived).length
    };
  },

  describe: function(c) {
    return c.days + " days, " + c.foods + " foods, " + c.meals + " meals, " + c.recipes + " recipes";
  },

  // What a backup file holds. Returns { error } for something that is not one.
  inspect: function(data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      return { error: "this is not a Waistline backup" };
    if (!Array.isArray(data.diary) && !Array.isArray(data.foodList))
      return { error: "this is not a Waistline backup (no diary or foods in it)" };

    const list = (key) => (Array.isArray(data[key]) ? data[key] : []);
    return {
      days: list("diary").filter(e => e && ((e.items && e.items.length) || (e.stats && Object.keys(e.stats).length))).length,
      foods: list("foodList").filter(f => f && f.barcode !== "quick-add" && !f.archived).length,
      meals: list("meals").filter(m => m && !m.archived).length,
      recipes: list("recipes").filter(r => r && !r.archived).length,
      settings: data.settings !== undefined,
      version: data.version
    };
  },

  stamp: function() {
    return app.Terminal.isoDate(new Date());
  },

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  // Run one of the app's own file writers. Without a phone it has nowhere to write, so what it
  // would have written is caught instead.
  capture: async function(writer) {
    const original = app.Utils.writeFile;
    let caught;
    app.Utils.writeFile = async (data, filename) => {
      caught = { data: data, filename: filename };
      return undefined;
    };

    try {
      await writer();
    } finally {
      app.Utils.writeFile = original;
    }
    return caught;
  },

  download: function(data, filename, type) {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => { URL.revokeObjectURL(url); }, 10000);
  },

  size: function(text) {
    const kb = new Blob([text]).size / 1024;
    return kb < 1024 ? Math.round(kb) + " KB" : (Math.round(kb / 102.4) / 10) + " MB";
  },

  runExport: async function(args) {
    const t = app.Terminal;
    const kind = (args[0] || "backup").toLowerCase();

    if (!["backup", "csv"].includes(kind)) {
      t.print("usage: export   (the full backup)   |   export csv   (the diary as a spreadsheet)", "err");
      return;
    }

    const writer = kind === "csv"
      ? () => app.Settings.writeDiaryToCsvFile()
      : () => app.Settings.writeDatabaseBackupToFile();

    if (kind === "backup") {
      const c = await this.counts();
      t.print("backing up " + this.describe(c) + " and your settings", "muted");
    }

    if (this.onDevice()) {
      const path = await writer();
      if (path === undefined) {
        t.print("could not write the file. check that the app may use storage", "err");
        return;
      }

      t.print("saved: " + path, "ok");
      app.Utils.shareFile(path);
      t.print("choose where to keep it in the share window that just opened", "muted");
    } else {
      const caught = await this.capture(writer);
      if (!caught) {
        t.print("nothing was produced to save", "err");
        return;
      }

      const ext = kind === "csv" ? "csv" : "json";
      const name = (kind === "csv" ? "waistline_diary_" : "waistline_backup_") + this.stamp() + "." + ext;
      this.download(caught.data, name, kind === "csv" ? "text/csv" : "application/json");
      t.print("downloading " + name + " (" + this.size(caught.data) + "). your browser decides where it goes", "ok");
    }

    if (kind === "backup")
      t.print("passwords and API keys are left out of the file. the terminal's own history is not part of a backup", "muted");
  },

  // ---------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------

  // The file the user picks: { name, text } or undefined
  pickFile: function() {
    if (this.onDevice() && window.chooser) {
      return chooser.getFile().then((file) => {
        if (!file || file.data === undefined) return undefined;
        return { name: file.name || "the file", text: new TextDecoder("utf-8").decode(file.data) };
      });
    }

    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";

      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) {
          resolve(undefined);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => { resolve({ name: file.name, text: String(reader.result) }); };
        reader.onerror = () => { resolve(undefined); };
        reader.readAsText(file);
      });

      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (input.parentNode) input.parentNode.removeChild(input); }, 60000);
    });
  },

  runImport: async function() {
    const t = app.Terminal;

    t.print("choose a Waistline backup file...", "muted");
    const file = await this.pickFile();
    if (!file) {
      t.print("no file chosen", "muted");
      return;
    }

    let data;
    try {
      data = JSON.parse(file.text);
    } catch (err) {
      t.print("that file is not readable as a backup (" + file.name + ")", "err");
      return;
    }

    await this.confirmImport(data, file.name);
  },

  // Show what is in the file, keep a copy of what you have now, and only then ask
  confirmImport: async function(data, name) {
    const t = app.Terminal;
    const info = this.inspect(data);

    if (info.error) {
      t.print(info.error, "err");
      return;
    }

    t.print(name + ": " + this.describe(info) + (info.settings ? ", with settings" : ", without settings"), "accent");

    // A copy of the present data first, under a different name so the file being imported is never overwritten
    let savedTo;
    if (this.onDevice()) {
      const current = await dbHandler.export();
      current.settings = JSON.parse(window.localStorage.getItem("settings"));
      ["off-password", "usda-key", "icu-key"].forEach((key) => {
        if (current.settings && current.settings.integration && key in current.settings.integration) current.settings.integration[key] = "";
      });
      savedTo = await app.Utils.writeFile(JSON.stringify(current), "waistline_before_import_" + this.stamp() + ".json");
    }

    const now = await this.counts();
    t.print("this REPLACES everything you have now (" + this.describe(now) + ")", "err");

    let question;
    if (savedTo) {
      t.print("a copy of what you have now was saved to " + savedTo, "muted");
      question = "replace it with the file? y to continue";
    } else if (this.onDevice()) {
      t.print("could not save a copy of what you have now first", "err");
      question = "replace it anyway, with no copy? type overwrite to continue";
    } else {
      t.print("no copy of what you have now is made here (a desktop browser cannot write files silently). export first if you want one", "muted");
      question = "replace it with the file? type overwrite to continue";
    }

    t.ask(question, async (line) => {
      const answer = line.trim().toLowerCase();
      const ok = savedTo ? /^y(es)?$/.test(answer) : answer === "overwrite";
      if (!ok) {
        t.print("nothing was changed", "muted");
        return;
      }
      await this.apply(data);
    });
  },

  // The same steps the regular import takes
  apply: async function(data) {
    const t = app.Terminal;
    app.f7.preloader.show();

    try {
      await dbHandler.import(data);

      if (data.settings !== undefined) {
        const settings = app.Settings.migrateSettings(data.settings, false);
        window.localStorage.setItem("settings", JSON.stringify(settings));
        app.Settings.changeTheme(settings.appearance.mode, settings.appearance.theme);
        app.Settings.resetModuleReadyStates();
      }
    } finally {
      app.f7.preloader.hide();
    }

    // What the terminal remembered points at data that is gone now
    try { window.localStorage.removeItem("terminal-undo"); } catch (err) {}
    app.TerminalDiary.foodNames = undefined;
    app.TerminalFoods.lastList = undefined;
    app.TerminalMeals.lastList = undefined;
    app.TerminalRecipes.lastList = undefined;
    app.TerminalDiary.refreshFoodNames();

    t.print("imported: " + this.describe(await this.counts()), "ok");
    t.print("undo was cleared, since it pointed at the old data", "muted");
    app.f7.views.main.router.refreshPage();
  }
};

app.Terminal.commands.export = {
  usage: "export [csv]",
  desc: "save all your data as a backup file (same file the regular screen makes). on a phone it opens the share window so you choose where it goes. export csv gives the diary as a spreadsheet",
  complete: (args) => (args.length === 0 ? ["csv"] : []),
  run: async (args) => { await app.TerminalBackup.runExport(args); }
};

app.Terminal.commands.import = {
  usage: "import",
  desc: "restore from a backup file, including one from the official app. opens the file chooser, shows what is in it, saves a copy of what you have now, and asks before replacing anything",
  run: async () => { await app.TerminalBackup.runImport(); }
};
