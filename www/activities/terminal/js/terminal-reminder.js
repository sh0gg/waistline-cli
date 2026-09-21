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
  A daily reminder to weigh yourself: set reminder 07:00, set reminder off.
  It is a local notification scheduled on the phone (no server, no account). Off until you set it.
  Needs the cordova-plugin-local-notification plugin; without it (a desktop browser) the time is
  remembered and the reminder starts working once the app runs on the phone.
*/
app.TerminalReminder = {

  id: 7001,

  plugin: function() {
    return (window.cordova && window.cordova.plugins && window.cordova.plugins.notification && window.cordova.plugins.notification.local) || undefined;
  },

  get: function() {
    return app.Settings.get("terminal", "reminder") || "";
  },

  // "7", "07:00", "7.30", "0730" -> "07:00". undefined when it is not a time of day
  parse: function(text) {
    const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(String(text).trim());
    if (!m) return undefined;

    const hour = parseInt(m[1], 10);
    const minute = m[2] === undefined ? 0 : parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return undefined;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  },

  // Puts the schedule on the phone (or takes it off). Safe to call any time: it replaces the previous one
  sync: async function() {
    const local = this.plugin();
    if (!local) return { phone: false };

    const time = this.get();
    await new Promise((done) => { local.cancel(this.id, done); });
    if (time === "") return { phone: true };

    const granted = await new Promise((done) => {
      local.hasPermission((has) => {
        if (has) done(true);
        else local.requestPermission(done);
      });
    });
    if (!granted) return { phone: true, denied: true };

    const parts = time.split(":");
    local.schedule({
      id: this.id,
      title: "waistline-cli",
      text: app.TerminalI18n && app.TerminalI18n.current() === "es" ? "hora de pesarte: weight" : "time to weigh yourself: weight",
      trigger: { every: { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) } },
      foreground: true
    });
    return { phone: true };
  },

  // What set reminder does after a valid value. Tells you how it went once the phone has answered
  apply: function() {
    const t = app.Terminal;
    this.sync().then((result) => {
      if (!result.phone) t.print("reminders only ring on the phone. the time is saved and starts working there", "muted");
      else if (result.denied) t.print("the phone did not allow notifications. allow them for this app in Android settings", "err");
    }).catch((err) => {
      console.error(err);
      t.print("could not schedule the reminder: " + (err && err.message ? err.message : err), "err");
    });
  }
};

// Alarms can be lost (restart, update), so the schedule is put back each time the app opens on the phone
document.addEventListener("deviceready", () => {
  if (app.TerminalReminder.get() !== "") app.TerminalReminder.sync().catch(() => {});
}, false);
