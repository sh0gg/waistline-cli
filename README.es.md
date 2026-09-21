# waistline-cli

**Un diario de comida y peso que se maneja escribiendo comandos, como una terminal. Todo se queda en tu móvil.**

waistline-cli es una app de Android: la abres, ves un prompt (`~/diary $`) y escribes. Sin menús, sin pestañas, sin cuenta, sin nube.
Es un fork de [Waistline](https://github.com/davidhealey/waistline), de David Healey, creado por **sh0gg**, en el que las pantallas
gráficas se sustituyeron por una terminal. Ambos son software libre bajo la GPLv3.

[Read in English](README.md) · README de Waistline original: [README.waistline.md](README.waistline.md)

> **Estado: 0.1.1, versión temprana.** La 0.1.0 se comprobó en un móvil Android real (escaneo, exportación e importación,
> recordatorio e icono). La 0.1.1 trae de serie los campos de la báscula (músculo, agua, hueso, bmr) y calcula el gasto del día con
> la actividad de tu reloj más el bmr de tu báscula; se comprobó en un navegador y con las pruebas automáticas, todavía no en un
> móvil. Habrá aristas: haz copias de seguridad (`export`).

## Ideas que lo definen

1. **Nada se estima ni se rellena.** Lo que dejas en blanco queda vacío. Las gráficas no dibujan línea a través de días sin dato y
   ningún promedio los cuenta. Las estimaciones (`plan`, proyecciones) solo avisan y siempre se rotulan como tales.
2. **Lo pasado no se reescribe.** Cambiar un alimento crea una versión nueva; los días ya apuntados conservan la anterior. Los
   objetivos tienen fecha de entrada en vigor.
3. **Tus datos son tuyos.** Base de datos local, una copia de seguridad que guardas donde quieras, y puedes importar copias de la
   Waistline original.
4. **Rápido de escribir.** Una línea registra una comida; el autocompletado fantasma, el historial y el botón `⇥` hacen el resto.
5. **Sin datos de partida.** Una instalación nueva está vacía, objetivos incluidos. `tour` te guía por lo que conviene introducir.

## Qué puedes hacer

| Área | Para qué sirve |
|---|---|
| `~/diary` | apuntar comidas en una línea (`+ oats 60g`), corregirlas (`edit`, `mv`, `rm`, `undo`), ver totales y balance |
| `~/foods`, `~/meals`, `~/recipes` | tus alimentos (con versiones), comidas guardadas y recetas; buscar en Open Food Facts o `scan` de código de barras |
| `~/body` | peso y lo que dé tu báscula, con avisos de valores que parecen erratas |
| `~/goals`, `plan` | objetivos con historial y un plan (`plan lose 0.5`) calculado con tus propios datos, fuente por fuente |
| `~/stats` | gráficas dibujadas dentro de la terminal: peso, grasa, ingesta, proteína, balance, proyecciones |
| `~/settings` | unidades, nombres de comidas, temas, idioma, recordatorio para pesarte |
| `export` / `import` | copia completa, CSV y restauración (también de la Waistline original) |

Los comandos siguen en inglés a propósito; el texto de alrededor se traduce con `set lang es`. `set reminder 07:00` programa un
aviso diario para pesarte. `help` lista todo; `tour` es un comienzo guiado.

## Cómo empezar

1. Instala el APK (ver abajo) y ábrelo. Responde las preguntas de preferencias y sigue la lista guiada de `tour`.
2. Apunta tu primera comida: `+ oats 60g`. Mira cómo vas con `today`.
3. Cuando algo no te salga, busca en el **[manual de uso](docs/MANUAL.es.md)** ([English](docs/MANUAL.md)): explica cada
   comando con ejemplos y casos de uso (productos escaneados y sus porciones, repartir una pizza en trozos, `burned` o
   `active` del reloj, cenas que caen en *snacks*, pasar de Waistline oficial...) y una tabla de trampas frecuentes.
4. ¿Vienes de Waistline? Exporta una copia con la app oficial y usa `import` (§9 del manual).

## Instalar

Descarga el APK de la página de [Releases](../../releases), comprueba su SHA-256 y permite «instalar apps desconocidas» a tu
navegador o gestor de archivos. Necesita Android 5.0 o superior. Como el APK va firmado con la clave del autor y no está en ninguna
tienda, Android puede avisar de que la app es de un desarrollador desconocido.

## Compilarlo

```
npm install
npx cordova platform add android
npx cordova build android           # APK de depuración
node tests/terminal/run.js          # comprobaciones de la lógica del terminal
```

Hace falta Node.js, JDK 17, el SDK de Android (plataforma 36, build-tools 36) y Gradle 8.14. Para la versión de navegador:
`npx cordova platform add browser && npx cordova run browser --port=8000`.

## Hoja de ruta

Más integraciones (Health Connect primero, para que relojes y básculas de muchas marcas alimenten el diario), más idiomas,
más pruebas y llegar a F-Droid.

## Créditos y licencia

Waistline es de [David Healey](https://github.com/davidhealey) y sus colaboradores; waistline-cli es un fork creado por **sh0gg**.
Los datos de alimentos vienen de [Open Food Facts](https://world.openfoodfacts.org). La tipografía es JetBrains Mono (SIL OFL).
Bajo la **GNU General Public License v3.0 o posterior**, como el original: ver las cabeceras de licencia y `www/LICENSE.txt`.
