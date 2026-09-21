# waistline-cli — user manual

> waistline-cli is a fork of [Waistline](https://github.com/davidhealey/waistline) (by David Healey) created by **sh0gg**. Both are free software under the GPLv3.
> [Leer en español](MANUAL.es.md) · [Back to the README](../README.md)

This manual explains how to use the app, with use cases, and how to work on the code. Reference version: **0.1.0**.
Inside the app, `help` lists the commands and `tour` walks you through the first steps.

**Contents:** [1. What it is](#1-what-it-is) · [2. First start](#2-first-start) · [3. Moving around](#3-moving-around-folders-and-shell) ·
[4. Diary](#4-food-diary) · [5. Foods, meals and recipes](#5-foods-saved-meals-and-recipes) ·
[6. Body measurements](#6-body-measurements-body) · [7. Goals and plan](#7-goals-profile-and-plan) ·
[8. Statistics](#8-statistics-stats) · [9. Backup](#9-backup) · [10. Settings](#10-settings-language-themes-and-reminder) ·
[11. Sample data](#11-sample-data) · [12. How data is stored](#12-how-data-is-stored) ·
[13. Working on the code](#13-working-on-the-code) · [14. Common cases and pitfalls](#14-common-cases-and-pitfalls) ·
[15. Limits](#15-limits-and-open-items)

---

## 1. What it is

A food and weight diary for Android that you drive by **typing commands**. You open it, see a prompt (`~/diary $`) and
type. No menus, no tabs, no account, no cloud: everything is stored on your phone.

Commands and options are **always in English**; the text around them can be shown in Spanish (`set lang es`).

### Four rules that explain everything

1. **Nothing is estimated or filled in.** What you leave blank stays empty. Charts never draw a line across days with no
   data. Estimates (`plan`, `stats project`) only guide you and are always labelled as estimates.
2. **The past is not rewritten.** Changing a food or recipe creates a **new version**; days already logged keep the old one.
   Goals have an effective date.
3. **Your data is yours.** All local. The backup is a file you keep wherever you want.
4. **Fast to type.** Ghost autocomplete, history and a `⇥` button.

---

## 2. First start

1. A few preference questions appear (`setup`): units, first day of the week, meal names.
2. Then the guided `tour` list: profile, weight, calorie goal, first food, first meal, reminder and a walk through the
   folders. Each item runs the real command and is ticked `[x]` by looking at what is **stored**, not at what you say.
   `tour` brings it back.
3. A fresh install **starts empty**, goals included.
4. Already use Waistline? Make a backup with the official app and use `import` (see §9).
5. Just want to see it work? `demo load` (30 days of data) and `demo clear` to remove it.

---

## 3. Moving around: folders and shell

| Folder | Contents |
|---|---|
| `~/diary/<date>` | the log, one folder per day |
| `~/foods` | your foods |
| `~/meals` | saved meals (templates) |
| `~/recipes` | recipes (a single line in the diary) |
| `~/body` | body measurements |
| `~/goals` | goals and profile |
| `~/stats` | your numbers over time, with charts |
| `~/settings` | preferences |

```
cd diary               cd ..                 cd ~
cd diary/2026-09-18    cd diary/yesterday    cd ~/diary/today
pwd    ls    help [command]    clear    reset
```

- Paths are relative, like in a shell: from `~/foods` you must type `cd ~/diary/today`.
- The lines `ls` prints **can be tapped** (they open the day, the goal, etc.).
- **Tab, `→` or the `⇥` button** accept the ghost autocomplete. The arrow keys walk the history.
- `clear` clears the screen. `reset` also clears the history, goes back to `~` and leaves any question. The ⟳ button at the
  top right does the same and never deletes data.
- `q` cancels a guided question.

### `edit`, `rm`, `cat`, `ls` and `new` depend on where you are

They change meaning by folder: inside a day they act on **entries**; in `~/foods`, on **foods**; in `~/meals`, on
templates; in `~/recipes`, on recipes. From `~` they do not know what you mean and say *"go to a day first, e.g. cd
diary/today"*. Fix: enter the right folder first.

`+` (log) on the other hand works **from any folder**.

---

## 4. Food diary

```
+ oats 60g                    # log
+ oats 60g @yesterday @08:12  # another day and time
+ sandwich @dinner            # into a specific meal
+ kcal 650 "pizza"            # quick add: bare calories, no food
today                         # today's totals: energy, balance against goal, macros
cat 3                         # nutrition detail of entry 3
edit 3 80g                    # change the amount
edit 3 kcal 800 "other"       # change a quick add
mv 3 4 @dinner                # move entries to another meal / time / day
rm 3 4                        # delete
undo                          # undo (repeatable; a template is undone as a whole)
```

### Amounts

| You type | Meaning |
|---|---|
| `60g`, `1.5kg`, `200ml` | that amount (converted to g/ml) |
| `0.5`, `2x`, `1/2`, `5/6`, `0,5` | times the food's **portion** (any fraction `a/b`) |
| `1 bag`, `2 slices` | a named serving of the food |

**Pitfall:** a number **without a unit** multiplies the food's portion. `+ oats 60` with a 100 g portion is 6000 g. The
app warns you (*"that is 6000g. for grams write 60g"*) and `undo` removes it.

### `@` tags (when)

`@08:12` (time), `@yesterday`, `@today`, `@2026-09-18` (day), `@lunch` (meal). They combine in any order.

**If you do not give a meal, it is chosen from the time you log:**

| Time | Meal |
|---|---|
| before 11:00 | breakfast |
| until 16:00 | lunch |
| until 21:00 | dinner |
| after that | snacks |

So a dinner logged at 22:30 ends up in *snacks*. Avoid it by naming the meal: `+ pizza 5/6 @dinner`; or, if it is already
logged, go into the day and use `mv <n> @dinner`. Meal names are the ones in your settings (`set meals`).

### Use case: log a forgotten day

```
cd diary/yesterday
+ toast 2 slices @08:30
+ kcal 700 "dinner out" @dinner
today
```

---

## 5. Foods, saved meals and recipes

### Foods (`~/foods`)

```
new "chicken stew" 350g kcal 420 fat 18 carb 30 protein 25
new "white rice" 100g kcal 350 carb 77 protein 7 serving bag=125g
new stew                   # without the rest: asks field by field (q cancels)
search yogurt              # search Open Food Facts and add to your foods
scan                       # phone camera; in a browser you type the code
scan 8410000000000
cat rice                   # see values and servings
```

Words: `kcal kj fat sat carb sugar fiber protein salt sodium brand barcode serving`.
**Values are for the portion you type.** `serving bag=125g` lets you write `+ rice 1 bag`.

**Changing a food without touching the past** (while in `~/foods`):

- `edit pizza kcal 900` → **new version**; the old one is archived. Days already logged do not change.
- Name, brand and named serving are changed in place.
- `edit pizza per 125g` expresses the *same* food per another portion and rescales the values. No new version, and days
  already logged give the same result.
- `edit pizza 125g` without values **is rejected** (it would falsify the kcal).
- `rm pizza` **archives**, it does not delete.
- `scan` of a product you already have compares it with Open Food Facts and, if it changed, offers to save a new version.

### Scanned or searched products: their portion

A product from Open Food Facts is normally saved **per 100 g** (or 100 ml), with unit `g`/`ml`. Check it with
`cat <product>`: the `per ...` line says which portion the values refer to.

That decides how you write amounts:

| You want | Type |
|---|---|
| a specific weight | `+ yogurt 125g` |
| a fraction **of the stored portion** | `+ yogurt 0.5` (half of 100 g = 50 g) |
| a named serving | `+ yogurt 1 pot` (create it first, see below) |

Creating a named serving for a product (only with unit `g`/`ml`, measured in that same unit):

```
cd foods
edit yogurt serving pot=125g
+ yogurt 1 pot
+ yogurt 0.5 pot
```

Changing the named serving **does not create a version** and does not touch what is already logged. When importing from
Open Food Facts the named serving is not filled in automatically: set it by hand this way.

### Use case: a 350 g pizza split into 6 slices, of which you eat 5

The product is per 100 g, so `+ pizza 5/6` would give 5/6 of **100 g** (wrong). Two correct ways:

**A. Rescale the food to the whole pizza (recommended).** It is the same food seen per another portion:

```
cd foods
edit pizza per 350g       # 250 kcal per 100 g becomes 875 kcal per 350 g; no new version
cd ..
+ pizza 5/6 @dinner       # 5/6 of 350 g = 291.7 g → 729 kcal, exact
```

**B. Log by slices.**

```
edit pizza serving slice=58.333333g     # 350/6 with enough decimals for the error to be negligible
+ pizza 5 slices @dinner
```

**If you already logged it wrongly:** enter the day, find the number with `ls` and fix it, **after** `per 350g`:

```
cd ~/diary/today
ls
edit <n> 5/6
mv <n> @dinner            # if it landed in snacks
```

After logging, the app may show `×0.8` (that is the rounding of 0.8333) and a hint *"that is 291.7g. for grams write
0.8g"*. It is a generic hint for numbers without a unit: with a fraction it does not apply, ignore it (see §14).

### Saved meals (`~/meals`)

They log **several entries at once**; each ingredient becomes its own entry.

```
new sandwich = white bread 2 slices, gouda 2 slices, mayonnaise 10g
+ sandwich
+ sandwich 2x @yesterday @13:15
```

They store **names**, not ids: at log time they use the current version of each food.

### Recipes (`~/recipes`)

A recipe is **one thing** and **one line** in the diary, with the values of the whole batch and its yield.
It **always asks how much it yields** if you do not give `yield`.

```
new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion     # from ingredients
new "lentil stew" yield 4 portions kcal 1600 fat 60 carb 200 protein 90  # from outside values
save 3 4 5 as sandwich                                                   # from entries of a day
cp sandwich ~/recipes                                                    # template → recipe (and `cp x ~/meals`)
+ stew            # 1 portion
+ stew 2          # 2 portions (not two batches)
+ soup 300g       # recipe by weight: needs an amount (or + soup 0.25 = a quarter)
refresh stew      # recalculate with the current foods → new version
```

Values are **frozen when saved**. If a template and a recipe share a name, `+` lets you choose.
Limitations: no recipes inside recipes, and a quick add cannot be an ingredient.

### Use case: cook a batch and eat it over several days

1. `new "lentil stew" = lentils 400g, chorizo 150g, carrot 200g, yield 4 portions`
2. Monday: `+ stew` · Tuesday: `+ stew` · Wednesday: `+ stew 2`
3. If you change lentil brand: `refresh stew`. What you already ate keeps its values.

---

## 6. Body measurements (`~/body`)

**Rule: only what you type is stored.**

```
weight                         # guided: Enter = leave empty, - = delete, q = cancel
weight 74.2 fat 18.5 water 55  # all at once
weight 163lb @yesterday        # with a unit and another day
ls                             # last 14 days (tap a day to open it)
ls weight                      # history of one field with the change between readings
rm 2026-09-18 water            # remove a measurement (undo brings it back)
fields    field show "body fat"    field add water %    field hide "body fat"
```

- By default only weight is asked; `fields` lists the fields. Hiding a field **does not delete** its values.
- **Warnings about possible mistakes** before saving: out-of-range values (weight 25–300 kg, %, BMR 700–4500), jumps of
  more than 1.5 kg from one day to the next, fat + muscle + bone above 100 %, inconsistent water, BMR outside 14–34
  kcal/kg. You decide: `y` keeps it, another value replaces it, Enter leaves it empty. A `742` for `74.2` is **suggested
  but never applied**.
- The day's weight also shows in `today`, with the weekly change `74.2 kg (-0.8 wk)` when there is a reading 5 to 9 days earlier.

### Your watch's energy: `burned` or `active`

There is no automatic connection to watches: you enter the energy yourself, in a field of its own. There are two possible
fields and **they are not the same**:

| Field | What it is | Create |
|---|---|---|
| `burned` | **total** energy of the day (basal + activity) | `field add burned kcal` |
| `active` | **activity** only | `field add active kcal` |

**Which one is yours?** It depends on how your watch labels its number. Total energy includes the basal metabolism (about
60–90 kcal an hour even at rest, 1,400–2,200 kcal a day); active energy only rises when you move. Two checks:

1. Look at the number first thing in the morning, before moving: if it already shows hundreds, it is total; if almost 0, it is active.
2. Compare it with your scale's BMR: a total cannot be lower than the basal rate.

**Do not enter the wrong field.** Active calories entered as `burned` make `plan` believe you burn much less than you do.

How to enter it:

```
field add active kcal
weight active 802             # today
weight active 802 @yesterday  # another day
```

- **Enter a finished day.** The watch number keeps rising during the day; store the total of a completed day (at night or
  with `@yesterday`), not a half-way reading.
- One day of data breaks nothing: `plan` only uses `watch` from 3 days on, and charts leave gaps. The warnings accept
  `active` between 10 and 3,500 kcal and `burned` between 700 and 4,500.

---

## 7. Goals, profile and plan

### Goals (`~/goals`)

With **versions by date**: each one applies from its day. `goal` always starts **today or later**.

```
ls                     # today's goals
goal calories 2100     # new version from today
goal protein 120 min   # a minimum instead of a maximum (max removes it)
goal fat 30 pct        # 30 % of energy
goal calories 2000 2000 2000 2000 2000 2300 2300   # one per day of the week
goal calories 2200 @2026-10-01                     # from a future date
goal calories none     # remove
goal weight 70         # target weight (used by plan and stats project)
cat calories           # all its versions, with "← now"
undo
```

### Profile

`profile` stores height, date of birth, sex and activity level. It is optional and only feeds the `formula` source of
`plan`. `help profile` shows the accepted values.

### The plan (`plan`)

An **estimate** of what you burn and what to eat. It shows each source **separately**, never mixed:

| Source | Origin |
|---|---|
| `watch` | average of the energy you entered, at least 3 days in the last 14: `burned` as is, or `active` added to the scale's BMR |
| `scale` | your scale's BMR × activity |
| `data` | average intake and 3-week weight trend (needs 5 weigh-ins over 10+ days and 10 days of intake) |
| `formula` | Mifflin-St Jeor with height, age and sex × activity |

```
plan                              # situation and sources
plan lose 0.5                     # lose 0.5 kg a week (deficit ≈ 550 kcal/day)
plan lose 0.5 move 200 protein    # 200 kcal of the deficit come from moving; suggests protein
plan lose 0.5 from watch          # compute on another source
plan maintain    plan gain 0.25
plan apply                        # sets it as your goal, AFTER ASKING (undo reverts it)
```

It warns if the pace exceeds 1 % of body weight a week, if the deficit exceeds a quarter of what you burn, or if eating
that falls below your BMR or 1,200 kcal. **It does not offer weight loss with BMI < 18.5.**

### Use case: start losing weight

1. `profile ...` and `weight` (several days, better with `fat`).
2. If you have a watch: `field add burned kcal` or `field add active kcal` (see §6) and enter each finished day.
3. Log food for ~2 weeks (a day only counts from 1,000 kcal).
4. `plan` → see which sources are available and whether they disagree.
5. `plan lose 0.5` → `plan apply` to set it as your goal.
6. Every week: `stats weeks 4` and `stats weight 30d`.

---

## 8. Statistics (`~/stats`)

SVG charts inside the terminal, no libraries. Default range `30d`; also `7d`, `12w`, `6m`, `all`.

```
stats                    # dashboard with mini charts (tap a row to open its chart)
stats weight 90d         # also fat, muscle, water, bmr, burned, active or your own fields
stats intake             # intake as bars with the goal line
stats protein
stats energy             # intake vs the watch's energy
stats balance            # intake − energy (green = deficit, red = surplus)
stats composition        # fat mass and lean mass in kg
stats weeks 8            # week-by-week table
stats top protein 14d    # which foods contribute most (kcal or protein)
stats project lose 0.5   # projection (always labelled "estimate")
```

**A gap is a gap:** no line is drawn across days with no data and no average counts them (the 7-day average needs 3
readings; today is drawn muted). What is computed just to look is not stored. The projection is straight lines: a
direction, not a promise.

---

## 9. Backup

```
export        # full backup: diary, foods, templates, recipes and settings
export csv    # the diary as a spreadsheet
import        # file picker → shows what is inside → asks for confirmation
```

- On the phone, `export` saves and opens the device's **share sheet**; `import` opens the system file picker.
- It is the **same format as the official app**: it can bring your Waistline data over.
- Keys and passwords are **left out**. The terminal's own history is not part of a backup.
- **`import` replaces EVERYTHING.** On the phone it first saves `waistline_before_import_<date>.json` and asks for `y`. If
  it cannot save that copy (or on desktop) it requires you to type `overwrite`. After importing, `undo` is cleared.

### Use case: move from official Waistline to waistline-cli

1. In the official app, export a backup of your data and keep it somewhere you can find it.
2. Install waistline-cli (it has a different application id, so both coexist).
3. `import` → choose the file → read the summary → `y`.
4. `ls`, `today` and `stats` to check everything is there.

---

## 10. Settings, language, themes and reminder

```
set                          # list preferences
set energy kj                # kcal | kj
set weight lb                # weight units
set week monday              # first day of the week
set meals breakfast, lunch, dinner, snacks   # 1 to 7 names
set sound off
setup                        # the guided first-start questions
set lang auto|en|es          # only changes the surrounding text, not the commands
theme                        # terminal, oled, solarized-dark, solarized-light, monokai, dracula
theme oled
accent pink | accent #ff8800 | accent default
set reminder 07:00           # daily weigh-in notification (off removes it; off by default)
```

Renaming meals keeps their position: old entries stay in the same group. The reminder is a local notification and **only
rings on the phone** (on desktop the time is stored and it tells you so).

---

## 11. Sample data

`demo load` adds foods, templates, a recipe, 30 days of entries and body measurements (with gaps on purpose). Everything is
tagged: `demo clear` removes only that and leaves your data exactly as it was. `demo status` says what is there.

---

## 12. How data is stored

- The same IndexedDB stores as Waistline: diary, foods, templates (`meals`), recipes and settings.
- Fields added by the terminal: `serving` and `archived` (foods), `refs` (templates), `demo` (sample data).
- The terminal's own state in `localStorage`: `terminal-log` (last 300 lines), `terminal-history`, `terminal-cwd`,
  `terminal-undo`. It is **not** part of `export`; `reset` clears it.
- A failure while the terminal starts leaves the app unusable (there is no fallback menu): the way out is `reset`, the ⟳
  button or reinstalling. Your data is not touched.

---

## 13. Working on the code

### Layout

```
www/activities/terminal/views/        terminal.html, terminal.css
www/activities/terminal/js/
  terminal.js            shell: paths, input, output, autocomplete, cd/ls/pwd
  terminal-diary.js      +, edit, mv, rm, cat, undo, today
  terminal-foods.js      new, search, scan, versions, per
  terminal-meals.js      templates
  terminal-recipes.js    new, save, cp, refresh, edit
  terminal-body.js       weight, fields, mistake warnings
  terminal-goals.js      goals with versions, and the profile
  terminal-plan.js       plan and plan apply
  terminal-charts.js     text sparklines and SVG charts
  terminal-stats.js      stats
  terminal-backup.js     export / import
  terminal-settings.js   set, setup
  terminal-themes.js     theme, accent (one more entry in `themes` = a new theme)
  terminal-onboarding.js tour and first start
  terminal-reminder.js   set reminder
  terminal-demo.js       sample data
  terminal-i18n*.js      Spanish translation
tests/terminal/          checks of the logic
```

The modules use `app` as a global. Kept from Waistline as a library: `settings.js`, `nutriments.js`, `body-stats.js`,
`foods-categories.js`, `goals.js`, `foods-meals-recipes.js`, `foodlist.js`, `open-food-facts.js`.
Every file carries the project's GPLv3 header.

### Run in the browser

```
npm install && npx cordova platform add browser
npx cordova run browser --port=8000        # http://localhost:8000
npx cordova prepare browser                # after EVERY change in www/ (the server serves a copy)
```

- If you see the old app: `prepare` is missing or it is cache (Ctrl+Shift+R).
- **Empty database without deleting anything:** open another origin (`http://127.0.0.2:8000`, `.3`, `.4`...).
- Verify with `demo load` in a clean origin and check that `demo clear` leaves it exact.
- Cordova modifies `package.json` when adding plugins or platforms; keep it out of your commits unless the change is intended.

### Tests

```
node tests/terminal/run.js
```

Covers shell, diary, foods, templates, servings, recipes and i18n. Checks for `~/body`, `~/goals`, `plan`, `~/stats` and
`export`/`import` are still missing. Template: `tests/terminal/recipes.test.js` (loads the files with a mock `app`).

### Translation

Phrases are written in `tests/terminal/i18n-es.txt` (`English == Spanish`, `{}` for variable parts). Then:

```
node tests/terminal/build-i18n.js     # generates terminal-i18n-es-areas.js and checks every key exists in the code
```

A line without translation is shown in English and recorded in `app.TerminalI18n.missing` (browser console).

### Build the APK

You need Node.js, JDK 17, the Android SDK (platform 36, build-tools 36) and Gradle 8.14, with `JAVA_HOME`, `ANDROID_HOME` and
Gradle on the `PATH`:

```
npx cordova build android
```

Output: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`. An APK meant for release must be **signed** with your own key.

---

## 14. Common cases and pitfalls

| Situation | What happens / what to do |
|---|---|
| `edit` from `~` says *"go to a day first"* | `edit` depends on the folder. `cd foods` for foods, `cd diary/today` for entries |
| I had dinner at 22:30 and it went to *snacks* | The meal is chosen from the time. Use `@dinner` when logging, or `mv <n> @dinner` in the day |
| `+ oats 60` gives 6000 g | A number without a unit multiplies the portion. Type `60g` (or `undo`) |
| I scanned a per-100 g product and `+ prod 5/6` gives too little | 5/6 is of the stored portion. `edit prod per 350g` first, or use grams |
| *"for grams write 0.8g"* appears when I use a fraction | It is a hint meant for `+ oats 60`. With `5/6` or `0.5` it does not apply: ignore it. Stored data is correct |
| I entered my watch's active calories as `burned` | `plan` will underestimate what you burn. Fix it with the `active` field (§6) |
| I made a mistake while logging | `undo` (repeatable) |
| The app will not start or stays blank | The ⟳ button, or `reset`, or reinstall. It does not delete your data |

---

## 15. Limits and open items

- **Watch and scale integration:** postponed. The planned route is Health Connect; today the energy is entered by hand.
- Removed on purpose when replacing the screens: USDA, text to speech, food photos, categories and tags, uploading to
  Open Food Facts, the pie chart.
- Automated tests for several areas are missing (see §13), plus per-folder `help` and nested recipes.
- Archived food versions accumulate (that is what protects the past).
