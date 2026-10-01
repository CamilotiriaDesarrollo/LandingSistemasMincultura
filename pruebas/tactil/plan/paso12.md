# Paso 12: La barra flotante deja de comerse las tarjetas

**Esfuerzo:** medio
**Depende de:** [11]
**Puede ir en paralelo con:** -

## Qué se hace

Con los tres controles ya en el zócalo, la barra flotante de contraste y letra se retira de encima del contenido: en teléfono pasa a una fila propia bajo el encabezado o a un panel que se abre desde un solo botón del zócalo, con los tres controles a 44 px. En tableta se aleja del canto derecho, donde hoy ocupa x=725..768 e y=348..474, que es justo donde se apoya la mano. Si se conserva alguna pieza fija, se ancla con env(safe-area-inset-bottom) y env(safe-area-inset-right) y se le reserva sitio en el contenido.

## Archivos

- `cliente\src\styles.css`

- `cliente\src\app\componentes\accesibilidad\accesibilidad.ts`


## Cómo se revisa (esto cierra el paso)

solapes.py devuelve lista vacía en los cuatro tamaños y en las cuatro posiciones de desplazamiento, frente a solapes de 83 a 94 por 39 px en la línea base. Los tres controles miden 44 por 44 px o más con 8 px de aire a zoom 1,0 y 1,3. En 768x1024 ningún elemento fijo toca los 12 px del canto derecho. Los tres siguen funcionando: A+ cambia el zoom, C conmuta la clase high-contrast.