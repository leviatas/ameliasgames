# Prompts de pelo para el Vestidor

Sprites para reemplazar el pelo vectorial (`hairBack`/`hairFront` de `Muneca.js`)
por PNGs, en `public/assets/vestidor/pelo/<id>_frente.png` y `<id>_atras.png`.

## Reglas del set

- **Peluca sola**: sin cara, sin piel, sin orejas, sin cuello, sin maniquí. El
  hueco de la cara queda blanco (se vuelve transparente en el post-proceso).
- **Dos capas** en los peinados largos: `_frente` (casquete + flequillo + mechones
  que caen por delante del hombro) y `_atras` (la melena que va detrás del cuerpo).
  Los peinados cortos usan sólo `_frente`.
- **Color neutro gris plata**, no el color final: el código lo tiñe por multiply
  con los 9 `HAIR_COLORS`, igual que `skinBody()` hace con la piel.
- **Vista frontal, simétrica**, proporción chibi: la cabeza de la muñeca es casi
  la mitad del cuerpo, así que la peluca tiene que ser grande y redonda.

## Bloque base (pegar SIEMPRE al principio)

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading,
clean thin outlines, warm pastel colors, isolated on plain white background.
Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes,
NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand.
The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big
circular head, roughly as wide as it is tall.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft
highlights, dark warm brown outlines (#5A4034). No other colors in the hair.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

Después del bloque base, agregar la línea del peinado.

## Peinados

### Ya en el catálogo (`HAIR_STYLES`)

| id | archivo(s) | línea del prompt |
|---|---|---|
| `colitas` | frente + atrás | `Two low pigtails, one on each side, tied with small bows, straight bangs across the forehead, the pigtails flare outward and end just below the jaw line.` |
| `corto` | frente | `Short rounded bob haircut, chin length, straight blunt bangs, soft inward curl at the tips, neat and tidy.` |
| `rodete` | frente | `Hair pulled up into one round bun on top of the head, smooth cap, tiny wispy strands near the temples, short bangs.` |
| `largo` | frente + atrás | `Long straight hair worn loose, falling down past the shoulders to hip length, straight bangs, two front locks framing the face.` |
| `trenza` | frente + atrás | `One thick braid resting over the right shoulder, tied with a small bow at the tip, side-swept bangs, chunky visible braid segments.` |

### Nuevos propuestos

| id sugerido | nombre / emoji | línea del prompt |
|---|---|---|
| `dos_trenzas` | Trenzas 🧶 | `Two thick braids, one over each shoulder, each tied with a small bow at the tip, straight bangs, chunky visible braid segments, symmetrical.` |
| `rulos` | Rulos 🌀 | `Big bouncy ringlet curls, shoulder length, voluminous rounded silhouette, curly bangs, each curl drawn as a clear spiral shape.` |
| `afro` | Afro ☁️ | `Full round natural afro, big soft cloud-like silhouette wider than the head, tiny coil texture marks, no bangs, perfectly round outline.` |
| `ondulado` | Ondas 🌊 | `Long wavy hair worn loose, soft S-shaped waves, waist length, middle part, no bangs, two wavy locks framing the face.` |
| `colita_alta` | Colita alta 🎽 | `High ponytail on top of the back of the head, tied with a scrunchie, the tail falls long behind, smooth pulled-back cap, short bangs.` |
| `media_cola` | Media cola 🦋 | `Half-up hairstyle: top half gathered in a small clip at the back, the rest falling loose to the shoulders, soft side bangs.` |
| `rodetes` | Rodetes 🍡 | `Two round space buns, one on each side of the top of the head, small loose strands hanging beside each bun, straight bangs, symmetrical.` |
| `hime` | Princesa 👑 | `Hime cut: very long straight hair, straight blunt bangs, two shorter straight side locks cut at cheek level, glossy and neat.` |
| `pixie` | Pixie ✨ | `Very short pixie cut, textured spiky tips, wispy side-swept bangs, ears area left open, tomboy look.` |
| `moño_alto` | Moñito 🎀 | `Hair tied up into a big fabric-like bow-shaped bun on top of the head, smooth cap, short bangs, cute idol look.` |

### Variante para la capa de atrás

Cuando el peinado necesita `_atras`, generar una segunda imagen con el bloque base
y esta línea, reemplazando `<descripción>`:

```
Only the BACK MASS of the hairstyle: <descripción de la melena/trenza/colita>,
seen from the front but drawn as the part that hangs BEHIND the head and body.
No wig cap, no bangs, no face opening — just the falling hair mass, a single
silhouette shape, wider at the top and tapering at the bottom.
```

## Post-proceso

Usar el script, que ya hace los dos casos:

```bash
scripts/procesar-pelo.sh frente ~/Descargas/colitas.png colitas_frente
scripts/procesar-pelo.sh atras  ~/Descargas/colitas_atras.png colitas_atras
```

Sale en `public/assets/vestidor/pelo/<nombre>.png` y falla si el alfa máximo no
queda en 255 (o sea, si el sprite quedaría translúcido).

Lo que hace de más que el pipeline de la ropa: en la capa `frente`, el hueco de
la cara suele quedar blanco *encerrado* por el flequillo y los mechones, donde el
floodfill desde la esquina no llega. **No se puede resolver con
`-transparent white`**: los brillos del pelo están a ~6% del blanco, caen dentro
del fuzz y el sprite queda agujereado. El script detecta el blob blanco encerrado
más grande (connected-components a fuzz 4%, así los brillos no cuentan como
blanco) y hace floodfill desde su centro, que al ser contiguo no puede saltar al
pelo.

⚠️ Por eso los brillos van en `#E8E8E8` y **nunca en blanco puro**: si un brillo
toca el hueco de la cara y está demasiado cerca del blanco, el floodfill se lo
lleva puesto.

## Calibración en el código

Cada peinado necesita su fila en `HAIR_ART` (`public/js/Muneca.js`), con
`[ruta, yTop, yBot, xs?]` en fracciones de la altura del cuerpo, igual que
`OUTFIT_ART`:

```js
const HAIR_ART = {
  colitas: { front: ['pelo/colitas_frente', 0.00, 0.46],
             back:  ['pelo/colitas_atras',  0.10, 0.62] },
};
```

Referencias medidas sobre `base/cuerpo.png` (0 = corona, 1 = pies):

- centro de la cabeza `headCy = 0.2153`, radio `headR = 0.2112`
- corona ≈ `0.004`, mentón ≈ `0.43`, hombros `0.4555`
- cadera `0.7412` (hasta dónde llega una melena larga)

Los valores salen de superponer y mirar, no de deducir.

El peinado que no esté en `HAIR_ART` se sigue dibujando vectorial, así que la
tabla puede crecer de a un peinado por vez. Las dos capas salen juntas o
ninguna: si sólo cargó una, se vería mitad PNG y mitad vectorial.

**No agregar peinados nuevos a `HAIR_STYLES` antes de tener sus PNG**: el
dibujo vectorial no conoce los ids nuevos y les pondría a todos el mismo
casquete genérico.
