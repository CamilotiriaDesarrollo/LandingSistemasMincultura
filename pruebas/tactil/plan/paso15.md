# Paso 15: El umbral del mapa pasa a ser el puntero

**Esfuerzo:** medio
**Depende de:** [14]
**Puede ir en paralelo con:** -

## Qué se hace

Cambiar vistaEfectiva en directorio.store.ts para que el repliegue a Lista no dependa del ancho: barras cuando conPuntero() es falso, rosa cuando hay puntero y el ancho da, Lista solo si ninguna de las dos cabe. La guarda conPuntero ya existe en directorio.store.ts:134 y hoy solo la leen mosaico.ts:142 y resplandor.ts. Retirar la regla @media (max-width:1099px) del bloque del mapa que oculta la pestaña, para que la tableta de 1024 px la recupere. Corregir el texto de ayuda de la vista mapa en explorador.ts, que hoy dice 'Pasa el cursor o usa Tab', por uno que no nombre el ratón cuando no hay ratón. Este paso va después del 14 a propósito: la pestaña no se ofrece antes de que exista la figura que puede atender.

## Archivos

- `cliente\src\app\servicios\directorio.store.ts`

- `cliente\src\app\componentes\explorador\explorador.ts`

- `cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

En 1024x768 con has_touch, el botón data-vista="mapa" existe, es visible, mide 44 px de alto y al tocarlo pinta las barras y no la rosa. En 390x844 y 768x1024 igual. En 1440x900 sin has_touch la pestaña pinta la rosa, cuyo lienzo mide 440 px de ancho por 516 px de alto, idéntico a linea-base.json, y las barras no se pintan. Abrir con ?vista=mapa respeta la vista en los cuatro tamaños y localStorage conserva la preferencia. El texto de ayuda en táctil no contiene la palabra cursor ni la palabra clic.