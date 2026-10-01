# Paso 6: El buscador ya no provoca la ampliación de iOS

**Esfuerzo:** bajo
**Depende de:** [3]
**Puede ir en paralelo con:** [10]

## Qué se hace

Subir la letra del campo de búsqueda a 16 px en el bloque de móvil y compensar el relleno vertical para conservar los 45 px de alto. No se toca la etiqueta viewport de index.html: sin maximum-scale y sin user-scalable=no, porque el zoom del usuario es un requisito de accesibilidad.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\index.html`


## Cómo se revisa (esto cierra el paso)

getComputedStyle del campo #query devuelve font-size 16px en 390 y 430 px, y su alto medido sigue en 45 px, con ancho 290 y 330 px. document.documentElement.clientWidth es idéntico antes y después de enfocar el campo. grep de index.html no encuentra maximum-scale ni user-scalable.