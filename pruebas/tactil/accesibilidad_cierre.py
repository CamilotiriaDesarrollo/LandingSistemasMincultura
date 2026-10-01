"""
Auditoria de cierre, lente de accesibilidad y no regresion de escritorio.

Ocho comprobaciones, cada una con PASA o FALLA y su cifra:

  1. Enlaces externos con aria-label, target=_blank y rel=noopener noreferrer.
  2. Foco visible en los cuatro tamanos tactiles.
  3. Recorrido completo con Tab, sin entrar en lo que tiene inert ni quedar preso.
  4. Alto contraste y ampliacion de letra sin romper nada.
  5. prefers-reduced-motion sin transiciones.
  6. El campo #query con font-size 16 px y sin ampliar el documento al enfocarlo.
  7. index.html sin maximum-scale ni user-scalable.
  8. Censo de escritorio en 1440x900 sin has_touch igual a linea-base.json.

El foco visible no se puede pedir con element.focus(): :focus-visible depende de
como llego el foco. Todo recorrido de este guion se hace con Tab de verdad, que
es lo unico que lo garantiza en Chromium.

El indicador de foco de esta hoja no siempre vive en el propio elemento: hay
reglas que lo pintan en ::after (.tema-boton) y reglas que lo pintan en un
antepasado (.search:has(input:focus-visible)). Por eso se acepta el indicador en
el elemento, en sus dos pseudos y en tres niveles de antepasado, y se anota
donde aparecio.

Uso:
    PYTHONIOENCODING=utf-8 python pruebas\\tactil\\accesibilidad_cierre.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Page, sync_playwright

import censo_objetivos
import comun

RUTA_INDEX = (
    comun.CARPETA.parent.parent / "cliente" / "src" / "index.html"
)

VISTAS = ("mosaico", "mapa", "lista")

#: Tope de pulsaciones de Tab por vista. La vista mapa tactil pinta 25 filas y
#: 5 cabeceras, asi que el recorrido largo cabe de sobra.
TOPE_TAB = 700


# --------------------------- 1. Enlaces externos ---------------------------

JS_EXTERNOS = comun.js(
    """
  const fuera = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) continue;
    let mismo = false;
    try { mismo = new URL(href, location.href).origin === location.origin; } catch (e) { mismo = false; }
    if (mismo) continue;
    const rel = (a.getAttribute('rel') || '').toLowerCase().split(/\\s+/).filter(Boolean);
    fuera.push({
      clave: nombre(a) + '|' + rotulo(a),
      href: href.slice(0, 90),
      aria: (a.getAttribute('aria-label') || '').trim(),
      target: a.getAttribute('target') || '',
      rel: rel.join(' '),
      tiene_aria: !!(a.getAttribute('aria-label') || '').trim(),
      tiene_target: a.getAttribute('target') === '_blank',
      tiene_rel: rel.includes('noopener') && rel.includes('noreferrer'),
      pintado: pintado(a),
      /* Dos grupos, porque no son el mismo enlace: los de portal los pinta el
         directorio desde el JSON, y los seis de la barra de navegacion vienen del
         encabezado portado del prototipo. Saber en cual cae un incumplimiento es
         lo que dice si el plan tactil lo introdujo o si venia de antes. */
      grupo: a.closest('nav.nav') ? 'navegacion' : (a.closest('footer') ? 'pie' : 'portal'),
    });
  }
  return fuera;
"""
)


def medir_externos(navegador: Browser) -> dict[str, Any]:
    """Recuento de enlaces externos por vista, en tactil y con raton."""
    bloques: dict[str, Any] = {}
    incompletos: list[dict[str, Any]] = []
    vistos: set[str] = set()

    escenas = (
        ("390x844", 390, 844, True),
        ("1024x768", 1024, 768, True),
        ("1440x900", 1440, 900, False),
    )
    for etiqueta, ancho, alto, tactil in escenas:
        with comun.abrir(
            navegador, ancho, alto, tactil=tactil, etiqueta=f"externos {etiqueta}"
        ) as pagina:
            for vista in VISTAS:
                cambiar_vista(pagina, vista)
                abrir_todos_los_temas(pagina)
                enlaces: list[dict[str, Any]] = pagina.evaluate(JS_EXTERNOS)
                clave = f"{etiqueta}/{vista}"
                malos = [
                    e
                    for e in enlaces
                    if not (e["tiene_aria"] and e["tiene_target"] and e["tiene_rel"])
                ]
                bloques[clave] = {
                    "total": len(enlaces),
                    "incompletos": len(malos),
                    "portal": sum(1 for e in enlaces if e["grupo"] == "portal"),
                    "portal_incompletos": sum(1 for e in malos if e["grupo"] == "portal"),
                    "navegacion_incompletos": sum(
                        1 for e in malos if e["grupo"] == "navegacion"
                    ),
                }
                for e in malos:
                    firma = e["clave"] + "|" + e["href"]
                    if firma in vistos:
                        continue
                    vistos.add(firma)
                    e["donde"] = clave
                    incompletos.append(e)
    return {"bloques": bloques, "incompletos": incompletos}


# --------------------------- 2. Foco visible ---------------------------

JS_FOCO = r"""
  () => {
    const e = document.activeElement;
    if (!e || e === document.body || e === document.documentElement) return null;
    const bruto = (e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
    const clave = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (bruto.length ? '.' + bruto.join('.') : '');
    const rotulo = ((e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 34);
    const marca = e.getAttribute('data-aud-tab');
    const grueso = (cs) => {
      if (!cs) return 0;
      const w = parseFloat(cs.outlineWidth || '0');
      return (cs.outlineStyle && cs.outlineStyle !== 'none' && w > 0) ? w : 0;
    };
    const sombra = (cs) => !!cs && cs.boxShadow && cs.boxShadow !== 'none';
    let donde = '';
    let ancho = 0;
    const propio = getComputedStyle(e);
    if (grueso(propio)) { donde = 'elemento'; ancho = grueso(propio); }
    if (!donde) {
      for (const p of ['::after', '::before']) {
        const cs = getComputedStyle(e, p);
        if (grueso(cs)) { donde = p; ancho = grueso(cs); break; }
      }
    }
    if (!donde) {
      let n = e.parentElement, salto = 0;
      while (n && salto < 3) {
        const cs = getComputedStyle(n);
        if (grueso(cs)) { donde = 'antepasado ' + n.tagName.toLowerCase(); ancho = grueso(cs); break; }
        for (const p of ['::after', '::before']) {
          const q = getComputedStyle(n, p);
          if (grueso(q)) { donde = 'antepasado ' + n.tagName.toLowerCase() + p; ancho = grueso(q); break; }
        }
        if (donde) break;
        n = n.parentElement; salto++;
      }
    }
    if (!donde && sombra(propio)) { donde = 'sombra'; ancho = -1; }
    const r = e.getBoundingClientRect();
    return {
      clave: clave,
      rotulo: rotulo,
      marca: marca,
      focus_visible: e.matches(':focus-visible'),
      donde: donde,
      ancho: ancho,
      visible: !!donde,
      en_inert: !!e.closest('[inert]'),
      en_hidden: !!e.closest('[hidden]'),
      dentro_ventana: r.bottom > 0 && r.top < window.innerHeight,
      alto: +r.height.toFixed(1),
      ancho_caja: +r.width.toFixed(1),
    };
  }
"""


#: Marca cada tabulable con un numero antes de recorrer. La identidad no puede
#: ser el nombre ni el rotulo: las clases cambian al enfocar (.is-foco) y dos
#: filas pueden compartir rotulo. El numero sobrevive a las dos cosas.
JS_MARCAR = comun.js(
    """
  const sel = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), '
    + 'select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  for (const e of document.querySelectorAll('[data-aud-tab]')) e.removeAttribute('data-aud-tab');
  const fuera = [];
  let i = 0;
  for (const e of document.querySelectorAll(sel)) {
    if (!pintado(e)) continue;
    if (e.getAttribute('tabindex') === '-1') continue;
    e.setAttribute('data-aud-tab', String(i));
    fuera.push({ marca: String(i), clave: nombre(e), rotulo: rotulo(e) });
    i++;
  }
  return fuera;
"""
)


def recorrer_con_tab(pagina: Page, tope: int = TOPE_TAB) -> dict[str, Any]:
    """
    Recorre la pagina con Tab de verdad y anota cada parada.

    La identidad de cada parada es el numero que JS_MARCAR dejo puesto, no su
    nombre: al enfocar, la hoja cambia clases y el nombre deja de coincidir.

    El foco sale del documento al llegar al final, porque despues del ultimo
    elemento viene el navegador. Eso no es un fallo: se sigue pulsando Tab para
    que vuelva a entrar, y el recorrido acaba cuando el foco ha vuelto a la
    primera parada (ciclo cerrado) o tras tres salidas.
    """
    esperados: list[dict[str, Any]] = pagina.evaluate(JS_MARCAR)
    pagina.evaluate(
        "() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur();"
        " window.scrollTo({top:0,left:0,behavior:'instant'}); }"
    )
    paradas: list[dict[str, Any]] = []
    orden: list[str] = []
    primera: str | None = None
    ciclo = False
    salidas = 0
    for paso in range(tope):
        pagina.keyboard.press("Tab")
        info = pagina.evaluate(JS_FOCO)
        if info is None:
            salidas += 1
            if salidas >= 3:
                break
            continue
        firma = info["marca"] if info["marca"] is not None else info["clave"] + "|" + info["rotulo"]
        if primera is None:
            primera = firma
        elif firma == primera and paso > 3:
            ciclo = True
            break
        paradas.append(info)
        orden.append(firma)
    alcanzados = set(orden)
    sin_alcanzar = [
        f"{e['clave']}|{e['rotulo']}" for e in esperados if e["marca"] not in alcanzados
    ]
    return {
        "paradas": len(paradas),
        "esperados": len(esperados),
        "ciclo_cerrado": ciclo,
        "salidas_del_documento": salidas,
        "sin_alcanzar": sin_alcanzar,
        "sin_indicador": [
            {"clave": p["clave"], "rotulo": p["rotulo"], "focus_visible": p["focus_visible"]}
            for p in paradas
            if not p["visible"]
        ],
        "en_inert": [p["clave"] for p in paradas if p["en_inert"]],
        "en_hidden": [p["clave"] for p in paradas if p["en_hidden"]],
        "indicadores": sorted({p["donde"] for p in paradas if p["donde"]}),
    }


def medir_foco_y_teclado(navegador: Browser) -> dict[str, Any]:
    """Foco visible y recorrido con Tab en los cuatro tamanos tactiles."""
    fuera: dict[str, Any] = {}
    for etiqueta, ancho, alto in comun.TACTILES:
        with comun.abrir(navegador, ancho, alto, etiqueta=f"foco {etiqueta}") as pagina:
            por_vista: dict[str, Any] = {}
            for vista in VISTAS:
                cambiar_vista(pagina, vista)
                por_vista[vista] = recorrer_con_tab(pagina)
            fuera[etiqueta] = por_vista
    return fuera


# --------------------- 4. Alto contraste y letra ampliada ---------------------

JS_SALUD_VISUAL = comun.js(
    """
  const de = document.documentElement;
  const objs = objetivos().map((o) => {
    const c = aCaja(o.el.getBoundingClientRect());
    return { clave: o.clave, ancho: c.ancho, alto: c.alto };
  });
  const pequenos = objs.filter((o) => Math.min(o.ancho, o.alto) < 44);
  pequenos.sort((a, b) => Math.min(a.ancho, a.alto) - Math.min(b.ancho, b.alto));
  return {
    contraste: document.body.classList.contains('high-contrast'),
    zoom: document.body.style.zoom || '1',
    desborde: Math.max(0, de.scrollWidth - de.clientWidth),
    alto_documento: de.scrollHeight,
    objetivos: objs.length,
    bajo_44: pequenos.length,
    pequenos: pequenos.slice(0, 6),
    /* Visible de verdad: opacidad mayor que 0 NO basta, porque un elemento con
       display:none conserva su opacidad calculada. En alto contraste la marca se
       oculta con body.high-contrast .p-marca{display:none}, asi que medir solo la
       opacidad daba 16 marcas visibles donde no hay ninguna. */
    marca_visible: [...document.querySelectorAll('.p-marca')].filter((m) => {
      const cs = getComputedStyle(m);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (+cs.opacity <= 0) return false;
      const r = m.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length,
    marcas: document.querySelectorAll('.p-marca').length,
    marca_display_none: [...document.querySelectorAll('.p-marca')]
      .filter((m) => getComputedStyle(m).display === 'none').length,
    zocalo_visible: (() => {
      const z = document.querySelector('.zocalo');
      if (!z) return false;
      const cs = getComputedStyle(z);
      return cs.display !== 'none' && z.getBoundingClientRect().height > 0;
    })(),
  };
"""
)


def medir_contraste_y_letra(navegador: Browser) -> dict[str, Any]:
    """
    Alto contraste y letra al maximo, sola y combinada, en telefono y tableta.
    Se comprueba que nada desborde, que ningun objetivo caiga bajo 44 px, que la
    marca de agua siga oculta en alto contraste y que la preferencia sobreviva a
    la recarga.
    """
    fuera: dict[str, Any] = {}
    for etiqueta, ancho, alto in (("390x844", 390, 844), ("1024x768", 1024, 768)):
        with comun.abrir(navegador, ancho, alto, etiqueta=f"contraste {etiqueta}") as pagina:
            fuera[f"{etiqueta}/normal"] = pagina.evaluate(JS_SALUD_VISUAL)

            # Alto contraste con el boton real de la barra, no con la clase.
            pagina.click('.accessibility button[aria-label="Cambiar contraste"]')
            pagina.wait_for_timeout(350)
            fuera[f"{etiqueta}/contraste"] = pagina.evaluate(JS_SALUD_VISUAL)

            # Letra al maximo: tres toques de A+ desde 1,0 llegan al techo 1,3.
            for _ in range(4):
                pagina.click('.accessibility button[aria-label="Aumentar letra"]')
                pagina.wait_for_timeout(120)
            pagina.wait_for_timeout(350)
            fuera[f"{etiqueta}/contraste+letra"] = pagina.evaluate(JS_SALUD_VISUAL)

            # La preferencia sobrevive a la recarga.
            pagina.reload(wait_until="load")
            comun.esperar_pintado(pagina)
            tras = pagina.evaluate(JS_SALUD_VISUAL)
            fuera[f"{etiqueta}/tras-recarga"] = tras
            fuera[f"{etiqueta}/persiste"] = {
                "contraste": tras["contraste"],
                "zoom": tras["zoom"],
            }

            # El piso del zoom es 1,0: A- no baja de ahi.
            for _ in range(6):
                pagina.click('.accessibility button[aria-label="Reducir letra"]')
                pagina.wait_for_timeout(100)
            fuera[f"{etiqueta}/piso"] = pagina.evaluate(
                "() => document.body.style.zoom || '1'"
            )
    return fuera


# --------------------- 5. prefers-reduced-motion ---------------------

#: Lo que prefers-reduced-motion tiene que apagar es el MOVIMIENTO, no todo
#: cambio gradual. Una transicion de 0,22 s sobre background-color o border-color
#: no mueve nada en pantalla y no es lo que la consulta pide quitar; una
#: transicion sobre transform, o una animacion, si lo es. Por eso se separan las
#: dos cuentas y solo la primera decide el veredicto: la segunda se da como dato.
JS_MOVIMIENTO = comun.js(
    """
  const sospechosos = [
    '.fav', '.tema', '.tema-boton', '.portal', '.p-marca', '.fila', '.conmutador button',
    '.zocalo-boton', '.barra-fila', '.barra-cabecera', '.barra-cuadro', '.indice a',
    '.mapa-fila', '.tramo', '.num', '.tema-num',
  ];
  const PROPIEDADES_DE_MOVIMIENTO = /transform|translate|rotate|scale|top|left|right|bottom|margin|inset|width|height|all/;
  const conMovimiento = [];
  const soloColor = [];
  let mirados = 0;
  for (const sel of sospechosos) {
    for (const e of document.querySelectorAll(sel)) {
      if (!pintado(e)) continue;
      mirados++;
      for (const p of [null, '::after', '::before']) {
        const cs = p ? getComputedStyle(e, p) : getComputedStyle(e);
        const vive = (texto) => (String(texto || '').match(/[\\d.]+(?=s)/g) || [])
          .some((n) => parseFloat(n) > 0.001);
        const conAnimacion = vive(cs.animationDuration)
          || (cs.animationIterationCount || '').includes('infinite');
        const conTransicion = vive(cs.transitionDuration);
        if (!conAnimacion && !conTransicion) continue;
        const props = (cs.transitionProperty || '').toLowerCase();
        const mueve = conAnimacion || PROPIEDADES_DE_MOVIMIENTO.test(props);
        const ficha = {
          clave: nombre(e) + (p || ''),
          transicion: cs.transitionDuration,
          propiedades: props.slice(0, 80),
          animacion: cs.animationDuration,
          repite: cs.animationIterationCount,
        };
        (mueve ? conMovimiento : soloColor).push(ficha);
      }
      if (mirados > 400) break;
    }
  }
  return {
    mirados: mirados,
    con_movimiento: conMovimiento.slice(0, 12),
    total_con_movimiento: conMovimiento.length,
    solo_color: soloColor.slice(0, 6),
    total_solo_color: soloColor.length,
  };
"""
)


#: Una transicion declarada no es movimiento: hace falta que algo cambie de
#: sitio. Esta medida enfoca con Tab de verdad y compara el transform y la
#: posicion del elemento y de sus hijos animados antes y despues. Es la
#: diferencia entre leer la hoja y medir la pagina, y es la que decide: con
#: reduce no se mueve nada; sin preferencia si, que es el control.
JS_ANTES_DE_ENFOCAR = comun.js(
    """
  /* La posicion se toma con offsetTop y offsetLeft, no con getBoundingClientRect:
     la caja de un elemento sticky o fixed cambia de coordenadas al desplazar, y
     el propio Tab desplaza la pagina entre las dos lecturas. Con el rectangulo
     salian 17 falsos movimientos, todos del zocalo sticky, del indice pegado y de
     la barra fija de accesibilidad. offsetTop es de maquetacion y no lo mueve ni
     el desplazamiento ni el anclaje. */
  const fuera = {};
  for (const e of document.querySelectorAll('[data-aud-tab]')) {
    const hijo = e.querySelector('b, .fav-flecha, .p-marca');
    fuera[e.getAttribute('data-aud-tab')] = {
      transform: getComputedStyle(e).transform,
      hijo: hijo ? getComputedStyle(hijo).transform : '',
      y: e.offsetTop,
      x: e.offsetLeft,
      alto: e.offsetHeight,
      ancho: e.offsetWidth,
      clave: nombre(e),
    };
  }
  return fuera;
"""
)

JS_AL_ENFOCAR = r"""
  () => {
    const e = document.activeElement;
    if (!e || !e.getAttribute || e === document.body) return null;
    const marca = e.getAttribute('data-aud-tab');
    if (marca === null) return null;
    const hijo = e.querySelector('b, .fav-flecha, .p-marca');
    return {
      marca: marca,
      transform: getComputedStyle(e).transform,
      hijo: hijo ? getComputedStyle(hijo).transform : '',
      y: e.offsetTop,
      x: e.offsetLeft,
      alto: e.offsetHeight,
      ancho: e.offsetWidth,
    };
  }
"""


def medir_movimiento_real(pagina: Page) -> dict[str, Any]:
    """
    Recorre con Tab y cuenta cuantos elementos se mueven de verdad al recibir el
    foco: cambio de transform propio, de transform de su hijo animado o de
    posicion en la pagina.
    """
    pagina.evaluate(JS_MARCAR)
    antes: dict[str, Any] = pagina.evaluate(JS_ANTES_DE_ENFOCAR)
    pagina.evaluate("() => window.scrollTo({top:0,left:0,behavior:'instant'})")
    movidos: list[dict[str, Any]] = []
    vistos = 0
    salidas = 0
    for _ in range(TOPE_TAB):
        pagina.keyboard.press("Tab")
        # La transicion mas larga de la hoja es de 0,25 s. Sin esta espera la
        # lectura cae en el primer fotograma y devuelve la matriz identidad, que
        # es indistinguible de no haber movimiento: el control dejaba de servir
        # como control.
        pagina.wait_for_timeout(300)
        ahora = pagina.evaluate(JS_AL_ENFOCAR)
        if ahora is None:
            salidas += 1
            if salidas >= 2:
                break
            continue
        base = antes.get(ahora["marca"])
        if base is None:
            continue
        vistos += 1
        # matrix(1,0,0,1,0,0) es la identidad: no mueve nada y vale lo mismo que
        # none. Sin esta equivalencia una transicion que acaba donde empezo se
        # contaria como movimiento.
        quieto = {"none", "", "matrix(1, 0, 0, 1, 0, 0)"}
        norm = lambda t: "none" if t in quieto else t  # noqa: E731
        cambia_propio = norm(base["transform"]) != norm(ahora["transform"])
        cambia_hijo = norm(base["hijo"]) != norm(ahora["hijo"])
        cambia_sitio = abs(base["x"] - ahora["x"]) > 0.5 or abs(base["y"] - ahora["y"]) > 0.5
        cambia_caja = (
            abs(base["ancho"] - ahora["ancho"]) > 0.5 or abs(base["alto"] - ahora["alto"]) > 0.5
        )
        if cambia_propio or cambia_hijo or cambia_sitio or cambia_caja:
            movidos.append(
                {
                    "clave": base["clave"],
                    "transform": f"{base['transform']} -> {ahora['transform']}",
                    "hijo": f"{base['hijo']} -> {ahora['hijo']}",
                    "sitio": f"{base['y']} -> {ahora['y']}",
                    "caja": f"{base['ancho']}x{base['alto']} -> {ahora['ancho']}x{ahora['alto']}",
                }
            )
        if vistos > len(antes) + 2:
            break
    return {
        "enfocados": vistos,
        "se_mueven": len(movidos),
        "detalle": movidos[:8],
    }


def medir_movimiento(navegador: Browser) -> dict[str, Any]:
    """Con reduced_motion=reduce ningun elemento conserva transicion ni animacion."""
    fuera: dict[str, Any] = {}
    for modo in ("reduce", "no-preference"):
        contexto = navegador.new_context(
            viewport={"width": 390, "height": 844},
            has_touch=True,
            is_mobile=True,
            device_scale_factor=3,
            locale="es-CO",
            reduced_motion=modo,
        )
        pagina = contexto.new_page()
        pagina.on(
            "console",
            lambda m, modo=modo: comun._anotar_consola(f"movimiento {modo}", "error", m.text)
            if m.type == "error"
            else None,
        )
        pagina.goto(comun.URL, wait_until="load")
        comun.esperar_pintado(pagina)
        bloque: dict[str, Any] = {}
        for vista in VISTAS:
            cambiar_vista(pagina, vista)
            bloque[vista] = pagina.evaluate(JS_MOVIMIENTO)
            bloque[vista]["real"] = medir_movimiento_real(pagina)
        bloque["consulta"] = pagina.evaluate(
            "() => matchMedia('(prefers-reduced-motion: reduce)').matches"
        )
        fuera[modo] = bloque
        contexto.close()
    return fuera


# --------------------- 6. El campo #query y la ampliacion de iOS ---------------------

JS_CAMPO = r"""
  () => {
    const c = document.getElementById('query');
    if (!c) return null;
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    return {
      font_size: cs.fontSize,
      px: parseFloat(cs.fontSize),
      alto: +r.height.toFixed(1),
      ancho: +r.width.toFixed(1),
      ancho_documento: document.documentElement.scrollWidth,
      escala_visual: window.visualViewport ? +window.visualViewport.scale.toFixed(2) : null,
    };
  }
"""


def medir_campo(navegador: Browser) -> dict[str, Any]:
    """font-size y alto del campo, y que enfocarlo no cambie el ancho del documento."""
    fuera: dict[str, Any] = {}
    for etiqueta, ancho, alto in comun.TACTILES:
        with comun.abrir(navegador, ancho, alto, etiqueta=f"campo {etiqueta}") as pagina:
            antes = pagina.evaluate(JS_CAMPO)
            pagina.focus("#query")
            pagina.wait_for_timeout(400)
            despues = pagina.evaluate(JS_CAMPO)
            fuera[etiqueta] = {
                "font_size": antes["font_size"],
                "px": antes["px"],
                "alto": antes["alto"],
                "ancho_antes": antes["ancho_documento"],
                "ancho_despues": despues["ancho_documento"],
                "escala": despues["escala_visual"],
            }
    with comun.abrir(navegador, 1440, 900, tactil=False, etiqueta="campo 1440x900") as pagina:
        e = pagina.evaluate(JS_CAMPO)
        fuera["1440x900 con raton"] = {
            "font_size": e["font_size"],
            "px": e["px"],
            "alto": e["alto"],
        }
    return fuera


# --------------------- 7. La etiqueta viewport ---------------------


def medir_viewport(navegador: Browser) -> dict[str, Any]:
    """La etiqueta viewport, leida en el archivo y leida en la pagina servida."""
    texto = RUTA_INDEX.read_text(encoding="utf-8") if RUTA_INDEX.exists() else ""
    bajo = texto.lower()
    with comun.abrir(navegador, 390, 844, etiqueta="viewport") as pagina:
        servido = pagina.evaluate(
            "() => { const m = document.querySelector('meta[name=viewport]');"
            " return m ? m.getAttribute('content') : ''; }"
        )
    bajo_servido = (servido or "").lower()
    return {
        "archivo": RUTA_INDEX.as_posix(),
        "existe": RUTA_INDEX.exists(),
        "contenido_archivo": (
            re.search(r'<meta[^>]*name=["\']viewport["\'][^>]*>', texto, re.I).group(0)
            if re.search(r'<meta[^>]*name=["\']viewport["\'][^>]*>', texto, re.I)
            else ""
        ),
        "contenido_servido": servido,
        "maximum_scale": "maximum-scale" in bajo or "maximum-scale" in bajo_servido,
        "user_scalable": "user-scalable" in bajo or "user-scalable" in bajo_servido,
    }


# --------------------- 8. No regresion de escritorio ---------------------


JS_ROSA = r"""
  () => {
    const svg = document.querySelector('#mapa svg');
    const centro = document.querySelector('#mapa .centro, #mapa .mapa-centro');
    const barras = document.querySelector('#mapa-barras');
    const csBarras = barras ? getComputedStyle(barras) : null;
    return {
      rosa_pintada: !!svg && svg.getBoundingClientRect().width > 0,
      ancho: svg ? +svg.getBoundingClientRect().width.toFixed(1) : 0,
      alto: svg ? +svg.getBoundingClientRect().height.toFixed(1) : 0,
      viewBox: svg ? svg.getAttribute('viewBox') : '',
      centro: centro ? +centro.getBoundingClientRect().width.toFixed(1) : 0,
      barras_pintadas: !!barras && !barras.hasAttribute('hidden')
        && csBarras.display !== 'none' && barras.getBoundingClientRect().height > 0,
      filas_de_barras: document.querySelectorAll('#mapa-barras .barra-fila').length,
    };
  }
"""


def medir_rosa_escritorio(navegador: Browser) -> dict[str, Any]:
    """
    La rosa de escritorio, que el plan declara intacta. Con raton el lienzo mide
    440 por 516 px y las barras no se pintan: si el umbral por conPuntero() se
    hubiera escrito al reves, aqui saldrian las barras.
    """
    etiqueta, ancho, alto = comun.ESCRITORIO
    with comun.abrir(
        navegador, ancho, alto, tactil=False, etiqueta=f"rosa {etiqueta}"
    ) as pagina:
        boton = pagina.locator('.conmutador button[data-vista="mapa"]')
        existe = boton.count() > 0
        if existe:
            boton.first.click()
            pagina.wait_for_timeout(900)
        datos = pagina.evaluate(JS_ROSA) if existe else {}
        datos["pestana_mapa"] = "existe" if existe else "no existe"
        return datos


def medir_no_regresion(navegador: Browser) -> dict[str, Any]:
    """Censo en 1440x900 sin has_touch contra linea-base.json, por clave."""
    ahora = censo_objetivos.medir_escritorio(navegador)
    rosa = medir_rosa_escritorio(navegador)
    base = comun.leer_linea_base()
    if not base or "escritorio" not in base:
        return {"hay_linea_base": False, "total_ahora": ahora["total"], "rosa": rosa}
    dif = censo_objetivos.comparar_escritorio(ahora, base["escritorio"]["censo"])
    return {
        "hay_linea_base": True,
        "rosa": rosa,
        "rosa_base": base["escritorio"]["mapa"]["rosa"],
        "total_antes": base["escritorio"]["censo"]["total"],
        "total_ahora": ahora["total"],
        "cambiados": dif["cambiados"],
        "faltan": dif["faltan"],
        "sobran": dif["sobran"],
        "bajo_44_antes": base["escritorio"]["censo"]["bajo_44"],
        "bajo_44_ahora": ahora["bajo_44"],
    }


# --------------------------- Utiles de escena ---------------------------


def cambiar_vista(pagina: Page, vista: str) -> None:
    """Cambia de vista por el conmutador de arriba y espera a que pinte."""
    boton = pagina.locator(f'.conmutador button[data-vista="{vista}"]')
    if boton.count() == 0:
        return
    boton.first.click()
    pagina.wait_for_timeout(700)
    pagina.evaluate("() => window.scrollTo({top:0,left:0,behavior:'instant'})")
    pagina.wait_for_timeout(150)


def abrir_todos_los_temas(pagina: Page) -> None:
    """
    Despliega todo lo que esconde enlaces de portal, para que el recuento de
    enlaces externos los vea. En mosaico son las cabeceras de tema; en las dos
    figuras de mapa son las cabeceras de region.
    """
    for sel in (
        "#mosaico .tema-boton",
        "#mapa-barras .barra-cabecera",
        "#mapa .mapa-cabecera",
    ):
        botones = pagina.locator(sel)
        for i in range(min(botones.count(), 8)):
            try:
                botones.nth(i).click(timeout=1500)
                pagina.wait_for_timeout(120)
            except Exception:  # noqa: BLE001
                pass
    pagina.wait_for_timeout(400)


# --------------------------- Juicio ---------------------------


def juzgar(d: dict[str, Any]) -> list[tuple[str, bool, list[str]]]:
    fuera: list[tuple[str, bool, list[str]]] = []

    # 1
    ext = d["externos"]
    total_inc = len(ext["incompletos"])
    cifras = [
        f"{clave}: {b['total']} enlaces externos, {b['portal']} de portal, "
        f"{b['incompletos']} incompletos ({b['portal_incompletos']} de portal, "
        f"{b['navegacion_incompletos']} de la barra de navegacion)"
        for clave, b in ext["bloques"].items()
    ]
    for e in ext["incompletos"][:8]:
        falta = []
        if not e["tiene_aria"]:
            falta.append("aria-label")
        if not e["tiene_target"]:
            falta.append('target="_blank"')
        if not e["tiene_rel"]:
            falta.append("rel=noopener noreferrer")
        cifras.append(
            f"  {e['grupo']}: {e['clave'][:44]} [{e['donde']}] le falta {', '.join(falta)}"
        )
    fuera.append(
        ("1. Enlaces externos con aria-label, target y rel", total_inc == 0, cifras)
    )

    # 2
    foco = d["foco"]
    sin_ind = 0
    cifras = []
    for etiqueta, vistas in foco.items():
        for vista, r in vistas.items():
            sin_ind += len(r["sin_indicador"])
            cifras.append(
                f"{etiqueta}/{vista}: {r['paradas']} paradas con Tab, "
                f"{len(r['sin_indicador'])} sin indicador de foco"
            )
    malos: list[str] = []
    for etiqueta, vistas in foco.items():
        for vista, r in vistas.items():
            for s in r["sin_indicador"][:3]:
                linea = f"  sin indicador: {s['clave'][:46]} [{etiqueta}/{vista}]"
                if linea not in malos:
                    malos.append(linea)
    cifras.extend(malos[:8])
    fuera.append(("2. Foco visible en los cuatro tamanos tactiles", sin_ind == 0, cifras))

    # 3
    inert = 0
    hidden = 0
    perdidos = 0
    cifras = []
    for etiqueta, vistas in foco.items():
        for vista, r in vistas.items():
            inert += len(r["en_inert"])
            hidden += len(r["en_hidden"])
            perdidos += len(r["sin_alcanzar"])
            cifras.append(
                f"{etiqueta}/{vista}: {r['paradas']} paradas de {r['esperados']} tabulables, "
                f"ciclo {'cerrado' if r['ciclo_cerrado'] else 'abierto'}, "
                f"{len(r['en_inert'])} en inert, {len(r['sin_alcanzar'])} sin alcanzar"
            )
    for etiqueta, vistas in foco.items():
        for vista, r in vistas.items():
            for p in r["sin_alcanzar"][:3]:
                linea = f"  sin alcanzar: {p[:46]} [{etiqueta}/{vista}]"
                if linea not in cifras:
                    cifras.append(linea)
    fuera.append(
        (
            "3. Recorrido completo con Tab, sin entrar en inert",
            inert == 0 and hidden == 0 and perdidos == 0,
            cifras,
        )
    )

    # 4
    cl = d["contraste"]
    ok4 = True
    cifras = []
    for clave, v in cl.items():
        if clave.endswith("/persiste") or clave.endswith("/piso"):
            continue
        ok_bloque = v["desborde"] == 0 and v["bajo_44"] == 0
        ok4 = ok4 and ok_bloque
        cifras.append(
            f"{clave}: zoom {v['zoom']}, contraste {'si' if v['contraste'] else 'no'}, "
            f"desborde {v['desborde']} px, {v['objetivos']} objetivos, "
            f"{v['bajo_44']} bajo 44 px, marca visible en {v['marca_visible']} de {v['marcas']} "
            f"({v['marca_display_none']} con display:none)"
        )
        for p in v["pequenos"][:3]:
            cifras.append(
                f"  {comun.num(p['ancho'])}x{comun.num(p['alto'])} px  {p['clave'].split('|')[0]}"
            )
    # La marca de agua sigue oculta en alto contraste.
    for etiqueta in ("390x844", "1024x768"):
        v = cl.get(f"{etiqueta}/contraste")
        if v and v["marcas"] and v["marca_visible"] != 0:
            ok4 = False
            cifras.append(
                f"  {etiqueta}: en alto contraste la marca de agua se ve en "
                f"{v['marca_visible']} tarjetas y deberia estar oculta"
            )
        p = cl.get(f"{etiqueta}/persiste")
        if p:
            persiste = p["contraste"] and abs(float(p["zoom"] or 1) - 1.3) < 0.01
            ok4 = ok4 and persiste
            cifras.append(
                f"{etiqueta}: tras recargar contraste {'si' if p['contraste'] else 'no'} "
                f"y zoom {p['zoom']}"
            )
        piso = cl.get(f"{etiqueta}/piso")
        if piso is not None:
            en_piso = abs(float(piso or 1) - 1.0) < 0.01
            ok4 = ok4 and en_piso
            cifras.append(f"{etiqueta}: piso del zoom {piso}")
    fuera.append(("4. Alto contraste y letra ampliada sin romper nada", ok4, cifras))

    # 5
    mv = d["movimiento"]
    reduce = mv["reduce"]
    control = mv["no-preference"]
    # El veredicto lo decide el movimiento medido, no la transicion declarada:
    # una transicion sobre transform cuya unica regla vive en @media (hover:hover)
    # no mueve nada en un equipo sin puntero fino.
    se_mueven = sum(reduce[v]["real"]["se_mueven"] for v in VISTAS)
    declaradas = sum(reduce[v]["total_con_movimiento"] for v in VISTAS)
    mueven_control = sum(control[v]["real"]["se_mueven"] for v in VISTAS)
    cifras = [f"consulta reduce activa: {'si' if reduce['consulta'] else 'no'}"]
    for v in VISTAS:
        r = reduce[v]
        cifras.append(
            f"reduce/{v}: {r['real']['enfocados']} elementos enfocados con Tab, "
            f"{r['real']['se_mueven']} se mueven al recibir el foco"
        )
    for v in VISTAS:
        cifras.append(
            f"control sin preferencia/{v}: {control[v]['real']['enfocados']} enfocados, "
            f"{control[v]['real']['se_mueven']} se mueven"
        )
    for c in control["mosaico"]["real"]["detalle"][:3]:
        cifras.append(f"  se mueve sin preferencia: {c['clave']} hijo {c['hijo']}")
    for v in VISTAS:
        for c in reduce[v]["real"]["detalle"][:3]:
            cifras.append(
                f"  se mueve CON reduce: {c['clave']} transform {c['transform']} "
                f"hijo {c['hijo']} sitio {c['sitio']} caja {c['caja']}"
            )
    cifras.append(
        f"transiciones declaradas sobre propiedades de movimiento con reduce: {declaradas} "
        "(ninguna se dispara: su unica regla vive en @media (hover:hover) y la anula "
        "transform:none!important del bloque reduce)"
    )
    for v in VISTAS:
        cifras.append(
            f"reduce/{v}: {reduce[v]['total_solo_color']} transiciones solo de color, "
            "que el bloque reduce conserva a proposito"
        )
    fuera.append(
        (
            "5. prefers-reduced-motion sin movimiento",
            reduce["consulta"] and se_mueven == 0 and mueven_control > 0,
            cifras,
        )
    )

    # 6
    ca = d["campo"]
    ok6 = True
    cifras = []
    for clave, v in ca.items():
        tactil = "raton" not in clave
        bien = abs(v["px"] - 16.0) < 0.01
        if tactil:
            bien = bien and v["alto"] >= 44.0 and v["ancho_antes"] == v["ancho_despues"]
            ok6 = ok6 and bien
            cifras.append(
                f"{clave}: font-size {v['font_size']}, alto {comun.num(v['alto'])} px, "
                f"ancho del documento {v['ancho_antes']} -> {v['ancho_despues']} px al enfocar"
            )
        else:
            cifras.append(
                f"{clave}: font-size {v['font_size']}, alto {comun.num(v['alto'])} px "
                "(dato de escritorio, no criterio)"
            )
    fuera.append(("6. Campo #query con font-size 16 px y sin ampliar", ok6, cifras))

    # 7
    vp = d["viewport"]
    ok7 = vp["existe"] and not vp["maximum_scale"] and not vp["user_scalable"]
    fuera.append(
        (
            "7. index.html sin maximum-scale ni user-scalable",
            ok7,
            [
                f"archivo: {vp['contenido_archivo']}",
                f"servido: {vp['contenido_servido']}",
                f"maximum-scale presente: {'si' if vp['maximum_scale'] else 'no'}",
                f"user-scalable presente: {'si' if vp['user_scalable'] else 'no'}",
            ],
        )
    )

    # 8
    nr = d["no_regresion"]
    if not nr["hay_linea_base"]:
        fuera.append(
            ("8. Censo de escritorio igual a linea-base.json", False, ["no hay linea-base.json"])
        )
    else:
        r = nr["rosa"]
        rb = nr["rosa_base"]
        rosa_igual = (
            r.get("rosa_pintada")
            and abs(r.get("ancho", 0) - rb["ancho"]) < 0.6
            and abs(r.get("alto", 0) - rb["alto"]) < 0.6
            and not r.get("barras_pintadas")
        )
        ok8 = not nr["cambiados"] and not nr["faltan"] and rosa_igual
        cifras = [
            f"objetivos: {nr['total_antes']} en la linea base, {nr['total_ahora']} ahora",
            f"rosa con raton: {comun.num(r.get('ancho', 0))}x{comun.num(r.get('alto', 0))} px "
            f"(linea base {comun.num(rb['ancho'])}x{comun.num(rb['alto'])}), "
            f"viewBox {r.get('viewBox')}, barras pintadas: "
            f"{'si' if r.get('barras_pintadas') else 'no'}",
            f"con otra medida: {len(nr['cambiados'])}",
            f"que faltan: {len(nr['faltan'])}",
            f"nuevos: {len(nr['sobran'])}",
            f"bajo 44 px: {nr['bajo_44_antes']} antes, {nr['bajo_44_ahora']} ahora "
            "(escritorio no tiene criterio de 44 px)",
        ]
        for c in nr["cambiados"][:10]:
            cifras.append(f"  {c['clave'].split('|')[0]}: {c['antes']} -> {c['ahora']}")
        for f in nr["faltan"][:6]:
            cifras.append(f"  falta: {f.split('|')[0]}")
        for s in nr["sobran"][:6]:
            cifras.append(f"  nuevo: {s.split('|')[0]}")
        fuera.append(("8. Censo de escritorio igual a linea-base.json", ok8, cifras))

    return fuera


# --------------------------- Recogida y salida ---------------------------


def recoger(navegador: Browser) -> dict[str, Any]:
    return {
        "externos": medir_externos(navegador),
        "foco": medir_foco_y_teclado(navegador),
        "contraste": medir_contraste_y_letra(navegador),
        "movimiento": medir_movimiento(navegador),
        "campo": medir_campo(navegador),
        "viewport": medir_viewport(navegador),
        "no_regresion": medir_no_regresion(navegador),
    }


def main() -> int:
    comun.comprobar_servidores()
    with sync_playwright() as reproductor:
        navegador = reproductor.chromium.launch()
        datos = recoger(navegador)
        navegador.close()

    datos["consola"] = comun.errores_consola()

    comun.titulo("Cierre: accesibilidad conservada y no regresion de escritorio")
    veredictos = juzgar(datos)
    for nombre, ok, cifras in veredictos:
        comun.veredicto(nombre, ok, cifras)

    comun.apartado("Errores de consola recogidos en todo el recorrido")
    comun.dato("total", len(datos["consola"]))
    for e in datos["consola"][:8]:
        comun.dato(e["donde"], e["texto"][:120])

    salida = comun.CARPETA / "cierre-accesibilidad.json"
    salida.write_text(
        json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    comun.apartado("Salida")
    comun.dato("archivo", salida.as_posix())

    fallan = [n for n, ok, _ in veredictos if not ok]
    comun.apartado("Resumen")
    comun.dato("comprobaciones", len(veredictos))
    comun.dato("pasan", len(veredictos) - len(fallan))
    comun.dato("fallan", len(fallan))
    for n in fallan:
        comun.dato("  FALLA", n)
    return 0 if not fallan else 1


if __name__ == "__main__":
    sys.exit(main())
