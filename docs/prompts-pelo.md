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
- **Los moños y hebillas van en rosa saturado** `#E84B7A`: `tintHair()` sólo tiñe
  lo desaturado, así que lo que tiene color propio sobrevive al teñido. Un moño
  gris se pintaría del color del pelo y desaparecería.
- **Vista frontal, simétrica**, proporción chibi: la cabeza de la muñeca es casi
  la mitad del cuerpo, así que la peluca tiene que ser grande y redonda.

## Cómo usarlos

Cada bloque de abajo es un prompt **completo**: se copia entero y se pega en el
generador, sin agregarle nada. Los que dicen *(capa de atrás)* son una segunda
imagen del mismo peinado.

Los moños, scrunchies y hebillas van **en rosa saturado `#E84B7A`** a propósito:
el teñido del código sólo toca lo desaturado, así que el pelo cambia de color y
el moño se queda rosa. Si salen grises, se tiñen junto con el pelo.

## Peinados del catálogo

### colitas — Colitas 🎀

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: two low pigtails, one on each side just below ear level, each tied with a small bow, straight blunt bangs across the forehead, the pigtails flare outward and end just below jaw level.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The two bows are the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### corto — Corto ✂️

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: short rounded bob haircut, chin length, straight blunt bangs, soft inward curl at the tips, neat and tidy.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### rodete — Rodete 🍡

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: hair pulled up into one round bun sitting on top of the head, smooth sleek cap, short bangs, tiny wispy strands near the temples.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### largo — Suelto 💁‍♀️

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: long straight hair worn loose, straight blunt bangs, two long front locks framing the face and falling forward past the shoulders.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### largo — Suelto *(capa de atrás)*

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: ONLY THE BACK MASS of a hairstyle — the part that hangs behind the head and body, seen from the front. NO wig cap, NO bangs, NO face opening, NO head, NO face, NO body, NO shoulders. One single continuous silhouette of falling hair.
STYLE: a long straight curtain of hair reaching hip length, widest at the top where it would sit behind the head, softly rounded bottom edge, smooth vertical strand lines.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### trenza — Trenza 🧵

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: one thick braid resting over the right shoulder, chunky clearly visible braid segments, tied with a small bow at the tip, side-swept bangs.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The bow is the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### trenza — Trenza *(capa de atrás)*

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, centered, flat orthographic view.
Subject: ONLY THE BACK MASS of a hairstyle — the part that hangs behind the head and body, seen from the front. NO wig cap, NO bangs, NO face opening, NO head, NO face, NO body, NO shoulders. One single continuous silhouette.
STYLE: a single thick braid hanging straight down to hip length, chunky clearly visible braid segments, tapering toward the tip, tied with a small bow at the bottom.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The bow is the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

## Peinados nuevos

Estos **todavía no están en `HAIR_STYLES`**: se agregan al catálogo recién cuando
tienen su PNG (ver la nota al final).

### dos_trenzas — Trenzas 🧶

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: two thick braids, one hanging over each shoulder, chunky clearly visible braid segments, each tied with a small bow at the tip, straight blunt bangs, perfectly symmetrical.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The two bows are the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### rulos — Rulos 🌀

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: big bouncy ringlet curls, shoulder length, voluminous rounded silhouette, curly bangs, each curl drawn as a clear chunky spiral shape.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### afro — Afro ☁️

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig hugs a big circular head, roughly as wide as it is tall.
STYLE: full round natural afro, big soft cloud-like silhouette clearly wider than the head, tiny coil texture marks all over, no bangs, almost perfectly circular outline.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### ondulado — Ondas 🌊

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: long wavy hair worn loose, soft S-shaped waves, middle part, no bangs, two wavy locks framing the face and falling forward past the shoulders.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### ondulado — Ondas *(capa de atrás)*

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: ONLY THE BACK MASS of a hairstyle — the part that hangs behind the head and body, seen from the front. NO wig cap, NO bangs, NO face opening, NO head, NO face, NO body, NO shoulders. One single continuous silhouette of falling hair.
STYLE: a long wavy curtain of hair reaching hip length, soft S-shaped waves along both edges, widest at the top, scalloped wavy bottom edge.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### colita_alta — Colita alta 🎽

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: high ponytail tied at the top back of the head with a scrunchie, smooth sleek pulled-back cap, short bangs; only the base and the very top of the ponytail peek above the head.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The scrunchie is the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### colita_alta — Colita alta *(capa de atrás)*

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, centered, flat orthographic view.
Subject: ONLY THE BACK MASS of a hairstyle — the part that hangs behind the head and body, seen from the front. NO wig cap, NO bangs, NO face opening, NO head, NO face, NO body, NO shoulders. One single continuous silhouette.
STYLE: one long ponytail hanging down from a gathered point at the very top, sweeping down and slightly to one side, flaring out in the middle and tapering to a soft pointed tip.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### media_cola — Media cola 🦋

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: half-up hairstyle, the top half gathered into a small clip at the back of the head, the rest falling loose to shoulder length, soft side-swept bangs.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). The clip is the only colored element: saturated pink #E84B7A.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### rodetes — Rodetes 🍡🍡

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: two round space buns, one on each side of the top of the head, a small loose strand hanging beside each bun, straight blunt bangs, perfectly symmetrical.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### hime — Princesa 👑

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: hime cut — straight blunt bangs and two shorter perfectly straight side locks cut sharply at cheek level, glossy and neat, the rest of the hair very long and straight.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### hime — Princesa *(capa de atrás)*

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: ONLY THE BACK MASS of a hairstyle — the part that hangs behind the head and body, seen from the front. NO wig cap, NO bangs, NO face opening, NO head, NO face, NO body, NO shoulders. One single continuous silhouette of falling hair.
STYLE: a very long perfectly straight curtain of hair reaching hip length, glossy, straight blunt horizontal bottom edge, smooth vertical strand lines.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### pixie — Pixie ✨

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: very short pixie cut hugging the head, textured spiky tips, wispy side-swept bangs, playful tomboy look.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
```

### mono_alto — Moñito 🎀

```
Cute children's game 2D illustration, chibi cartoon style, soft cel shading, clean thin outlines, isolated on plain white background. Front view, perfectly symmetrical, centered, flat orthographic view.
Subject: a WIG ONLY — a hairstyle floating on an invisible head. NO face, NO eyes, NO mouth, NO skin, NO ears, NO neck, NO body, NO mannequin head, NO wig stand. The inner opening where the face would be is pure empty white.
Proportions for a chibi doll with a very large round head: the wig cap hugs a big circular head, roughly as wide as it is tall.
STYLE: hair gathered on top of the head into a big bun shaped like a bow, made of hair itself, smooth sleek cap below it, short bangs, cute idol look.
Hair colored neutral silver grey: #C8C8C8 base, #9C9C9C shadows, #E8E8E8 soft highlights, dark warm brown outlines (#5A4034). No other colors.
Plain pure white background, no drop shadow, no gradient, no props, no text.
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
