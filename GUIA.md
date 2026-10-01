# Landing de portales · Ministerio de las Culturas

Landing de organización que reúne los portales y sistemas de información del
Ministerio en un solo punto de entrada. Es el primer paso para unificar la
experiencia de usuario entre sistemas.

Se portó **tal cual** desde `../propuesta-final.html`: con ratón la versión Angular
se ve idéntica píxel por píxel al prototipo. Mantener esa fidelidad es un
requisito, no un detalle.

Sin ratón la landing se aparta del prototipo a propósito, porque el prototipo no
se podía usar con el dedo. Ese es el asunto de la sección «La versión táctil», y
los dos casos no se mezclan: lo táctil vive en su propio bloque de la hoja y la
versión con ratón no cambia.

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Cliente | Angular, componentes standalone y signals | 20.3 |
| Lenguaje | TypeScript | 5.9 |
| Servidor | ASP.NET Core, minimal API | .NET 10 (LTS hasta nov. 2028) |
| Estilos | CSS plano, sin framework | no aplica |

El API sigue el **mismo contrato del Portal ISI**: `GET /api/health` y
`GET /api/sistemas`. No cambiar esas rutas ni la forma de la respuesta sin
acordarlo, porque es lo que permite integrar esta landing con el ISI.

## Dónde se cambia cada cosa

La regla: **el contenido vive en un JSON, la forma en el CSS, la estructura en
las plantillas.** Casi todos los cambios son de contenido y no tocan código.

| Quiero cambiar… | Archivo |
|---|---|
| Agregar, quitar o editar un portal | `servidor/Datos/portales.json` → `portals` |
| Los tres accesos favoritos | `servidor/Datos/portales.json` → `favorites` |
| Un tema (nombre, descripción, color) | `servidor/Datos/portales.json` → `categories` |
| Colores de toda la landing | `cliente/src/styles.css` → bloque `:root` |
| Tamaños de toque, zócalo, cualquier cosa de táctil | `cliente/src/styles.css` → bloque `TÁCTIL`, al final |
| La barra inferior táctil | `cliente/src/app/componentes/zocalo/` |
| El mapa táctil, Barras contadas | `cliente/src/app/componentes/mapa-barras/` |
| La rosa de los saberes, que es el mapa de escritorio | `cliente/src/app/componentes/mapa/` y `cliente/src/app/nucleo/geometria-rosa.ts` |
| Textos fijos de la portada | `cliente/src/app/componentes/portada/portada.html` |
| Enlaces del menú superior | `cliente/src/app/componentes/encabezado/encabezado.ts` |
| Texto del pie | `cliente/src/app/componentes/pie/pie.html` |
| Colores de las tarjetas favoritas | `cliente/src/app/componentes/portada/portada.ts` → `tonos`, `colores` |
| Lógica de búsqueda y filtrado | `cliente/src/app/servicios/directorio.store.ts` |
| Reglas de validación del JSON | `servidor/Servicios/DirectorioService.cs` → `Validar` |

### Agregar un portal, paso a paso

1. Confirmar a qué tema pertenece. Los temas válidos son los `id` de
   `categories` en `servidor/Datos/portales.json`.
2. Comprobar que no esté ya en la lista, por nombre y por URL.
3. Redactar la descripción: una sola línea que diga qué hace la persona en ese
   portal, sin rayas, siguiendo el tono de las que ya están.
4. Agregar el objeto `{ name, desc, url, category }` al final de `portals`. Solo
   `https://`, salvo que el portal no tenga certificado, y entonces conviene
   dejarlo anotado.
5. Si va a ser acceso favorito, agregarlo también a `favorites`.
6. Consultar `GET http://localhost:5080/api/sistemas`. Si responde 500, el
   mensaje dice exactamente qué corregir.

### El JSON se valida solo

`DirectorioService` revisa `portales.json` cada vez que cambia. Si un portal usa
una categoría que no existe, tiene una URL inválida, está repetido o si un
favorito no corresponde a ningún portal, `/api/sistemas` responde 500 con la
lista exacta de errores. **No se necesita reiniciar el servidor** para ver un
cambio en el JSON.

## La versión táctil

La landing tiene dos versiones y **el umbral entre las dos no es el ancho de la
pantalla: es la existencia de puntero fino.** En cuanto el medio declara que no
hay ratón, la interfaz cambia de tamaños y de figura. El criterio se escribe una
sola vez y de dos maneras que significan lo mismo:

| Dónde | Cómo se pregunta |
|---|---|
| En la hoja | `@media (hover:none),(pointer:coarse)` |
| En el código | `store.conPuntero()`, que es `matchMedia('(hover: hover)')` |

Consecuencia deliberada: una tableta de 1.024 px recibe la versión táctil y una
ventana estrecha de escritorio no. Un portátil táctil con ratón ve la de
escritorio, porque manda `hover:hover`.

### El bloque TÁCTIL de la hoja

`cliente/src/styles.css` termina en un tercer bloque, delimitado con comentario,
con trece secciones nombradas y sus tokens: `--toque:44px`, `--aire:8px`,
`--aire-seguro:10px` y los dos anclajes con `env(safe-area-inset-bottom)` y
`env(safe-area-inset-right)`. Va al final a propósito: casi todas sus reglas
repiten selectores de arriba con la misma especificidad y solo ganan por orden de
aparición. Invertir el orden pierde el bloque entero.

**Ninguna regla táctil se escribe fuera de esa consulta.** Una regla táctil suelta
se filtra a escritorio y rompe la fidelidad al prototipo, que es requisito del
proyecto. La única excepción que hay es `.zocalo{display:none}`, que está justo
antes de la consulta y lo que hace es ocultar, así que con ratón no pinta nada.

La red de seguridad es el censo de 1440x900 con ratón contra
`pruebas/tactil/linea-base.json`: si una regla táctil se escapó, el ancho o el alto
de algún objetivo de escritorio deja de coincidir.

### La pestaña Mapa nombra dos figuras

No es un error de la revisión, está decidido así:

| Figura | Cuándo | Dónde vive |
|---|---|---|
| Rosa de los saberes | con puntero y contenedor por encima de 1.100 px | `componentes/mapa/`, con `nucleo/geometria-rosa.ts` |
| Barras contadas | siempre que no haya puntero | `componentes/mapa-barras/` |

Las dos guardas están en `servicios/directorio.store.ts`, en `mapaEnBarras` y
`mapaEnRosa`. El umbral no puede ser el ancho: una tableta táctil de 1.024 px da un
contenedor de 976 px, y con un umbral de ancho se perdía la pestaña aunque las
barras caben desde 320 px. Por eso la pestaña ya no desaparece en tableta.

`nucleo/geometria-rosa.ts` y `componentes/mapa/` **no se tocan.** La rosa se
conserva igual para escritorio y de ella solo se importa `estiloTema`. Añadir
logos a los 10 portales que no tienen archivo de marca tampoco es trabajo de
código: entra por el JSON y por la carpeta de marcas.

### Lo que hay que recordar al agregar algo

- Ningún componente lleva `styles` ni `styleUrl`. La hoja es global y la única
  excepción que existe es `app.css`.
- Si el objetivo es tocable, mide 44 por 44 px con 8 px de aire. El aire se
  escribe con `--aire-seguro`, que son 10 px, porque a 8 exactos la medición lee
  7,9 por subpíxeles y eso cuenta como par pegado.
- **Ninguna captura con `full_page=True`.** Apaga la emulación táctil de Chromium
  durante el disparo: la imagen sale de escritorio y la página, que ve aparecer un
  ratón, cambia de versión de verdad. Para fotografiar la página entera se mide el
  alto y se reabre con la ventana de ese alto. Está en `pruebas/tactil/capturas/`.
- **Las tres vistas se miden, no solo la que carga.** El censo y el hit test del
  banco cambian de pestaña y miden mosaico, mapa y lista. Medir solo la primera
  escondió durante toda una ronda que las filas de la vista Lista se tocaban: 20
  pares a 0,0 px de aire en los cuatro tamaños. Si se agrega una cuarta vista, va
  a `comun.VISTAS`.

### Cómo se comprueba

`pruebas/tactil` es un banco de medición con Playwright, fuera de `cliente/`, con
tres comandos y diecinueve comprobaciones. Están en el README y el detalle en `pruebas/tactil/LEEME.md`, con la
tabla de antes y después. Todo cambio que toque la hoja o algo táctil se cierra
corriendo el banco.

## Cómo correrlo

```powershell
# Versión integrada: compila Angular y la sirve desde .NET en un solo puerto
./iniciar.ps1                  # → http://localhost:5080

# Desarrollo: recarga en caliente del cliente
./desarrollo.ps1               # → http://localhost:4200 (API en 5080)
```

## Verificar antes de dar un cambio por terminado

1. `cd cliente && npx ng build` compila sin errores ni advertencias.
2. `cd servidor && dotnet build` compila sin advertencias.
3. `GET http://localhost:5080/api/sistemas` responde 200.
4. La página carga y la búsqueda filtra.
5. Si el cambio fue visual, comparar contra `../propuesta-final.html`.
6. Si el cambio tocó la hoja o algo táctil, correr el banco de `pruebas/tactil`.
   Los tres comandos están en el README.
7. El censo de 1440x900 con ratón tiene que seguir coincidiendo con
   `pruebas/tactil/linea-base.json`. Esa línea base no se reescribe para arreglar
   un fallo: es la prueba de que la versión de escritorio no cambió.

## Reglas

- **Textos:** registro institucional en todo texto visible. Sin rayas, ni la
  larga ni la corta: los incisos van con coma, dos puntos, punto aparte o
  paréntesis. Sin conectores de relleno y sin palabras rebuscadas. Las
  descripciones de portal son de una línea y dicen qué se hace ahí.
- **Accesibilidad:** se conserva la barra de contraste y tamaño de letra, los
  `aria-label` de cada enlace y el foco visible. Ningún cambio puede quitarlos. La
  preferencia de contraste y de tamaño de letra sobrevive a la recarga, y el piso
  del zoom es 1,0.
- **La etiqueta `viewport` no lleva `maximum-scale` ni `user-scalable=no`.** Con
  eso se arreglaría la ampliación de iOS rompiendo el zoom del usuario, que es un
  requisito de accesibilidad. El remedio es que el campo declare 16 px.
- **Una sola hoja.** Ningún componente lleva `styles` ni `styleUrl`: la hoja es
  global y la única excepción que existe es `app.css`. Tampoco se añade framework
  de CSS ni una segunda hoja.
- **Enlaces externos** abren en pestaña nueva con `rel="noopener noreferrer"`.
- **Sin nombres de personas** en ningún texto de la landing.
- **Selectores de atributo.** Los componentes usan `header[app-encabezado]`,
  `section[app-portada]`, etc., para que Angular no agregue envoltorios y el DOM
  quede igual al prototipo. No cambiarlos a selectores de elemento.
- **Una sola fuente de verdad.** No escribir portales dentro del código Angular.
