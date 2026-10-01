# Paso 10: Las preferencias de accesibilidad persisten y el piso deja de estorbar

**Esfuerzo:** bajo
**Depende de:** nada
**Puede ir en paralelo con:** [1, 3, 4, 5, 6, 7, 8, 9]

## Qué se hace

Guardar el tamaño de letra y el contraste y aplicarlos al arrancar, con el mismo patrón envuelto en try/catch que ya usa cliente\src\app\nucleo\pedido.ts para localStorage. Subir el piso del zoom de 0,9 a 1,0, porque reducir por debajo de lo normal no es una ayuda de accesibilidad y es lo que deja el campo de búsqueda en 41 px de alto. Añadir aria-pressed al botón de contraste. No toca la hoja de estilo, así que corre en paralelo con todo el carril de la hoja.

## Archivos

- `cliente\src\app\componentes\accesibilidad\accesibilidad.ts`


## Cómo se revisa (esto cierra el paso)

Tres pulsaciones de A+, recarga con wait_until="load", y body.style.zoom sigue en 1,3; lo mismo con la clase high-contrast en body. Cinco pulsaciones de A− dejan el zoom en 1,0 y el campo #query con 45 px de alto, no 41. El botón de contraste expone aria-pressed true y false. En un contexto con almacenamiento bloqueado la página carga igual y no hay errores de consola.