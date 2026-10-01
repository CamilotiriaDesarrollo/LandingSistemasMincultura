# Paso 8: Todos los objetivos a 44 por 44 px con 8 px de aire

**Esfuerzo:** medio
**Depende de:** [3, 4, 5]
**Puede ir en paralelo con:** [10]

## Qué se hace

Subir a 44 px de alto real y 8 px de hueco, solo cuando el puntero es grueso: los seis enlaces de nav.nav, hoy de 12 px de alto en tableta, con relleno vertical; el botón .header-search, hoy 86 por 34 px; el botón .mobile-nav, hoy 78 por 30 px; las ocho fichas de búsqueda rápida, hoy 38 px de alto con huecos de 7,9 px; los enlaces del índice pegado, subiendo el hueco de 4,0 a 8 px con relleno interno y no con gap, para no perder altura de toque; los dos botones del conmutador, hoy 98 por 30 px y 76 por 30 px con 2,0 px de hueco, que además pasan a ser un par con relleno propio; los tres botones de accesibilidad, hoy 28 por 30 px con 3,0 px de hueco; y el gap del mosaico apilado en teléfono, de 8 a 10 px. Si la fila de seis enlaces institucionales no cabe a esa altura en 768 px, se reparte en dos filas, nunca se recorta.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

censo_objetivos.py devuelve 0 objetivos por debajo de 44 por 44 px y 0 pares de vecinos por debajo de 8 px, en 390x844, 430x932, 768x1024 y 1024x768, a zoom 1,0 y 1,3. En 1440x900 sin has_touch el censo no cambia respecto a linea-base.json. Desborde horizontal sigue en 0 en los cuatro tamaños.