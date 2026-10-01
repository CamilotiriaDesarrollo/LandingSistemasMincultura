# Capturas de antes y después

Corte del 30 de septiembre de 2026, chromium 147.0.7727.15.

## `antes/`

Cuatro imágenes, una por tamaño, de la landing antes del plan táctil. Son lo que
veía un teléfono entonces, porque entonces solo había una versión: el mosaico a
dos columnas, el conmutador de 30 px, la barra de accesibilidad flotando y sin
pestaña Mapa.

## `despues/`

Dieciséis imágenes, cuatro por tamaño: la página entera en las tres vistas y una
cuarta con el zócalo flotando a media página, esa sí con la ventana real del
aparato.

| Tamaño | Mosaico | Mapa | Lista |
|---|---|---|---|
| 390x844 | 4.339 px | 2.334 px | 4.743 px |
| 430x932 | 4.132 px | 2.267 px | 4.487 px |
| 768x1024 | 3.658 px | 2.158 px | 3.504 px |
| 1024x768 | 3.551 px | 2.049 px | 3.161 px |

En teléfono el mapa es la vista más corta de las tres, que es lo contrario de lo
que pasaba antes: la rosa no cabía y la pestaña estaba escondida.

## Cómo se toman, y la trampa que hay que conocer

```powershell
$env:PYTHONIOENCODING = "utf-8"
python pruebas\tactil\capturas\tomar.py pruebas\tactil\capturas\despues
```

**Nunca con `full_page=True`.** Está medido: una captura de página completa apaga
la emulación táctil de Chromium durante el disparo. La imagen sale de escritorio
aunque el contexto se haya pedido con `has_touch` e `is_mobile`, y aunque el
estado leído un instante antes diga que es táctil. Después del disparo
`(hover: hover)` se queda en `true` y `(pointer: coarse)` en `false`, con la
ventana en el mismo ancho, y la pestaña siguiente ya no vuelve a ser táctil: si se
pulsa Mapa, la página cae a Lista, que es justo lo que tiene que hacer cuando
aparece un ratón.

Lo que hace `tomar.py` en su lugar: mide el alto del documento con la ventana real
del aparato, reabre con la ventana de ese alto y dispara una captura normal. Eso
da la página entera y conserva la emulación. Cada imagen lleva su contexto propio
y el guion imprime `tactil=True`, `zocalo=True` y `pestanas=3` antes de cada
disparo, para que no haya que creer en la palabra.

Es también la razón de que las cuatro de `antes/` salgan de escritorio: se tomaron
con `full_page=True` antes de saber esto. No se vuelven a tomar porque el código
de entonces ya no está, y en sustancia siguen siendo correctas, porque antes del
plan un teléfono recibía exactamente esa versión.
