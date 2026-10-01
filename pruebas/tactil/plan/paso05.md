# Paso 5: La cabecera de tema recupera sus 80 y 88 px de altura tocable

**Esfuerzo:** bajo
**Depende de:** [3]
**Puede ir en paralelo con:** [10]

## Qué se hace

Poner pointer-events:none a .tema-pista y a .tema-desc, que no son interactivos y hoy se pintan por encima del ::after del botón y se comen los toques del centro de la cabecera. Como refuerzo, z-index:1 en .tema-boton::after. Cambio de comportamiento solamente: no se altera ni un píxel del dibujo.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

Sondeo vertical de .tema-cabeza cada 4 px, de y=0 a y=alto, en 390x844, 430x932 y 768x1024: todos los puntos devuelven .tema-boton o su pseudoelemento. El área tocable real pasa de 332 por 36 px a 332 por 80 px en 390 px y a 698 por 88 px en 768 px. Captura comparada contra la línea base: 0 píxeles de diferencia.