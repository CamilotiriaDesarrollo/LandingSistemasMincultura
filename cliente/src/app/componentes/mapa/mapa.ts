import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DIRECTORIO_VACIO, PortalEnriquecido, TemaEnriquecido } from '../../modelos/estado';
import { calcularEstado } from '../../nucleo/estado';
import {
  Foco,
  Geo,
  TemaGeo,
  calcularGeometria,
  estiloTema,
  f1,
  mismoFoco,
} from '../../nucleo/geometria-rosa';
import { plural } from '../../nucleo/texto';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Resaltado } from '../resaltado/resaltado';

/** Un portal de una columna con su índice global: con él se casan fila, línea, punto y haz. */
interface FilaVista {
  p: PortalEnriquecido;
  i: number;
}

/** Un tema tal como lo pinta una columna, con su tono y sus filas ya indexadas. */
interface GrupoVista {
  t: TemaEnriquecido;
  solido: boolean;
  color: string;
  filas: FilaVista[];
}

interface ArcoVista {
  id: string;
  numero: string;
  d: string;
  x: number;
  y: number;
  solido: boolean;
  color: string;
  ux: string;
  uy: string;
}

interface PuntoVista {
  i: number;
  fav: boolean;
  d: string;
  cx: number;
  cy: number;
}

/** Las dos líneas de la ficha del centro, ya resueltas como texto. */
interface FichaCentro {
  clave: string;
  portal: boolean;
  tema: string;
  nombre: string;
  desc: string;
  dominio: string;
  pie: string;
}

type Canal = 'teclado' | 'puntero';

/**
 * Vista mapa: la rosa de los saberes con su anillo de temas, las dos columnas de nombres y
 * el centro que cuenta.
 *
 * INVARIANTE CENTRAL: la geometría se calcula UNA VEZ sobre todos los portales y no depende
 * de la búsqueda. Buscar apaga y enciende, pero el mapa es siempre el mismo mapa; si geo()
 * llegara a colgar de la consulta, el mapa se reordenaría al escribir.
 *
 * Solo cinco cosas siguen siendo imperativas: los haces, el ajuste de nombres, el contador
 * del centro, el IntersectionObserver y la validación de la geometría. Todo lo demás son
 * enlaces de plantilla, así que pintarMapa no existe como función.
 */
@Component({
  selector: 'div[app-mapa]',
  templateUrl: './mapa.html',
  imports: [NgTemplateOutlet, Resaltado],
})
export class Mapa {
  protected readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);
  private readonly destruir = inject(DestroyRef);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly plural = plural;

  /* ─────────── Geometría: de una vez y sin consulta ─────────── */
  /** Estado sin búsqueda: es lo único de lo que la geometría puede depender. */
  private readonly base = computed(() =>
    calcularEstado(this.store.datos() ?? DIRECTORIO_VACIO, {}),
  );

  /**
   * Los temas del mapa con sus portales ya indexados. Es la entrada de la geometría y el
   * origen de las descripciones ocultas, y no lee la consulta en ningún punto.
   *
   * El mapa NO filtra los temas por total > 0, a diferencia del mosaico: si el API devolviera
   * un tema vacío saldría una cabecera con lista vacía y un arco con peso 1. Agregar ese
   * filtro cambiaría la geometría respecto a la propuesta.
   */
  protected readonly temasBase = computed<GrupoVista[]>(() =>
    this.base().temas.map((t, j) => {
      const e = estiloTema(j);
      return {
        t,
        solido: e.clase === 'solido',
        color: e.color,
        filas: t.portales.map((p) => ({ p, i: this.store.indiceDe(p) })),
      };
    }),
  );

  private readonly temasGeo = computed<TemaGeo[]>(() =>
    this.temasBase().map((g) => ({
      id: g.t.id,
      numero: g.t.numero,
      total: g.t.total,
      portales: g.filas.map((f) => ({ i: f.i, fav: f.p.favorito })),
    })),
  );

  protected readonly geo = computed<Geo>(() => calcularGeometria(this.temasGeo()));

  /**
   * Índice global del portal -> posición en geo().puntos, que es el orden del DOM.
   * viewChildren devuelve los nodos en orden de DOM, no por índice global: sin este mapa los
   * haces se lanzarían sobre la línea equivocada y nada avisaría.
   */
  private readonly posDe = computed(() => new Map(this.geo().puntos.map((p, n) => [p.i, n])));

  protected readonly caja = computed(() => {
    const g = this.geo();
    return { ancho: g.conf.ancho, alto: g.alto, viewBox: `0 0 ${g.conf.ancho} ${g.alto}` };
  });

  protected readonly centroCaja = computed(() => {
    const g = this.geo();
    const r = g.conf.rCentro;
    return { left: g.cx - r + 'px', top: g.cy - r + 'px', lado: 2 * r + 'px' };
  });

  protected readonly arcos = computed<ArcoVista[]>(() =>
    this.geo().arcos.map((a) => {
      const e = estiloTema(a.j);
      return {
        id: a.id,
        numero: a.numero,
        d: a.d,
        x: f1(a.num[0]),
        y: f1(a.num[1]),
        solido: e.clase === 'solido',
        color: e.color,
        ux: String(a.u[0]),
        uy: String(a.u[1]),
      };
    }),
  );

  protected readonly puntos = computed<PuntoVista[]>(() =>
    this.geo().puntos.map((p) => ({
      i: p.i,
      fav: p.fav,
      d: p.d,
      cx: f1(p.punto[0]),
      cy: f1(p.punto[1]),
    })),
  );

  /* ─────────── Estado marcado: apaga y enciende, no mueve nada ─────────── */
  /** Los mismos temas, con los conteos y las coincidencias de la fase de marcado. */
  protected readonly grupos = computed<ReadonlyMap<string, GrupoVista>>(() => {
    const mapa = new Map<string, GrupoVista>();
    this.store.estado().temas.forEach((t, j) => {
      const e = estiloTema(j);
      mapa.set(t.id, {
        t,
        solido: e.clase === 'solido',
        color: e.color,
        filas: t.portales.map((p) => ({ p, i: this.store.indiceDe(p) })),
      });
    });
    return mapa;
  });

  /** Lo que las líneas y los puntos del SVG necesitan, por índice global. */
  private readonly marcados = computed<
    ReadonlyMap<number, { coincide: boolean; apagado: boolean; tema: string }>
  >(() => {
    const hay = this.store.hayConsultaMarca();
    const porI = new Map<number, { coincide: boolean; apagado: boolean; tema: string }>();
    for (const g of this.grupos().values()) {
      for (const f of g.filas) {
        const coincide = hay && f.p.coincide;
        porI.set(f.i, { coincide, apagado: hay && !f.p.coincide, tema: g.t.id });
      }
    }
    return porI;
  });

  /* ─────────── Foco: dos canales y manda el teclado ─────────── */
  private readonly focoTeclado = signal<Foco | null>(null);
  private readonly focoPuntero = signal<Foco | null>(null);
  protected readonly focoEfectivo = computed(() => this.focoTeclado() ?? this.focoPuntero());
  protected readonly portalEnFoco = computed(() => {
    const f = this.focoEfectivo();
    return f && f.tipo === 'portal' ? f.i : -1;
  });
  protected readonly temaEnFoco = computed(() => {
    const f = this.focoEfectivo();
    return f && f.tipo === 'tema' ? f.id : '';
  });

  private readonly tiempos: Record<Canal, ReturnType<typeof setTimeout> | undefined> = {
    teclado: undefined,
    puntero: undefined,
  };

  /* ─────────── Visibilidad y movimiento ─────────── */
  protected readonly mapaVisible = signal(false);
  private readonly mapaAlVeinte = signal(false);
  /** Sube cada vez que el mapa cruza el 20 % hacia arriba: ahí se relanzan los haces. */
  private readonly pulsoHaces = signal(0);
  protected readonly giro = signal(0);
  private ultimoGiro = 0;

  /* ─────────── Centro ─────────── */
  protected readonly numeroMostrado = signal(0);
  /** Espejo sin señal del número: contarHasta no puede leer la señal que escribe. */
  private mostrado = 0;
  /** Valor al que se está contando, en vez del data-valor del prototipo. */
  private objetivo = 0;
  private centroPrimeraVez = true;
  private cuadro = 0;
  private cierre: ReturnType<typeof setTimeout> | undefined;

  private readonly cuentaCentro = computed(() => {
    const e = this.store.estado();
    return e.hayConsulta ? e.resultados.length : e.total;
  });

  protected readonly lineaCentro = computed(() => {
    const e = this.store.estado();
    const n = this.cuentaCentro();
    if (!e.hayConsulta) return `${n === 1 ? 'portal' : 'portales'} en ${e.temas.length} temas`;
    return n ? (n === 1 ? 'portal coincide' : 'portales coinciden') : 'Sin coincidencias';
  });

  protected readonly subCentro = computed(() => {
    const e = this.store.estado();
    const n = this.cuentaCentro();
    if (!e.hayConsulta) return '';
    return n ? `de ${e.total}` : 'Prueba con otra palabra';
  });

  protected readonly fichaCentro = computed<FichaCentro | null>(() => {
    const f = this.focoEfectivo();
    if (f && f.tipo === 'portal') {
      const fila = [...this.grupos().values()].flatMap((g) => g.filas).find((x) => x.i === f.i);
      if (!fila) return null;
      const p = fila.p;
      return {
        clave: 'p' + f.i + '|' + this.store.consultaMarca(),
        portal: true,
        tema: p.tema?.name ?? '',
        nombre: p.name,
        desc: p.desc,
        dominio: p.dominio,
        pie: 'Se abre en una pestaña nueva ↗',
      };
    }
    const id = (f && f.tipo === 'tema' ? f.id : '') || this.store.temaActivo();
    const g = id ? this.grupos().get(id) : undefined;
    if (!g) return null;
    const t = g.t;
    const hay = this.store.hayConsultaMarca();
    return {
      clave: 't' + t.id + '|' + hay + t.coincidencias,
      portal: false,
      tema: 'Tema ' + t.numero,
      nombre: t.name,
      desc: t.desc,
      dominio: '',
      pie: hay
        ? `${t.coincidencias} de ${plural(t.total, 'portal', 'portales')}`
        : plural(t.total, 'portal', 'portales'),
    };
  });

  protected readonly claveCentro = computed(() => this.fichaCentro()?.clave ?? 'cuenta');

  /* ─────────── Nodos que hay que medir o animar ─────────── */
  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');
  /**
   * Los dos haces de cada punto. Dos consultas y no una porque el mismo nombre de referencia
   * no se puede declarar dos veces en la misma vista; las dos devuelven los nodos en orden de
   * DOM, así que la posición sigue saliendo de posDe.
   */
  private readonly colas = viewChildren<ElementRef<SVGPathElement>>('hazCola');
  private readonly cabezas = viewChildren<ElementRef<SVGPathElement>>('hazCabeza');
  private readonly nombres = viewChildren('nombre', { read: ElementRef });
  private readonly filaItems = viewChildren('filaItem', { read: ElementRef });

  /** Largo de cada haz. Se vacía cuando cambian los datos, porque el path cambia. */
  private readonly largos = new Map<number, number>();
  /** Señal y no campo: la validación corre en un afterRenderEffect que tiene que despertar. */
  private readonly fuentesListas = signal(false);
  private validado = false;
  private tiempoHaces: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destruir.onDestroy(() => {
      clearTimeout(this.tiempos.teclado);
      clearTimeout(this.tiempos.puntero);
      clearTimeout(this.tiempoHaces);
      clearTimeout(this.cierre);
      this.cancelarCuadro();
    });

    // Los datos llegan por HTTP y con ellos cambia el path de cada haz: el cache de largos
    // no sirve para la geometría nueva.
    effect(() => {
      this.geo();
      this.largos.clear();
    });

    // Cambiar de pestaña suelta lo señalado, como en el prototipo: si no, al volver al mapa
    // seguiría encendida una fila que ya nadie está señalando.
    effect(() => {
      this.store.vista();
      this.focoTeclado.set(null);
      this.focoPuntero.set(null);
    });

    // El contador del centro. Fuera de pantalla escribe directo; la primera vez que el mapa
    // aparece cuenta desde 0 en 900 ms, y después en 300. La bandera de primera vez no se
    // gasta mientras el API responde: en el prototipo los datos ya estaban, y con el mapa
    // todavía vacío la primera cuenta se perdería.
    effect(() => {
      const n = this.cuentaCentro();
      const primera = this.centroPrimeraVez && !!this.store.datos();
      if (!this.mapaVisible()) {
        this.contarHasta(n, 0);
      } else if (primera) {
        this.centroPrimeraVez = false;
        this.escribirNumero(0);
        this.objetivo = 0;
        this.contarHasta(n, 900);
      } else {
        this.contarHasta(n, 300);
      }
    });

    // Un solo efecto para los haces de búsqueda: al escribir (qMarca ya llega con los 120 ms
    // de espera), al cambiar de vista y al cruzar el 20 % de visibilidad. La espera propia de
    // 120 ms junta la ráfaga de cambios y le da tiempo al [hidden] de soltarse.
    effect(() => {
      const hay = this.store.hayConsultaMarca();
      this.store.consultaMarca();
      const vista = this.store.vistaEfectiva();
      const visible = this.mapaVisible();
      this.pulsoHaces();
      clearTimeout(this.tiempoHaces);
      if (!hay || vista !== 'mapa' || !visible) return;
      this.tiempoHaces = setTimeout(() => this.lanzarHacesDeBusqueda(), 120);
    });

    afterNextRender(() => {
      this.observarVisibilidad();
      this.observarAncho();
      // El A+ cambia body.style.zoom y eso NO dispara resize: de ahí el ResizeObserver.
      const fuentes = this.documento.fonts;
      if (fuentes) fuentes.ready.then(() => this.fuentesListas.set(true));
    });

    // Medir exige nodos pintados: el ajuste de nombres corre después de cada render que
    // cambie los nodos, la consulta marcada o la vista.
    afterRenderEffect(() => {
      this.nombres();
      this.store.consultaMarca();
      this.store.vistaEfectiva();
      this.ajustarNombres();
      // Red de seguridad del port, una sola vez y solo en desarrollo: con otros datos la
      // partición de columnas y el alto cambian solos, y esto dice si el CSS y la geometría
      // siguen de acuerdo. Espera a que lleguen los datos, que en el prototipo ya estaban.
      if (isDevMode() && this.fuentesListas() && !this.validado && this.geo().puntos.length) {
        this.validado = true;
        this.validarGeometria();
      }
    });
  }

  /* ─────────── Consultas de la plantilla ─────────── */
  protected apagado(p: PortalEnriquecido): boolean {
    return this.store.hayConsultaMarca() && !p.coincide;
  }

  protected esFoco(i: number): boolean {
    return this.portalEnFoco() === i;
  }

  protected puntoCoincide(i: number): boolean {
    return this.marcados().get(i)?.coincide ?? false;
  }

  protected puntoApagado(i: number): boolean {
    return this.marcados().get(i)?.apagado ?? false;
  }

  /** La línea se tiñe cuando su tema está fijo o señalado. */
  protected lineaDeTema(i: number): boolean {
    const tema = this.marcados().get(i)?.tema ?? '';
    return !!tema && (this.store.temaActivo() === tema || this.temaEnFoco() === tema);
  }

  /** Tema sin coincidencias: se apaga el arco, no su número. */
  protected arcoApagado(id: string): boolean {
    return this.store.hayConsultaMarca() && !this.grupos().get(id)?.t.coincidencias;
  }

  /* ─────────── Los seis manejadores del lienzo ─────────── */
  /**
   * Solo el movimiento real del mouse señala: si la página se desplaza bajo un puntero quieto
   * no cuenta, y por eso el realce está en .is-foco y no en :hover. Cuando la persona mueve el
   * mouse, lo que señala pasa a mandar sobre el foco de teclado.
   */
  protected alPunteroSeMueve(ev: PointerEvent): void {
    if (!(ev.movementX || ev.movementY)) return;
    const el = this.elementoDelMapa(ev);
    if (!el) return;
    const foco = this.focoDe(el);
    clearTimeout(this.tiempos.puntero);
    if (mismoFoco(this.focoPuntero(), foco) && !this.focoTeclado()) return;
    const antes = this.focoEfectivo();
    this.focoTeclado.set(null);
    this.focoPuntero.set(foco);
    if (mismoFoco(antes, foco)) return;
    this.girarOrbitas();
    this.lanzarHazDelFoco();
  }

  protected alPunteroSaleDelMapa(ev: PointerEvent): void {
    const el = this.elementoDelMapa(ev);
    // Moverse dentro de la misma fila no la apaga.
    if (!el || (ev.relatedTarget instanceof Node && el.contains(ev.relatedTarget))) return;
    this.soltarFoco('puntero');
  }

  /** El :focus-visible es lo que evita que un clic de mouse encienda la ficha del centro. */
  protected alFocoEntraEnMapa(ev: FocusEvent): void {
    const el = this.elementoDelMapa(ev);
    if (el && el.matches(':focus-visible')) this.marcarFoco('teclado', this.focoDe(el));
  }

  protected alFocoSaleDelMapa(ev: FocusEvent): void {
    if (this.elementoDelMapa(ev)) this.soltarFoco('teclado');
  }

  /**
   * La cabecera de un tema fija ese tema. Es el mismo ?tema= del mosaico, así que al volver a
   * la otra pestaña el tema sigue elegido; el mapa no guarda estado propio.
   */
  protected alPulsarEnMapa(ev: MouseEvent): void {
    const cab = (ev.target as Element | null)?.closest<HTMLElement>('.cabecera');
    if (!cab) return;
    this.store.alternarTema(cab.dataset['tema'] ?? '');
    this.store.abiertoDesde.set('');
  }

  /** Las flechas recorren cabeceras y filas, salteando lo que está apagado con inert. */
  protected alTeclearMapa(ev: KeyboardEvent): void {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const items = Array.from(
      this.anfitrion.querySelectorAll<HTMLElement>('.cabecera, .mapa-fila'),
    ).filter((el) => !el.closest('[inert]'));
    const n = items.indexOf(this.documento.activeElement as HTMLElement);
    if (n < 0) return;
    ev.preventDefault();
    const destino = Math.max(0, Math.min(items.length - 1, n + (ev.key === 'ArrowDown' ? 1 : -1)));
    items[destino].focus();
  }

  private elementoDelMapa(ev: Event): HTMLElement | null {
    const objetivo = ev.target as Element | null;
    return objetivo?.closest<HTMLElement>('.mapa-fila, .cabecera') ?? null;
  }

  private focoDe(el: HTMLElement): Foco {
    return el.classList.contains('mapa-fila')
      ? { tipo: 'portal', i: Number(el.dataset['i']) }
      : { tipo: 'tema', id: el.dataset['tema'] ?? '' };
  }

  /* ─────────── Foco: los dos canales ─────────── */
  private marcarFoco(canal: Canal, foco: Foco): void {
    clearTimeout(this.tiempos[canal]);
    const actual = canal === 'teclado' ? this.focoTeclado() : this.focoPuntero();
    if (mismoFoco(actual, foco)) return;
    const antes = this.focoEfectivo();
    this.fijarCanal(canal, foco);
    if (mismoFoco(antes, this.focoEfectivo())) return;
    this.girarOrbitas();
    this.lanzarHazDelFoco();
  }

  /** La espera de 150 ms es lo que evita el parpadeo al pasar de una fila a otra. */
  private soltarFoco(canal: Canal, espera = 150): void {
    clearTimeout(this.tiempos[canal]);
    this.tiempos[canal] = setTimeout(() => this.fijarCanal(canal, null), espera);
  }

  private fijarCanal(canal: Canal, foco: Foco | null): void {
    if (canal === 'teclado') this.focoTeclado.set(foco);
    else this.focoPuntero.set(foco);
  }

  /* ─────────── 1. Los haces ─────────── */
  private mapaEnPantalla(): boolean {
    return (
      this.store.vistaEfectiva() === 'mapa' &&
      !this.anfitrion.hidden &&
      this.mapaVisible() &&
      !this.store.menosMovimiento()
    );
  }

  private lanzarHaz(i: number, retraso = 0): void {
    if (!this.mapaEnPantalla()) return;
    const n = this.posDe().get(i);
    if (n === undefined) return;
    const cola = this.colas()[n]?.nativeElement;
    const cabeza = this.cabezas()[n]?.nativeElement;
    if (!cola || !cabeza || typeof cola.animate !== 'function') return;
    let largoTotal = this.largos.get(i);
    if (largoTotal === undefined) {
      largoTotal = cola.getTotalLength();
      this.largos.set(i, largoTotal);
    }
    const tramos: [SVGPathElement, number][] = [
      [cola, 70],
      [cabeza, 22],
    ];
    for (const [el, largo] of tramos) {
      el.style.strokeDasharray = `${largo} ${largoTotal + largo + 10}`;
      el.style.strokeDashoffset = String(largo);
      // El .haz nace con visibility:hidden para que no se vea antes del primer disparo.
      el.style.visibility = 'visible';
      if (typeof el.getAnimations === 'function') el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [{ strokeDashoffset: String(largo) }, { strokeDashoffset: String(-largoTotal) }],
        { duration: 450, delay: retraso, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' },
      );
    }
  }

  private lanzarHazDelFoco(): void {
    const f = this.focoEfectivo();
    if (f && f.tipo === 'portal') this.lanzarHaz(f.i);
  }

  /** Al buscar, los resultados se encienden uno tras otro. Con más de ocho sería ruido. */
  private lanzarHacesDeBusqueda(): void {
    const e = this.store.estado();
    if (!e.hayConsulta || e.resultados.length > 8) return;
    e.resultados.forEach((p, n) => this.lanzarHaz(this.store.indiceDe(p), n * 40));
  }

  /* ─────────── 2. El ajuste de nombres ─────────── */
  /** Nombres que no caben: bajan un punto de letra y, si aun así no caben, llevan title. */
  private ajustarNombres(): void {
    if (this.store.vistaEfectiva() !== 'mapa' || this.anfitrion.hidden) return;
    for (const ref of this.nombres()) {
      const el = ref.nativeElement as HTMLElement;
      el.classList.remove('is-apretado');
      el.removeAttribute('title');
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      el.classList.add('is-apretado');
      // textContent da el nombre entero aunque esté partido por el <mark>, así que no hace
      // falta mapear la posición del DOM al índice global del portal.
      if (el.scrollWidth > el.clientWidth + 1) el.title = el.textContent ?? '';
    }
  }

  /* ─────────── 3. El contador del centro ─────────── */
  /**
   * El centro cuenta del valor anterior al nuevo. Con ms = 0, con menos movimiento o sin
   * cambio escribe directo. Un temporizador escribe siempre el valor final, aunque el
   * navegador no pinte cuadros porque la pestaña está oculta.
   */
  private contarHasta(hasta: number, ms: number): void {
    const desde = this.objetivo;
    if (desde === hasta && this.mostrado === hasta) return;
    this.cancelarCuadro();
    clearTimeout(this.cierre);
    this.objetivo = hasta;
    if (!ms || this.store.menosMovimiento() || desde === hasta) {
      this.escribirNumero(hasta);
      return;
    }
    const ventana = this.documento.defaultView;
    if (!ventana) {
      this.escribirNumero(hasta);
      return;
    }
    const inicio = performance.now();
    const paso = (ahora: number): void => {
      const t = Math.max(0, Math.min(1, (ahora - inicio) / ms));
      const k = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      this.escribirNumero(Math.round(desde + (hasta - desde) * k));
      if (t < 1) this.cuadro = ventana.requestAnimationFrame(paso);
    };
    this.cuadro = ventana.requestAnimationFrame(paso);
    this.cierre = setTimeout(() => {
      this.cancelarCuadro();
      this.escribirNumero(hasta);
    }, ms + 60);
  }

  private escribirNumero(n: number): void {
    this.mostrado = n;
    this.numeroMostrado.set(n);
  }

  private cancelarCuadro(): void {
    if (this.cuadro) this.documento.defaultView?.cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
  }

  /* ─────────── 4. Visibilidad ─────────── */
  /**
   * Solo mueve las dos señales de visibilidad. Lo que no se porta es la llamada a actualizar
   * del prototipo, que repintaba todo y reescribía la URL en cada cruce.
   */
  private observarVisibilidad(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || !('IntersectionObserver' in ventana)) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          this.mapaVisible.set(en.isIntersecting);
          const alVeinte = en.intersectionRatio >= 0.2;
          // Al bajar hasta el mapa con una búsqueda activa, los resultados se encienden al
          // llegar, no antes, que es cuando se pueden ver.
          if (alVeinte && !this.mapaAlVeinte()) this.pulsoHaces.update((n) => n + 1);
          this.mapaAlVeinte.set(alVeinte);
        }
      },
      { threshold: [0, 0.2] },
    );
    observador.observe(this.anfitrion);
    this.destruir.onDestroy(() => observador.disconnect());
  }

  private observarAncho(): void {
    const el = this.lienzo()?.nativeElement;
    if (!el || typeof ResizeObserver !== 'function') return;
    const observador = new ResizeObserver(() => this.ajustarNombres());
    observador.observe(el);
    this.destruir.onDestroy(() => observador.disconnect());
  }

  private girarOrbitas(): void {
    if (!this.mapaEnPantalla()) return;
    const ahora = performance.now();
    if (ahora - this.ultimoGiro < 500) return;
    this.ultimoGiro = ahora;
    this.giro.update((g) => g + 8);
  }

  /* ─────────── 5. La red de seguridad ─────────── */
  /** Compara la geometría calculada con lo que pinta el navegador. Solo para validar. */
  private validarGeometria(): void {
    if (this.store.vistaEfectiva() !== 'mapa' || this.anfitrion.hidden) return;
    const lienzo = this.lienzo()?.nativeElement;
    if (!lienzo) return;
    const porI = new Map<number, HTMLElement>();
    for (const ref of this.filaItems()) {
      const el = ref.nativeElement as HTMLElement;
      porI.set(Number(el.dataset['i']), el);
    }
    const zoom = parseFloat(this.documento.body.style.getPropertyValue('zoom')) || 1;
    const top = lienzo.getBoundingClientRect().top;
    let max = 0;
    for (const p of this.geo().puntos) {
      const el = porI.get(p.i);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      max = Math.max(max, Math.abs((r.top + r.height / 2 - top) / zoom - p.filaY));
    }
    if (max > 1.5) {
      console.warn(`Mapa: las filas se corren ${max.toFixed(1)} px de la geometría calculada.`);
    }
  }
}
