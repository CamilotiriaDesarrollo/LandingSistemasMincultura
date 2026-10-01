"""
Reflow: desborde horizontal en anchos estrechos.

Se mide el desborde en cuatro anchos de px CSS. No son anchos de telefono: son
lo que deja la ampliacion del navegador sobre un telefono de 390 px. 320 px es
el minimo de la pauta, 195 px es el 200 por ciento y 98 px el 400 por ciento.
160 px se mide para separar el desborde que aparece por texto largo del que
aparece por una medida fija.

Ademas de la cifra, el guion nombra a los culpables: los elementos cuyo borde
derecho pasa del ancho de la ventana y que no estan recortados por un antepasado
con overflow. Es el dato que necesita quien escribe la hoja de estilo, porque la
cifra sola no dice donde mirar.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\reflow.py
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import comun

NOMBRE = "Reflow: 0 px de desborde horizontal en anchos estrechos"

#: Alto con el que se abre cada ancho de reflow. Fijo, para que la cifra se
#: repita: el alto de ventana cambia donde corta el texto.
ALTO_REFLOW = 844

JS_REFLOW = comun.js(
    """
  const de = document.documentElement;
  const ventana = de.clientWidth;
  const desborde = Math.max(0, Math.round(de.scrollWidth - ventana));

  const recortado = (e) => {
    let n = e.parentElement;
    while (n && n !== de) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible') return true;
      n = n.parentElement;
    }
    return false;
  };

  const culpables = [];
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const exceso = Math.round(r.right + window.scrollX - ventana);
    if (exceso <= 1) continue;
    if (recortado(e)) continue;
    culpables.push({ el: nombre(e), exceso, ancho: +r.width.toFixed(1) });
  }
  culpables.sort((a, b) => b.exceso - a.exceso);

  // El mas profundo de cada rama es el que hay que arreglar: los antepasados
  // desbordan porque el hijo los empuja.
  const vistos = new Set();
  const unicos = [];
  for (const c of culpables) {
    if (vistos.has(c.el)) continue;
    vistos.add(c.el);
    unicos.push(c);
  }

  return {
    ancho_ventana: ventana,
    ancho_scroll: de.scrollWidth,
    desborde,
    culpables: unicos.slice(0, 8),
    total_culpables: culpables.length,
  };
"""
)


def medir_pagina(pagina: Page) -> dict[str, Any]:
    return pagina.evaluate(JS_REFLOW)


def medir(
    navegador: Browser, anchos: tuple[int, ...] = comun.ANCHOS_REFLOW
) -> dict[str, Any]:
    resultado: dict[str, Any] = {}
    for ancho in anchos:
        clave = f"{ancho}px"
        with comun.abrir(
            navegador, ancho, ALTO_REFLOW, etiqueta=f"reflow {clave}"
        ) as pagina:
            resultado[clave] = medir_pagina(pagina)
    return resultado


def medir_tamanos(
    navegador: Browser, tamanos: tuple[tuple[str, int, int], ...] = comun.TACTILES
) -> dict[str, Any]:
    """Desborde en los tamanos de dispositivo, que la auditoria pide en cero."""
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in tamanos:
        with comun.abrir(navegador, ancho, alto, etiqueta=etiqueta) as pagina:
            resultado[etiqueta] = medir_pagina(pagina)
    return resultado


#: 98 px es el 400 por ciento y se mide como dato, no como condicion de cierre.
ANCHOS_EXIGIDOS = (320, 195, 160)


def juzgar(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """Objetivo: 0 px de desborde a 320, 195 y 160 px CSS."""
    cifras: list[str] = []
    ok = True
    for clave, d in datos.items():
        ancho = int(clave.rstrip("px"))
        exigido = ancho in ANCHOS_EXIGIDOS
        if exigido:
            ok = ok and d["desborde"] == 0
        marca = "" if exigido else "  (dato, no condicion de cierre)"
        cifras.append(f"{clave}: {d['desborde']} px de desborde{marca}")
        for c in d["culpables"][:3]:
            cifras.append(f"  {c['el']} pasa {c['exceso']} px  [{clave}]")
    return ok, cifras


def main() -> int:
    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        datos = medir(navegador)
        por_tamano = medir_tamanos(navegador)
        navegador.close()

    comun.titulo(NOMBRE)
    ok, cifras = juzgar(datos)
    comun.veredicto(NOMBRE, ok, cifras)

    comun.apartado("Desborde en los tamanos de dispositivo")
    for etiqueta, d in por_tamano.items():
        comun.dato(etiqueta, f"{d['desborde']} px")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
