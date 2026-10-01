# Paso 14: Mapa táctil: Barras contadas

**Esfuerzo:** alto
**Depende de:** [3, 8]
**Puede ir en paralelo con:** [11]

## Qué se hace

Componente nuevo con selector de atributo, por ejemplo div[app-mapa-barras], hermano de #mapa en explorador.html y oculto con [hidden] igual que las otras vistas. Una barra por tema, en el orden del directorio. Barra cerrada de 326 por 76 px: número del tema con su color, nombre en versalitas, conteo, y la escalera de cuadros, uno por portal, que es lo que hace contable el reparto de 4, 9, 6, 4 y 2. Es un botón con aria-expanded y aria-controls, nunca dos estados que digan lo mismo. Al abrirse muestra las filas de portales de 326 por 56 px, cada una un solo enlace con aria-label 'Abrir X en una pestaña nueva', target=_blank y rel=noopener noreferrer, con nombre completo, dominio y flecha, más una segunda salida al pie de la barra abierta, porque con nueve portales el recorrido ya pide volver arriba. La acción se dispara en click y nunca en pointerdown, para que arrastrar el dedo fuera la cancele. La búsqueda apaga cambiando el relleno del cuadro a #ece7ff, no bajando la opacidad, el conteo dice '4 de 9' reutilizando lo que ya sabe decir el mapa, y las filas que no coinciden llevan inert. El estado del tema abierto usa store.alternarTema y temaActivo, así que viaja por ?tema= y no se inventa estado nuevo. Apertura y cierre se anuncian con el servicio Anuncio. No se toca geometria-rosa.ts ni mapa.ts.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\mapa-barras\mapa-barras.ts`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\mapa-barras\mapa-barras.html`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\explorador\explorador.html`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

En 390x844, 430x932 y 768x1024 con has_touch y la vista forzada a barras: 0 objetivos por debajo de 44 por 44 px, y el centro de cada barra cerrada devuelve su propio botón en el hit test. Un tap en una barra pone aria-expanded en true, muestra sus filas de 56 px y la región aria-live recibe texto. Un tap en una fila de portal abre exactamente 1 pestaña. Un arrastre que empieza en una fila y suelta fuera abre 0 pestañas. Al escribir museo, el relleno calculado de los cuadros sin coincidencia es #ece7ff con opacidad 1, el conteo del tema dice '4 de 9', y las filas sin coincidencia tienen el atributo inert. Con Tab se recorren barras y filas, el foco es visible y no entra en lo que tiene inert. Alto total del bloque medido y anotado para 25 portales. Desborde horizontal 0. 0 errores de consola.