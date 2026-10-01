# Brief

OBJETO

La landing de portales cumple en escritorio y no cumple en táctil. La medición previa delimita el problema: no hay desborde horizontal ni errores de consola en 390, 430, 768, 1024 ni 1440 px, así que lo que falla no es el ancho sino la ausencia de ratón. Entre 20 y 26 objetivos tocables quedan por debajo de 44 por 44 px según el dispositivo. El enlace del logo mide 135 por 53 px pero su centro devuelve el enlace de salto invisible, de modo que en 390 y 430 px el logo no responde al toque. Una banda muerta de 19 a 28 px atraviesa el centro de cada cabecera de tema, que de 80 px de alto solo acepta 36. La barra flotante de accesibilidad tapa hasta 94 por 39 px de un enlace de portal en casi cualquier punto del recorrido. El conmutador de vistas, el control más usado, mide 98 por 30 px, va pegado con 2,0 px de hueco y desaparece al desplazar: el documento mide 4106 px en 390 px de ancho, y recuperar el conmutador cuesta subir 1294 px. El campo de búsqueda lleva letra de 13 px, por lo que iOS amplía la página al enfocarlo y no la devuelve. La pestaña Mapa se oculta por debajo de 1100 px, así que en tableta de 1024 px no existe aunque haya espacio, y la vista cae a Lista, que mide 5,16 pantallas sin un rótulo de tema fijo.

El trabajo consiste en llevar la landing a una versión táctil sin perder la versión de escritorio. Se fija un solo criterio de entrada: en cuanto el medio declara que no hay puntero fino, es decir cuando matchMedia('(hover: hover)') devuelve false, la interfaz cambia de figura y de tamaños. Nada de la versión de escritorio se reescribe: el bloque táctil se añade al final de cliente/src/styles.css dentro de una consulta (hover:none),(pointer:coarse), y la red de seguridad es que el censo en 1440 px con ratón siga dando los mismos números que la línea base.

ALCANCE EN CUATRO FRENTES

Primero, ergonomía de toque. Todo objetivo llega a 44 por 44 px reales con 8 px de aire entre vecinos: los seis enlaces del menú de tableta, que hoy tienen 12 px de alto, los tres botones de accesibilidad, que tienen 28 por 30 px con 3,0 px de hueco, las ocho búsquedas rápidas, los cinco enlaces del índice pegado y los dos botones del conmutador. Se retiran los dos elementos que roban toques sin ser interactivos, el enlace de salto oculto y la pista de la cabecera de tema, y se cierra el desborde de 52 px que aparece a 195 px CSS, que es lo que deja el zoom al 200 por ciento en un teléfono de 390 px.

Segundo, permanencia y alcance. Los tres controles más usados, buscador, conmutador de vistas y acceso a los temas, pasan a una barra inferior fija con anclaje a env(safe-area-inset-bottom), y el contenido reserva su altura con relleno inferior para que ninguna tarjeta quede debajo. Arriba se queda la identidad institucional. La barra flotante de accesibilidad deja de flotar sobre el contenido.

Tercero, las tarjetas y el logo. El logo vuelve a ser tocable. La marca de agua de la tarjeta deja de depender de un apaño: hoy el toque pone la tarjeta activa 2200 ms y a la vez abre el portal en pestaña nueva, con lo que la marca no se llega a ver. En táctil la marca se muestra sin tocar nada, con la opacidad baja que ya usa el mosaico, y el toque conserva un solo significado, que es abrir el portal. Diez de las 25 tarjetas no tienen archivo de marca y eso se declara como dato, no como defecto.

Cuarto, el mapa. Los 440 px fijos del centro y el alto de 516 px que decide el dato hacen que la rosa desborde su caja 198 px en 390 px y 158 px en 430 px, y que las dos columnas de nombres queden en 0 px. En táctil el mapa se dibuja con otra figura, Barras contadas, y la rosa se conserva intacta para escritorio. El umbral deja de ser el ancho de pantalla y pasa a ser la existencia de puntero, con lo que la tableta de 1024 px recupera la pestaña.

CÓMO SE MIDE

La aplicación corre en http://localhost:4200 con el API en http://localhost:5080. Toda comprobación se hace con Playwright en Python, sync_api, con un contexto de has_touch=True e is_mobile=True, porque es lo único que hace que matchMedia('(hover: hover)') devuelva false, que es de lo que depende la interfaz táctil. Las páginas se abren con wait_until="load" y nunca con "networkidle", porque el servidor de desarrollo deja un websocket abierto. Los guiones viven en landing-portales\pruebas\tactil, fuera de cliente, y se ejecutan con PYTHONIOENCODING=utf-8 python. El banco de medición es el paso 1 y todos los demás pasos cierran con una de sus comprobaciones.

REPARTO DEL TRABAJO

Cinco carriles, repartidos por quién escribe en qué archivo. El carril de Medida es dueño de landing-packages\pruebas\tactil y nunca escribe en cliente. El carril de Hoja es el único escritor de cliente\src\styles.css, que es un solo archivo y por tanto el eje serial del plan: dos pasos que la tocan no se lanzan a la vez, aunque escriban en secciones distintas. El carril de Casco trabaja el encabezado, la accesibilidad y la barra inferior. El carril de Mapa trabaja la figura táctil y el umbral. El carril de Revisión cierra cada paso ejecutando la comprobación del banco, y no lo lleva quien hizo el cambio. Los pasos 1 y 10 no tocan la hoja de estilo y corren en paralelo con el carril de la hoja.

REGLAS QUE NO SE NEGOCIAN

El API no cambia: GET /api/health y GET /api/sistemas con la misma forma. Ni portales, ni temas, ni favoritos se escriben dentro del código. Los componentes nuevos usan selector de atributo. Cada enlace externo conserva aria-label, target="_blank" y rel="noopener noreferrer". El foco visible, prefers-reduced-motion, el alto contraste y la ampliación de letra se conservan. No se pone maximum-scale ni user-scalable=no en ningún caso, porque eso arregla el síntoma del zoom rompiendo un requisito de accesibilidad. Los textos siguen el registro institucional, sin rayas y sin nombres de personas.


# Decisión sobre el mapa

Se lleva Barras contadas, que es la ganadora del panel con 4,5 sobre 5. La razón decisiva es la prueba del encargo, una mano y con prisa: todo objetivo es una fila de ancho completo, 326 por 76 px cerrada y 326 por 56 px abierta, el gesto es siempre un toque con un solo significado, no hay objetivos por debajo de 44 por 44 px y nada queda escondido detrás de un gesto, porque el nombre, el dominio y el conteo van impresos. Conserva además la única lectura que ninguna otra vista da, que es ver dónde cayó la respuesta al buscar, y lo hace por la vía correcta: el apagado se pinta cambiando el relleno a #ece7ff y no bajando la opacidad, que es la lección del problema de los logos. Su esfuerzo es el más contenido porque no toca cliente\src\app\nucleo\geometria-rosa.ts ni añade señales al store, y deja la rosa de escritorio intacta.

De Rosa brújula se toma su hallazgo central, que es obligatorio y corrige un error de la ganadora: el umbral del mapa no puede ser el ancho de contenedor. Con .wrap en min(1240px, calc(100% - 48px)), una tableta táctil de 1024 px da un contenedor de 976 px, así que un umbral de 940 px pintaría la rosa justo donde el nivel de portal es inalcanzable con el dedo. El umbral pasa a ser doble: barras siempre que conPuntero() sea falso, y rosa solo con puntero y contenedor por encima de 1100 px. La guarda ya existe sin usar en cliente\src\app\servicios\directorio.store.ts:134 y hoy solo la leen mosaico.ts:142 y resplandor.ts; el mapa nunca la consulta. Se toma también su lectura de que la pestaña Mapa no debe desaparecer en tableta.

De Temas plegados se toma el zócalo inferior fijo con env(safe-area-inset-bottom) y relleno compensatorio en el contenido, que es la única idea de las tres que ataca de frente el uso con una mano, y su trabajo de persistencia del tamaño de letra. Se toma como tarea hermana, el paso 11, no dentro del mapa. Se rechaza el resto de esa propuesta: quitar el conmutador, quitar las tres vistas en táctil y suprimir la elección de vista es una decisión de producto que no sale de un plan de responsividad y que tendría que aprobarse por escrito y antes.

Consecuencia que debe quedar escrita en la entrega: la pestaña Mapa nombra dos figuras distintas, la rosa con ratón y las barras contadas sin ratón. No se descubre en la revisión, se declara.


# Criterios de cierre

- Censo de objetivos: 0 objetivos tocables por debajo de 44 por 44 px y 0 pares de vecinos por debajo de 8 px, en 390x844, 430x932, 768x1024 y 1024x768 con has_touch e is_mobile, a zoom 1,0 y 1,3. La línea base tenía entre 20 y 26 por debajo de 44 px.

- Hit test: el centro de cada control devuelve ese control. En particular el enlace del logo en los tres tamaños, el enlace 'Inicio' de la nav en 768 px, cinco alturas distintas de cada cabecera de tema, los tres botones de accesibilidad y cada barra del mapa táctil. Ningún punto de la esquina superior izquierda devuelve a.saltar.

- Solapes: la lista de solapes entre elementos de posición fija y enlaces sale vacía al 0, 20, 50 y 100 por ciento del recorrido, en los cuatro tamaños táctiles. La línea base tenía solapes de 83 a 94 por 39 px.

- Permanencia y alcance: con scrollY=2000, buscador, conmutador de vistas y acceso a temas siguen en pantalla y el centro de los tres cae en el tercio inferior de la ventana. La última tarjeta de la página queda entera, sin nada fijo encima.

- Reflow: desborde horizontal 0 a 320, 195 y 160 px CSS. La línea base tenía 0, 52 y 87 px.

- Ampliación de iOS: el campo #query tiene font-size 16px y 45 px de alto en móvil, el ancho del documento no cambia al enfocarlo, e index.html no contiene maximum-scale ni user-scalable.

- Tarjetas: un tap abre exactamente 1 pestaña, sin doble significado ni temporizador; la marca de agua tiene opacidad mayor que 0 sin tocar nada en las 15 tarjetas que tienen archivo; en alto contraste sigue oculta y el texto de la tarjeta conserva 4,5 a 1 o más.

- Mapa: en 1024x768 con has_touch la pestaña Mapa existe, mide 44 px de alto y pinta Barras contadas; en 1440x900 con ratón pinta la rosa con lienzo de 440 por 516 px, idéntica a la línea base. En el mapa táctil, arrastrar desde una fila y soltar fuera abre 0 pestañas, y el apagado de la búsqueda se hace con relleno #ece7ff y opacidad 1.

- Accesibilidad conservada: cada enlace externo con aria-label, target=_blank y rel=noopener noreferrer; foco visible en los cuatro tamaños; recorrido completo con Tab en las tres vistas sin entrar en lo que tiene inert; prefers-reduced-motion sin transiciones; la preferencia de tamaño de letra y de contraste sobrevive a la recarga; el piso del zoom es 1,0.

- Sin regresión de escritorio: el censo en 1440x900 sin has_touch coincide con linea-base.json en ancho y alto de todos los objetivos medidos, y geometria-rosa.ts no tiene cambios.

- Salud del proyecto: 0 errores de consola en los cinco tamaños, npx ng build sin advertencias, dotnet build sin advertencias, GET /api/sistemas 200 y portales.json con el mismo hash.

- Reproducible por un tercero: PYTHONIOENCODING=utf-8 python pruebas\tactil\auditoria.py imprime las diez comprobaciones con PASA o FALLA y sus cifras, siguiendo solo el README.


# Fuera de alcance

- No se toca cliente\src\app\nucleo\geometria-rosa.ts ni la rosa de escritorio. La figura aprobada se conserva como está, y la prueba de que sigue igual es que el censo en 1440 px con ratón no cambia. Liberar los 440 px del centro era la vía de Rosa brújula y no gana el panel.

- No se quita el conmutador ni ninguna de las tres vistas en táctil, ni se suprime la elección de vista. Era el núcleo de Temas plegados y es una decisión de producto, no de responsividad: tendría que aprobarse por escrito y antes.

- No se cambia el API, ni las rutas GET /api/health y GET /api/sistemas, ni la forma de la respuesta, ni servidor\Datos\portales.json. El contrato es lo que permite integrar con el ISI.

- No se pone maximum-scale ni user-scalable=no en la etiqueta viewport. Arregla la ampliación de iOS rompiendo el zoom del usuario, que es un requisito de accesibilidad.

- No se añaden logos para los 10 portales que hoy no tienen archivo de marca. Es contenido y entra por el JSON y por la carpeta de marcas, no por el código.

- No se rediseña la sección de accesos favoritos ni sus cifras más allá de los tamaños de toque. Su bento ya se reparte en dos columnas en móvil y no está entre los problemas medidos.

- No se añaden gestos de arrastre, de pinza ni de mantener pulsado, ni menús con capas superpuestas. Todo se resuelve con un toque de un solo significado, que es lo que aguanta la prueba de una mano y con prisa.

- No se añade Router, ni framework de CSS, ni hoja de estilo adicional, ni instalación como aplicación ni funcionamiento sin conexión. La landing sigue siendo una sola hoja de CSS plano y el estado por URL sigue en pedido.ts.

- No se prueba en dispositivos físicos ni en Safari de iOS real. La medición es Chromium con has_touch e is_mobile, que es lo que hay. De la ampliación al enfocar y de env(safe-area-inset-*) se comprueba el código, no el comportamiento, y queda anotado como riesgo con una revisión pendiente en un teléfono con muesca.

- No se reescriben los textos institucionales, salvo los dos que nombran el ratón cuando no hay ratón: la ayuda de la vista mapa y la pista de la cabecera de tema.


# Riesgos

- Chromium con has_touch no es Safari de iOS. La ampliación al enfocar un campo de menos de 16 px y el valor real de env(safe-area-inset-bottom) no se pueden comprobar ahí. Mitigación: comprobar el código, 16 px declarados y presencia de env, y pedir una revisión en un teléfono con muesca antes de la entrega.

- styles.css es un solo archivo y el eje serial del plan. Si se escribe desde dos sitios a la vez se pierde trabajo aunque toquen secciones distintas. Mitigación: un único escritor en cada momento, una sección nombrada por paso, y ningún par de pasos que la toquen marcado como paralelo.

- Una regla táctil escrita fuera de la consulta (hover:none),(pointer:coarse) se filtra a escritorio y rompe la fidelidad al prototipo, que es requisito del proyecto. Mitigación: el censo en 1440 px con ratón contra la línea base cierra cada paso de la hoja.

- El zócalo fijo resta alto útil de pantalla. Con 25 portales el recorrido crece y con la letra ampliada al máximo más. Mitigación: medir el alto del zócalo a zoom 1,3 y reservar su altura con relleno inferior, no con margen.

- La pestaña Mapa nombra dos figuras distintas según haya ratón o no. Puede desconcertar a quien pase de un equipo a otro. Mitigación: queda escrito en GUIA.md y en la entrega, no se descubre en la revisión.

- El umbral por conPuntero() hace que un portátil táctil con ratón vea la rosa y no las barras. Es la decisión deliberada: manda hover:hover. Queda anotada, junto con el caso contrario de una tableta con teclado y ratón acoplados.

- La marca de agua siempre visible en táctil baja el contraste del texto de la tarjeta. Mitigación: medir 4,5 a 1 con la marca puesta, en normal y en alto contraste, donde la marca sigue oculta.

- body.style.zoom, que es lo que usan A+ y A−, no es una propiedad estándar. Las medidas a 1,3 dependen de Chromium. Mitigación: las comprobaciones de tamaño se dan también a zoom 1,0, que es el caso obligatorio.

- El paso 14 y el paso 11 se solapan en el tiempo y los dos necesitan sección propia en la hoja. Si el carril del mapa escribe su CSS antes de que la hoja quede libre, se pisan. Mitigación: entrega el componente y el texto exacto de su sección, y la sección se aplica cuando el carril de la hoja se libera.
