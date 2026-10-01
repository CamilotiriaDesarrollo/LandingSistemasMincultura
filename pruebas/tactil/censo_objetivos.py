"""
Censo de objetivos tocables: area real y aire entre vecinos.

Recorre todo lo que un dedo puede tocar en cada tamano tactil, a zoom 1,0 y 1,3,
y responde dos preguntas: cuantos objetivos miden menos de 44 por 44 px y
cuantos pares de vecinos tienen menos de 8 px de aire.

Mide ademas el censo de escritorio, 1440x900 con raton, que es la red de
seguridad del plan: si una regla tactil se escribe fuera de la consulta
(hover:none),(pointer:coarse), se filtra a escritorio y el ancho o el alto de
algun objetivo deja de coincidir con la linea base.

Que cuenta como objetivo tocable: cualquier elemento interactivo pintado, con
caja de area mayor que cero, que no este dentro de [hidden] ni de [inert]. El
enlace de salto cuenta aunque tenga opacidad 0, porque el navegador se lo entrega
al dedo igual: por eso se anota su opacidad.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\censo_objetivos.py
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import comun
from comun import LADO_MINIMO, AIRE_MINIMO

NOMBRE = "Censo de objetivos tocables: 44 por 44 px y 8 px de aire"

JS_CENSO = comun.js(
    """
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return objetivos().map((o) => {
    const cs = getComputedStyle(o.el);
    const c = aCaja(o.el.getBoundingClientRect());
    return {
      clave: o.clave,
      nombre: nombre(o.el),
      rotulo: rotulo(o.el),
      ruta: ruta(o.el),
      x: c.x, y: c.y, ancho: c.ancho, alto: c.alto,
      opacidad: +(+cs.opacity).toFixed(2),
      cajas: o.el.getClientRects().length,
    };
  });
"""
)


def medir_pagina(pagina: Page) -> dict[str, Any]:
    """Censo de una pagina ya abierta y quieta."""
    objetivos: list[dict[str, Any]] = pagina.evaluate(JS_CENSO)
    pequenos = [o for o in objetivos if min(o["ancho"], o["alto"]) < LADO_MINIMO]
    pequenos.sort(key=lambda o: min(o["ancho"], o["alto"]))
    pares = comun.pares_pegados(objetivos)
    return {
        "total": len(objetivos),
        "bajo_44": len(pequenos),
        "pares_bajo_8": len(pares),
        "objetivos": objetivos,
        "pequenos": [
            {"clave": o["clave"], "ancho": o["ancho"], "alto": o["alto"], "opacidad": o["opacidad"]}
            for o in pequenos
        ],
        "pares": pares,
    }


def medir(
    navegador: Browser,
    tamanos: tuple[tuple[str, int, int], ...] = comun.TACTILES,
    zooms: tuple[float, ...] = comun.ZOOMS,
) -> dict[str, Any]:
    """Censo tactil, un bloque por tamano y ampliacion."""
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in tamanos:
        for zoom in zooms:
            base = f"{etiqueta}@{comun.num(zoom)}"
            with comun.abrir(navegador, ancho, alto, zoom=zoom, etiqueta=base) as pagina:
                # LAS TRES VISTAS, en la misma pagina. Medir solo la que carga
                # dejaba sin censar las cabeceras de barra del mapa tactil y las
                # filas de la lista, que es donde el dedo pasa la mitad del
                # tiempo. La pagina se abre una vez y la vista se cambia dentro:
                # abrirla tres veces triplicaba el tiempo del banco sin medir
                # nada nuevo.
                for vista in comun.VISTAS:
                    if vista != comun.VISTAS[0]:
                        comun.cambiar_vista(pagina, vista)
                    resultado[f"{base} {vista}"] = medir_pagina(pagina)
    return resultado


def medir_escritorio(navegador: Browser) -> dict[str, Any]:
    """Censo con raton en 1440x900. Es la referencia de no regresion."""
    etiqueta, ancho, alto = comun.ESCRITORIO
    with comun.abrir(
        navegador, ancho, alto, tactil=False, etiqueta=f"{etiqueta} con raton"
    ) as pagina:
        # Se compara contra la linea base, que se tomo en la vista que carga, asi
        # que el censo que vuelve es el del mosaico. Las otras dos se miden
        # aparte para que un objetivo pequeno que solo exista en el mapa o en la
        # lista de escritorio no pase sin verse.
        propio = medir_pagina(pagina)
        propio["otras_vistas"] = {}
        for vista in comun.VISTAS[1:]:
            comun.cambiar_vista(pagina, vista)
            d = medir_pagina(pagina)
            propio["otras_vistas"][vista] = {
                "total": d["total"],
                "bajo_44": d["bajo_44"],
                "pares_bajo_8": d["pares_bajo_8"],
            }
        return propio


def comparar_escritorio(ahora: dict[str, Any], antes: dict[str, Any]) -> dict[str, Any]:
    """
    Compara el censo de escritorio contra el de la linea base por clave, no por
    posicion en el DOM: asi sobrevive a que el plan anada un componente nuevo.
    """
    de_antes = {o["clave"]: o for o in antes.get("objetivos", [])}
    de_ahora = {o["clave"]: o for o in ahora.get("objetivos", [])}
    cambiados = []
    for clave, a in de_antes.items():
        b = de_ahora.get(clave)
        if b is None:
            continue
        if abs(a["ancho"] - b["ancho"]) > 0.5 or abs(a["alto"] - b["alto"]) > 0.5:
            cambiados.append(
                {
                    "clave": clave,
                    "antes": f"{comun.num(a['ancho'])}x{comun.num(a['alto'])}",
                    "ahora": f"{comun.num(b['ancho'])}x{comun.num(b['alto'])}",
                }
            )
    return {
        "faltan": sorted(set(de_antes) - set(de_ahora)),
        "sobran": sorted(set(de_ahora) - set(de_antes)),
        "cambiados": cambiados,
    }


def juzgar(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """Objetivo: 0 objetivos por debajo de 44 px y 0 pares por debajo de 8 px."""
    cifras: list[str] = []
    ok = True
    for clave, d in datos.items():
        ok = ok and d["bajo_44"] == 0 and d["pares_bajo_8"] == 0
        cifras.append(
            f"{clave}: {d['total']} objetivos, {d['bajo_44']} por debajo de "
            f"{int(LADO_MINIMO)} px, {d['pares_bajo_8']} pares por debajo de "
            f"{int(AIRE_MINIMO)} px"
        )
    peores = _peores(datos)
    if peores:
        cifras.append("los mas pequenos:")
        cifras.extend("  " + p for p in peores)
    pegados = _mas_pegados(datos)
    if pegados:
        cifras.append("los mas pegados:")
        cifras.extend("  " + p for p in pegados)
    return ok, cifras


def _peores(datos: dict[str, Any], cuantos: int = 8) -> list[str]:
    vistos: dict[str, str] = {}
    for clave, d in datos.items():
        for o in d["pequenos"]:
            if o["clave"] in vistos:
                continue
            extra = " (opacidad 0)" if o["opacidad"] == 0 else ""
            vistos[o["clave"]] = (
                f"{comun.num(o['ancho'])}x{comun.num(o['alto'])} px  "
                f"{o['clave'].split('|')[0]}  {o['clave'].split('|')[1][:26]}{extra}  [{clave}]"
            )
            if len(vistos) >= cuantos:
                return list(vistos.values())
    return list(vistos.values())


def _mas_pegados(datos: dict[str, Any], cuantos: int = 5) -> list[str]:
    todos: list[tuple[float, str]] = []
    for clave, d in datos.items():
        for p in d["pares"][:cuantos]:
            todos.append(
                (
                    p["hueco"],
                    f"{comun.num(p['hueco'])} px entre {p['a'].split('|')[0]} "
                    f"y {p['b'].split('|')[0]}  [{clave}]",
                )
            )
    todos.sort(key=lambda t: t[0])
    return [t[1] for t in todos[:cuantos]]


def main() -> int:
    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        datos = medir(navegador)
        escritorio = medir_escritorio(navegador)
        navegador.close()

    comun.titulo(NOMBRE)
    ok, cifras = juzgar(datos)
    comun.veredicto(NOMBRE, ok, cifras)

    comun.apartado("Escritorio 1440x900 con raton")
    comun.dato("objetivos", escritorio["total"])
    base = comun.leer_linea_base()
    if base and "escritorio" in base:
        dif = comparar_escritorio(escritorio, base["escritorio"]["censo"])
        comun.dato("objetivos con otra medida que en la linea base", len(dif["cambiados"]))
        comun.dato("objetivos que faltan", len(dif["faltan"]))
        comun.dato("objetivos nuevos", len(dif["sobran"]))
        for c in dif["cambiados"][:10]:
            comun.dato("  " + c["clave"].split("|")[0], f"{c['antes']} -> {c['ahora']}")
    else:
        comun.dato("linea base", "no hay linea-base.json todavia")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
