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
  Spanish text for the terminal. The keys are the English lines exactly as the code prints them (see terminal-i18n.js).
  Commands, flags and the words you type (kcal, fat, @yesterday, +, new...) are NOT translated: only the text around them.
*/
app.TerminalI18n.labels("es", { usage: "uso", names: "nombres" });

// ---------------------------------------------------------------------
// The shell, help and settings
// ---------------------------------------------------------------------
app.TerminalI18n.add("es", {
  "diary/  food log, one folder per day": "diary/  registro de comidas, una carpeta por día",
  "foods/  your food list": "foods/  tu lista de alimentos",
  "meals/  saved meals": "meals/  comidas guardadas",
  "recipes/  recipes": "recipes/  recetas",
  "body/  weight and body measurements": "body/  peso y medidas corporales",
  "stats/  charts and averages": "stats/  gráficas y medias",
  "goals/  targets and the plan calculator": "goals/  objetivos y calculadora del plan",
  "settings/  preferences": "settings/  preferencias",
  "food log, one folder per day": "registro de comidas, una carpeta por día",
  "your food list": "tu lista de alimentos",
  "saved meals": "comidas guardadas",
  "recipes": "recetas",
  "weight and body measurements": "peso y medidas corporales",
  "charts and averages": "gráficas y medias",
  "targets and the plan calculator": "objetivos y calculadora del plan",
  "preferences": "preferencias",

  "no such directory: {}": "no existe el directorio: {}",
  "~ — home. ls lists what is here.": "~ — inicio. ls lista lo que hay aquí.",
  "cancelled": "cancelado",
  "no option {}": "no existe la opción {}",
  "unknown command: {} (try help)": "comando desconocido: {} (prueba help)",
  "type help for commands, ls to look around, tap ⇥ to autocomplete": "escribe help para ver los comandos, ls para mirar alrededor, toca ⇥ para autocompletar",
  "no such command: {}": "no existe el comando: {}",
  "(nothing here yet)": "(aquí no hay nada todavía)",

  "list commands, or show details for one": "lista los comandos, o detalla uno",
  "clear the screen": "limpia la pantalla",
  "clear screen and command history, and go home": "limpia la pantalla y el historial de comandos, y vuelve al inicio",
  "print the current directory": "muestra el directorio actual",
  "change directory: cd diary, cd .., cd ~, cd diary/2026-09-19, cd diary/yesterday": "cambia de directorio: cd diary, cd .., cd ~, cd diary/2026-09-19, cd diary/yesterday",
  "list what is in the current directory (tap an item to open it)": "lista lo que hay en el directorio actual (toca un elemento para abrirlo)",

  "unit for energy: kcal or kj": "unidad de energía: kcal o kj",
  "energy is kcal or kj": "energy es kcal o kj",
  "only how numbers are shown changes; stored values are untouched": "solo cambia cómo se muestran los números; lo guardado no se toca",
  "unit for body weight: kg, lb or st": "unidad del peso corporal: kg, lb o st",
  "weight is kg, lb or st": "weight es kg, lb o st",
  "measurements you already saved are converted when shown": "las medidas ya guardadas se convierten al mostrarlas",
  "unit for lengths: cm or inch": "unidad de longitud: cm o inch",
  "length is cm or inch": "length es cm o inch",
  "first day of the week: sunday or monday": "primer día de la semana: sunday o monday",
  "week is sunday or monday": "week es sunday o monday",
  "seven-value goals start on this day": "los objetivos de siete valores empiezan este día",
  "colour theme: terminal, oled, solarized-dark, solarized-light, monokai, dracula (the theme command lists them)": "tema de color: terminal, oled, solarized-dark, solarized-light, monokai, dracula (el comando theme los lista)",
  "themes: {}": "temas: {}",
  "highlight colour: a name (orange, red, yellow, green, cyan, blue, purple, pink, white), a hex like #ff8800, or default": "color de resalte: un nombre (orange, red, yellow, green, cyan, blue, purple, pink, white), un hex como #ff8800, o default",
  "not a colour. use a name or hex like #ff8800": "no es un color. usa un nombre o un hex como #ff8800",
  "what the keyboard's Enter key does: send (runs the command) or button (does nothing; a send button appears next to the tab button)": "qué hace la tecla Enter del teclado: send (ejecuta el comando) o button (no hace nada; aparece un botón de enviar junto al de tabulador)",
  "enter is send or button": "enter es send o button",
  "Enter no longer runs commands; use the ⏎ button": "Enter ya no ejecuta comandos; usa el botón ⏎",
  "Enter runs the command": "Enter ejecuta el comando",
  "torch on while scanning a barcode: on or off": "linterna encendida al escanear un código de barras: on u off",
  "beep after a barcode scan: on or off": "pitido tras escanear un código de barras: on u off",
  "automatic weekly backup file on the phone: on or off": "copia de seguridad semanal automática en el móvil: on u off",
  "country for Open Food Facts searches (a country name, or all)": "país para las búsquedas en Open Food Facts (un nombre de país, o all)",
  "language of the terminal's own text: auto (follows the phone), en or es. Commands stay in English": "idioma de los textos del terminal: auto (sigue al móvil), en o es. Los comandos siguen en inglés",
  "lang is auto, en or es": "lang es auto, en o es",
  "language for Open Food Facts searches (a language code such as en or es, or default)": "idioma de las búsquedas en Open Food Facts (un código como en o es, o default)",
  "{} is on or off": "{} es on u off",
  "give between 1 and 7 names, separated by commas: set meals breakfast, lunch, dinner, snacks": "indica entre 1 y 7 nombres, separados por comas: set meals breakfast, lunch, dinner, snacks",
  "two meals have the same name": "dos comidas tienen el mismo nombre",
  "cannot remove {}: there are entries in it. move them first with mv <n> @meal": "no se puede quitar {}: tiene entradas. muévelas antes con mv <n> @comida",
  "cannot remove {}: there are entries in them. move them first with mv <n> @meal": "no se pueden quitar {}: tienen entradas. muévelas antes con mv <n> @comida",
  "(none)": "(ninguna)",
  "renamed meals keep their place, so old entries stay in the same group": "las comidas renombradas conservan su sitio, así que las entradas antiguas siguen en el mismo grupo",
  "set {} <value>: {}": "set {} <valor>: {}",
  "change one with: set <name> <value>   (set meals breakfast, lunch, dinner)": "cambia una con: set <nombre> <valor>   (set meals breakfast, lunch, dinner)",
  "setup runs the guided questions": "setup lanza las preguntas guiadas",
  "no setting called {}. set on its own lists them": "no hay ningún ajuste llamado {}. set a secas los lista",
  "welcome. a few questions to set things up. Enter keeps what is in [brackets]; q stops (you can run setup again any time)": "bienvenido. unas preguntas para dejarlo listo. Enter conserva lo que hay entre [corchetes]; q para parar (puedes repetir setup cuando quieras)",
  "setup: Enter keeps what is in [brackets]": "setup: Enter conserva lo que hay entre [corchetes]",
  "language of the terminal's text (auto, en or es)": "idioma de los textos del terminal (auto, en o es)",
  "energy unit (kcal or kj)": "unidad de energía (kcal o kj)",
  "body weight unit (kg, lb or st)": "unidad del peso corporal (kg, lb o st)",
  "length unit (cm or inch)": "unidad de longitud (cm o inch)",
  "first day of the week (sunday or monday)": "primer día de la semana (sunday o monday)",
  "meals of the day, separated by commas": "comidas del día, separadas por comas",
  "all set. type help to see what you can do; + <food> logs something, new <food> creates one": "todo listo. escribe help para ver qué puedes hacer; + <alimento> apunta algo, new <alimento> crea uno",
  "goals: goal calories 2000": "objetivos: goal calories 2000",
  "body: weight 70": "cuerpo: weight 70",
  "import a backup: import": "importar una copia: import",
  "your preferences: set lists them, set energy kj, set weight lb, set week monday, set meals breakfast, lunch, dinner, set theme terminal, set sound off. set <name> shows one": "tus preferencias: set las lista, set energy kj, set weight lb, set week monday, set meals breakfast, lunch, dinner, set theme terminal, set sound off. set <nombre> muestra una",
  "the guided questions of the first start: units, first day of the week and meal names. Enter keeps the current value": "las preguntas guiadas del primer arranque: idioma, unidades, primer día de la semana y nombres de las comidas. Enter conserva el valor actual"
});

// ---------------------------------------------------------------------
// Getting started (terminal-onboarding.js)
// ---------------------------------------------------------------------
app.TerminalI18n.add("es", {
  "your profile: height, birth date, sex, activity (only for the plan's formula; every field is optional)": "tu perfil: altura, fecha de nacimiento, sexo, actividad (solo para la fórmula del plan; todos los campos son opcionales)",
  "your weight today (and whatever your scale gives you)": "tu peso de hoy (y lo que te dé la báscula)",
  "a daily calorie goal (or plan lose 0.5 later, to have one worked out from your data)": "un objetivo diario de calorías (o plan lose 0.5 más tarde, para que se calcule a partir de tus datos)",
  "your first food: name, portion and values, asked one at a time": "tu primer alimento: nombre, porción y valores, preguntados uno a uno",
  "log something you ate: + <food> [amount] [@when]": "apunta algo que hayas comido: + <alimento> [cantidad] [@cuándo]",
  "how the areas work: a short tour": "cómo funcionan las carpetas: un recorrido corto",
  "already use Waistline? import your backup": "¿ya usas Waistline? importa tu copia de seguridad",
  "goal calories 2000 sets it from today. plan works one out from your data, and asks before applying it": "goal calories 2000 lo fija desde hoy. plan calcula uno a partir de tus datos y pregunta antes de aplicarlo",
  "daily calories (a number; Enter skips)": "calorías al día (un número; Enter para saltar)",
  "new asks what it needs. search <text> and scan find foods online instead": "new pregunta lo que necesita. search <texto> y scan buscan alimentos en internet",
  "for example + oats 60g   or   + oats 60g @yesterday @08:12": "por ejemplo + oats 60g   o   + oats 60g @yesterday @08:12",
  "what did you eat? (a food you created, and an amount; Enter skips)": "¿qué has comido? (un alimento que hayas creado y una cantidad; Enter para saltar)",
  "all set: everything on the list is done. tour shows it again; help lists every command": "todo listo: has completado la lista. tour la vuelve a mostrar; help lista todos los comandos",
  "to get started ({} of {} done). tap one or type its number; skip what you do not need": "para empezar ({} de {} hechos). toca uno o escribe su número; salta lo que no necesites",
  "nothing here is filled in for you, and no sample data is loaded. demo load adds some if you only want to look around (demo clear removes it)": "aquí no se rellena nada por ti y no se carga ningún dato de ejemplo. demo load añade algunos si solo quieres curiosear (demo clear los quita)",
  "the app is a set of folders. cd goes in, cd .. comes back, ls looks around, and + logs from anywhere": "la app es un conjunto de carpetas. cd entra, cd .. vuelve, ls mira alrededor y + apunta desde cualquier sitio",
  "diary    + oats 60g   logs a meal. edit, mv, rm and undo fix it. today shows the totals": "diary    + oats 60g   apunta una comida. edit, mv, rm y undo la corrigen. today muestra los totales",
  "foods    new, search and scan build your list. changing a food never rewrites past days": "foods    new, search y scan construyen tu lista. cambiar un alimento nunca reescribe días pasados",
  "meals    a saved set: new sandwich = bread 2 slices, cheese 2 slices. then + sandwich": "meals    un conjunto guardado: new sandwich = bread 2 slices, cheese 2 slices. luego + sandwich",
  "recipes  a whole batch logged as one line. new stew yield 4 portions": "recipes  una tanda entera apuntada como una línea. new stew yield 4 portions",
  "body     weight 74.2 fat 18.5 logs measurements. odd values are pointed out, never changed": "body     weight 74.2 fat 18.5 apunta medidas. los valores raros se señalan, nunca se cambian",
  "goals    goal calories 2100, and plan lose 0.5 to work out what to eat": "goals    goal calories 2100, y plan lose 0.5 para calcular qué comer",
  "stats    stats weight 90d draws a chart. a gap stays a gap": "stats    stats weight 90d dibuja una gráfica. un hueco sigue siendo un hueco",
  "settings set lists units, meal names, theme and language. export saves a backup": "settings set lista unidades, nombres de comidas, tema e idioma. export guarda una copia de seguridad",
  "help lists every command, help <command> explains one, and tour brings the checklist back": "help lista todos los comandos, help <comando> explica uno, y tour trae de vuelta la lista",
  "preferences saved. change them any time with set": "preferencias guardadas. cámbialas cuando quieras con set",
  "getting started: {} of {} done": "primeros pasos: {} de {} hechos",
  "the getting-started checklist: your profile, weight, goal, first food and first meal, each one guided. tour areas is a short explanation of the folders": "la lista de primeros pasos: tu perfil, peso, objetivo, primer alimento y primera comida, cada uno guiado. tour areas es una explicación corta de las carpetas"
});
