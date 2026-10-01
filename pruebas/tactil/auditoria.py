"""
Banco de medicion tactil de la landing de portales. Guion maestro.

Corre las siete comprobaciones del banco contra http://localhost:4200 y las
imprime con PASA o FALLA y sus cifras:

  1. Censo de objetivos tocables: 44 por 44 px y 8 px de aire.
  2. Hit test: el centro de cada control devuelve ese control.
  3. Sonda vertical de las cabeceras de tema, cada 4 px.
  4. Solapes de elementos fijos sobre enlaces.
  5. Reflow: desborde horizontal en anchos estrechos.
  6. Errores de consola.

Despues imprime el apartado de datos, que no lleva veredicto: son las medidas
que otros pasos necesitan comparar contra la linea base, entre ellas la pestana
Mapa por tamano, el campo de busqueda, el conmutador, la etiqueta viewport, la
permanencia a scrollY=2000 y el lienzo de la rosa en escritorio.

    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\auditoria.py

Dos modos mas:

    ... auditoria.py --guardar-linea-base    escribe linea-base.json
    ... auditoria.py --calibrar              comprueba que el banco mide bien

El modo --calibrar existe porque un banco de medicion tambien se puede romper.
Comprueba que las cinco medidas de la auditoria previa se reproducen tal cual, y
solo tiene sentido mientras la landing no haya cambiado: en cuanto el plan
avance, --calibrar tiene que fallar y eso no es un defecto. La calibracion se
conserva contra linea-base.json, que es lo que no se mueve.
"""

from __future__ import annotations

import sys
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import alcance_zocalo
import censo_objetivos
import comun
import hit_test
import reflow
import solapes

# --------------------------- Medidas sin veredicto ---------------------------

JS_ESTADO = comun.js(
    """
  const de = document.documentElement;
  const q = document.getElementById('query');
  const rq = q && q.getBoundingClientRect();
  const mapa = document.querySelector('.conmutador button[data-vista="mapa"]');
  const rm = mapa && mapa.getBoundingClientRect();
  const conmutador = document.querySelector('.conmutador');
  const rc = conmutador && conmutador.getBoundingClientRect();
  const visibles = [].slice.call(document.querySelectorAll('.conmutador button')).filter(pintado);
  const pulsado = document.querySelector('.conmutador button[aria-pressed="true"]');
  const meta = document.querySelector('meta[name="viewport"]');
  const contenido = (meta && meta.getAttribute('content')) || '';

  return {
    con_puntero: matchMedia('(hover: hover)').matches,
    puntero_grueso: matchMedia('(pointer: coarse)').matches,
    ancho_amplio: matchMedia('(min-width: 1100px)').matches,
    alto_documento: de.scrollHeight,
    alto_ventana: window.innerHeight,
    pantallas: +(de.scrollHeight / window.innerHeight).toFixed(2),
    desborde: Math.max(0, Math.round(de.scrollWidth - de.clientWidth)),
    viewport: contenido,
    viewport_limpio: !/maximum-scale|user-scalable/i.test(contenido),
    campo_busqueda: q ? {
      font_size: getComputedStyle(q).fontSize,
      ancho: +rq.width.toFixed(1),
      alto: +rq.height.toFixed(1),
    } : null,
    pestana_mapa: mapa ? {
      existe: true,
      display: getComputedStyle(mapa).display,
      ancho: +rm.width.toFixed(1),
      alto: +rm.height.toFixed(1),
    } : { existe: false },
    conmutador: rc ? {
      ancho: +rc.width.toFixed(1),
      alto: +rc.height.toFixed(1),
      y_documento: Math.round(rc.y + window.scrollY),
    } : null,
    vistas_visibles: visibles.map((b) => b.getAttribute('data-vista')),
    vista_activa: pulsado ? pulsado.getAttribute('data-vista') : '',
  };
"""
)

JS_PERMANENCIA = comun.js(
    """
  const donde = (sel) => {
    const e = document.querySelector(sel);
    if (!e || !pintado(e)) return { existe: false };
    const r = e.getBoundingClientRect();
    const centro = r.y + r.height / 2;
    return {
      existe: true,
      en_pantalla: r.bottom > 0 && r.top < window.innerHeight,
      centro_en_ventana: +centro.toFixed(1),
      fraccion: +(centro / window.innerHeight).toFixed(2),
      alto: +r.height.toFixed(1),
    };
  };
  // LOS TRES CONTROLES DEL ZOCALO, que son los que dan permanencia sin raton.
  // Antes se leian '#query', '.conmutador' y 'nav#indice', que son los del
  // cuerpo de la pagina: a media pagina quedan arriba, fuera de la ventana, y la
  // linea salia 'buscador fuera, conmutador fuera' contradiciendo el hecho
  // medido. El zocalo es el que se queda a la vista y es el que se mide.
  // Los del cuerpo se siguen anotando, con su nombre, porque son el punto de
  // comparacion: con raton el zocalo no se pinta y la permanencia es la de ellos.
  return {
    scroll: Math.round(window.scrollY),
    zocalo_buscar: donde('[data-zocalo=\"buscador\"]'),
    zocalo_vistas: donde('[data-zocalo=\"vistas\"]'),
    zocalo_temas: donde('[data-zocalo=\"temas\"]'),
    cuerpo_buscador: donde('#query'),
    cuerpo_conmutador: donde('.conmutador'),
    cuerpo_indice: donde('nav#indice'),
  };
"""
)

JS_ROSA = comun.js(
    """
  const svg = document.getElementById('rosa-svg');
  const lienzo = document.getElementById('mapa-lienzo');
  const rl = lienzo && lienzo.getBoundingClientRect();
  const centro = document.querySelector('.mapa .centro');
  const rcen = centro && centro.getBoundingClientRect();
  return {
    rosa: svg ? {
      ancho: +svg.getAttribute('width'),
      alto: +svg.getAttribute('height'),
      viewBox: svg.getAttribute('viewBox'),
    } : null,
    lienzo: rl ? { ancho: +rl.width.toFixed(1), alto: +rl.height.toFixed(1) } : null,
    centro: rcen ? { ancho: +rcen.width.toFixed(1), alto: +rcen.height.toFixed(1) } : null,
    filas_de_mapa: document.querySelectorAll('.mapa a.mapa-fila').length,
    cabeceras_de_mapa: document.querySelectorAll('.mapa button.cabecera').length,
  };
"""
)


def medir_estado(navegador: Browser) -> dict[str, Any]:
    """Medidas de pagina en los cuatro tamanos tactiles, con permanencia."""
    resultado: dict[str, Any] = {}
    for etiqueta, ancho, alto in comun.TACTILES:
        with comun.abrir(navegador, ancho, alto, etiqueta=etiqueta) as pagina:
            estado = pagina.evaluate(JS_ESTADO)
            comun.ir_a(pagina, 2000)
            estado["permanencia_2000"] = pagina.evaluate(JS_PERMANENCIA)
            comun.ir_a(pagina, 0)
            resultado[etiqueta] = estado
    return resultado


def medir_escritorio(navegador: Browser) -> dict[str, Any]:
    """
    1440x900 con raton: censo de referencia, estado y lienzo de la rosa. Es la
    red de seguridad contra una regla tactil escrita fuera de su consulta.
    """
    etiqueta, ancho, alto = comun.ESCRITORIO
    with comun.abrir(
        navegador, ancho, alto, tactil=False, etiqueta=f"{etiqueta} con raton"
    ) as pagina:
        estado = pagina.evaluate(JS_ESTADO)
        censo = censo_objetivos.medir_pagina(pagina)
        mapa = _abrir_mapa(pagina)
        return {"tamano": etiqueta, "estado": estado, "censo": censo, "mapa": mapa}


def _abrir_mapa(pagina: Page) -> dict[str, Any]:
    """Cambia a la vista mapa y mide su figura. Con raton tiene que ser la rosa."""
    boton = pagina.query_selector('.conmutador button[data-vista="mapa"]')
    if boton is None:
        return {"pestana": "no existe"}
    boton.click()
    pagina.wait_for_timeout(900)
    medida = pagina.evaluate(JS_ROSA)
    medida["pestana"] = "existe"
    return medida


# --------------------------- Comprobacion de consola ---------------------------


def juzgar_consola(errores: list[dict[str, str]]) -> tuple[bool, list[str]]:
    """Objetivo: 0 errores de consola en todo lo medido."""
    if not errores:
        return True, ["0 errores de consola en todo el recorrido de la auditoria"]
    por_donde: dict[str, int] = {}
    for e in errores:
        por_donde[e["donde"]] = por_donde.get(e["donde"], 0) + 1
    cifras = [f"{len(errores)} errores de consola"]
    cifras += [f"  {donde}: {n}" for donde, n in sorted(por_donde.items())]
    cifras += [f"  {e['tipo']} en {e['donde']}: {e['texto'][:120]}" for e in errores[:5]]
    return False, cifras


# --------------------------- Recogida completa ---------------------------


def recoger(navegador: Browser) -> dict[str, Any]:
    comun.olvidar_consola()
    datos: dict[str, Any] = {
        "url": comun.URL,
        "tamanos_tactiles": [t[0] for t in comun.TACTILES],
        "tamano_escritorio": comun.ESCRITORIO[0],
        "lado_minimo": comun.LADO_MINIMO,
        "aire_minimo": comun.AIRE_MINIMO,
    }
    datos["censo"] = censo_objetivos.medir(navegador)
    datos["hit_test"] = hit_test.medir(navegador)
    datos["solapes"] = solapes.medir(navegador)
    datos["reflow"] = reflow.medir(navegador)
    datos["alcance"] = alcance_zocalo.medir(navegador)
    datos["estado"] = medir_estado(navegador)
    datos["escritorio"] = medir_escritorio(navegador)
    datos["consola"] = comun.errores_consola()
    return datos


def juzgar(datos: dict[str, Any]) -> list[tuple[str, bool, list[str]]]:
    ok_censo, cifras_censo = censo_objetivos.juzgar(datos["censo"])
    ok_hit, cifras_hit = hit_test.juzgar(datos["hit_test"])
    ok_sonda, cifras_sonda = _juzgar_sonda(datos["hit_test"])
    ok_sol, cifras_sol = solapes.juzgar(datos["solapes"])
    ok_ref, cifras_ref = reflow.juzgar(datos["reflow"])
    ok_alc, cifras_alc = alcance_zocalo.juzgar(datos["alcance"])
    ok_con, cifras_con = juzgar_consola(datos["consola"])
    return [
        ("1. " + censo_objetivos.NOMBRE, ok_censo, cifras_censo),
        ("2. " + hit_test.NOMBRE, ok_hit, cifras_hit),
        ("3. Sonda vertical de las cabeceras de tema, cada 4 px", ok_sonda, cifras_sonda),
        ("4. " + solapes.NOMBRE, ok_sol, cifras_sol),
        ("5. " + reflow.NOMBRE, ok_ref, cifras_ref),
        ("6. " + alcance_zocalo.NOMBRE, ok_alc, cifras_alc),
        ("7. Errores de consola", ok_con, cifras_con),
    ]


def _juzgar_sonda(datos: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    La sonda se juzga aparte del hit test aunque se mida a la vez: una cabecera
    de 80 px que solo acepta 36 no falla en su centro, falla en la franja.
    """
    cifras: list[str] = []
    ok = True
    for etiqueta, d in datos.items():
        con_franja = [c for c in d["cabeceras"] if c["franjas_muertas"]]
        ok = ok and not con_franja
        if not d["cabeceras"]:
            cifras.append(f"{etiqueta}: sin cabeceras de tema a la vista")
            continue
        alto = d["cabeceras"][0]["alto"]
        acepta = min(c["px_que_aceptan"] for c in d["cabeceras"])
        cifras.append(
            f"{etiqueta}: {len(con_franja)} de {len(d['cabeceras'])} cabeceras con franja "
            f"muerta; de {comun.num(alto)} px de alto la que menos acepta {acepta} px"
        )
        for c in con_franja:
            for f in c["franjas_muertas"]:
                cifras.append(
                    f"  {c['rotulo']}: muerta de y={f['desde']} a y={f['hasta']}, "
                    f"{f['hasta'] - f['desde'] + 4} px que ocupa {f['devuelve']}  [{etiqueta}]"
                )
    return ok, cifras


# --------------------------- Apartado de datos ---------------------------


def imprimir_datos(datos: dict[str, Any]) -> None:
    comun.apartado("Datos, sin veredicto")
    for etiqueta, e in datos["estado"].items():
        comun.dato(
            etiqueta,
            f"hover:hover {str(e['con_puntero']).lower()}, "
            f"documento {e['alto_documento']} px ({comun.num(e['pantallas'])} pantallas), "
            f"desborde {e['desborde']} px",
        )
        mapa = e["pestana_mapa"]
        comun.dato(
            f"  {etiqueta} pestana Mapa",
            "no existe en el DOM"
            if not mapa["existe"]
            else f"display {mapa['display']}, {comun.num(mapa['ancho'])}x{comun.num(mapa['alto'])} px",
        )
        comun.dato(f"  {etiqueta} vistas visibles", ", ".join(e["vistas_visibles"]) or "ninguna")
        q = e["campo_busqueda"]
        if q:
            comun.dato(
                f"  {etiqueta} campo #query",
                f"font-size {q['font_size']}, {comun.num(q['ancho'])}x{comun.num(q['alto'])} px",
            )
        c = e["conmutador"]
        if c:
            comun.dato(
                f"  {etiqueta} conmutador",
                f"{comun.num(c['ancho'])}x{comun.num(c['alto'])} px, "
                f"a {c['y_documento']} px del principio del documento",
            )
        p = e["permanencia_2000"]
        comun.dato(
            f"  {etiqueta} a scrollY={p['scroll']}",
            ", ".join(
                f"{k} {'en pantalla' if v.get('en_pantalla') else 'fuera'}"
                for k, v in p.items()
                if isinstance(v, dict) and v.get("existe")
            )
            or "ningun control medible",
        )
        comun.dato(f"  {etiqueta} viewport", e["viewport"])

    esc = datos["escritorio"]
    comun.dato(
        "1440x900 con raton",
        f"hover:hover {str(esc['estado']['con_puntero']).lower()}, "
        f"{esc['censo']['total']} objetivos, "
        f"{esc['censo']['bajo_44']} por debajo de 44 px, desborde {esc['estado']['desborde']} px",
    )
    mapa = esc["mapa"]
    rosa = mapa.get("rosa")
    comun.dato(
        "  1440x900 vista mapa",
        f"lienzo de la rosa {rosa['ancho']}x{rosa['alto']} px, viewBox {rosa['viewBox']}"
        if rosa
        else f"pestana {mapa.get('pestana')}, sin rosa",
    )
    if mapa.get("lienzo"):
        comun.dato(
            "  1440x900 caja del mapa",
            f"{comun.num(mapa['lienzo']['ancho'])}x{comun.num(mapa['lienzo']['alto'])} px, "
            f"{mapa['filas_de_mapa']} filas y {mapa['cabeceras_de_mapa']} cabeceras",
        )


# --------------------------- Calibracion del banco ---------------------------


def calibrar(datos: dict[str, Any]) -> list[tuple[str, bool, list[str]]]:
    """
    Las cinco medidas de la auditoria previa, tal como estaban antes de tocar
    nada. Si el banco las reproduce, mide lo que dice medir.
    """
    salida: list[tuple[str, bool, list[str]]] = []

    ocultas = {
        t: datos["estado"][t]["pestana_mapa"].get("display")
        for t in datos["estado"]
    }
    salida.append(
        (
            "la pestana Mapa se oculta por debajo de 1100 px",
            all(v == "none" for v in ocultas.values()),
            [f"{t}: display {v}" for t, v in ocultas.items()],
        )
    )

    bajo = {
        t: d["bajo_44"] for t, d in datos["censo"].items() if t.endswith("@1,0")
    }
    valores = list(bajo.values())
    salida.append(
        (
            "entre 20 y 26 objetivos por debajo de 44 por 44 px",
            bool(valores) and min(valores) == 20 and max(valores) == 26,
            [f"{t}: {v}" for t, v in bajo.items()],
        )
    )

    logo = {}
    for t in ("390x844", "430x932"):
        d = datos["hit_test"].get(t, {})
        fila = next((c for c in d.get("con_nombre", []) if c["control"] == "enlace del logo"), None)
        logo[t] = fila["estado"] if fila else "sin medir"
    salida.append(
        (
            "el centro del logo devuelve a.saltar en 390 y 430 px",
            all("a.saltar" in v for v in logo.values()),
            [f"{t}: {v}" for t, v in logo.items()],
        )
    )

    franjas = [
        f
        for c in datos["hit_test"].get("390x844", {}).get("cabeceras", [])
        for f in c["franjas_muertas"]
    ]
    cubre = [f for f in franjas if f["desde"] <= 45 and f["hasta"] >= 64]
    salida.append(
        (
            "la cabecera de tema tiene banda muerta entre y=45 y y=64 en 390 px",
            len(cubre) == len(datos["hit_test"].get("390x844", {}).get("cabeceras", []))
            and bool(cubre),
            [
                f"{len(cubre)} de {len(franjas)} franjas muertas cubren y=45 a y=64",
                *[f"  de y={f['desde']} a y={f['hasta']}, la ocupa {f['devuelve']}" for f in franjas[:5]],
            ],
        )
    )

    barra = [
        s
        for parada in datos["solapes"].get("390x844", {}).get("paradas", {}).values()
        for s in parada["solapes"]
        if s["encima"] == "div.accessibility"
    ]
    mayor = max(barra, key=lambda s: s["ancho"] * s["alto"], default=None)
    salida.append(
        (
            "la barra flotante tapa 83 por 39 px de un enlace de portal",
            mayor is not None and mayor["ancho"] == 83.0 and mayor["alto"] == 39.0,
            [
                f"{len(barra)} solapes de div.accessibility en 390 px",
                *(
                    [
                        f"  el mayor {comun.num(mayor['ancho'])}x{comun.num(mayor['alto'])} px "
                        f"sobre {mayor['debajo']}"
                    ]
                    if mayor
                    else []
                ),
            ],
        )
    )

    desbordes = {t: e["desborde"] for t, e in datos["estado"].items()}
    desbordes[datos["escritorio"]["tamano"]] = datos["escritorio"]["estado"]["desborde"]
    salida.append(
        (
            "desborde horizontal 0 en los cinco tamanos",
            all(v == 0 for v in desbordes.values()),
            [f"{t}: {v} px" for t, v in desbordes.items()],
        )
    )

    salida.append(
        (
            "0 errores de consola",
            not datos["consola"],
            [f"{len(datos['consola'])} errores"],
        )
    )
    return salida


# --------------------------- Programa ---------------------------

AYUDA = """Banco de medicion tactil de la landing de portales.

  python pruebas\\tactil\\auditoria.py                       las siete comprobaciones
  python pruebas\\tactil\\auditoria.py --guardar-linea-base  ademas escribe linea-base.json
  python pruebas\\tactil\\auditoria.py --calibrar            ademas comprueba el banco

Se ejecuta con PYTHONIOENCODING=utf-8 y con la landing en pie en
http://localhost:4200 (API en http://localhost:5080).
"""


def main(argumentos: list[str]) -> int:
    if "--ayuda" in argumentos or "-h" in argumentos:
        print(AYUDA)
        return 0
    guardar = "--guardar-linea-base" in argumentos
    con_calibracion = "--calibrar" in argumentos

    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        version = navegador.version
        datos = recoger(navegador)
        navegador.close()
    datos["navegador"] = f"chromium {version}"

    comun.titulo("AUDITORIA TACTIL DE LA LANDING DE PORTALES")
    print(f"Sitio: {comun.URL}    Navegador: {datos['navegador']}")
    print("Contexto: has_touch=True, is_mobile=True, wait_until=load")
    print(
        "Tamanos: "
        + ", ".join(datos["tamanos_tactiles"])
        + " tactiles y "
        + datos["tamano_escritorio"]
        + " con raton"
    )

    comun.apartado("Las siete comprobaciones")
    resultados = juzgar(datos)
    for nombre, ok, cifras in resultados:
        comun.veredicto(nombre, ok, cifras)

    imprimir_datos(datos)

    fallan = [n for n, ok, _ in resultados if not ok]
    comun.apartado("Resumen")
    print(f"  {len(resultados) - len(fallan)} de {len(resultados)} comprobaciones PASAN")
    for n in fallan:
        print(f"  FALLA {n}")

    if con_calibracion:
        comun.apartado("Calibracion del banco contra la auditoria previa")
        cal = calibrar(datos)
        for nombre, ok, cifras in cal:
            comun.veredicto(nombre, ok, cifras)
        malas = [n for n, ok, _ in cal if not ok]
        print(f"  {len(cal) - len(malas)} de {len(cal)} medidas se reproducen")

    if guardar:
        comun.escribir_linea_base(datos)
        comun.apartado("Linea base")
        print(f"  escrita en {comun.RUTA_LINEA_BASE}")
        print(f"  {comun.RUTA_LINEA_BASE.stat().st_size // 1024} KB")

    return 0 if not fallan else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
