# Banco de medición táctil

Mide si la landing de portales se puede usar con el dedo. No es una suite de
pruebas del código: abre la página real en un navegador real, con un contexto que
declara pantalla táctil y sin ratón, y mide con qué se encuentra un dedo.

Con este banco se cerraron los pasos del plan de responsividad y con él se
comprueba cualquier cambio posterior. Está fuera de `cliente/` a propósito: no
entra en el paquete que sirve .NET.

## Tres comandos

La landing tiene que estar en pie, en otra consola:

```powershell
./desarrollo.ps1                 # → http://localhost:4200 (API en 5080)
```

Y después, en la raíz del proyecto:

```powershell
$env:PYTHONIOENCODING = "utf-8"
python pruebas\tactil\auditoria.py             # 6 comprobaciones de medida
python pruebas\tactil\accesibilidad_cierre.py  # 8 de accesibilidad y no regresión
python pruebas\tactil\cierre_mapa_tarjetas.py  # 4 de mapa y tarjetas
```

Cada guion imprime sus comprobaciones con `PASA` o `FALLA` y sus cifras, y las
deja además en un JSON al lado:

| Guion | Comprobaciones | Escribe | Duró |
|---|---|---|---|
| `auditoria.py` | 6 de medida, más un apartado de datos sin veredicto | nada, salvo con `--guardar-linea-base` | 1 min 10 s |
| `accesibilidad_cierre.py` | 8 de accesibilidad conservada y no regresión de escritorio | `cierre-accesibilidad.json` | 3 min 53 s |
| `cierre_mapa_tarjetas.py` | 4 de las dos figuras del mapa y de la tarjeta táctil | `cierre-mapa-tarjetas.json` | 45 s |

Los tiempos son los de la última ejecución y dependen de la máquina.

Si la landing no responde, los tres lo dicen y no arrancan el navegador.

`auditoria.py` y `accesibilidad_cierre.py` devuelven 0 cuando todo pasa y 1 cuando
algo falla, así que sirven desde un guion. `cierre_mapa_tarjetas.py` devuelve
siempre 0: su veredicto se lee en el resumen que imprime al final y en el campo
`pasa` de su JSON. Queda anotado como pendiente en la última sección.

## Antes y después

Antes es `linea-base.json`, la fotografía de la landing antes de que el plan la
tocara. Después son las cifras de la última ejecución de los tres guiones contra
la versión terminada, que están en los dos `cierre-*.json`. Las dos columnas se
midieron el 30 de septiembre de 2026 con chromium 147.0.7727.15, así que la
comparación no mezcla navegadores. Las medidas por tamaño van en el orden 390x844,
430x932, 768x1024 y 1024x768, todos táctiles.

| Medida | Antes | Después |
|---|---|---|
| Objetivos por debajo de 44 por 44 px, zoom 1,0 | 20, 20, 26, 26 | 0, 0, 0, 0 |
| Objetivos por debajo de 44 por 44 px, zoom 1,3 | 6, 8, 24, 24 | 0, 0, 0, 0 |
| Pares de vecinos por debajo de 8 px, zoom 1,0 | 17, 12, 10, 8 | 0, 0, 0, 0 |
| Filas de la vista Lista, aire entre vecinas | no se medía: el censo solo recorría la vista que carga. Al recorrer las tres salieron 20 pares a 0,0 px en los cuatro tamaños y en los dos zooms | 10,0 px entre filas, con la fila de 88 px de alto en teléfono y 57,8 px en tableta |
| Enlaces atrapados debajo del zócalo | no había zócalo | 0 en las doce combinaciones de tamaño y vista, con 5 a 26 cruces por recorrido, que es dato |
| Objetivos tocables censados | 55, 55, 61, 61 | 60, 60, 66, 66 |
| Enlace del logo en 390 px | 135 por 53 px y el centro devuelve `a.saltar` | 135 por 53 px y el centro devuelve el propio enlace |
| Puntos de la esquina superior izquierda que devuelven `a.saltar` | 63 de la rejilla | 0 |
| Enlace «Inicio» de la nav en 768 px | 29,6 por 14 px y lo tapaba `a.saltar` | 44 por 44 px y el centro devuelve el propio enlace |
| Cabecera de tema en 390 px | 80 px de alto, acepta 48, franja muerta de 38 a 66 px que devuelve `span.tema-pista` | 89,4 px de alto, 0 franjas muertas, la que menos acepta 88 px |
| Botones de accesibilidad | 30 por 31 px en 390 px y 31 por 32 px en 768 px, con 3,0 px de hueco, en posición fija | 44 por 44 px los tres, en el flujo de la página |
| Seis enlaces institucionales de la nav de tableta | 14 px de alto | 44 px de alto |
| Solapes de un elemento fijo sobre un enlace | la barra de accesibilidad, fija en 104 por 39 px, tapaba 83 por 39 px de un enlace de portal al 20 y al 50 por ciento del recorrido | 0 solapes en las cuatro paradas de los cuatro tamaños |
| Botones del conmutador de vistas | 99 por 31 px y 77,5 por 31 px, con 2,0 px de hueco, y la pestaña Mapa oculta | 99 por 44 px, 81,7 por 44 px y 77,5 por 44 px, en un grupo de 288,2 por 54,0 px |
| Barra inferior | no existía | zócalo de 66 px de alto, pegado desde el flujo con `position:sticky` y anclado a 8 px más `env(safe-area-inset-bottom)` mientras la página está desplazada, con cinco botones de 44 px de alto |
| A `scrollY=2000` en 390x844 | buscador y conmutador fuera de pantalla, el conmutador a 1.387 px por encima del borde | buscador, vistas y temas del zócalo en pantalla, con el centro en 803 px de 844, dentro del tercio inferior, que empieza en 563 |
| Reserva de alto al final del documento | no hacía falta, no había barra inferior | la caja del zócalo reserva su propio alto, y en los cuatro tamaños la última tarjeta no queda debajo de él |
| Ocho búsquedas rápidas | 40 px de alto en 390 px y 32 px en 768 px, con pares de 7,9 px de hueco | 76,6 por 44 px en 390 px y 73,6 por 44 px en 768 px |
| Cinco enlaces del índice de temas | 4,0 px de hueco entre vecinos | 102,1 por 51 px, con el hueco por encima de 8 px |
| Campo `#query` | `font-size` 13 px y 45 px de alto en 390 y 430 px, que es donde iOS amplía; 16 px y 55 px en tableta y en escritorio | 16 px en los cinco tamaños, 45 px de alto en teléfono y 55 px en tableta, y el ancho del documento no cambia al enfocarlo |
| Desborde horizontal a 320, 195 y 160 px CSS | 0, 52 y 87 px | 0, 0 y 0 px |
| Desborde horizontal a 98 px CSS, que es dato y no criterio | 149 px | 38 px |
| Pestaña Mapa en 1024x768 táctil | `display:none`, 0 por 0 px | `display:flex`, 81,7 por 44,0 px, pinta Barras contadas: 5 barras, 25 cuadros, reparto 4, 9, 6, 4, 2 |
| Vista mapa en 1440x900 con ratón | rosa de 440 por 516 px, `viewBox 0 0 440 516` | la misma rosa, y `geometria-rosa.ts` intacto |
| Censo de escritorio en 1440x900 con ratón | 57 objetivos, 27 por debajo de 44 px | 57 objetivos, 27 por debajo de 44 px, 0 con ancho o alto cambiado |
| Marca de agua de la tarjeta | se revelaba al tocar, que además ponía la tarjeta activa 2.200 ms y abría el portal a la vez | visible sin tocar nada en las 15 tarjetas del mosaico que tienen archivo, y un toque abre 1 pestaña |
| Marca de agua en alto contraste | oculta | oculta, las 16 de la página con `display:none` |
| Alto del documento en 390x844 | 4.106 px, 4,86 pantallas | 4.339 px, 5,1 pantallas |
| Errores de consola | 0 | 0 |

Tres cifras que no son defecto y conviene no volver a discutir. La primera: 10 de
los 25 portales no tienen archivo de marca, así que 15 es el total posible en el
mosaico. La segunda: los dos guiones cuentan marcas distintas a propósito,
`cierre_mapa_tarjetas.py` las 15 del mosaico y `accesibilidad_cierre.py` las 16 de
la página, porque uno de los accesos favoritos también lleva marca. La tercera: el
censo sube de 55 a 60 objetivos porque el zócalo añade cinco botones, no porque
haya aparecido nada más.

El desborde a 98 px CSS baja de 149 a 38 px y se imprime como dato. 98 px es la
mitad del ancho mínimo de la pauta y ningún criterio de cierre lo exige.

## Los tres modos de auditoria.py

| Comando | Qué hace |
|---|---|
| `python pruebas\tactil\auditoria.py` | Las seis comprobaciones y los datos |
| `python pruebas\tactil\auditoria.py --guardar-linea-base` | Lo anterior y reescribe `linea-base.json` |
| `python pruebas\tactil\auditoria.py --calibrar` | Lo anterior y comprueba que el banco mide bien |

`--guardar-linea-base` **no se ejecuta para arreglar un fallo.** La línea base es
la fotografía de la landing antes de que el plan la tocara y es la única prueba de
que la versión de escritorio no cambió. Se reescribe solo si se decide por escrito
mover la referencia.

`--calibrar` comprueba que las medidas de la auditoría previa se reproducen tal
cual, y por eso hoy falla: la landing sí cambió. Eso no es un defecto del banco.

## Cada comprobación por separado

Cada guion corre solo y mide únicamente lo suyo, que es más rápido mientras se
trabaja en un cambio concreto:

```powershell
python pruebas\tactil\censo_objetivos.py   # tamaños de toque y aire entre vecinos
python pruebas\tactil\hit_test.py          # quién responde en el centro de cada control
python pruebas\tactil\solapes.py           # qué tapa un elemento de posición fija
python pruebas\tactil\reflow.py            # desborde horizontal en anchos estrechos
```

La sonda vertical de las cabeceras de tema y el recuento de errores de consola no
tienen guion propio: la sonda se mide dentro de `hit_test.py`, porque usa la misma
consulta de puntos, y los errores de consola se acumulan en toda la ejecución y
solo tienen sentido al final, en `auditoria.py`.

## Las diecinueve comprobaciones y qué exige cada una

### auditoria.py, medida

| # | Comprobación | Pasa cuando |
|---|---|---|
| 1 | Censo de objetivos tocables | 0 objetivos por debajo de 44 por 44 px y 0 pares de vecinos por debajo de 8 px, en las tres vistas de los cuatro tamaños táctiles, a zoom 1,0 y 1,3 |
| 2 | Hit test de centros | El centro de cada control devuelve ese control, en las tres vistas; ningún punto de la esquina superior izquierda devuelve `a.saltar` y la pestaña Mapa existe con 44 px de alto |
| 3 | Sonda vertical de cabeceras | Ninguna cabecera de tema tiene franja muerta, sondeando cada 4 px |
| 4 | Solapes | Ningún elemento de posición fija se cruza con un enlace, al 0, 20, 50 y 100 por ciento del recorrido |
| 5 | Reflow | 0 px de desborde horizontal a 320, 195 y 160 px CSS |
| 6 | Alcance | Ningún enlace queda atrapado debajo del zócalo: el centro de cada uno devuelve el propio enlace al menos una vez en el recorrido, en las tres vistas |
| 7 | Errores de consola | 0 errores en todo lo medido |

### accesibilidad_cierre.py, accesibilidad conservada y no regresión

| # | Comprobación | Pasa cuando |
|---|---|---|
| 1 | Enlaces externos | Cada uno conserva `aria-label`, `target="_blank"` y `rel="noopener noreferrer"`, en las tres vistas |
| 2 | Foco visible | Todo lo que recibe foco con Tab tiene indicador, en los cuatro tamaños táctiles |
| 3 | Recorrido con Tab | El recorrido se cierra, no entra en lo que tiene `inert` ni en lo que tiene `hidden`, y no queda preso |
| 4 | Alto contraste y letra ampliada | Sin desborde, sin objetivos por debajo de 44 px, la marca de agua oculta y la preferencia sobrevive a la recarga |
| 5 | `prefers-reduced-motion` | Sin transiciones ni animaciones en lo que se mira |
| 6 | Campo `#query` | `font-size` 16 px y el ancho del documento no cambia al enfocarlo |
| 7 | Etiqueta viewport | `index.html` sin `maximum-scale` ni `user-scalable` |
| 8 | Censo de escritorio | 1440x900 sin `has_touch` coincide con `linea-base.json` en ancho y alto de todos los objetivos |

### cierre_mapa_tarjetas.py, las dos figuras del mapa y la tarjeta

| Clave | Comprobación | Pasa cuando |
|---|---|---|
| A | Mapa táctil | En 1024x768 con `has_touch` la pestaña Mapa existe, mide 44 px de alto y pinta Barras contadas |
| B | Rosa de escritorio | En 1440x900 con ratón pinta la rosa con lienzo de 440 por 516 px y `geometria-rosa.ts` está intacto |
| C | Un toque, un significado | Un toque en una tarjeta abre exactamente 1 pestaña, sin temporizador; arrastrar y soltar fuera abre 0 |
| D | Marca de agua | Se ve sin tocar nada en las 15 tarjetas que tienen archivo, y en alto contraste sigue oculta |

Los 38 px de desborde a 98 px CSS y los solapes de elementos con `position:sticky`
se imprimen como dato y no deciden el veredicto. En la versión táctil quedan dos
elementos pegados, el índice de temas arriba y el zócalo abajo, y ningún elemento
de posición fija en pantalla. El índice se pega arriba y el contenido pasa por
debajo a propósito: contarlo como fallo obligaría a rehacer algo que nadie pidió.
El zócalo está pegado y no fijo para lo mismo y para una razón más, que es que al
llegar al final del documento vuelve a su sitio y deja la última tarjeta entera.

Que los solapes del zócalo sean dato no se afirma de palabra: lo mide la
comprobación 6. Un zócalo abajo pasa por encima del contenido al desplazar, igual
que cualquier barra inferior de teléfono, y eso no es un defecto. El defecto sería
que algún enlace no se pudiera destapar nunca. La comprobación recorre la página de
80 en 80 px en las tres vistas y pregunta por el centro de cada enlace: pasa cuando
ninguno queda atrapado. Medido el 30 de septiembre de 2026, 0 atrapados en las doce
combinaciones de tamaño y vista, con 5 a 26 cruces por recorrido, que es la cifra
que se imprime como dato.

## Cómo se mide, y por qué así

- **El umbral es la existencia de puntero, no el ancho.** Toda la versión táctil
  entra por `matchMedia('(hover: hover)')` en falso, que en la hoja es
  `@media (hover:none),(pointer:coarse)` y en el código es `store.conPuntero()`.
  Por eso una tableta de 1024 px recibe la versión táctil y una ventana estrecha
  de escritorio no.
- **Contexto táctil:** `has_touch=True` e `is_mobile=True`. Es lo único que hace
  que `matchMedia('(hover: hover)')` devuelva `false`. Sin `is_mobile` el
  navegador sigue declarando puntero fino y la medición mide la versión de
  escritorio en una ventana estrecha.
- **`wait_until="load"`, nunca `"networkidle"`:** el servidor de desarrollo deja
  un websocket abierto y la espera expira.
- **Espera de pintado:** el store tiene una fase firme de 400 ms y los números de
  tema se animan, así que no basta con que exista el primer tema. Se espera a que
  el alto del documento repita dos veces.
- **Desplazamiento instantáneo:** la hoja trae `html{scroll-behavior:smooth}`, así
  que todo desplazamiento de medición se pide con `behavior:'instant'`. Con
  desplazamiento suave la lectura cae en mitad de la animación y las cifras no se
  repiten.
- **Ampliación de letra:** el zoom 1,3 se aplica con `body.style.zoom`, que es lo
  que usan los botones A+ y A−. No es una propiedad estándar: las medidas a 1,3
  dependen de Chromium y por eso toda comprobación se da también a 1,0.
- **Tamaños:** 390x844, 430x932, 768x1024 y 1024x768 táctiles, y 1440x900 con
  ratón, que es la red de seguridad de escritorio.

### Qué cuenta como objetivo tocable

Cualquier elemento interactivo pintado, con caja de área mayor que cero, que no
esté dentro de `[hidden]` ni de `[inert]`. El enlace de salto contaba aunque
tuviera opacidad 0, porque el navegador se lo entregaba al dedo igual: hoy mide 0
por 0 px en reposo y recupera su caja al recibir foco, así que no entra en el censo
y sigue en el recorrido con Tab.

Dos objetivos son **vecinos** cuando comparten franja en uno de los dos ejes. Los
que se cruzan en diagonal no lo son: entre esos dos el dedo no se equivoca. Un
objetivo dentro de otro tampoco es vecino, porque es el mismo toque.

## Qué hay en los tres JSON

`linea-base.json` es la fotografía completa de la landing antes de que el plan la
tocara, unos 290 KB. Se usa para dos cosas:

1. **No regresión de escritorio.** `censo_objetivos.py` compara el censo de
   1440x900 con ratón contra el de la línea base por clave, no por posición en el
   DOM, así que sobrevive a que se agregue un componente. Si una regla táctil se
   escribe fuera de la consulta `(hover:none),(pointer:coarse)`, se filtra a
   escritorio y el ancho o el alto de algún objetivo deja de coincidir.
2. **Referencias que otras comprobaciones necesitan.** El lienzo de la rosa (440
   por 516 px, `viewBox 0 0 440 516`), el `font-size` y el alto del campo `#query`,
   la etiqueta `viewport`, el alto del documento, la posición del conmutador y la
   permanencia a `scrollY=2000`.

Las claves de primer nivel son `censo`, `hit_test`, `solapes`, `reflow`, `estado` y
`escritorio`, una por medición; `consola` con los errores recogidos; y la cabecera
`url`, `tamanos_tactiles`, `tamano_escritorio`, `lado_minimo`, `aire_minimo`,
`navegador` y `generado`.

**`linea-base.json` no se regenera.** Es la medición de antes del plan y es la
prueba de que la versión de escritorio no cambió; volver a medirla para que algo
cuadre sería falsear la prueba. Lo único que se le quitó, el 1 de octubre de 2026,
son nueve líneas de dos campos que no medían nada de la página y que ninguna
comprobación comparaba: de la línea base solo se leen `escritorio.censo`, para la
no regresión de escritorio, y `escritorio.mapa.rosa`, para el lienzo de la rosa.
Las nueve líneas se quitaron del archivo a mano, sin volver a medir, así que
ninguna medida de tamaño, de hueco, de hit test ni de censo cambió.

`cierre-accesibilidad.json` guarda lo medido en la versión terminada, con las
claves `externos`, `foco`, `contraste`, `movimiento`, `campo`, `viewport`,
`no_regresion` y `consola`. `cierre-mapa-tarjetas.json` es una lista de cuatro
entradas con `clave`, `criterio`, `pasa` y `medido`. Los dos se reescriben en cada
ejecución y no son una referencia que haya que conservar.

## Lo que este banco no puede medir, y lo que queda pendiente

Chromium con `has_touch` no es Safari de iOS. Dos cosas se comprueban en el código
y no en el comportamiento, y quedan pendientes de una revisión en un teléfono con
muesca:

- La ampliación al enfocar un campo de menos de 16 px. El banco mide que `#query`
  declare 16 px, no que iOS no amplíe.
- El valor real de `env(safe-area-inset-bottom)`, que es el anclaje del zócalo.

Otras dos cosas quedan pendientes en el banco mismo:

- **Un solo punto de entrada.** Hoy son tres comandos y no uno. Las diecinueve
  comprobaciones no se imprimen juntas.
- **`cierre_mapa_tarjetas.py` devuelve siempre 0.** Su veredicto se lee en el
  resumen y en el campo `pasa` de su JSON, no en el código de salida.

**La permanencia del zócalo sí sale del banco.** `auditoria.py` la mide a
`scrollY=2000` sobre `[data-zocalo="buscador"]`, `[data-zocalo="vistas"]` y
`[data-zocalo="temas"]`, que son los controles que la dan, y de paso imprime los
del cuerpo de la página con ese nombre para poder compararlos. Antes leía solo los
del cuerpo y la línea decía «buscador fuera, conmutador fuera» contradiciendo el
hecho medido. Sigue siendo dato y no veredicto: lo que decide es la comprobación 6,
que es la que pregunta si algo queda inalcanzable.

## Requisitos

- Python 3.10 o más, con `playwright` y su Chromium:
  `pip install playwright` y `python -m playwright install chromium`.
- La landing en pie en `http://localhost:4200` con el API en `http://localhost:5080`.
- `PYTHONIOENCODING=utf-8`, porque la salida lleva tildes.

Los tres guiones abren varias decenas de páginas y tardaron seis minutos en total
en la última ejecución. Python deja una carpeta `__pycache__` al importar los
módulos; se puede borrar.

## Capturas, y la trampa de la página completa

`pruebas/tactil/capturas/` guarda las imágenes de antes y después, dieciséis de la
versión terminada, y su guion. Lo que hay que saber antes de tomar una captura:
**nunca con `full_page=True`.** Está medido: apaga la emulación táctil de Chromium
durante el disparo y la imagen sale de escritorio aunque el contexto se haya pedido
táctil. Tras el disparo `(hover: hover)` se queda en `true`, así que la pestaña
Mapa de esa página cae a Lista, correctamente, porque para la página acaba de
aparecer un ratón. El detalle y la forma correcta están en
`capturas/LEEME.md`.

## El plan con que se hizo

`pruebas/tactil/plan/` guarda el brief, la medición previa con sus cifras, la
propuesta de figura del mapa táctil que se eligió y los diecisiete pasos, uno por
archivo. No hace falta para usar el banco: está para poder responder más tarde por
qué cada cosa quedó como quedó. Su índice es `plan/LEEME.md`.
