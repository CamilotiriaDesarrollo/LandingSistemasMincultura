"""
Auditoria de cierre, lente de mapa y tarjetas.

Cuatro comprobaciones, cada una con su cifra y su veredicto:

  A. En 1024x768 con has_touch la pestana Mapa existe, mide 44 px de alto y
     pinta Barras contadas.
  B. En 1440x900 con raton la pestana pinta la rosa con su lienzo de 440 px de
     ancho por 516 px de alto, y geometria-rosa.ts esta intacto.
  C. Un toque en una tarjeta del mosaico abre exactamente 1 pestana, sin doble
     significado ni temporizador.
  D. La marca de agua se ve sin tocar nada en las tarjetas que tienen archivo.

Se ejecuta con PYTHONIOENCODING=utf-8 python pruebas\\tactil\\cierre_mapa_tarjetas.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, sync_playwright

from comun import abrir, comprobar_servidores, errores_consola, olvidar_consola

RAIZ = Path(__file__).resolve().parents[2]
NUCLEO = RAIZ / "cliente" / "src" / "app" / "nucleo"
GEOMETRIA = NUCLEO / "geometria-rosa.ts"
MOSAICO_TS = RAIZ / "cliente" / "src" / "app" / "componentes" / "mosaico" / "mosaico.ts"
# Archivos del nucleo que ningun paso del plan toca: sirven de reloj de referencia.
TESTIGOS = ["estado.ts", "mosaico.ts", "pedido.ts", "tonos.ts", "texto.ts"]
# Archivos que el plan si escribe: su marca de tiempo acota cuando empezo el trabajo.
ESCRITOS = [
    RAIZ / "cliente" / "src" / "styles.css",
    RAIZ / "cliente" / "src" / "app" / "servicios" / "directorio.store.ts",
    MOSAICO_TS,
]

resultados: list[dict[str, Any]] = []


def veredicto(clave: str, criterio: str, ok: bool, medido: str) -> None:
    resultados.append({"clave": clave, "criterio": criterio, "pasa": ok, "medido": medido})
    print(f"[{'PASA' if ok else 'FALLA'}] {clave}. {criterio}")
    print(f"        {medido}")


# --------------------------------------------------------------------------- A


def a_pestana_y_barras(nav: Browser) -> None:
    with abrir(nav, 1024, 768, tactil=True, etiqueta="1024x768 tactil") as p:
        boton = p.locator('.conmutador button[data-vista="mapa"]')
        existe = boton.count() == 1
        visible = existe and boton.is_visible()
        caja = boton.bounding_box() if visible else None
        alto = round(caja["height"], 1) if caja else 0.0
        ancho = round(caja["width"], 1) if caja else 0.0

        if visible:
            boton.click()
            p.wait_for_timeout(500)

        est = p.evaluate(
            """() => {
              const barras = document.getElementById('mapa-barras');
              const rosa = document.getElementById('mapa');
              const vb = barras && !barras.hasAttribute('hidden')
                && getComputedStyle(barras).display !== 'none';
              const vr = rosa && !rosa.hasAttribute('hidden')
                && getComputedStyle(rosa).display !== 'none';
              const b = barras ? barras.getBoundingClientRect() : null;
              return {
                barras_visible: !!vb,
                rosa_visible: !!vr,
                n_barras: barras ? barras.querySelectorAll('.mapa-barra').length : 0,
                n_cuadros: barras
                  ? barras.querySelectorAll('.barra-tira .barra-cuadro').length : 0,
                ancho_barras: b ? Math.round(b.width * 10) / 10 : 0,
                hover_hover: matchMedia('(hover: hover)').matches,
                presionado: (document.querySelector(
                  '.conmutador button[data-vista=\\"mapa\\"]') || {})
                  .getAttribute?.('aria-pressed') ?? null,
                // Barras contadas se reconoce por el reparto impreso: 4, 9, 6, 4 y 2.
                reparto: Array.from(
                  barras ? barras.querySelectorAll('.mapa-barra') : []
                ).map((li) => li.querySelectorAll('.barra-tira .barra-cuadro').length),
                cuentas: Array.from(
                  barras ? barras.querySelectorAll('.mapa-barra [data-cuenta]') : []
                ).map((s) => s.textContent.trim().replace(/\\s+/g, ' ')),
              };
            }"""
        )

        # El centro de cada barra cerrada tiene que devolver su propio boton. elementFromPoint
        # trabaja en coordenadas de ventana, asi que cada barra se acerca antes de medir.
        centros = []
        for i in range(est["n_barras"]):
            p.evaluate(
                "i => document.querySelectorAll('#mapa-barras .barra-cabecera')[i]"
                ".scrollIntoView({block: 'center', behavior: 'instant'})",
                i,
            )
            p.wait_for_timeout(200)
            centros.append(
                p.evaluate(
                    """i => {
                      const bt = document.querySelectorAll('#mapa-barras .barra-cabecera')[i];
                      const r = bt.getBoundingClientRect();
                      const e = document.elementFromPoint(
                        r.x + r.width / 2, r.y + r.height / 2
                      );
                      return {
                        alto: Math.round(r.height * 10) / 10,
                        ancho: Math.round(r.width * 10) / 10,
                        propio: !!(e && e.closest('.barra-cabecera') === bt),
                        devuelve: e ? e.tagName + '.' + (e.className || '') : 'nada',
                      };
                    }""",
                    i,
                )
            )

        ok_hover = est["hover_hover"] is False
        altos = [c["alto"] for c in centros]
        propios = sum(1 for c in centros if c["propio"])
        ajenos = [c["devuelve"] for c in centros if not c["propio"]]
        ok = (
            existe
            and visible
            and alto >= 44
            and est["barras_visible"]
            and not est["rosa_visible"]
            and est["n_barras"] == 5
            and est["n_cuadros"] == 25
            and est["reparto"] == [4, 9, 6, 4, 2]
            and altos
            and min(altos) >= 44
            and propios == 5
            and ok_hover
        )
        veredicto(
            "A",
            "1024x768 con has_touch: pestana Mapa existe, 44 px de alto, pinta Barras contadas",
            ok,
            f"hover:hover={est['hover_hover']}; pestana existe={existe}, visible={visible}, "
            f"{ancho}x{alto} px, aria-pressed={est['presionado']}; "
            f"#mapa-barras visible={est['barras_visible']} ({est['ancho_barras']} px de ancho), "
            f"barras={est['n_barras']}, cuadros={est['n_cuadros']}, "
            f"reparto={est['reparto']}, conteos impresos={est['cuentas']}; "
            f"alto de barra cerrada={altos} px, centro que devuelve su boton={propios} de 5"
            f"{' (ajenos: ' + str(ajenos) + ')' if ajenos else ''}; "
            f"#mapa (rosa) visible={est['rosa_visible']}",
        )


# --------------------------------------------------------------------------- B


def b_rosa_escritorio(nav: Browser) -> None:
    sha = hashlib.sha256(GEOMETRIA.read_bytes()).hexdigest()
    # No hay repositorio: la prueba de que el archivo no se toco es su marca de tiempo
    # frente a la de los testigos del nucleo y la de los archivos que el plan si escribe.
    t_geo = GEOMETRIA.stat().st_mtime
    t_testigos = max((NUCLEO / n).stat().st_mtime for n in TESTIGOS)
    t_escritos = min(f.stat().st_mtime for f in ESCRITOS)
    # El archivo es mas antiguo que el primero que el plan escribio, y del mismo dia y hora
    # que los testigos que nadie toca: ningun paso lo abrio.
    intacto = t_geo < t_escritos and abs(t_geo - t_testigos) < 600

    with abrir(nav, 1440, 900, tactil=False, etiqueta="1440x900 con raton") as p:
        boton = p.locator('.conmutador button[data-vista="mapa"]')
        visible = boton.count() == 1 and boton.is_visible()
        caja = boton.bounding_box() if visible else None
        alto_pestana = round(caja["height"], 1) if caja else 0.0
        if visible:
            boton.click()
            p.wait_for_timeout(600)

        est = p.evaluate(
            """() => {
              const rosa = document.querySelector('#mapa .rosa');
              const lienzo = document.getElementById('mapa-lienzo');
              const barras = document.getElementById('mapa-barras');
              const mapa = document.getElementById('mapa');
              const r = rosa ? rosa.getBoundingClientRect() : null;
              const cs = lienzo ? getComputedStyle(lienzo) : null;
              return {
                hover_hover: matchMedia('(hover: hover)').matches,
                rosa_visible: !!(mapa && !mapa.hasAttribute('hidden')),
                barras_visible: !!(barras && !barras.hasAttribute('hidden')),
                ancho: r ? Math.round(r.width * 10) / 10 : 0,
                alto: r ? Math.round(r.height * 10) / 10 : 0,
                var_ancho: cs ? cs.getPropertyValue('--ancho-centro').trim() : '',
                var_alto: cs ? cs.getPropertyValue('--alto').trim() : '',
                n_rayos: document.querySelectorAll('#mapa .rosa-svg g').length,
                n_filas: document.querySelectorAll('#mapa .mapa-fila').length,
              };
            }"""
        )

        ok = (
            est["hover_hover"] is True
            and est["rosa_visible"]
            and not est["barras_visible"]
            and est["ancho"] == 440.0
            and est["alto"] == 516.0
            and intacto
        )
        from datetime import datetime as _dt

        def _f(t: float) -> str:
            return _dt.fromtimestamp(t).strftime("%Y-%m-%d %H:%M")

        veredicto(
            "B",
            "1440x900 con raton: pinta la rosa con lienzo de 440 px y geometria-rosa.ts intacto",
            ok,
            f"hover:hover={est['hover_hover']}; pestana visible={visible} "
            f"({alto_pestana} px de alto); .rosa={est['ancho']}x{est['alto']} px "
            f"(--ancho-centro={est['var_ancho']}, --alto={est['var_alto']}); "
            f"barras visibles={est['barras_visible']}; grupos svg={est['n_rayos']}, "
            f"filas de nombre={est['n_filas']}; "
            f"geometria-rosa.ts intacto={intacto} "
            f"(sha256 {sha[:16]}, {GEOMETRIA.stat().st_size} bytes, "
            f"mtime {_f(t_geo)}; testigos del nucleo hasta {_f(t_testigos)}; "
            f"primer archivo del plan {_f(t_escritos)})",
        )


# --------------------------------------------------------------------------- C y D


def c_d_tarjetas(nav: Browser) -> None:
    olvidar_consola()
    contexto = nav.new_context(
        viewport={"width": 390, "height": 844},
        has_touch=True,
        is_mobile=True,
        device_scale_factor=3,
        locale="es-CO",
    )
    p = contexto.new_page()
    p.goto("http://localhost:4200/", wait_until="load")
    p.wait_for_selector("#mosaico .tema-boton", state="attached", timeout=20000)
    p.wait_for_timeout(1200)

    try:
        # ---- D: la marca se ve sin tocar nada ----
        marcas = p.evaluate(
            """() => {
              const salida = [];
              for (const a of document.querySelectorAll('#mosaico .casilla .portal')) {
                const m = a.querySelector('.p-marca');
                if (!m) continue;
                const cs = getComputedStyle(m);
                const r = m.getBoundingClientRect();
                salida.push({
                  nombre: (a.getAttribute('aria-label') || a.textContent || '').trim()
                    .slice(0, 46),
                  opacidad: Math.round(parseFloat(cs.opacity) * 1000) / 1000,
                  display: cs.display,
                  visibilidad: cs.visibility,
                  transform: cs.transform,
                  w: Math.round(r.width), h: Math.round(r.height),
                  src: (m.getAttribute('src') || '').split('/').pop(),
                });
              }
              return salida;
            }"""
        )
        con_archivo = [m for m in marcas if m["src"]]
        opacas = [m for m in con_archivo if m["opacidad"] > 0]
        sin_caja = [m for m in con_archivo if m["w"] == 0 or m["h"] == 0]
        ops = sorted({m["opacidad"] for m in con_archivo})
        # En alto contraste la marca se retira: es la otra mitad del criterio.
        alto_c = p.evaluate(
            """() => {
              document.body.classList.add('high-contrast');
              const m = document.querySelectorAll('#mosaico .casilla .p-marca');
              const visibles = Array.from(m).filter(
                (x) => getComputedStyle(x).display !== 'none'
              ).length;
              document.body.classList.remove('high-contrast');
              return { total: m.length, visibles };
            }"""
        )
        ok_d = (
            len(con_archivo) == 15
            and len(opacas) == len(con_archivo)
            and not sin_caja
            and all(m["display"] != "none" for m in con_archivo)
            and alto_c["visibles"] == 0
        )
        veredicto(
            "D",
            "La marca de agua se ve sin tocar nada en las tarjetas que tienen archivo",
            ok_d,
            f"tarjetas con .p-marca y archivo={len(con_archivo)} de 25 portales; "
            f"con opacidad > 0 sin interaccion={len(opacas)}; "
            f"opacidades distintas={ops}; con caja 0x0={len(sin_caja)}; "
            f"en alto contraste quedan visibles={alto_c['visibles']} de {alto_c['total']}; "
            f"ejemplo: {con_archivo[0]['nombre']} opacidad={con_archivo[0]['opacidad']} "
            f"{con_archivo[0]['w']}x{con_archivo[0]['h']} px "
            f"transform={con_archivo[0]['transform']}",
        )

        # ---- C: un toque abre exactamente 1 pestana ----
        codigo = MOSAICO_TS.read_text(encoding="utf-8")
        apanos = [t for t in ("pointerdown", "MS_TOQUE", "alTocarCasilla", "setTimeout") if t in codigo]

        objetivo = p.locator("#mosaico .casilla:not([hidden]) .portal").first
        objetivo.scroll_into_view_if_needed()
        p.wait_for_timeout(300)
        caja = objetivo.bounding_box()
        antes = len(contexto.pages)
        href = objetivo.get_attribute("href")
        aria = objetivo.get_attribute("aria-label")
        target = objetivo.get_attribute("target")
        rel = objetivo.get_attribute("rel")
        # Un solo significado: el toque no puede además abrir ni cerrar el tema, y por tanto
        # no puede mover ?tema= ni la casilla abierta.
        estado_antes = p.evaluate(
            "({url: location.search, abiertas: document.querySelectorAll("
            "'#mosaico .casilla.abierto, #mosaico .tema.abierto').length})"
        )

        # La pestaña nueva tarda en aparecer: el primer emergente de un contexto obliga a
        # Chromium a levantar un renderizador. Contar paginas tras una espera fija da un
        # falso 0, asi que se espera el suceso y despues se comprueba que no llega otro.
        with contexto.expect_page(timeout=20000) as emergente:
            objetivo.tap()
        abierta = emergente.value
        abierta.wait_for_timeout(200)
        url_abierta = abierta.url
        despues = len(contexto.pages)

        # Ni clase de estado ni temporizador: 2500 ms despues nada cambia por si solo.
        clase_tras = p.evaluate(
            """() => {
              const c = document.querySelector('#mosaico .casilla:not([hidden])');
              const a = c ? c.querySelector('.portal') : null;
              return {
                clases_casilla: c ? c.className : '',
                clases_enlace: a ? a.className : '',
                activos: document.querySelectorAll(
                  '#mosaico .is-toque, #mosaico .toque, #mosaico .activa, #mosaico .is-activa'
                ).length,
              };
            }"""
        )
        p.wait_for_timeout(2500)
        final = len(contexto.pages)
        estado_tras = p.evaluate(
            "({url: location.search, abiertas: document.querySelectorAll("
            "'#mosaico .casilla.abierto, #mosaico .tema.abierto').length})"
        )

        # Arrastrar desde la tarjeta y soltar fuera no abre nada: el disparo es click.
        cx = caja["x"] + caja["width"] / 2
        cy = caja["y"] + caja["height"] / 2
        antes_arrastre = len(contexto.pages)
        p.mouse.move(cx, cy)
        p.mouse.down()
        p.mouse.move(cx + 120, cy + 260, steps=10)
        p.mouse.up()
        p.wait_for_timeout(2500)
        tras_arrastre = len(contexto.pages)

        ok_c = (
            despues - antes == 1
            and final == despues
            and not apanos
            and clase_tras["activos"] == 0
            and target == "_blank"
            and rel == "noopener noreferrer"
            and bool(aria)
            and estado_tras == estado_antes
            and tras_arrastre == antes_arrastre
        )
        veredicto(
            "C",
            "Un toque en una tarjeta abre exactamente 1 pestana, sin doble significado "
            "ni temporizador",
            ok_c,
            f"objetivo={aria!r} en ({round(caja['x'])},{round(caja['y'])}) "
            f"{round(caja['width'])}x{round(caja['height'])} px; "
            f"pestanas antes={antes}, tras el toque={despues} "
            f"({url_abierta[:48]}), tras 2,5 s mas={final} (delta={despues - antes}); "
            f"grep de mosaico.ts sin apanos={not apanos} (encontrado: {apanos or 'nada'}); "
            f"clases de estado tras el toque={clase_tras['activos']}; "
            f"estado antes={estado_antes} y despues={estado_tras} (sin doble significado); "
            f"arrastre desde la tarjeta y suelta fuera: "
            f"{antes_arrastre} -> {tras_arrastre} pestanas; "
            f"target={target}, rel={rel}, href={href}",
        )
    finally:
        contexto.close()

    errs = errores_consola()
    print(f"\n  Errores de consola en 390x844 durante C y D: {len(errs)}")
    for e in errs[:5]:
        print(f"    {e}")


def main() -> None:
    comprobar_servidores()
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        try:
            a_pestana_y_barras(nav)
            b_rosa_escritorio(nav)
            c_d_tarjetas(nav)
        finally:
            nav.close()

    print("\n=== Resumen ===")
    for r in resultados:
        print(f"{r['clave']}: {'PASA' if r['pasa'] else 'FALLA'}")
    Path(__file__).with_name("cierre-mapa-tarjetas.json").write_text(
        json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
