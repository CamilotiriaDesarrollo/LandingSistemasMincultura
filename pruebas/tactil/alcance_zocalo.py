"""
Alcance: ningun enlace queda imposible de destapar por debajo del zocalo.

Esta comprobacion existe porque el criterio de solapes no la cubre. El criterio
de solapes se da sobre elementos de position fixed, y con razon: un elemento fijo
tapa lo mismo en cualquier punto del recorrido y no hay forma de sacarlo de ahi.
El zocalo es pegado, no fijo, asi que pasa por encima del contenido al desplazar
igual que cualquier barra inferior de telefono, y el criterio de solapes lo deja
pasar. La pregunta que queda sin responder es la que de verdad importa:

    ¿hay algun enlace que, en NINGUNA posicion del recorrido, se pueda tocar?

Eso seria el defecto. Un enlace que el zocalo acompaña hacia abajo y nunca suelta
no se puede abrir con el dedo, y ninguna otra comprobacion del banco lo ve.

Como se mide: se recorre la pagina de 80 en 80 px en las tres vistas y en cada
parada se pregunta a elementFromPoint por el centro de cada enlace que esta
entero dentro de la ventana. Un enlace pasa en cuanto su centro devuelve el
propio enlace UNA vez en todo el recorrido. Lo que se cuenta como fallo son los
que no lo consiguen ni una.

Se anota tambien, como dato y no como condicion, en cuantas paradas el zocalo se
cruza con un enlace. Esa cifra no es un defecto: es lo propio de una barra
inferior y baja a cero al llegar al final de la pagina, donde el zocalo vuelve a
su sitio del flujo.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\tactil\alcance_zocalo.py
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import comun

NOMBRE = "Alcance: ningun enlace queda atrapado debajo del zocalo"

#: Paso del recorrido, en px CSS. 80 px es menos que el alto del zocalo en los
#: cuatro tamanos, asi que ningun enlace puede cruzar la barra entre dos paradas
#: sin que alguna lo pille fuera de ella.
PASO = 80

#: Que se mide. Los enlaces de portal y, en el mapa tactil, los dos mandos de la
#: figura: la cabecera de cada barra y la fila de cada portal.
SEL_MEDIBLE = 'a[href^="http"], button.barra-cabecera, a.barra-fila'

JS_PARADA = comun.js(
    """
  const z = document.querySelector('.zocalo');
  const rz = z && pintado(z) ? z.getBoundingClientRect() : null;
  const salida = [];
  for (const e of document.querySelectorAll(datos)) {
    if (!pintado(e)) continue;
    const r = e.getBoundingClientRect();
    const cx = Math.min(window.innerWidth - 1, Math.max(0, r.x + r.width / 2));
    const cy = Math.min(window.innerHeight - 1, Math.max(0, r.y + r.height / 2));
    const tocado = document.elementFromPoint(cx, cy);
    const dueno = tocado ? tocado.closest(SEL) : null;
    let cruza = false;
    if (rz) {
      const w = Math.min(r.right, rz.right) - Math.max(r.left, rz.left);
      const h = Math.min(r.bottom, rz.bottom) - Math.max(r.top, rz.top);
      cruza = w > 0 && h > 0;
    }
    salida.push({
      clave: nombre(e) + '|' + rotulo(e),
      // Entero dentro de la ventana: un enlace cortado por el canto de arriba
      // tiene el centro fuera y la pregunta no significa nada.
      dentro: r.top >= 0 && r.bottom <= window.innerHeight,
      suyo: dueno === e || (dueno && e.contains(dueno)) || !!(tocado && e.contains(tocado)),
      cruza_el_zocalo: cruza,
      quien: nombre(tocado),
    });
  }
  return { scroll: Math.round(window.scrollY), enlaces: salida };
"""
)


def medir_vista(pagina: Page) -> dict[str, Any]:
    """Recorre la pagina entera en la vista que este puesta."""
    alcanzados: set[str] = set()
    pendientes: dict[str, str] = {}
    cruces = 0
    paradas = 0
    recorrido = comun.recorrido(pagina)
    y = 0.0
    while True:
        comun.ir_a(pagina, y)
        d: dict[str, Any] = pagina.evaluate(JS_PARADA, SEL_MEDIBLE)
        paradas += 1
        for e in d["enlaces"]:
            if e["cruza_el_zocalo"] and e["dentro"]:
                cruces += 1
            if e["dentro"] and e["suyo"]:
                alcanzados.add(e["clave"])
            elif e["clave"] not in alcanzados:
                pendientes[e["clave"]] = e["quien"]
        if y >= recorrido:
            break
        y = min(y + PASO, recorrido)
    atrapados = {k: q for k, q in pendientes.items() if k not in alcanzados}
    return {
        "paradas": paradas,
        "recorrido": round(recorrido),
        "enlaces": len(alcanzados) + len(atrapados),
        "alcanzables": len(alcanzados),
        "atrapados": [{"clave": k, "lo_tapa": q} for k, q in atrapados.items()],
        "cruces_con_el_zocalo": cruces,
    }


def medir(
    navegador: Browser, tamanos: tuple[tuple[str, int, int], ...] = comun.TACTILES
) -> dict[str, Any]:
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in tamanos:
        with comun.abrir(navegador, ancho, alto, etiqueta=etiqueta) as pagina:
            for vista in comun.VISTAS:
                if vista != comun.VISTAS[0]:
                    comun.cambiar_vista(pagina, vista)
                resultado[f"{etiqueta} {vista}"] = medir_vista(pagina)
    return resultado


def juzgar(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """Objetivo: 0 enlaces atrapados en las tres vistas de los cuatro tamanos."""
    cifras: list[str] = []
    ok = True
    for clave, d in datos.items():
        ok = ok and not d["atrapados"]
        cifras.append(
            f"{clave}: {d['enlaces']} enlaces medidos, {d['alcanzables']} alcanzables, "
            f"{len(d['atrapados'])} atrapados; {d['cruces_con_el_zocalo']} cruces con el "
            f"zocalo en {d['paradas']} paradas de {d['recorrido']} px, que es dato"
        )
        for a in d["atrapados"][:4]:
            cifras.append(f"  {a['clave'].split('|')[0]} lo tapa {a['lo_tapa']}  [{clave}]")
    return ok, cifras


def main() -> int:
    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        datos = medir(navegador)
        navegador.close()
    comun.titulo(NOMBRE)
    ok, cifras = juzgar(datos)
    comun.veredicto(NOMBRE, ok, cifras)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
