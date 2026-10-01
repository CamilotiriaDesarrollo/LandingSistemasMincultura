"""
Infraestructura compartida del banco de medicion tactil.

Aqui vive lo que los cinco guiones necesitan en comun: el contexto tactil, la
espera de pintado, el selector de objetivo tocable, el calculo de huecos entre
vecinos, el registro de errores de consola y el formato de salida con PASA o
FALLA.

Dos decisiones que no se cambian sin medir otra vez:

1. El contexto se abre con has_touch=True e is_mobile=True. Es lo unico que hace
   que matchMedia('(hover: hover)') devuelva false, y de esa consulta depende la
   interfaz tactil. Sin is_mobile el navegador sigue declarando puntero fino y
   la medicion mide la version de escritorio en una ventana estrecha.

2. Las paginas se abren con wait_until="load" y nunca con "networkidle": el
   servidor de desarrollo deja un websocket abierto y la espera expira.

La hoja de estilo trae html{scroll-behavior:smooth}, asi que todo desplazamiento
de medicion se pide con behavior:'instant'. Con el desplazamiento suave la
lectura de coordenadas cae en mitad de la animacion y las cifras no se repiten.
"""

from __future__ import annotations

import json
import sys
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from playwright.sync_api import Browser, Page

# --------------------------- Constantes del banco ---------------------------

URL = "http://localhost:4200/"
URL_SALUD = "http://localhost:5080/api/health"

CARPETA = Path(__file__).resolve().parent
RUTA_LINEA_BASE = CARPETA / "linea-base.json"

#: Lado minimo de un objetivo tocable, en px CSS.
LADO_MINIMO = 44.0
#: Aire minimo entre dos objetivos vecinos, en px CSS.
AIRE_MINIMO = 8.0

#: Tamanos tactiles obligatorios: telefono, telefono grande, tableta vertical,
#: tableta horizontal.
TACTILES: tuple[tuple[str, int, int], ...] = (
    ("390x844", 390, 844),
    ("430x932", 430, 932),
    ("768x1024", 768, 1024),
    ("1024x768", 1024, 768),
)

#: El quinto tamano se mide con raton: es la red de seguridad de escritorio.
ESCRITORIO: tuple[str, int, int] = ("1440x900", 1440, 900)

#: Anchos de reflow en px CSS. 195 es lo que deja el zoom al 200 por ciento en
#: un telefono de 390 px; 98 es el 400 por ciento y se mide como dato.
ANCHOS_REFLOW: tuple[int, ...] = (320, 195, 160, 98)

#: Ampliaciones de letra. 1,0 es el caso obligatorio; 1,3 es el techo que fija
#: el boton A+ de la barra de accesibilidad.
ZOOMS: tuple[float, ...] = (1.0, 1.3)

#: Fracciones del recorrido en las que se buscan solapes.
PARADAS_RECORRIDO: tuple[float, ...] = (0.0, 0.2, 0.5, 1.0)

#: Todo lo que un dedo puede tocar.
SEL_TOCABLE = (
    'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), '
    "select:not([disabled]), textarea:not([disabled]), summary, "
    '[tabindex]:not([tabindex="-1"]), [role="button"], [contenteditable="true"]'
)

# --------------------------- Errores de consola ---------------------------

_consola: list[dict[str, str]] = []


def _anotar_consola(donde: str, tipo: str, texto: str) -> None:
    _consola.append({"donde": donde, "tipo": tipo, "texto": texto[:400]})


def errores_consola() -> list[dict[str, str]]:
    """Todo error de consola recogido desde el arranque del proceso."""
    return list(_consola)


def olvidar_consola() -> None:
    _consola.clear()


# --------------------------- Apertura de paginas ---------------------------


def nuevo_contexto(navegador: Browser, ancho: int, alto: int, *, tactil: bool = True) -> Any:
    return navegador.new_context(
        viewport={"width": ancho, "height": alto},
        has_touch=tactil,
        is_mobile=tactil,
        device_scale_factor=3 if tactil else 1,
        locale="es-CO",
    )


@contextmanager
def abrir(
    navegador: Browser,
    ancho: int,
    alto: int,
    *,
    tactil: bool = True,
    zoom: float = 1.0,
    etiqueta: str = "",
) -> Iterator[Page]:
    """
    Abre la landing en un contexto tactil o de escritorio y la deja lista para
    medir. Cierra el contexto al salir.
    """
    contexto = nuevo_contexto(navegador, ancho, alto, tactil=tactil)
    pagina = contexto.new_page()
    marca = etiqueta or f"{ancho}x{alto}{'' if tactil else ' con raton'}"

    def al_mensaje(m: Any) -> None:
        if m.type == "error":
            _anotar_consola(marca, "error", m.text)

    pagina.on("console", al_mensaje)
    pagina.on("pageerror", lambda e: _anotar_consola(marca, "pageerror", str(e)))

    pagina.goto(URL, wait_until="load")
    esperar_pintado(pagina)
    if zoom != 1.0:
        aplicar_zoom(pagina, zoom)
    try:
        yield pagina
    finally:
        contexto.close()


def esperar_pintado(pagina: Page, *, espera: int = 20000) -> None:
    """
    Espera a que el API responda y el mosaico quede quieto. El store tiene una
    fase firme de 400 ms y los numeros de tema se animan, asi que no basta con
    que el primer tema exista: se espera a que el alto del documento repita.
    """
    pagina.wait_for_selector("#mosaico .tema-boton", state="attached", timeout=espera)
    pagina.wait_for_function(
        "() => document.fonts ? document.fonts.status === 'loaded' : true", timeout=espera
    )
    anterior = -1
    for _ in range(25):
        pagina.wait_for_timeout(200)
        alto = pagina.evaluate("document.documentElement.scrollHeight")
        if alto == anterior:
            return
        anterior = alto
    # Sin estabilizar en 5 s se sigue adelante: la cifra se anota igual y la
    # comprobacion de consola deja constancia si algo fallo de verdad.


def aplicar_zoom(pagina: Page, zoom: float) -> None:
    """
    Amplia la letra igual que el boton A+ de la barra de accesibilidad, que usa
    body.style.zoom. No es una propiedad estandar: las medidas a 1,3 dependen de
    Chromium y por eso toda comprobacion se da tambien a 1,0.
    """
    pagina.evaluate("z => { document.body.style.zoom = String(z); }", zoom)
    pagina.wait_for_timeout(400)
    pagina.evaluate("document.body.offsetHeight")


#: Las tres vistas del conmutador, en el orden en que las pinta la pagina.
VISTAS: tuple[str, ...] = ("mosaico", "mapa", "lista")


def cambiar_vista(pagina: Page, vista: str) -> None:
    """
    Pulsa la pestana del conmutador y espera a que el bloque de esa vista quede
    pintado.

    Hace falta porque un censo de una sola vista no mide las otras dos: las tres
    viven siempre en el DOM y se ocultan con [hidden], asi que lo que no esta a
    la vista no entra en el censo de objetivos tocables. Sin esto, las cabeceras
    de barra del mapa tactil y las filas de la lista no se median nunca.

    La pestana Mapa pinta uno de dos bloques segun haya puntero fino o no, asi
    que se espera por los dos y basta con que uno quede visible.
    """
    if vista not in VISTAS:
        raise ValueError(f"vista desconocida: {vista}")
    boton = pagina.locator(f'.conmutador button[data-vista="{vista}"]')
    if boton.count() == 0:
        raise RuntimeError(f"no hay pestana para la vista {vista}")
    boton.first.click()
    destinos = ("#mapa", "#mapa-barras") if vista == "mapa" else (f"#{vista}",)
    pagina.wait_for_function(
        "sels => sels.some((s) => { const e = document.querySelector(s);"
        " return e && !e.hasAttribute('hidden') && e.getClientRects().length > 0; })",
        arg=list(destinos),
        timeout=10000,
    )
    # El mosaico reparte con una transicion de vista y el mapa cuenta los
    # numeros al entrar: sin esta espera el censo coge cajas a medio mover.
    pagina.wait_for_timeout(700)
    pagina.evaluate("window.scrollTo({ top: 0, left: 0, behavior: 'instant' })")
    pagina.wait_for_timeout(150)


def ir_a(pagina: Page, y: float) -> None:
    """Desplazamiento instantaneo. Nunca suave: la medicion no espera animacion."""
    pagina.evaluate("y => window.scrollTo({ top: y, left: 0, behavior: 'instant' })", y)
    pagina.wait_for_timeout(250)


def recorrido(pagina: Page) -> float:
    return float(
        pagina.evaluate(
            "Math.max(0, document.documentElement.scrollHeight - window.innerHeight)"
        )
    )


# --------------------- Fragmentos de JavaScript compartidos ---------------------

_PLANTILLA_UTILES = r"""
  const SEL = __SEL__;
  const nombre = (e) => {
    if (!e) return 'nada';
    const bruto = (e.getAttribute && e.getAttribute('class')) || '';
    const cls = bruto.trim().split(/\s+/).filter(Boolean);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls.length ? '.' + cls.join('.') : '');
  };
  const rotulo = (e) => (((e.getAttribute && e.getAttribute('aria-label')) || e.textContent || '')
    .replace(/\s+/g, ' ').trim().slice(0, 44));
  const ruta = (e) => {
    const partes = [];
    let n = e;
    while (n && n.nodeType === 1 && n !== document.body) {
      const p = n.parentElement;
      if (!p) break;
      partes.unshift(n.tagName.toLowerCase() + ':nth-child(' + ([].indexOf.call(p.children, n) + 1) + ')');
      n = p;
    }
    return 'body>' + partes.join('>');
  };
  const pintado = (e) => {
    if (e.closest('[hidden]') || e.closest('[inert]')) return false;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const objetivos = () => {
    const vistos = new Map();
    const lista = [];
    const puestos = new Set();
    for (const e of document.querySelectorAll(SEL)) {
      if (puestos.has(e)) continue;
      if (!pintado(e)) continue;
      puestos.add(e);
      const base = nombre(e) + '|' + rotulo(e);
      const n = (vistos.get(base) || 0) + 1;
      vistos.set(base, n);
      lista.push({ el: e, clave: base + '|' + n });
    }
    return lista;
  };
  const fijoQueTapa = (e) => {
    let n = e;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === 'fixed') return n;
      n = n.parentElement;
    }
    return null;
  };
  const aCaja = (r) => ({
    x: +(r.x + window.scrollX).toFixed(1),
    y: +(r.y + window.scrollY).toFixed(1),
    ancho: +r.width.toFixed(1),
    alto: +r.height.toFixed(1),
  });
"""

#: Utilidades que se inyectan al principio de cada medicion.
JS_UTILES = _PLANTILLA_UTILES.replace("__SEL__", json.dumps(SEL_TOCABLE))


def js(cuerpo: str) -> str:
    """Envuelve un cuerpo de medicion con las utilidades compartidas."""
    return "(datos) => {\n" + JS_UTILES + "\n" + cuerpo + "\n}"


# --------------------------- Huecos entre vecinos ---------------------------


def hueco(a: dict[str, Any], b: dict[str, Any]) -> float | None:
    """
    Aire entre dos objetivos vecinos, en px CSS. Devuelve None cuando no son
    vecinos, es decir cuando se cruzan en diagonal y no comparten franja en
    ninguno de los dos ejes: entre esos dos el dedo no se equivoca.

    Dos objetivos que se pisan devuelven 0,0.
    """
    a_der, a_ab = a["x"] + a["ancho"], a["y"] + a["alto"]
    b_der, b_ab = b["x"] + b["ancho"], b["y"] + b["alto"]

    dx = max(0.0, a["x"] - b_der, b["x"] - a_der)
    dy = max(0.0, a["y"] - b_ab, b["y"] - a_ab)

    solape_x = min(a_der, b_der) - max(a["x"], b["x"])
    solape_y = min(a_ab, b_ab) - max(a["y"], b["y"])

    if dx > 0 and dy > 0:
        return None
    if dx == 0 and dy == 0:
        return 0.0
    if dx == 0:
        # Vecinos en vertical: tienen que compartir franja horizontal de verdad.
        return round(dy, 1) if solape_x > 4 else None
    return round(dx, 1) if solape_y > 4 else None


def pares_pegados(objetivos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pares de vecinos con menos de 8 px de aire, del mas pegado al menos."""
    pares: list[dict[str, Any]] = []
    for i, a in enumerate(objetivos):
        for b in objetivos[i + 1 :]:
            # Un objetivo dentro de otro no es un vecino: es el mismo toque.
            if a["ruta"].startswith(b["ruta"]) or b["ruta"].startswith(a["ruta"]):
                continue
            h = hueco(a, b)
            if h is None or h >= AIRE_MINIMO:
                continue
            pares.append({"a": a["clave"], "b": b["clave"], "hueco": h})
    pares.sort(key=lambda p: p["hueco"])
    return pares


# --------------------------- Salida ---------------------------

_ANCHO = 78


def titulo(texto: str) -> None:
    print()
    print("=" * _ANCHO)
    print(texto)
    print("=" * _ANCHO)


def apartado(texto: str) -> None:
    print()
    print(texto)
    print("-" * min(len(texto), _ANCHO))


def veredicto(nombre: str, ok: bool, cifras: list[str]) -> None:
    print(f"[{'PASA ' if ok else 'FALLA'}] {nombre}")
    for linea in cifras:
        print(f"         {linea}")


def aviso(texto: str) -> None:
    print(f"[AVISO] {texto}")


def dato(nombre: str, valor: Any) -> None:
    print(f"  {nombre}: {valor}")


def num(v: float) -> str:
    """Cifra con coma decimal, como el resto del proyecto."""
    return f"{float(v):.1f}".replace(".", ",")


# --------------------------- Linea base ---------------------------


def leer_linea_base() -> dict[str, Any] | None:
    if not RUTA_LINEA_BASE.exists():
        return None
    return json.loads(RUTA_LINEA_BASE.read_text(encoding="utf-8"))


def escribir_linea_base(datos: dict[str, Any]) -> None:
    datos = dict(datos)
    datos["generado"] = datetime.now().isoformat(timespec="seconds")
    RUTA_LINEA_BASE.write_text(
        json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def comprobar_servidores() -> None:
    """
    Sin la landing en pie no hay medicion. Se avisa con el comando exacto en vez
    de dejar caer un error de red de Playwright.
    """
    import urllib.request

    for direccion in (URL, URL_SALUD):
        try:
            with urllib.request.urlopen(direccion, timeout=8) as r:
                if r.status != 200:
                    raise RuntimeError(str(r.status))
        except Exception as e:  # noqa: BLE001
            print(f"No responde {direccion} ({e}).")
            print("Levanta la landing con .\\desarrollo.ps1 y vuelve a ejecutar.")
            sys.exit(2)
