"""
Solapes: que tapa un elemento de posicion fija y cuanto.

La barra flotante de accesibilidad se queda quieta mientras la pagina se
desplaza, asi que en cada punto del recorrido cae encima de un enlace distinto.
Este guion cruza cada elemento de posicion fija contra cada enlace y boton, en
cuatro puntos del recorrido y en los cuatro tamanos tactiles, y devuelve el
rectangulo comun.

El veredicto se da solo sobre position:fixed, que es lo que dice el criterio de
cierre. Los elementos pegados con position:sticky se miden aparte, como dato: el
indice de temas se pega arriba y el contenido pasa por debajo a proposito, asi
que contarlo como fallo obligaria a rehacer algo que nadie pidio.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\solapes.py
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import comun

NOMBRE = "Solapes: ningun elemento fijo tapa un enlace"

JS_SOLAPES = comun.js(
    """
  const fijos = [];
  const pegados = [];
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (cs.position === 'fixed') { fijos.push({ el: e, r }); continue; }
    // Pegado de verdad solo cuando ya se separo de su sitio en el flujo.
    const p = e.parentElement ? e.parentElement.getBoundingClientRect() : r;
    if (r.top - p.top > 0.5) pegados.push({ el: e, r });
  }

  const enlaces = [];
  for (const o of objetivos()) enlaces.push({ el: o.el, clave: o.clave, r: o.el.getBoundingClientRect() });

  const cruzar = (capas) => {
    const salida = [];
    for (const f of capas) {
      for (const l of enlaces) {
        if (f.el.contains(l.el) || l.el.contains(f.el)) continue;
        const ancho = Math.min(f.r.right, l.r.right) - Math.max(f.r.left, l.r.left);
        const alto = Math.min(f.r.bottom, l.r.bottom) - Math.max(f.r.top, l.r.top);
        if (ancho <= 0.5 || alto <= 0.5) continue;
        salida.push({
          encima: nombre(f.el),
          debajo: nombre(l.el),
          rotulo: rotulo(l.el).slice(0, 30),
          ancho: +ancho.toFixed(1),
          alto: +alto.toFixed(1),
        });
      }
    }
    salida.sort((a, b) => b.ancho * b.alto - a.ancho * a.alto);
    return salida;
  };

  return {
    scroll: Math.round(window.scrollY),
    // La caja de un elemento fijo se da en coordenadas de ventana, no de
    // documento: es lo unico que significa algo cuando la pagina se desplaza.
    fijos: fijos.map((f) => ({
      el: nombre(f.el),
      caja: {
        x: +f.r.x.toFixed(1), y: +f.r.y.toFixed(1),
        ancho: +f.r.width.toFixed(1), alto: +f.r.height.toFixed(1),
      },
    })),
    solapes: cruzar(fijos),
    solapes_pegados: cruzar(pegados),
  };
"""
)


def medir_pagina(pagina: Page) -> dict[str, Any]:
    largo = comun.recorrido(pagina)
    paradas: dict[str, Any] = {}
    for fraccion in comun.PARADAS_RECORRIDO:
        comun.ir_a(pagina, largo * fraccion)
        clave = f"{int(fraccion * 100)}%"
        paradas[clave] = pagina.evaluate(JS_SOLAPES)
    comun.ir_a(pagina, 0)
    return {"recorrido": round(largo), "paradas": paradas}


def medir(
    navegador: Browser, tamanos: tuple[tuple[str, int, int], ...] = comun.TACTILES
) -> dict[str, Any]:
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in tamanos:
        with comun.abrir(navegador, ancho, alto, etiqueta=etiqueta) as pagina:
            resultado[etiqueta] = medir_pagina(pagina)
    return resultado


def juzgar(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """Objetivo: la lista de solapes sale vacia en las cuatro paradas."""
    cifras: list[str] = []
    ok = True
    for etiqueta, d in datos.items():
        total = 0
        peor = None
        for clave, parada in d["paradas"].items():
            total += len(parada["solapes"])
            for s in parada["solapes"]:
                area = s["ancho"] * s["alto"]
                if peor is None or area > peor[0]:
                    peor = (area, clave, s)
        ok = ok and total == 0
        texto = f"{etiqueta}: {total} solapes en las cuatro paradas de {d['recorrido']} px"
        if peor:
            _, clave, s = peor
            texto += (
                f"; el mayor {comun.num(s['ancho'])}x{comun.num(s['alto'])} px, "
                f"{s['encima']} sobre {s['debajo']} ({s['rotulo']}) al {clave}"
            )
        cifras.append(texto)
        for clave, parada in d["paradas"].items():
            for s in parada["solapes"][:2]:
                cifras.append(
                    f"  al {clave}: {s['encima']} tapa {comun.num(s['ancho'])}x"
                    f"{comun.num(s['alto'])} px de {s['debajo']} ({s['rotulo']})  [{etiqueta}]"
                )
        pegados = sum(len(p["solapes_pegados"]) for p in d["paradas"].values())
        if pegados:
            cifras.append(
                f"  {pegados} solapes de elementos pegados, informativo  [{etiqueta}]"
            )
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

    comun.apartado("Elementos fijos encontrados")
    for etiqueta, d in datos.items():
        primera = next(iter(d["paradas"].values()))
        for f in primera["fijos"]:
            c = f["caja"]
            comun.dato(
                f"{etiqueta} {f['el']}",
                f"{comun.num(c['ancho'])}x{comun.num(c['alto'])} px en x={comun.num(c['x'])}",
            )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
