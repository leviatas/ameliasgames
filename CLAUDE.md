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
  4. `-channel A -evaluate subtract 12% +channel -trim +repage` (limpia artefactos)
  5. re-crop por caja de alfa ≥45% (`-alpha extract -threshold 45% -trim` → `-crop`)
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
