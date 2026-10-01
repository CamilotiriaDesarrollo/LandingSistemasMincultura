# Paso 4: El enlace de salto deja de tapar el logo

**Esfuerzo:** bajo
**Depende de:** [3]
**Puede ir en paralelo con:** [10]

## Qué se hace

Sacar .saltar del hit test mientras está oculto. Sustituir la técnica de transform más opacity por una que no deje caja tocable: visibility:hidden con pointer-events:none, y devolver visibility:visible con pointer-events:auto en .saltar:focus. Alternativa aceptable: clip-path:inset(50%). El enlace sigue siendo el primer nodo enfocable y sigue viéndose al recibir foco.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

touchscreen.tap en el centro del enlace del logo en 390x844, 430x932 y 768x1024 deja hash en '#inicio'. En 768x1024 el tap sobre el enlace 'Inicio' de la nav navega. elementFromPoint en el rectángulo x=0..135, y=0..70 no devuelve a.saltar en ninguno de los tres tamaños. Con una pulsación de Tab desde la carga, el enlace es el elemento activo, es visible y su área real supera 44 px de alto.