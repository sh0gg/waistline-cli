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

// The translator (terminal-i18n.js) and the Spanish dictionaries.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = path.join(__dirname, "../../www/activities/terminal/js/");
let lang = "es";
global.window = { localStorage: { getItem: () => null, setItem() {} } };
global.app = { Settings: { get: (section, key) => (key === "lang" ? lang : undefined) } };
Object.defineProperty(global, "navigator", { value: { language: "en-US" }, configurable: true, writable: true });
const load = (file) => require("vm").runInThisContext(fs.readFileSync(dir + file, "utf8"));
load("terminal-i18n.js");
load("terminal-i18n-es.js");
load("terminal-i18n-es-areas.js");
const i = app.TerminalI18n;

let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(got) + " != " + JSON.stringify(want)); };

console.error = () => {};
console.debug = () => {};

eq("exact line", i.tr("nothing to undo"), "nada que deshacer");
eq("template", i.tr("no such directory: foo"), "no existe el directorio: foo");
eq("command label stays", i.tr("cd: no such directory: foo"), "cd: no existe el directorio: foo");
eq("usage label", i.tr("usage: rm <n> [n...]"), "uso: rm <n> [n...]");
eq("choice number kept", i.tr("2) [x] your weight today (and whatever your scale gives you)"), "2) [x] tu peso de hoy (y lo que te dé la báscula)");
eq("question with default and (q cancels)", i.tr("energy unit (kcal or kj) [kcal] (q cancels)"), "unidad de energía (kcal o kj) [kcal] (q cancela)");
eq("pieces joined by a dot", i.tr("getting started: 3 of 6 done · tour"), "primeros pasos: 3 de 6 hechos · tour");
eq("reordered / repeated holes", i.tr("that is 6000g. for grams write 60g. undo takes it back"), "eso son 6000g. para gramos escribe 60g. undo lo deshace");
eq("leading indent kept", i.tr("  not available: watch"), "  no disponible: watch");
eq("folder note appended to a description", i.tr("show the details and nutrition of an entry (in ~/foods: a food)"), "muestra el detalle y la nutrición de una entrada (en ~/foods: un alimento)");
eq("nested capture is translated", i.tr("updated 2 entries (now on 2026-09-18)"), "actualizadas 2 entradas (ahora en 2026-09-18)");
eq("longest template wins", i.tr("saved 2026-09-19: weight 74 kg"), "guardado 2026-09-19: weight 74 kg");
eq("shorter template still works", i.tr("saved oats"), "guardado oats");
eq("unknown line stays", i.tr("a line nobody translated"), "a line nobody translated");
eq("unknown line is remembered", !!i.missing["a line nobody translated"], true);
eq("command words are not touched", i.tr("+ oats 60g"), "+ oats 60g");
eq("weekday in Spanish", i.weekday(new Date(2026, 8, 19)), "sáb");

lang = "en";
eq("English is left alone", i.tr("nothing to undo"), "nothing to undo");
eq("English weekday", i.weekday(new Date(2026, 8, 19)), "sat");
lang = "auto";
global.navigator.language = "es-ES";
eq("auto follows a Spanish phone", i.current(), "es");
global.navigator.language = "fr-FR";
eq("auto falls back to English", i.current(), "en");
lang = "de";
eq("unknown language falls back to English", i.current(), "en");

// The source of the translations is checked and up to date
const check = spawnSync(process.execPath, [path.join(__dirname, "build-i18n.js"), "--check"], { encoding: "utf8" });
eq("i18n-es.txt passes its checks", check.status, 0);
if (check.status !== 0) console.log(check.stdout);

const built = fs.readFileSync(dir + "terminal-i18n-es-areas.js", "utf8");
const count = (built.match(/^ {2}"/gm) || []).length;
const source = fs.readFileSync(path.join(__dirname, "i18n-es.txt"), "utf8").split(/\r?\n/).filter(l => l.trim() !== "" && !l.startsWith("#")).length;
eq("terminal-i18n-es-areas.js is generated from the current i18n-es.txt (run build-i18n.js)", count, source);

// The reminder's time parsing
global.document = { addEventListener() {} };
load("terminal-reminder.js");
const r = app.TerminalReminder;
eq("reminder 7", r.parse("7"), "07:00");
eq("reminder 07:00", r.parse("07:00"), "07:00");
eq("reminder 7.30", r.parse("7.30"), "07:30");
eq("reminder 0730", r.parse("0730"), "07:30");
eq("reminder 23:59", r.parse("23:59"), "23:59");
eq("reminder 24:00 is not a time", r.parse("24:00"), undefined);
eq("reminder 7:60 is not a time", r.parse("7:60"), undefined);
eq("reminder words are not a time", r.parse("morning"), undefined);
eq("no plugin in a browser", r.plugin(), undefined);

process.exit(fails ? 1 : 0);
