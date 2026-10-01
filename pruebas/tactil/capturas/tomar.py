"""
Capturas de la version tactil terminada.

NO SE USA full_page=True. Medido: una captura de pagina completa apaga la
emulacion tactil de Chromium DURANTE el disparo, de modo que la imagen sale de
escritorio aunque el contexto se haya pedido tactil y aunque el estado leido un
instante antes diga que es tactil. Despues del disparo (hover:hover) se queda en
true y (pointer:coarse) en false, con la ventana en el mismo ancho.

En su lugar se mide el alto del documento con la ventana real del aparato y se
reabre con la ventana de ese alto, que da la pagina entera en un disparo normal
y conserva la emulacion. La unica distorsion es que el zocalo se dibuja al pie de
esa ventana alta, que es donde lo pintaria igualmente una captura completa; para
verlo flotando esta la toma aparte, que si va con la ventana del aparato.
"""
import sys
from playwright.sync_api import sync_playwright

D = [("movil-390",390,844),("movil-430",430,932),("tablet-768",768,1024),("tablet-1024",1024,768)]
dest = sys.argv[1]
ESTADO = """() => {
  const vis=(s)=>{const e=document.querySelector(s);return !!(e&&!e.hasAttribute('hidden')&&e.getClientRects().length);};
  const act=document.querySelector('.conmutador button[aria-pressed="true"]');
  return {tactil:!matchMedia('(hover: hover)').matches, zocalo:!!document.querySelector('.zocalo button'),
          pestanas:document.querySelectorAll('.conmutador button').length,
          pulsada:act&&act.getAttribute('data-vista'), mosaico:vis('#mosaico'),
          barras:vis('#mapa-barras'), lista:vis('#lista'), alto:document.documentElement.scrollHeight};
}"""

def abrir(nav, w, h, dsf=3):
    ctx = nav.new_context(viewport={"width":w,"height":h}, has_touch=True, is_mobile=True,
                          device_scale_factor=dsf, locale="es-CO")
    p = ctx.new_page(); p.goto("http://localhost:4200/", wait_until="load")
    p.wait_for_selector("#mosaico .tema-boton", state="attached", timeout=20000)
    p.wait_for_timeout(2400)
    return ctx, p

def poner_vista(p, v):
    if v == "mosaico": return
    p.evaluate("""v => document.querySelector('.conmutador button[data-vista="'+v+'"]').click()""", v)
    destinos = ["#mapa","#mapa-barras"] if v=="mapa" else [f"#{v}"]
    p.wait_for_function("sels => sels.some(s => { const e=document.querySelector(s);"
                        " return e && !e.hasAttribute('hidden') && e.getClientRects().length; })",
                        arg=destinos, timeout=10000)
    p.wait_for_timeout(1300)
    p.evaluate("window.scrollTo({top:0,left:0,behavior:'instant'})"); p.wait_for_timeout(400)

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    for n,w,h in D:
        for v in ("mosaico","mapa","lista"):
            # Paso 1: el alto de esa vista con la ventana real del aparato.
            ctx, p = abrir(nav, w, h)
            poner_vista(p, v)
            alto = int(p.evaluate("document.documentElement.scrollHeight")); ctx.close()
            # Paso 2: la misma vista con la ventana de ese alto, un disparo normal.
            ctx, p = abrir(nav, w, alto, dsf=2)
            poner_vista(p, v)
            e = p.evaluate(ESTADO)
            p.screenshot(path=f"{dest}/{n}-{v}.png")
            print(f"  {n} {v}: tactil={e['tactil']} zocalo={e['zocalo']} pestanas={e['pestanas']} "
                  f"pulsada={e['pulsada']} mosaico={e['mosaico']} barras={e['barras']} lista={e['lista']} "
                  f"alto={alto}", flush=True)
            ctx.close()
        # El zocalo flotando, con la ventana del aparato y sin pagina completa.
        ctx, p = abrir(nav, w, h)
        p.evaluate("window.scrollTo({top: Math.round(document.documentElement.scrollHeight*0.45), behavior:'instant'})")
        p.wait_for_timeout(900)
        e = p.evaluate(ESTADO)
        p.screenshot(path=f"{dest}/{n}-zocalo.png")
        print(f"  {n} zocalo: tactil={e['tactil']} zocalo={e['zocalo']}", flush=True)
        ctx.close()
    nav.close()
