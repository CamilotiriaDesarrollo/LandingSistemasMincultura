# Landing de portales

Directorio de los portales y sistemas de información del Ministerio de las
Culturas, las Artes y los Saberes. Angular 20 en el cliente, ASP.NET Core
(.NET 10) en el servidor.

> **Es un prototipo.** Este repositorio no es un sitio oficial del Ministerio ni
> está publicado por él: es una propuesta de navegación en desarrollo, con corte
> del 30 de septiembre de 2026. Los 25 portales que reúne son públicos y sus
> direcciones salen del directorio oficial. Cada portal conserva su sitio y su
> operación; aquí solo se unifica la forma de entrar.

## Correrla

```powershell
./iniciar.ps1        # compila y abre http://localhost:5080
./desarrollo.ps1     # modo desarrollo, http://localhost:4200
```

Requiere Node.js 20 o superior y el SDK de .NET 10.

## Móvil y tableta

La landing tiene dos versiones, la de escritorio y la táctil, y el umbral entre
las dos no es el ancho de la pantalla: es la existencia de puntero fino. En
cuanto el aparato declara que no hay ratón, es decir cuando
`matchMedia('(hover: hover)')` devuelve `false`, los objetivos pasan a 44 por 44
px, aparece un zócalo abajo con el buscador, el conmutador de vistas y el acceso
a los temas, y la vista mapa cambia de figura. Una tableta de 1.024 px recibe la
versión táctil y una ventana estrecha de escritorio no.

Tres cosas que conviene saber antes de tocar nada:

- La pestaña Mapa nombra **dos figuras distintas**: la rosa de los saberes con
  ratón, y Barras contadas sin ratón. No es un error de la revisión.
- Todo el CSS táctil vive en un bloque al final de `cliente/src/styles.css`,
  dentro de `@media (hover:none),(pointer:coarse)`. Nada táctil se escribe fuera
  de esa consulta.
- La etiqueta `viewport` no lleva `maximum-scale` ni `user-scalable=no`, y no se
  le añaden: el zoom del usuario es un requisito de accesibilidad.

## Cambiar el contenido

Los portales, los temas y los favoritos están en un solo archivo:
`servidor/Datos/portales.json`. Al guardarlo, el cambio se ve al recargar la
página, sin reiniciar nada. Si el archivo queda con un error, la página lo
indica y el servidor dice exactamente qué corregir.

### Por qué son 25 y no 29

Corte del 30 de septiembre de 2026, contra la página oficial del Ministerio
(`mincultura.gov.co/Paginas/portales-y-sistemas-de-informacion.aspx`), que ese
día listaba 29 entradas en cuatro grupos:

| Grupo | Oficial | Aquí |
|---|---|---|
| Entidades culturales | 11 | 11 |
| Portales de proyectos | 10 | 10 |
| Portales de servicios | 4 | 4 |
| Sistemas internos | 4 | 0 |

Los cuatro que faltan son AZ-Digital, Siempre, Nómina y Correo institucional.
Se dejan fuera a propósito: piden inicio de sesión y son de uso del equipo del
Ministerio, no de quien consulta el directorio. Agregarlos obligaría además a
abrir un sexto tema y a cambiar el texto del buscador, que dice «portales
públicos». Si algún día entran, este es el motivo que habría que revisar.

Dos diferencias de enlace frente a la página oficial, a favor de este archivo:
aquí los sitios van en `https` donde la oficial todavía enlaza en `http`, y
PQRSD apunta al formulario ciudadano (`/PQRSD/Publica/`) y no al panel
administrativo.

## Medir la versión táctil

Hay un banco de medición en `pruebas/tactil`. Abre la página en un navegador real
con un contexto que declara pantalla táctil y sin ratón, y mide con qué se
encuentra un dedo: tamaños de toque, aire entre vecinos, qué responde en el
centro de cada control, qué tapa un elemento fijo, si algún enlace queda atrapado
debajo del zócalo, desborde horizontal, foco, recorrido con Tab y las dos figuras
del mapa.

Hace falta Python 3.10 o superior, una vez:

```powershell
pip install playwright
python -m playwright install chromium
```

Con la landing en pie en otra consola, desde la raíz del proyecto:

```powershell
./desarrollo.ps1                                 # en otra consola

$env:PYTHONIOENCODING = "utf-8"
python pruebas\tactil\auditoria.py               # 7 comprobaciones de medida
python pruebas\tactil\accesibilidad_cierre.py    # 8 de accesibilidad y no regresión
python pruebas\tactil\cierre_mapa_tarjetas.py    # 4 de mapa y tarjetas
```

Cada guion imprime sus comprobaciones con `PASA` o `FALLA` y sus cifras. Los dos
primeros devuelven 0 cuando todo pasa y 1 cuando algo falla; el tercero devuelve
siempre 0, así que su veredicto se lee en el resumen que imprime al final. Entre
los tres tardan unos treinta minutos y no tocan ningún archivo del cliente. La
mayor parte se la lleva `auditoria.py`, que recorre las tres vistas de los cuatro
tamaños en dos ampliaciones y además camina la página entera buscando enlaces
atrapados.

`PYTHONIOENCODING=utf-8` no es opcional: la salida lleva tildes. Y la landing
tiene que estar en `http://localhost:4200` con el API en `http://localhost:5080`,
porque el banco mide la página servida y no el código.

El detalle de qué exige cada comprobación, la tabla de antes y después con las
cifras medidas y lo que el banco no puede medir están en
`pruebas/tactil/LEEME.md`.

## Publicar

`./iniciar.ps1` deja el cliente compilado dentro de `servidor/wwwroot`. Para
publicar basta con el servidor:

```powershell
cd servidor
dotnet publish -c Release -o ../publicacion
```

La carpeta `publicacion` se despliega en IIS o como servicio de Kestrel.

## API

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/sistemas` | Temas, portales y favoritos |

Es el mismo contrato del Portal ISI.
