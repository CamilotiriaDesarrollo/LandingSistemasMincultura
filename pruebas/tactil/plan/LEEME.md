# El plan con que se hizo la versión táctil

Esta carpeta es el registro de cómo se trabajó, no instrucciones de uso. La
versión táctil ya está hecha: lo que hay que saber para tocarla está en
`GUIA.md`, en el `README.md` y en `pruebas/tactil/LEEME.md`. Esto se guarda por
una razón distinta, que es poder responder más tarde por qué cada cosa quedó como
quedó sin reconstruirlo de memoria.

Corte del 30 de septiembre de 2026.

## Qué hay

| Archivo | Qué es |
|---|---|
| `_comun.md` | El brief. Objeto del trabajo, el criterio de entrada, lo que no se toca y las reglas que valieron para todos los pasos |
| `_hallazgos.md` | La medición previa, hallazgo por hallazgo, cada uno con su cifra, el archivo y la línea donde estaba y la propuesta. Es de donde salieron los diecisiete pasos |
| `_mapa-ganadora.md` | La propuesta de figura del mapa táctil que se eligió, «Barras contadas». Está en JSON aunque la extensión diga md. Trae lo que se conserva de la rosa y, con nombre propio, lo que se pierde |
| `paso01.md` a `paso17.md` | Un archivo por paso, con su esfuerzo, de qué depende, con qué puede ir en paralelo, qué se hace y con qué se cierra. Falta el 2: se retiró del plan, y los demás conservan su número porque las dependencias se nombran así |

## El orden en que se ejecutaron

Diecisiete pasos en cinco tandas, repartidos por quién escribe en qué archivo:

1. **Preparar**, en paralelo: 1 (banco de medición) y 10 (la guarda de puntero
   en el store).
2. **Componentes**, en paralelo porque ninguno escribe en la hoja: 14 (mapa
   táctil), 11 (zócalo), 13 (marca de agua de la tarjeta), 15 (navegación).
3. **Hoja**, en serie y con un solo autor: los pasos 3 a 9 y el 12, que son todos
   del bloque táctil de `cliente/src/styles.css`. Es un carril de uno porque dos
   manos escribiendo el mismo archivo se pisan.
4. **Auditar**, en paralelo: tres lentes distintas sobre lo mismo, ergonomía,
   mapa y tarjetas, y accesibilidad.
5. **Documentar**: paso 17.

## Qué encontró la auditoría y no cerró el plan

Queda escrito porque es la parte que más cuesta reconstruir:

- El zócalo se entregó pegado sin reserva de alto y el censo midió 26 pares de
  vecinos a 0,0 px. Se cerró haciendo que el zócalo solo flote con la página
  desplazada, y se comprobó aparte que ningún enlace queda atrapado debajo. Esa
  comprobación es ahora la número 6 del banco.
- El censo y el hit test medían solo la vista que carga. Al hacerlos recorrer las
  tres apareció un defecto que llevaba abierto todo el tiempo: las filas de la
  vista Lista se tocaban, 20 pares a 0,0 px en los cuatro tamaños. Es la sección
  11 del bloque táctil de la hoja.
- Los cinco enlaces de la barra de navegación no llevaban `aria-label`, `target`
  ni `rel`. Venían así del prototipo, no del plan.

## Lo que el plan dejó fuera a propósito

No se comprobó en aparato físico ni en Safari de iOS. La ampliación al enfocar un
campo y el valor real de `env(safe-area-inset-bottom)` se comprobaron por código.
Una revisión en un teléfono con muesca sigue pendiente y está escrita también en
`pruebas/tactil/LEEME.md`.
