# Paso 1: Banco de medición táctil y línea base

**Esfuerzo:** medio
**Depende de:** nada
**Puede ir en paralelo con:** [10]

## Qué se hace

Crear los guiones de medición reutilizables, fuera de cliente, y congelar la línea base contra la versión actual. Un guion por comprobación: censo de objetivos tocables con área real y hueco entre vecinos, hit test del centro de cada control con elementFromPoint, sondeo vertical de cabeceras cada 4 px, solape de elementos fijos contra enlaces en cuatro posiciones de desplazamiento, reflow a 320, 195, 160 y 98 px CSS, y recuento de errores de consola. Un guion maestro, auditoria.py, que corre los seis y imprime PASA o FALLA con los números. Contexto con has_touch=True, is_mobile=True, wait_until="load", tamaños 390x844, 430x932, 768x1024, 1024x768 y 1440x900, a zoom 1,0 y 1,3. La salida se guarda en linea-base.json.

## Archivos

- `pruebas\tactil\auditoria.py`

- `pruebas\tactil\censo_objetivos.py`

- `pruebas\tactil\hit_test.py`

- `pruebas\tactil\solapes.py`

- `pruebas\tactil\reflow.py`

- `pruebas\tactil\linea-base.json`

- `pruebas\tactil\LEEME.md`


## Cómo se revisa (esto cierra el paso)

PYTHONIOENCODING=utf-8 python pruebas\tactil\auditoria.py reproduce sin tocar nada los cinco hechos ya medidos: la pestaña Mapa ausente por debajo de 1100 px, entre 20 y 26 objetivos por debajo de 44 por 44 px, el centro del logo devolviendo a.saltar en 390 y 430 px, la banda muerta de la cabecera de tema entre y=45 y y=64 en 390 px, y el solape de la barra flotante de 83 por 39 px a mitad de página. Desborde horizontal 0 en los cinco tamaños y 0 errores de consola.