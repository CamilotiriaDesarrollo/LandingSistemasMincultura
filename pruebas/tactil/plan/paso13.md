# Paso 13: La tarjeta táctil muestra su marca y el toque significa una sola cosa

**Esfuerzo:** medio
**Depende de:** [3]
**Puede ir en paralelo con:** -

## Qué se hace

Retirar el apaño de pointerdown de mosaico.ts, es decir alTocarCasilla y la constante MS_TOQUE de 2200 ms, que hoy pone la tarjeta activa mientras el mismo toque abre el portal en pestaña nueva, con lo que la marca queda detrás de la pestaña recién abierta. En su lugar, mostrar la marca de agua siempre cuando no hay puntero, con la opacidad baja que ya usa el mosaico, para que el logo se vea sin tocar nada. El toque conserva un solo significado: abre el portal. Se deja constancia de que 10 de las 25 tarjetas no tienen archivo de marca.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\mosaico\mosaico.ts`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

En 390x844 con has_touch, un tap sobre una tarjeta abre exactamente 1 pestaña y el recuento de páginas del contexto pasa de 1 a 2. Sin tocar nada, getComputedStyle de .p-marca da opacidad mayor que 0 en las 15 tarjetas que tienen archivo. grep de mosaico.ts no encuentra pointerdown ni MS_TOQUE. En 1440x900 con ratón, la marca sigue apareciendo solo al señalar y el censo de escritorio no cambia. El contraste del nombre y la descripción sobre la tarjeta con marca puesta es mayor o igual a 4,5 a 1, también en alto contraste, donde la marca sigue oculta.