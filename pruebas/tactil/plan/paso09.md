# Paso 9: Las dos tiras horizontales avisan de que siguen

**Esfuerzo:** bajo
**Depende de:** [8]
**Puede ir en paralelo con:** [10]

## Qué se hace

En la tira de búsquedas rápidas y en la del índice pegado, añadir aviso de continuación, degradado en el borde derecho o media ficha asomando, y cambiar scroll-snap-type de mandatory a proximity, que es lo que hace que el arrastre se sienta agarrado. Hoy solo 4 de 8 fichas caben en 390 px con scrollWidth 761, y 2 de 8 con la letra ampliada al máximo; los dos últimos temas del índice quedan fuera de la tira.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

En 390x844 y 430x932: getComputedStyle de .fichas y de .indice ul da scroll-snap-type con proximity; el aviso de continuación existe y se mide su ancho; las 8 fichas y los 5 temas quedan alcanzables con un solo arrastre programático y su área real sigue por encima de 44 px de alto a zoom 1,0 y 1,3. El contorno de foco de la primera y la última no se recorta.