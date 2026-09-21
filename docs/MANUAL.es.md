# waistline-cli — manual de uso

> waistline-cli es un fork de [Waistline](https://github.com/davidhealey/waistline) (de David Healey) creado por **sh0gg**. Ambos son software libre bajo GPLv3.
> [Read in English](MANUAL.md) · [Volver al README](../README.es.md)

Este manual explica cómo usar la app, con casos de uso, y cómo trabajar en el código. Versión de referencia: **0.1.1** (los campos de báscula de serie y el gasto con `active` en `stats` llegan en esta versión).
Dentro de la app, `help` lista los comandos y `tour` te guía en los primeros pasos.

**Índice:** [1. Qué es](#1-qué-es) · [2. Primer arranque](#2-primer-arranque) · [3. Moverse](#3-moverse-carpetas-y-shell) ·
[4. Diario](#4-diario-de-comidas) · [5. Alimentos, comidas y recetas](#5-alimentos-comidas-guardadas-y-recetas) ·
[6. Medidas corporales](#6-medidas-corporales-body) · [7. Objetivos y plan](#7-objetivos-perfil-y-plan) ·
[8. Estadísticas](#8-estadísticas-stats) · [9. Copia de seguridad](#9-copia-de-seguridad) ·
[10. Ajustes](#10-ajustes-idioma-temas-y-recordatorio) · [11. Datos de muestra](#11-datos-de-muestra) ·
[12. Cómo se guardan los datos](#12-cómo-se-guardan-los-datos) · [13. Trabajar en el código](#13-trabajar-en-el-código) ·
[14. Casos y trampas frecuentes](#14-casos-y-trampas-frecuentes) · [15. Límites](#15-límites-y-pendientes)

---

## 1. Qué es

Un diario de comida y peso para Android que se maneja **escribiendo comandos**. Al abrirlo ves un prompt (`~/diary $`) y
escribes. Sin menús, sin pestañas, sin cuenta, sin nube: todo se guarda en el móvil.

Los comandos y opciones están **siempre en inglés**; el texto de alrededor puede verse en español (`set lang es`).

### Cuatro reglas que explican todo

1. **Nada se estima ni se rellena.** Lo que dejas en blanco queda vacío. Las gráficas no unen días sin dato. Las
   estimaciones (`plan`, `stats project`) solo orientan y siempre se rotulan como tales.
2. **Lo pasado no se reescribe.** Cambiar un alimento o receta crea una **versión nueva**; los días ya registrados
   conservan la anterior. Los objetivos tienen fecha de entrada en vigor.
3. **Tus datos son tuyos.** Todo local. La copia de seguridad es un archivo que guardas tú.
4. **Rápido de teclear.** Autocompletado fantasma, historial y un botón `⇥`.

---

## 2. Primer arranque

1. Salen unas preguntas de preferencias (`setup`): unidades, primer día de la semana, nombres de comidas.
2. Después aparece la lista guiada `tour`: perfil, peso, objetivo de calorías, primer alimento, primera comida,
   recordatorio, el gasto de tu reloj (si tienes uno) y un recorrido por las carpetas. Cada punto ejecuta el comando real y se marca `[x]` mirando lo que hay
   **guardado**, no lo que dices. `tour` la vuelve a mostrar.
3. Una instalación nueva **empieza vacía**, también sin objetivos.
4. ¿Ya usabas Waistline? Haz una copia con la app oficial y usa `import` (ver §9).
5. ¿Solo quieres verla funcionar? `demo load` (30 días de datos) y `demo clear` para quitarlo.

---

## 3. Moverse: carpetas y shell

| Carpeta | Contenido |
|---|---|
| `~/diary/<fecha>` | el registro, una carpeta por día |
| `~/foods` | tu lista de alimentos |
| `~/meals` | comidas guardadas (plantillas) |
| `~/recipes` | recetas (una sola línea en el diario) |
| `~/body` | medidas corporales |
| `~/goals` | objetivos y perfil |
| `~/stats` | números en el tiempo, con gráficas |
| `~/settings` | preferencias |

```
cd diary               cd ..                 cd ~
cd diary/2026-09-18    cd diary/yesterday    cd ~/diary/today
pwd    ls    help [comando]    clear    reset
```

- Las rutas son relativas, como en una shell: desde `~/foods` hay que escribir `cd ~/diary/today`.
- Las líneas de `ls` **se pueden tocar** (abren el día, el objetivo, etc.).
- **Tab, `→` o el botón `⇥`** aceptan el autocompletado fantasma. Las flechas recorren el historial.
- `clear` limpia la pantalla. `reset` limpia también el historial, vuelve a `~` y sale de cualquier pregunta. El botón ⟳
  de arriba a la derecha hace lo mismo y nunca borra datos.
- `q` cancela una pregunta guiada.

### `edit`, `rm`, `cat`, `ls` y `new` dependen de dónde estés

Cambian de significado según la carpeta: en un día actúan sobre **entradas**; en `~/foods`, sobre **alimentos**; en
`~/meals`, sobre plantillas; en `~/recipes`, sobre recetas. Desde `~` no saben qué quieres y te dicen
*«ve primero a un día, p. ej. cd diary/today»*. Solución: entra antes en la carpeta que toca.

En cambio `+` (registrar) funciona **desde cualquier carpeta**.

---

## 4. Diario de comidas

```
+ oats 60g                    # registrar
+ oats 60g @yesterday @08:12  # otro día y hora
+ sandwich @dinner            # en una comida concreta
+ kcal 650 "pizza"            # quick add: calorías sueltas, sin alimento
today                         # totales de hoy: energía, balance contra objetivo, macros
cat 3                         # detalle nutricional de la entrada 3
edit 3 80g                    # cambiar cantidad
edit 3 kcal 800 "otra"        # cambiar un quick add
mv 3 4 @dinner                # mover entradas de comida / hora / día
rm 3 4                        # borrar
undo                          # deshacer (repetible; una plantilla se deshace entera)
```

### Cantidades

| Escribes | Significa |
|---|---|
| `60g`, `1.5kg`, `200ml` | esa cantidad (se convierte a g/ml) |
| `0.5`, `2x`, `1/2`, `5/6`, `0,5` | veces la **porción** del alimento (cualquier fracción `a/b`) |
| `1 bag`, `2 slices` | ración con nombre del alimento |

**Trampa:** un número **sin unidad** multiplica la porción del alimento. `+ oats 60` con porción de 100 g son 6000 g.
La app lo avisa (*«that is 6000g. for grams write 60g»*) y `undo` lo quita.

### Etiquetas `@` (cuándo)

`@08:12` (hora), `@yesterday`, `@today`, `@2026-09-18` (día), `@lunch` (comida). Se combinan en cualquier orden.

**Si no dices la comida, se elige por la hora a la que registras:**

| Hora | Comida |
|---|---|
| antes de las 11:00 | breakfast |
| hasta las 16:00 | lunch |
| hasta las 21:00 | dinner |
| después | snacks |

Por eso una cena a las 22:30 acaba en *snacks*. Se evita escribiendo la comida: `+ pizza 5/6 @dinner`; o, si ya está
registrada, entrando en el día y usando `mv <n> @dinner`. Los nombres de comida son los de tus ajustes (`set meals`).

### Caso de uso: apuntar un día olvidado

```
cd diary/yesterday
+ tostadas 2 slices @08:30
+ kcal 700 "cena fuera" @dinner
today
```

---

## 5. Alimentos, comidas guardadas y recetas

### Alimentos (`~/foods`)

```
new "chicken stew" 350g kcal 420 fat 18 carb 30 protein 25
new "arroz blanco" 100g kcal 350 carb 77 protein 7 serving bag=125g
new guiso                  # sin el resto: pregunta campo a campo (q cancela)
search yogur               # busca en Open Food Facts y añade a tus alimentos
scan                       # cámara del móvil; en el navegador, escribes el código
scan 8410000000000
cat arroz                  # ver valores y raciones
```

Palabras: `kcal kj fat sat carb sugar fiber protein salt sodium brand barcode serving`.
**Los valores son por la porción que escribes.** `serving bag=125g` permite `+ arroz 1 bag`.

**Cambiar un alimento sin tocar el pasado** (estando en `~/foods`):

- `edit pizza kcal 900` → **versión nueva**; la anterior se archiva. Los días ya registrados no cambian.
- Nombre, marca y ración con nombre se cambian en el sitio.
- `edit pizza per 125g` expresa el *mismo* alimento por otra porción y reescala los valores. No crea versión y los días
  ya registrados dan lo mismo.
- `edit pizza 125g` sin valores **se rechaza** (falsearía las kcal).
- `rm pizza` **archiva**, no borra.
- `scan` de un producto que ya tienes lo compara con Open Food Facts y, si cambió, ofrece guardar versión nueva.

### Productos escaneados o buscados: su porción

Un producto de Open Food Facts se guarda normalmente **por 100 g** (o 100 ml), con la unidad `g`/`ml`. Míralo con
`cat <producto>`: la línea `per ...` dice a qué porción se refieren los valores.

Eso condiciona cómo escribes cantidades:

| Quieres | Escribe |
|---|---|
| un peso concreto | `+ yogur 125g` |
| una fracción **de la porción guardada** | `+ yogur 0.5` (medio de 100 g = 50 g) |
| una ración con nombre | `+ yogur 1 pot` (hay que crearla antes, ver abajo) |

Crear una ración con nombre para un producto (solo con unidad `g`/`ml`, y medida en esa misma unidad):

```
cd foods
edit yogur serving pot=125g
+ yogur 1 pot
+ yogur 0.5 pot
```

Cambiar la ración con nombre **no crea versión** ni toca lo ya registrado. Al importar de Open Food Facts la ración con
nombre no se rellena sola: se pone a mano así.

### Caso de uso: una pizza de 350 g que se reparte en 6 trozos, de la que comes 5

El producto está por 100 g, así que `+ pizza 5/6` daría 5/6 de **100 g** (error). Dos formas correctas:

**A. Reescalar el alimento a la pizza entera (recomendado).** Es el mismo alimento visto por otra porción:

```
cd foods
edit pizza per 350g       # 250 kcal por 100 g pasan a 875 kcal por 350 g; sin versión nueva
cd ..
+ pizza 5/6 @dinner       # 5/6 de 350 g = 291,7 g → 729 kcal, exacto
```

**B. Registrar por trozos.**

```
edit pizza serving slice=58.333333g     # 350/6 con decimales suficientes para que el error sea despreciable
+ pizza 5 slices @dinner
```

**Si ya la habías registrado mal:** entra en el día, mira el número con `ls` y corrige, **después** de `per 350g`:

```
cd ~/diary/today
ls
edit <n> 5/6
mv <n> @dinner            # si cayó en snacks
```

Tras registrar, la app puede mostrar `×0.8` (es el redondeo de 0,8333) y un aviso *«that is 291.7g. for grams write
0.8g»*. Es una sugerencia genérica para números sin unidad: con una fracción no aplica, ignórala (ver §14).

### Comidas guardadas (`~/meals`)

Registran **varias entradas de golpe**; cada ingrediente queda como entrada propia.

```
new sandwich = white bread 2 slices, gouda 2 slices, mayonnaise 10g
+ sandwich
+ sandwich 2x @yesterday @13:15
```

Guardan **nombres**, no ids: usan la versión vigente de cada alimento al registrarse.

### Recetas (`~/recipes`)

Una receta es **una sola cosa** y **una sola línea** del diario, con los valores de la tanda entera y su rendimiento.
**Siempre pregunta cuánto rinde** si no pones `yield`.

```
new sandwich = white bread 2 slices, gouda 2 slices, yield 1 portion     # desde ingredientes
new "lentil stew" yield 4 portions kcal 1600 fat 60 carb 200 protein 90  # desde valores de fuera
save 3 4 5 as sandwich                                                   # desde entradas de un día
cp sandwich ~/recipes                                                    # plantilla → receta (y `cp x ~/meals`)
+ stew            # 1 ración
+ stew 2          # 2 raciones (no dos tandas)
+ soup 300g       # receta por peso: pide cantidad (o + soup 0.25 = un cuarto)
refresh stew      # recalcular con los alimentos actuales → versión nueva
```

Los valores **se congelan al guardar**. Si hay plantilla y receta con el mismo nombre, `+` te deja elegir.
Limitaciones: no hay recetas dentro de recetas, y un quick add no puede ser ingrediente.

### Caso de uso: cocinar una tanda y comerla varios días

1. `new "lentil stew" = lentils 400g, chorizo 150g, carrot 200g, yield 4 portions`
2. Lunes: `+ stew` · martes: `+ stew` · miércoles: `+ stew 2`
3. Si cambias de marca de lentejas: `refresh stew`. Lo ya comido conserva sus valores.

---

## 6. Medidas corporales (`~/body`)

**Regla: solo se guarda lo que tú escribes.**

```
weight                         # guiado: Enter = dejar vacío, - = borrar, q = cancelar
weight 74.2 fat 18.5 water 55  # todo de una vez
weight 163lb @yesterday        # con unidad y otro día
ls                             # últimos 14 días (tocar un día lo abre)
ls weight                      # historial de un campo con el cambio entre medidas
rm 2026-09-18 water            # quitar una medida (undo la recupera)
fields    field show "body fat"    field add water %    field hide "body fat"
```

- **De serie** se preguntan `weight`, `body fat`, `muscle`, `water`, `bone` (los tres últimos y `body fat` en %) y `bmr` (kcal),
  que es lo que suelen dar las básculas de bioimpedancia. `neck`, `waist` y `hips` (cinta) existen pero están ocultos.
  `fields` los lista, `field show <nombre>` / `field hide <nombre>` cambian cuáles se preguntan y `field add <nombre> [unidad]`
  crea uno nuevo. Ocultar un campo **no borra** sus valores. En una instalación anterior a la 0.1.1 los que faltan se añaden
  solos al actualizar, sin tocar tus valores ni lo que hubieras ocultado.
- **Avisos de posibles errores** antes de guardar: valores fuera de rango (peso 25–300 kg, %, BMR 700–4500), saltos de
  más de 1,5 kg de un día a otro, grasa + músculo + huesos > 100 %, agua incoherente, BMR fuera de 14–34 kcal/kg.
  Decides tú: `y` mantiene, otro valor lo cambia, Enter lo deja vacío. Un `742` por `74.2` se **sugiere pero no se aplica**.
- El peso del día aparece en `today`, con el cambio semanal `74.2 kg (-0.8 wk)` si hay medida de 5 a 9 días antes.

### El gasto de tu reloj: `burned` o `active`

No hay conexión automática con relojes: el gasto lo anotas tú, en un campo propio. Hay dos posibles y **no son lo mismo**:

| Campo | Qué es | Crear |
|---|---|---|
| `burned` | gasto **total** del día (basal + actividad) | `field add burned kcal` |
| `active` | solo la **actividad** (necesita el `bmr` de la báscula del mismo día para dar un total) | `field add active kcal` |

**¿Cuál es el tuyo?** Depende de cómo rotule el reloj su número. El gasto total incluye el metabolismo basal (unas 60–90
kcal por hora incluso en reposo, 1.400–2.200 kcal al día); las activas solo suben cuando te mueves. Dos comprobaciones:

1. Mira el número a primera hora de la mañana, sin haberte movido: si ya marca cientos, es total; si casi 0, es activa.
2. Compáralo con el BMR de tu báscula: un total no puede ser menor que el basal.

**No anotes el campo equivocado.** Unas activas metidas como `burned` hacen que `plan` crea que gastas mucho menos de lo real.

`tour` te lo ofrece y te explica la diferencia. Cómo anotarlo:

```
field add active kcal
weight active 802             # hoy
weight active 802 @yesterday  # otro día
```

- **Anota el día ya cerrado.** El número del reloj sube durante el día; guarda el total de un día terminado (por la
  noche o con `@yesterday`), no una lectura a medias.
- Con un solo día de datos no se rompe nada: `plan` solo usa `watch` desde 3 días y las gráficas dejan huecos. Los
  avisos aceptan `active` entre 10 y 3.500 kcal y `burned` entre 700 y 4.500.
- **`stats` usa uno u otro, nunca los mezcla:** con `burned`, el gasto es ese número; sin él, con `active`, el gasto de un
  día es `bmr + active` **del mismo día**. Un día sin `bmr` (o sin `active`) queda vacío, no se rellena con otro día. El
  panel, `stats energy`, `stats balance` y `stats weeks` dicen de cuál de los dos salen.

---

## 7. Objetivos, perfil y plan

### Objetivos (`~/goals`)

Con **versiones por fecha**: cada una vale desde su día. `goal` siempre empieza **hoy o después**.

```
ls                     # objetivos de hoy
goal calories 2100     # nueva versión desde hoy
goal protein 120 min   # mínimo en vez de máximo (max lo quita)
goal fat 30 pct        # 30 % de la energía
goal calories 2000 2000 2000 2000 2000 2300 2300   # uno por día de la semana
goal calories 2200 @2026-10-01                     # desde una fecha futura
goal calories none     # quitar
goal weight 70         # peso objetivo (lo usan plan y stats project)
cat calories           # todas sus versiones, con "← now"
undo
```

### Perfil

`profile` guarda altura, fecha de nacimiento, sexo y nivel de actividad. Es opcional y solo alimenta la fuente `formula`
de `plan`. `help profile` muestra los valores admitidos.

### El plan (`plan`)

Una **estimación** de gasto y de qué comer. Muestra cada fuente **por separado**, sin mezclar:

| Fuente | Origen |
|---|---|
| `watch` | media del gasto que anotaste, mín. 3 días de los últimos 14: `burned` tal cual, o `active` sumado al BMR de la báscula |
| `scale` | BMR de la báscula × actividad |
| `data` | ingesta media y tendencia de peso de 3 semanas (requiere 5 pesajes en 10+ días y 10 días de ingesta) |
| `formula` | Mifflin-St Jeor con altura, edad y sexo × actividad |

```
plan                              # situación y fuentes
plan lose 0.5                     # bajar 0,5 kg/semana (déficit ≈ 550 kcal/día)
plan lose 0.5 move 200 protein    # 200 kcal del déficit salen de moverte; sugiere proteína
plan lose 0.5 from watch          # calcular sobre otra fuente
plan maintain    plan gain 0.25
plan apply                        # lo pone como objetivo, TRAS PREGUNTAR (undo lo deshace)
```

Avisa si el ritmo pasa del 1 % del peso a la semana, si el déficit supera un cuarto del gasto o si comer eso queda bajo
tu BMR o 1.200 kcal. **No ofrece bajar de peso con IMC < 18,5.**

### Caso de uso: empezar a bajar de peso

1. `profile ...` y `weight` (varios días, mejor con `fat`).
2. Si tienes reloj: `field add burned kcal` o `field add active kcal` (ver §6) y anótalo cada día cerrado.
3. Registra comida ~2 semanas (un día solo cuenta desde 1.000 kcal).
4. `plan` → mira qué fuentes están disponibles y si se contradicen.
5. `plan lose 0.5` → `plan apply` para fijarlo como objetivo.
6. Cada semana: `stats weeks 4` y `stats weight 30d`.

---

## 8. Estadísticas (`~/stats`)

Gráficas SVG dentro del terminal, sin librerías. Rango por defecto `30d`; también `7d`, `12w`, `6m`, `all`.

```
stats                    # panel con mini-gráficas (tocar una fila abre su gráfica)
stats weight 90d         # también fat, muscle, water, bmr, burned, active o campos propios
stats intake             # ingesta en barras con línea de objetivo
stats protein
stats energy             # ingesta vs gasto (burned, o bmr + active)
stats balance            # ingesta − gasto (verde = déficit, rojo = superávit)
stats composition        # masa grasa y magra en kg
stats weeks 8            # tabla semanal
stats top protein 14d    # qué alimentos aportan más (kcal o protein)
stats project lose 0.5   # proyección (siempre "estimación")
```

**Un hueco es un hueco:** no se dibuja línea por días sin dato y ningún promedio los cuenta (la media de 7 días exige 3
lecturas; hoy se dibuja apagado). Lo calculado para mirar no se guarda. La proyección son rectas: sirve como dirección,
no como promesa.

---

## 9. Copia de seguridad

```
export        # copia completa: diario, alimentos, plantillas, recetas y ajustes
export csv    # el diario como hoja de cálculo
import        # selector de archivos → enseña qué hay → pide confirmación
```

- En el móvil, `export` guarda y abre la **hoja de compartir**; `import` abre el selector del sistema.
- Es el **mismo formato que la app oficial**: sirve para traer tus datos de Waistline.
- Claves y contraseñas **se dejan fuera**. El historial del terminal no forma parte.
- **`import` reemplaza TODO.** En el móvil guarda antes `waistline_before_import_<fecha>.json` y pide `y`. Si no puede
  guardar esa copia (o en escritorio) exige escribir `overwrite`. Tras importar se borra `undo`.

### Caso de uso: pasar de Waistline oficial a waistline-cli

1. En la app oficial, exporta una copia de tus datos y guárdala donde la encuentres.
2. Instala waistline-cli (tiene otro identificador de aplicación, así que conviven).
3. `import` → elige el archivo → revisa el resumen → `y`.
4. `ls`, `today` y `stats` para comprobar que está todo.

---

## 10. Ajustes, idioma, temas y recordatorio

```
set                          # lista las preferencias
set energy kj                # kcal | kj
set weight lb                # unidades de peso
set week monday              # primer día de la semana
set meals breakfast, lunch, dinner, snacks   # de 1 a 7 nombres
set sound off
setup                        # las preguntas guiadas del primer arranque
set lang auto|en|es          # solo cambia el texto de alrededor, no los comandos
theme                        # terminal, oled, solarized-dark, solarized-light, monokai, dracula
theme oled
accent pink | accent #ff8800 | accent default
set reminder 07:00           # aviso diario para pesarte (off lo quita; apagado por defecto)
```

Renombrar comidas conserva su posición: las entradas viejas siguen en el mismo grupo. El recordatorio es una notificación
local y **solo suena en el móvil** (en escritorio la hora se guarda y avisa).

---

## 11. Datos de muestra

`demo load` añade alimentos, plantillas, una receta, 30 días de entradas y medidas corporales (con huecos a propósito).
Todo va marcado: `demo clear` quita solo eso y deja tus datos exactamente igual. `demo status` dice qué hay.

---

## 12. Cómo se guardan los datos

- Mismos almacenes de IndexedDB que Waistline: diario, alimentos, plantillas (`meals`), recetas y ajustes.
- Campos añadidos por el terminal: `serving` y `archived` (alimentos), `refs` (plantillas), `demo` (datos de muestra).
- Estado propio del terminal en `localStorage`: `terminal-log` (últimas 300 líneas), `terminal-history`, `terminal-cwd`,
  `terminal-undo`. **No** va en `export`; `reset` lo borra.
- Un fallo al arrancar el terminal deja la app inutilizable (no hay menú de respaldo): la salida es `reset`, el botón ⟳
  o reinstalar. Los datos no se tocan.

---

## 13. Trabajar en el código

### Estructura

```
www/activities/terminal/views/        terminal.html, terminal.css
www/activities/terminal/js/
  terminal.js            shell: rutas, entrada, salida, autocompletado, cd/ls/pwd
  terminal-diary.js      +, edit, mv, rm, cat, undo, today
  terminal-foods.js      new, search, scan, versiones, per
  terminal-meals.js      plantillas
  terminal-recipes.js    new, save, cp, refresh, edit
  terminal-body.js       weight, fields, avisos de errores
  terminal-goals.js      objetivos con versiones y perfil
  terminal-plan.js       plan y plan apply
  terminal-charts.js     sparklines y gráficas SVG
  terminal-stats.js      stats
  terminal-backup.js     export / import
  terminal-settings.js   set, setup
  terminal-themes.js     theme, accent (una entrada más en `themes` = un tema nuevo)
  terminal-onboarding.js tour y primer arranque
  terminal-reminder.js   set reminder
  terminal-demo.js       datos de muestra
  terminal-i18n*.js      traducción al español
tests/terminal/          pruebas de la lógica
```

Los módulos usan `app` como global. Se conservan de Waistline, como librería: `settings.js`, `nutriments.js`,
`body-stats.js`, `foods-categories.js`, `goals.js`, `foods-meals-recipes.js`, `foodlist.js`, `open-food-facts.js`.
Cada fichero lleva la cabecera GPLv3.

### Ejecutar en el navegador

```
npm install && npx cordova platform add browser
npx cordova run browser --port=8000        # http://localhost:8000
npx cordova prepare browser                # tras CADA cambio en www/ (el servidor sirve una copia)
```

- Si ves la app vieja: falta `prepare` o es caché (Ctrl+Shift+R).
- **Base de datos vacía sin borrar nada:** abre otro origen (`http://127.0.0.2:8000`, `.3`, `.4`...).
- Verifica con `demo load` en un origen limpio y comprueba que `demo clear` lo deja exacto.
- Cordova modifica `package.json` al añadir plugins o plataformas; no lo incluyas en tus commits salvo que el cambio sea intencionado.

### Pruebas

```
node tests/terminal/run.js
```

Cubre shell, diario, alimentos, plantillas, raciones, recetas e i18n. Faltan pruebas de `~/body`, `~/goals`, `plan`,
`~/stats` y `export`/`import`. Plantilla: `tests/terminal/recipes.test.js` (carga los ficheros con un `app` simulado).

### Traducción

Las frases se escriben en `tests/terminal/i18n-es.txt` (`inglés == español`, `{}` para lo variable). Luego:

```
node tests/terminal/build-i18n.js     # genera terminal-i18n-es-areas.js y comprueba que cada clave exista en el código
```

Una línea sin traducir sale en inglés y se anota en `app.TerminalI18n.missing` (consola del navegador).

### Compilar el APK

Necesitas Node.js, JDK 17, el Android SDK (platform 36, build-tools 36) y Gradle 8.14, con `JAVA_HOME`, `ANDROID_HOME` y
Gradle en el `PATH`:

```
npx cordova build android
```

Salida: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`. Un APK para publicar debe ir **firmado** con tu propia clave.

---

## 14. Casos y trampas frecuentes

| Situación | Qué pasa / qué hacer |
|---|---|
| `edit` desde `~` dice *«ve primero a un día»* | `edit` depende de la carpeta. `cd foods` para alimentos, `cd diary/today` para entradas |
| Cené a las 22:30 y salió en *snacks* | La comida se elige por la hora. Usa `@dinner` al registrar, o `mv <n> @dinner` en el día |
| `+ oats 60` da 6000 g | Un número sin unidad multiplica la porción. Escribe `60g` (o `undo`) |
| Escaneé un producto por 100 g y `+ prod 5/6` da poco | 5/6 es de la porción guardada. `edit prod per 350g` primero, o usa gramos |
| Sale *«for grams write 0.8g»* al usar una fracción | Es una sugerencia pensada para `+ oats 60`. Con `5/6` o `0.5` no aplica: ignórala. Los datos guardados son correctos |
| Anoté las calorías activas del reloj como `burned` | `plan` subestimará tu gasto. Corrígelo con el campo `active` (§6) |
| Me equivoqué al registrar | `undo` (repetible) |
| La app no arranca o se queda en blanco | El botón ⟳, o `reset`, o reinstalar. No borra tus datos |

---

## 15. Límites y pendientes

- **Integración con relojes y básculas:** aplazada. La vía prevista es Health Connect; hoy el gasto se anota a mano.
- Se quitaron a propósito al sustituir las pantallas: USDA, texto a voz, fotos de alimentos, categorías y etiquetas,
  subida a Open Food Facts, gráfico circular.
- Faltan pruebas automáticas de varias áreas (ver §13), `help` por carpeta y recetas anidadas.
- Las versiones archivadas de alimentos se acumulan (es lo que protege el pasado).
