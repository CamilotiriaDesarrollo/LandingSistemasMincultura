# Paso 16: Auditoría de cierre y compilación

**Esfuerzo:** medio
**Depende de:** [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
**Puede ir en paralelo con:** -

## Qué se hace

Correr el banco completo contra la versión terminada, en 390x844, 430x932, 768x1024, 1024x768 y 1440x900, a zoom 1,0 y 1,3, con y sin has_touch, y añadir las comprobaciones que no son de medida: recorrido completo con Tab en cada vista, foco visible en los cuatro tamaños, prefers-reduced-motion sin transiciones, alto contraste con contraste mayor o igual a 4,5 a 1 en todo texto pequeño, recuento de enlaces externos con aria-label, target y rel, y anuncios de la región aria-live al abrir tema, cambiar vista y buscar sin resultados. Compilar cliente y servidor y comprobar el API.

## Archivos

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\pruebas\tactil\auditoria.py`

- `C:\Users\camil\Desktop\IA Raiz Proyectos\001 Trabajo Diario\003 Minisiterio Varios\08 Portal Landing Sistemas info\landing-portales\pruebas\tactil\cierre.json`


## Cómo se revisa (esto cierra el paso)

auditoria.py imprime PASA en las diez comprobaciones y guarda cierre.json. cd cliente && npx ng build sin errores ni advertencias. cd servidor && dotnet build sin advertencias. GET http://localhost:5080/api/sistemas responde 200 y servidor\Datos\portales.json conserva el mismo hash que antes de empezar.