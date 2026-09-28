# CLAUDE.md — Guía del proyecto

Juego web para chicos (canvas 2D, ES modules, sin framework) servido por un Express
dockerizado. Textos de UI en español rioplatense (voseo: "tocá", "juntá").

## Flujo de deploy (obligatorio en cada cambio)

1. Bumpear la insignia de versión `#app-version` en `public/index.html`
   (`vX.Y.Z`: patch = fix chico, minor = feature/juego nuevo, major = cambio grande).
2. Commit con mensaje `feat:`/`fix:` que termina en `(vX.Y.Z)`.
3. `docker compose up -d --build` (puerto 5173).
4. Verificar: `curl -s http://localhost:5173/ | grep vX.Y.Z`.

## Arquitectura de mini-juegos

Cada juego es una clase en `public/js/<Nombre>.js` con `constructor(canvas, ...)`,
`update(dt)`, `render(ctx)`, `destroy()` y entrada por `pointer(x, y)`.
`game.js` es el orquestador; para registrar un juego nuevo hay que tocar:

- import + variable de estado + caso en `gameLoop()`
- `launchX()` / `exitX()` + limpieza en `showHub()`
- wiring de `pointerdown` (usar `canvasPoint(e)`) y tecla Escape
- botón/tarjeta en `public/index.html` (submenú que corresponda) + overlay
  `#<juego>-ui` con botón `← Menú` (clase `.game-menu-btn`)
- estilo `.hub-card.<juego>` en `public/css/style.css`
- ⚠️ si es 2P: sumar `#<juego>-ui` a las **tres** listas de "2P game UI overlays"
  de `style.css`. Si falta en la del `.hidden`, el overlay nunca se oculta y el
  botón `← Menú` queda flotando invisible sobre el hub robándose los clicks.
- si es un juego de mesa: entrada en `GAME_HELP` (game.js) + botón
  `<button id="<juego>-help" class="game-help-btn">❓</button>` en su overlay; el
  wiring del botón es automático a partir de las claves de `GAME_HELP`.
- ⚠️ si es 2P: además de lo de arriba van `SHARED_BOARD_MODES` (si es tablero
  compartido, para que el toque cuente para quien tiene el turno y no según la
  mitad de pantalla), `ONLINE_GAMES`, `_wireOnlineBtn()` y `ONLINE_EXIT_FNS`, más
  `getNetState()`/`setNetState()` en la clase. Salir de un juego 2P vuelve al
  submenú de 2 Players, no al hub.
- ⚠️ online: **la invitada nunca corre `update()`**, sólo `render()` con el
  estado que le llega. Toda animación tiene que salir del estado sincronizado o
  del reloj (`performance.now()`), nunca de contadores que se acumulen en el
  render. Y `_lerpValue` (game.js) sólo suaviza las claves `x/y/vx/vy/t`: lo que
  se mueve continuo (ángulos, posiciones) conviene mandarlo con esos nombres o
  se ve a 20 fps.

Los layouts se recalculan por frame en un `_layout()` proporcional a
`canvas.width/height` con factor `s = clamp(min(W,H)/720, 0.5, 1)` — nunca
posiciones absolutas.

## Pipeline de arte (sprites PNG generados con IA)

- Assets por juego en `public/assets/<juego>/`, generados con prompts de estilo:
  "Cute children's game 2D illustration, chibi cartoon style, soft cel shading,
  clean thin outlines, warm pastel colors, isolated on plain white background".
- Procesamiento (ImageMagick **6**: usar `-draw 'matte 0,0 floodfill'`, no `alpha`):
  1. `-fuzz 7% -trim +repage` (recorte sobre blanco)
  2. `-alpha set -bordercolor white -border 1 -fill none -draw 'matte 0,0 floodfill' -shave 1x1`
  3. `-resize '700x700>'`
  4. `-channel A -evaluate subtract 12% +channel` (limpia artefactos)
  5. ⚠️ `-channel A -level 0%,88% +channel -trim +repage` — el paso 4 le resta
     12% de alfa a **todos** los píxeles, así que el sprite entero queda
     translúcido; esto le devuelve la opacidad a las zonas sólidas sin revivir
     los halos. Sin este paso se ve el fondo (o el cuerpo, si se apilan capas)
     a través del dibujo. Verificar con
     `convert x.png -alpha extract -format '%[fx:maxima*255]' info:` → 255.
  6. re-crop por caja de alfa ≥45% (`-alpha extract -threshold 45% -trim` → `-crop`)
- En el código: patrón `loadImg(name)` / `ready(img)` con **fallback vectorial o
  emoji** mientras carga (ver `Helado.js` y `Panaderia.js`). Partes animadas van
  en sprites separados (ej.: aspas del molino, gallina) para rotarlas/moverlas
  por código.

## Panadería (`Panaderia.js`) — decisiones de diseño

- **Personaje jugable**: la protagonista camina hasta el objetivo tocado y la
  acción se ejecuta al llegar (`_goTo(x, y, task)` → `_doTask()`), revalidando
  el estado por si un trabajador se adelantó. Sprite `jugadora.png`.
- **Cadena de producción**: semillas (arbusto) → campos (máx **4**, 2×2) →
  molino → harina → horno → productos. Fuentes compradas desbloquean productos:
  gallinero→huevos→torta, cacaotero→chocolate→galletas, vaca (+cacaotero)→
  leche→choco c/leche.
- **`PRODUCTS`** es la tabla extensible: cada producto declara ingredientes
  (`flour/egg/choc/milk`), precio, monedas y `timeMul`. ⚠️ Al agregar un
  ingrediente nuevo hay que descontarlo en `_loadOven()` — este bug ocurrió
  dos veces (chocolate y leche); el test lo atrapa.
- Horno con menú de recetas cuando hay >1 producto desbloqueado; panadero
  automático prioriza lo que espera la fila; pedidos de clientes salen de un
  pool donde el pan pesa doble.
- Trabajadores (granjero/molinero/panadero/vendedor) y mejoras ⭐ (molino/horno,
  estrella junto al nombre). El granjero camina de verdad a sus tareas.
- **Persistencia**: todo en localStorage `panaderia_state`; el botón
  `#panaderia-reset` (con confirm) borra SOLO ese progreso vía `wipeSave()` +
  instancia nueva. La clave también está en la lista del reset global de
  `index.html`.
- Ventas acreditan dinero interno del juego **y** monedas globales (`Wallet.js`).

## Testing

Sin framework: tests simulados en Node contra la clase real, con stubs
(`globalThis.Image`, `localStorage`, `window`), corriendo `update(1/60)` en loop
y `pointer()` sintético. Guardarlos en el scratchpad de la sesión, junto a una
copia del archivo (`node --check` primero). Ojo con el "ruido" de los
trabajadores automáticos en los tests: apagarlos (`g.workers.x = false`) y
frenar spawns (`custSpawnT = 9999`, etc.) para aislar lo que se mide.

## Juegos 3D (Three.js) — Sky Run (`Dash3D.js`)

- En la UI se llama **Sky Run** (para no confundirlo con el Dash 2D de la nena);
  el código, ids DOM (`dash3d-*`) y claves de localStorage siguen como `dash3d`.
- Personajes elegibles en la pantalla de inicio (`CHARACTERS`: nena, Labubu,
  conejito), guardado en `dash3d_hero`. Cada uno se arma en `_build_<id>(rig, mesh, P)`
  con formas de Three.js (sin modelos externos) y expone `legs/arms/head/ears/eyes/hair`
  para la animación genérica de `_updateHero()` (lo que no tiene, queda vacío).
  ⚠️ `this.parts` son las partículas; las del héroe son `this.heroParts`.
- Dificultad (`DIFFICULTIES`: Fácil ×0.5, Normal ×1, Difícil ×2) multiplica la
  velocidad en `_speedAt()`; guardada en `dash3d_diff`, récord separado por
  dificultad (`dash3d_best` = Normal, `dash3d_best_facil`, `dash3d_best_dificil`).
  Cambiarla en la pantalla de inicio llama a `reset()` para regenerar la pista.

- Three.js sale de `node_modules/three` (servido en `/three`) vía el `importmap` de
  `index.html` (`three`, `three/addons/`). El juego se importa **bajo demanda**
  (`await import('./Dash3D.js')` en `launchDash3D()`), así el hub no carga WebGL.
- Crea su propio `<canvas id="dash3d-canvas">` WebGL encima del canvas 2D;
  `render()` ignora `ctx`. `destroy()` libera geometrías/materiales y el contexto.
- Calidad adaptativa: si baja de ~40 fps apaga bloom y luego baja resolución.
- El primer `dt` puede llegar negativo (rAF vs `performance.now()`): clamp a `[0, 0.05]`.
- Verificación visual: Playwright + Chromium con `--use-angle=swiftshader`
  (lento, ~1 fps: simular con `update(1/60)` en loop y sacar capturas).
