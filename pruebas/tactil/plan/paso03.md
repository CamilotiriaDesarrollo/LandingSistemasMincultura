# Paso 3: Andamio del bloque táctil en la hoja de estilo

**Esfuerzo:** bajo
**Depende de:** [1]
**Puede ir en paralelo con:** [10]

## Qué se hace

Añadir al final de cliente\src\styles.css un tercer bloque delimitado con comentario, TÁCTIL, dentro de @media (hover:none),(pointer:coarse), con las secciones vacías ya nombradas, una por paso siguiente, y los tokens que van a usar todas: --toque:44px, --aire:8px y las variables de anclaje con env(safe-area-inset-bottom) y env(safe-area-inset-right). Va al final a propósito, porque solo gana por orden de aparición, igual que el bloque de la propuesta unificada. Ninguna regla táctil se escribe fuera de esa consulta.

## Archivos

- `cliente\src\styles.css`


## Cómo se revisa (esto cierra el paso)

cd cliente && npx ng build compila sin errores ni advertencias. El censo en 1440x900 sin has_touch da exactamente los mismos números que linea-base.json, con diferencia 0 en ancho y alto de todos los objetivos medidos. Un grep del archivo confirma que el bloque nuevo está dentro de la consulta y que no hay reglas táctiles fuera de ella.