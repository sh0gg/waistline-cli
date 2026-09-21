# waistline-cli

**A food and weight diary you drive by typing commands, like a terminal. Everything stays on your phone.**

waistline-cli is an Android app: you open it, see a prompt (`~/diary $`) and type. No menus, no tabs, no account, no cloud.
It is a fork of [Waistline](https://github.com/davidhealey/waistline) by David Healey, created by **sh0gg**, in which the
graphical screens were replaced by a terminal. Both are free software under the GPLv3.

[Leer en español](README.es.md) · Original Waistline README: [README.waistline.md](README.waistline.md)

> **Status: 0.1.1, early version.** 0.1.0 was checked on a real Android phone (scan, export/import, reminder and icon). 0.1.1 adds
> the scale fields (muscle, water, bone, bmr) out of the box and works out the day's energy from your watch's activity plus your
> scale's bmr; it was checked in a browser and with the automated tests, not yet on a phone. Expect rough edges, and please keep
> backups (`export`).

## A taste of it

```
+ oats 60g @08:12        # log breakfast at 08:12
today                    # totals for today and balance against your goal
weight 74.2 fat 18.5     # log body measurements
plan lose 0.5            # what to eat to lose 0.5 kg a week, from your own data
stats weight 90d         # a chart, drawn inside the terminal
theme dracula            # change the look
```

## Ideas that define it

1. **Nothing is estimated or filled in.** What you leave blank stays empty. Charts never draw a line across days with no data, and
   no average counts them. Estimates (`plan`, projections) only warn, and are always labelled as estimates.
2. **The past is not rewritten.** Changing a food creates a new version; days already logged keep the old one. Goals have an
   effective date.
3. **Your data is yours.** Local database, a backup file you keep wherever you want, and it can import backups from the original
   Waistline.
4. **Fast to type.** One line logs a meal; ghost autocomplete, history and a `⇥` button do the rest.
5. **No starter data.** A fresh install is empty, including goals. `tour` walks you through what is worth entering.

## What you can do

| Area | What it is for |
|---|---|
| `~/diary` | log meals in one line (`+ oats 60g`), fix them (`edit`, `mv`, `rm`, `undo`), see totals and balance |
| `~/foods`, `~/meals`, `~/recipes` | your foods (with versions), saved meals, recipes; search Open Food Facts or `scan` a barcode |
| `~/body` | weight and whatever your scale gives you, with warnings for values that look like typos |
| `~/goals`, `plan` | goals with history, and a plan (`plan lose 0.5`) worked out from your own data, source by source |
| `~/stats` | charts drawn inside the terminal: weight, fat, intake, protein, balance, projections |
| `~/settings` | units, meal names, themes (`terminal`, `oled`, `solarized`, `monokai`, `dracula`), language, weigh-in reminder |
| `export` / `import` | full backup, CSV, and restore (also from the original Waistline) |

Commands stay in English on purpose. The text around them is translated: `set lang es` (English and Spanish so far).
`set reminder 07:00` schedules a daily notification to weigh yourself. `help` lists everything; `tour` is a guided start.

## Getting started

1. Install the APK (see below) and open it. Answer the preference questions and follow the guided `tour` list.
2. Log your first meal: `+ oats 60g`. See how you are doing with `today`.
3. When something does not work out, look in the **[user manual](docs/MANUAL.md)** ([Español](docs/MANUAL.es.md)): it
   explains every command with examples and use cases (scanned products and their portions, splitting a pizza into
   slices, a watch's `burned` vs `active` energy, dinners that land in *snacks*, moving over from official Waistline...)
   and a table of common pitfalls.
4. Coming from Waistline? Export a backup with the official app and use `import` (§9 of the manual).

## Install

Download the APK from the [Releases](../../releases) page, check its SHA-256, and allow "install unknown apps" for your browser or file
manager. Requires Android 5.0 or later. Since the APK is signed with the author's own key and is not on any store, Android may warn
that the app is from an unknown developer.

## Build it yourself

```
npm install
npx cordova platform add android
npx cordova build android           # debug APK
node tests/terminal/run.js          # checks of the terminal's logic
```

You need Node.js, a JDK 17, the Android SDK (platform 36, build-tools 36) and Gradle 8.14. For the browser version:
`npx cordova platform add browser && npx cordova run browser --port=8000`.

## Roadmap

More integrations (Health Connect first, so that watches and scales from many brands can feed the diary), more languages,
more tests, and getting on F-Droid.

## Credits and license

Waistline is by [David Healey](https://github.com/davidhealey) and its contributors; waistline-cli is a fork created by **sh0gg**.
Food data comes from [Open Food Facts](https://world.openfoodfacts.org). The font is JetBrains Mono (SIL OFL).
Licensed under the **GNU General Public License v3.0 or later**, like the original: see the license headers and `www/LICENSE.txt`.
