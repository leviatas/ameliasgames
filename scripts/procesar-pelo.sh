#!/usr/bin/env bash
# Post-proceso de los sprites de pelo del Vestidor (ImageMagick 6).
#
#   scripts/procesar-pelo.sh frente entrada.png colitas_frente
#   scripts/procesar-pelo.sh atras  entrada.png colitas_atras
#
# La diferencia entre las dos capas: la de frente lleva el hueco de la cara, que
# suele quedar como una zona blanca *encerrada* por el flequillo y los mechones,
# donde el floodfill desde la esquina no llega. Ojo: NO se puede resolver con
# `-transparent white`, porque los brillos del pelo (#F0F0F0, ver
# docs/prompts-pelo.md) caen dentro del fuzz y se agujerean. En vez de eso se
# busca el blob blanco encerrado más grande y se hace floodfill desde su centro.
set -euo pipefail

capa=${1:?falta la capa: frente | atras}
src=${2:?falta el png de entrada}
name=${3:?falta el nombre de salida (sin .png)}
[ "$capa" = frente ] || [ "$capa" = atras ] || { echo "capa desconocida: $capa (frente | atras)" >&2; exit 1; }

out_dir="$(dirname "$0")/../public/assets/vestidor/pelo"
mkdir -p "$out_dir"
out="$out_dir/$name.png"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# 1) recorte sobre el blanco + fondo exterior transparente
convert "$src" -fuzz 7% -trim +repage \
  -alpha set -bordercolor white -border 1 -fill none \
  -draw 'matte 0,0 floodfill' -shave 1x1 "$tmp/a.png"

# 2) la de frente: agujerear el hueco de la cara si quedó blanco encerrado.
#    Se detecta a fuzz 4% (sólo blanco casi puro, así los brillos no entran) y
#    recién ahí se hace floodfill, que al ser contiguo no puede saltar al pelo.
if [ "$capa" = frente ]; then
  seed=$(convert "$tmp/a.png" -background black -alpha remove -alpha off -colorspace gray \
           -fuzz 4% -fill white -opaque white -fill black +opaque white -threshold 50% \
           -define connected-components:verbose=true \
           -define connected-components:area-threshold=100 \
           -connected-components 8 null: 2>/dev/null \
         | awk '/srgb\(255,255,255\)/ { if ($4+0 > max) { max = $4+0; c = $3 } } END { if (c) print c }')
  if [ -n "$seed" ]; then
    x=${seed%%,*}; y=${seed##*,}
    # fuzz bajo a propósito: si un brillo del pelo (#E8E8E8) toca el hueco de la
    # cara, con fuzz alto el floodfill se lo lleva puesto
    convert "$tmp/a.png" -alpha set -fuzz 4% -fill none \
      -draw "matte ${x%.*},${y%.*} floodfill" "$tmp/b.png"
    echo "hueco de la cara: floodfill en ${x%.*},${y%.*}"
  else
    cp "$tmp/a.png" "$tmp/b.png"
    echo "sin hueco encerrado (el flequillo abre hacia abajo): nada que agujerear"
  fi
else
  cp "$tmp/a.png" "$tmp/b.png"
fi

# 3) escala, limpieza de halos y recuperación de la opacidad.
#    El -evaluate subtract deja TODO translúcido; el -level se la devuelve a las
#    zonas sólidas sin revivir los halos (mismo paso que la ropa, ver CLAUDE.md).
convert "$tmp/b.png" -resize '700x700>' \
  -channel A -evaluate subtract 12% +channel \
  -channel A -level 0%,88% +channel -trim +repage \
  "$out"

max=$(convert "$out" -alpha extract -format '%[fx:maxima*255]' info:)
echo "$out  →  $(identify -format '%wx%h' "$out")  alfa máx: $max"
[ "$max" = "255" ] || { echo "⚠️  el alfa máximo no es 255: el pelo va a quedar translúcido" >&2; exit 1; }
