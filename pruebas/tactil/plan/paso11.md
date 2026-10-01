# Paso 11: Zócalo táctil: buscador, conmutador y temas siempre a mano

**Esfuerzo:** alto
**Depende de:** [2, 3, 8, 10]
**Puede ir en paralelo con:** -

## Qué se hace

Componente nuevo con selector de atributo, por ejemplo div[app-zocalo], visible solo cuando no hay puntero. Barra inferior fija con tres objetivos de 44 px: acceso al buscador, que enfoca #query sin romper el atajo Ctrl K, el conmutador de vistas, reutilizando store.cambiarVista y aria-pressed sin duplicar estado, y el acceso a los temas. Anclaje con bottom:calc(8px + env(safe-area-inset-bottom)) y relleno inferior en el contenido igual a su altura, para que ninguna tarjeta quede debajo. Arriba queda la identidad institucional. El componente se añade a app.html. Su CSS va en la sección del bloque táctil que le corresponde.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\zocalo\zocalo.ts`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\componentes\zocalo\zocalo.html`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\app\app.html`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

Con scrollY=2000 en 390x844, 430x932 y 768x1024, los tres controles siguen en pantalla y el centro de cada uno cae en el tercio inferior de la ventana, por debajo de y=557 en 390x844 y de y=615 en 430x932. Cada uno mide al menos 44 por 44 px con 8 px de aire. solapes.py devuelve lista vacía al 0, 20, 50 y 100 por ciento del recorrido. El relleno inferior del contenido es mayor o igual a la altura del zócalo, así que la última tarjeta queda entera. grep encuentra env(safe-area-inset-bottom). En 1440x900 con ratón el zócalo no existe en el DOM medido y el censo de escritorio no cambia.