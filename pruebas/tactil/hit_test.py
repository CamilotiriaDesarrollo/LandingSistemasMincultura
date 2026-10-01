"""
Hit test: quien responde de verdad al toque.

Un objetivo puede medir 44 por 44 px y aun asi no funcionar, porque otro
elemento se le pone encima. Este guion pregunta con elementFromPoint quien
contesta en el punto donde el dedo va a caer.

Tres mediciones:

1. Centro de cada control. Se desplaza el control al centro de la ventana y se
   consulta su punto medio. Se distingue entre que conteste otro elemento del
   flujo y que lo tape un elemento de posicion fija, porque son dos arreglos
   distintos: el primero se arregla en el flujo y el segundo apartando la capa.

2. Sonda vertical de las cabeceras de tema, cada 4 px. Devuelve las franjas
   muertas: los tramos donde el punto no cae en el boton del tema. Es la banda
   que abre la pista 'Ver solo este tema +', que no es interactiva y esta encima.

3. Rejilla de la esquina superior izquierda, cada 8 px. Cuenta los puntos que
   devuelven el enlace de salto, que es invisible y esta sobre el logo.

Y dos controles con nombre propio, porque el criterio de cierre los pide uno a
uno: el enlace del logo en los tres tamanos de telefono y tableta, y la pestana
Mapa, que debe existir y medir 44 px de alto tambien por debajo de 1100 px.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\hit_test.py
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import comun
from comun import LADO_MINIMO

NOMBRE = "Hit test: el centro de cada control devuelve ese control"

#: Controles que el criterio de cierre nombra uno a uno.
CON_NOMBRE: tuple[tuple[str, str], ...] = (
    ("enlace del logo", ".top a"),
    ("enlace Inicio de la nav", ".nav a"),
    ("boton Buscar del encabezado", ".header-search"),
    ("boton Explorar de movil", ".mobile-nav"),
    ("contraste", ".accessibility button:nth-child(1)"),
    ("reducir letra", ".accessibility button:nth-child(2)"),
    ("aumentar letra", ".accessibility button:nth-child(3)"),
    ("campo de busqueda", "#query"),
    ("conmutador, mosaico", '.conmutador button[data-vista="mosaico"]'),
    ("conmutador, mapa", '.conmutador button[data-vista="mapa"]'),
    ("conmutador, lista", '.conmutador button[data-vista="lista"]'),
)

JS_CENTROS = comun.js(
    """
  const res = [];
  for (const o of objetivos()) {
    o.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = o.el.getBoundingClientRect();
    const cx = Math.min(window.innerWidth - 1, Math.max(0, r.x + r.width / 2));
    const cy = Math.min(window.innerHeight - 1, Math.max(0, r.y + r.height / 2));
    const tocado = document.elementFromPoint(cx, cy);
    const dueno = tocado ? tocado.closest(SEL) : null;
    let como;
    if (dueno === o.el) como = 'ok';
    else if (dueno && o.el.contains(dueno)) como = 'ok';
    else if (tocado && o.el.contains(tocado)) como = 'ok';
    else if (tocado && fijoQueTapa(tocado)) como = 'fijo';
    else como = 'otro';
    res.push({
      clave: o.clave,
      como,
      devuelve: nombre(tocado),
      rotulo_devuelto: tocado ? rotulo(tocado) : '',
      ancho: +r.width.toFixed(1),
      alto: +r.height.toFixed(1),
    });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return res;
"""
)

JS_SONDA = comun.js(
    """
  const salida = [];
  for (const cab of document.querySelectorAll('#mosaico .tema-cabeza')) {
    if (!pintado(cab)) continue;
    cab.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = cab.getBoundingClientRect();
    const boton = cab.querySelector('.tema-boton');
    const titulo = cab.querySelector('h3');
    const x = r.x + r.width / 2;
    const puntos = [];
    for (let dy = 2; dy < r.height; dy += 4) {
      const y = r.y + dy;
      if (y < 0 || y > window.innerHeight - 1) { puntos.push({ dy: Math.round(dy), estado: 'fuera' }); continue; }
      const tocado = document.elementFromPoint(x, y);
      const acepta = !!(tocado && boton && (tocado === boton || boton.contains(tocado)));
      puntos.push({ dy: Math.round(dy), estado: acepta ? 'acepta' : 'muerto', devuelve: nombre(tocado) });
    }
    salida.push({
      tema: (titulo && titulo.id) || '',
      rotulo: boton ? rotulo(boton).slice(0, 26) : '',
      alto: +r.height.toFixed(1),
      alto_boton: boton ? +boton.getBoundingClientRect().height.toFixed(1) : 0,
      puntos,
    });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return salida;
"""
)

JS_REJILLA_SALTO = comun.js(
    """
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const salto = document.querySelector('a.saltar');
  const puntos = [];
  for (let y = 0; y <= 120; y += 8) {
    for (let x = 0; x <= 240; x += 8) {
      const tocado = document.elementFromPoint(x, y);
      if (tocado && tocado.closest('a.saltar')) puntos.push([x, y]);
    }
  }
  return {
    existe: !!salto,
    caja: salto ? aCaja(salto.getBoundingClientRect()) : null,
    opacidad: salto ? +(+getComputedStyle(salto).opacity).toFixed(2) : null,
    puntos_robados: puntos.length,
    muestra: puntos.slice(0, 6),
  };
"""
)

JS_CON_NOMBRE = comun.js(
    """
  const salida = [];
  for (const [rot, sel] of datos) {
    const e = document.querySelector(sel);
    if (!e) { salida.push({ control: rot, selector: sel, estado: 'no existe' }); continue; }
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') {
      salida.push({ control: rot, selector: sel, estado: 'oculto por CSS', display: cs.display });
      continue;
    }
    e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r0 = e.getBoundingClientRect();
    if (r0.width <= 0 || r0.height <= 0) {
      // Caja de cero: no lo oculta su propio display sino el de un antepasado.
      let tapon = e.parentElement, causa = '';
      while (tapon && tapon !== document.body) {
        if (getComputedStyle(tapon).display === 'none') { causa = nombre(tapon); break; }
        tapon = tapon.parentElement;
      }
      salida.push({
        control: rot, selector: sel,
        estado: causa ? 'oculto por CSS en ' + causa : 'sin caja',
        ancho: 0, alto: 0,
      });
      continue;
    }
    const r = e.getBoundingClientRect();
    const cx = Math.min(window.innerWidth - 1, Math.max(0, r.x + r.width / 2));
    const cy = Math.min(window.innerHeight - 1, Math.max(0, r.y + r.height / 2));
    const tocado = document.elementFromPoint(cx, cy);
    const dueno = tocado ? tocado.closest(SEL) : null;
    const acierta = dueno === e || (dueno && e.contains(dueno)) || (tocado && e.contains(tocado));
    salida.push({
      control: rot,
      selector: sel,
      estado: acierta ? 'ok' : 'lo tapa ' + nombre(tocado),
      ancho: +r.width.toFixed(1),
      alto: +r.height.toFixed(1),
    });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return salida;
"""
)


def medir_pagina(pagina: Page) -> dict[str, Any]:
    centros: list[dict[str, Any]] = pagina.evaluate(JS_CENTROS)
    sonda: list[dict[str, Any]] = pagina.evaluate(JS_SONDA)
    salto: dict[str, Any] = pagina.evaluate(JS_REJILLA_SALTO)
    nombrados: list[dict[str, Any]] = pagina.evaluate(
        JS_CON_NOMBRE, [[r, s] for r, s in CON_NOMBRE]
    )

    fallos = [c for c in centros if c["como"] == "otro"]
    tapados = [c for c in centros if c["como"] == "fijo"]

    return {
        "controles": len(centros),
        "aciertos": sum(1 for c in centros if c["como"] == "ok"),
        "devuelven_otro": [
            {"clave": c["clave"], "devuelve": c["devuelve"]} for c in fallos
        ],
        "tapados_por_fijo": [
            {"clave": c["clave"], "devuelve": c["devuelve"]} for c in tapados
        ],
        "cabeceras": _resumir_sonda(sonda),
        "enlace_de_salto": salto,
        "con_nombre": nombrados,
    }


def _resumir_sonda(sonda: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convierte la sonda de 4 px en franjas: px que aceptan y franjas muertas."""
    salida = []
    for cab in sonda:
        muertas: list[dict[str, Any]] = []
        actual: dict[str, Any] | None = None
        for p in cab["puntos"]:
            if p["estado"] == "muerto":
                if actual is None:
                    actual = {"desde": p["dy"], "hasta": p["dy"], "devuelve": p.get("devuelve", "")}
                else:
                    actual["hasta"] = p["dy"]
            elif actual is not None:
                muertas.append(actual)
                actual = None
        if actual is not None:
            muertas.append(actual)
        acepta = sum(1 for p in cab["puntos"] if p["estado"] == "acepta")
        salida.append(
            {
                "tema": cab["tema"],
                "rotulo": cab["rotulo"],
                "alto": cab["alto"],
                "alto_boton": cab["alto_boton"],
                "px_que_aceptan": acepta * 4,
                "franjas_muertas": muertas,
                "px_muertos": sum(1 for p in cab["puntos"] if p["estado"] == "muerto") * 4,
            }
        )
    return salida


def medir(
    navegador: Browser, tamanos: tuple[tuple[str, int, int], ...] = comun.TACTILES
) -> dict[str, Any]:
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in tamanos:
        with comun.abrir(navegador, ancho, alto, etiqueta=etiqueta) as pagina:
            # LAS TRES VISTAS. El criterio de cierre nombra una por una las cinco
            # cabeceras de barra del mapa tactil, y preguntarle a elementFromPoint
            # por ellas con el mapa oculto no mide nada. La sonda vertical de
            # cabeceras de tema solo tiene sentido en el mosaico y devuelve una
            # lista vacia en las otras dos vistas, que es lo correcto: ahi no hay
            # cabecera de tema que sondear.
            for vista in comun.VISTAS:
                if vista != comun.VISTAS[0]:
                    comun.cambiar_vista(pagina, vista)
                resultado[f"{etiqueta} {vista}"] = medir_pagina(pagina)
    return resultado


def juzgar(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Objetivo: todo centro devuelve su control, ninguna cabecera con franja
    muerta, ningun punto de la esquina devuelve el enlace de salto y la pestana
    Mapa existe con 44 px de alto en los cuatro tamanos tactiles.
    """
    cifras: list[str] = []
    ok = True
    for etiqueta, d in datos.items():
        otros = len(d["devuelven_otro"])
        fijos = len(d["tapados_por_fijo"])
        robados = d["enlace_de_salto"]["puntos_robados"]
        muertos = sum(1 for c in d["cabeceras"] if c["franjas_muertas"])
        mapa = _pestana_mapa(d)
        malo = otros or fijos or robados or muertos or not mapa["ok"]
        ok = ok and not malo
        # Los dos motivos de fallo van por separado porque son dos arreglos
        # distintos, y los dos deciden el veredicto. Entre los dos y el total de
        # centros medidos queda dicho cuantos aciertan, sin imprimir fraccion.
        cifras.append(
            f"{etiqueta}: {d['controles']} centros medidos; "
            f"{otros} devuelven otro elemento, {fijos} los tapa un elemento fijo; "
            f"{robados} puntos de la esquina devuelven a.saltar; "
            f"{muertos} de {len(d['cabeceras'])} cabeceras con franja muerta; "
            f"pestana Mapa {mapa['texto']}"
        )
        for c in d["devuelven_otro"][:4]:
            cifras.append(
                f"  {c['clave'].split('|')[0]} devuelve {c['devuelve']}  [{etiqueta}]"
            )
        for c in d["tapados_por_fijo"][:3]:
            cifras.append(
                f"  {c['clave'].split('|')[0]} lo tapa {c['devuelve']}  [{etiqueta}]"
            )
        for c in d["cabeceras"]:
            for f in c["franjas_muertas"]:
                cifras.append(
                    f"  cabecera {c['rotulo']}: muerta de y={f['desde']} a y={f['hasta']} "
                    f"de {comun.num(c['alto'])} px, la ocupa {f['devuelve']}  [{etiqueta}]"
                )
    return ok, cifras


def _pestana_mapa(d: dict[str, Any]) -> dict[str, Any]:
    """La pestana Mapa tiene que existir y medir 44 px tambien en tableta."""
    for c in d["con_nombre"]:
        if c["control"] != "conmutador, mapa":
            continue
        if c["estado"] != "ok":
            return {"ok": False, "texto": c["estado"]}
        alto = c.get("alto", 0)
        return {
            "ok": alto >= LADO_MINIMO,
            "texto": f"{comun.num(c['ancho'])}x{comun.num(alto)} px",
        }
    return {"ok": False, "texto": "sin medir"}


def main() -> int:
    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        datos = medir(navegador)
        navegador.close()

    comun.titulo(NOMBRE)
    ok, cifras = juzgar(datos)
    comun.veredicto(NOMBRE, ok, cifras)

    comun.apartado("Controles con nombre propio")
    for etiqueta, d in datos.items():
        for c in d["con_nombre"]:
            medida = (
                f"{comun.num(c['ancho'])}x{comun.num(c['alto'])} px"
                if "ancho" in c
                else "sin caja"
            )
            comun.dato(f"{etiqueta} {c['control']}", f"{c['estado']}, {medida}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
