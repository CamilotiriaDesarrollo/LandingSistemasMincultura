# Paso 7: Sin desborde horizontal al 200 por ciento de zoom

**Esfuerzo:** bajo
**Depende de:** [3]
**Puede ir en paralelo con:** [10]

## Qué se hace

Cerrar los 52 px de desborde que aparecen a 195 px CSS. La fila del encabezado admite partirse cuando no cabe, con flex-wrap, y el botón 'Explorar ↓' encoge en vez de empujar, retirando el margin-left:auto como único responsable de su posición. Limitar el ancho de la barra flotante al de la ventana para que no salga por la izquierda a 98 px CSS.

## Archivos

- `cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

reflow.py da desborde horizontal 0 a 320, 195 y 160 px CSS, frente a 0, 52 y 87 px de la línea base. A 98 px CSS el borde izquierdo de .accessibility es mayor o igual a 0. Ningún elemento distinto de las tiras con desplazamiento propio excede el ancho de la ventana.