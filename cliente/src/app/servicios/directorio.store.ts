import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { Directorio, Portal } from '../modelos/directorio';
import {
  DIRECTORIO_VACIO,
  EstadoDirectorio,
  PortalEnriquecido,
  TemaEnriquecido,
} from '../modelos/estado';
import {
  calcularEstado,
  clavesDe,
  conteosDe,
  cuenta,
  resolverEstado,
  sugerencias,
  temasEnOrden,
  textoConteo,
} from '../nucleo/estado';
import { Conteo, Disposicion, calcularMosaico } from '../nucleo/mosaico';
import { Vista, escribirPedido, leerPedido, recordarVista } from '../nucleo/pedido';
import { Anuncio } from './anuncio';
import { Medios } from './medios';
import { Movimiento } from './movimiento';
import { Numeros } from './numeros';

/**
 * Comparador de los conteos que alimentan el mosaico. Sin él, calcularMosaico se
 * recalcularía cada vez que cambia cualquier cosa del estado, incluido pasar el cursor
 * por el mapa, y la partición flexible es exponencial.
 */
const IGUALES = (a: readonly Conteo[], b: readonly Conteo[]): boolean =>
  a.length === b.length && a.every((c, i) => c.id === b[i].id && c.n === b[i].n);

/**
 * Único cliente del API y única fuente de estado de la landing.
 *
 * LAS DOS FASES DE LA BÚSQUEDA son la pieza de arquitectura de este archivo:
 *   qMarca, a los 120 ms, alimenta lo que apaga, resalta y cuenta SIN mover nada de sitio.
 *   qFirme, a los 400 ms, alimenta el reacomodo del mosaico, la lista, el índice, el
 *   bloque vacío, la vista y la URL.
 * Colapsarlas en una sola señal reacomoda el mosaico en cada tecla y se pierde el sentido
 * de la fase de marcado.
 */
@Injectable({ providedIn: 'root' })
export class DirectorioStore {
  private readonly http = inject(HttpClient);
  private readonly destruir = inject(DestroyRef);
  private readonly medios = inject(Medios);
  private readonly anuncio = inject(Anuncio);
  private readonly movimiento = inject(Movimiento);
  private readonly numeros = inject(Numeros);

  /* ─────────── Señales de escritura: las únicas. Todo lo demás se deriva. ─────────── */
  readonly datos = signal<Directorio | null>(null);
  readonly error = signal<string | null>(null);
  /** Texto crudo del campo, sin trim: el trim solo se aplica al escribir la URL. */
  readonly consulta = signal('');
  /** Id del tema abierto. Vacío significa TODOS, no «ninguno válido». */
  readonly tema = signal('');
  readonly vista = signal<Vista>('mosaico');
  /** Tema cuyo botón abrió la vista, para devolverle el foco al cerrar. */
  readonly abiertoDesde = signal('');
  private readonly qMarca = signal('');
  private readonly qFirme = signal('');

  private tiempoMarca: ReturnType<typeof setTimeout> | undefined;
  private tiempoFirme: ReturnType<typeof setTimeout> | undefined;

  /* ─────────── Datos crudos ─────────── */
  /** Los datos llegan por HTTP: mientras no están, el directorio vacío evita ramas de null. */
  private readonly fuente = computed<Directorio>(() => this.datos() ?? DIRECTORIO_VACIO);
  readonly categorias = computed(() => this.fuente().categories);
  readonly portales = computed(() => this.fuente().portals);
  readonly cargando = computed(() => !this.datos() && !this.error());

  readonly claves = computed<ReadonlyMap<string, string>>(() => clavesDe(this.portales()));
  readonly indices = computed<ReadonlyMap<string, number>>(
    () => new Map(this.portales().map((p, i) => [p.name + '|' + p.url, i])),
  );

  /* ─────────── Fase de marcado (120 ms). Nada se mueve de lugar. ─────────── */
  // Directo, sin resolverEstado: el tema abierto NO se cierra mientras se escribe.
  readonly estado = computed<EstadoDirectorio>(() =>
    calcularEstado(this.fuente(), { q: this.qMarca(), tema: this.tema() }),
  );
  readonly consultaMarca = computed(() => this.estado().consulta);
  readonly hayConsultaMarca = computed(() => this.estado().hayConsulta);

  /** Claves de los portales que pasan la búsqueda: quién queda encendido. */
  readonly coincideMarca = computed<ReadonlySet<string>>(() => {
    const claves = this.claves();
    const dentro = new Set<string>();
    for (const p of this.estado().resultados) {
      const k = claves.get(p.name + '|' + p.url);
      if (k) dentro.add(k);
    }
    return dentro;
  });

  readonly cuentaDe = computed<ReadonlyMap<string, number>>(() => {
    const e = this.estado();
    return new Map(e.temas.map((t) => [t.id, cuenta(e, t)]));
  });
  /** Escala el tamaño del número de cada tema con la variable --peso. */
  readonly maximoCuenta = computed(() => Math.max(1, ...this.cuentaDe().values()));

  readonly total = computed(() => this.estado().total);
  /** Los favoritos no se filtran por la búsqueda, a propósito: el bento es fijo. */
  readonly favoritos = computed<PortalEnriquecido[]>(() => this.estado().favoritos);
  readonly textoConteo = computed(() => textoConteo(this.estado()));
  readonly sugerencias = computed(() => sugerencias(this.fuente()));

  /* ─────────── Fase completa (400 ms). Reacomodo. ─────────── */
  private readonly resuelto = computed<{ e: EstadoDirectorio; aviso: string }>(() =>
    resolverEstado(this.fuente(), { q: this.qFirme(), tema: this.tema() }),
  );
  readonly estadoFirme = computed(() => this.resuelto().e);
  readonly temaActivo = computed(() => this.estadoFirme().temaActivo);
  readonly resultados = computed<PortalEnriquecido[]>(() => this.estadoFirme().resultados);
  readonly hayResultados = computed(() => this.resultados().length > 0);

  readonly conteos = computed<Conteo[]>(() => conteosDe(this.estadoFirme()), { equal: IGUALES });
  readonly disposicion = computed<Disposicion>(() =>
    calcularMosaico(this.conteos(), { abierto: this.temaActivo(), apilar: !this.anchoAmplio() }),
  );
  readonly temasLista = computed<TemaEnriquecido[]>(() => {
    const e = this.estadoFirme();
    return temasEnOrden(e).filter((t) => cuenta(e, t) > 0);
  });

  /* ─────────── Medios ─────────── */
  readonly anchoAmplio = this.medios.consultar('(min-width: 1100px)');
  readonly conPuntero = this.medios.consultar('(hover: hover)');
  readonly menosMovimiento = this.medios.consultar('(prefers-reduced-motion: reduce)');

  /**
   * LA PESTAÑA MAPA NOMBRA DOS FIGURAS y el umbral es el puntero, no el ancho de pantalla.
   *
   * Sin puntero se pintan las barras contadas, que son filas de ancho completo y caben
   * desde 320 px. Con puntero se pinta la rosa, que necesita los 1100 px de sus dos
   * columnas y su centro de 440 px. El ancho solo decide entre rosa y lista.
   *
   * Por eso el umbral no puede ser el ancho: una tableta táctil de 1024 px da un
   * contenedor de 976 px y con un umbral de ancho perdía la pestaña aunque las barras
   * caben de sobra. Consecuencia deliberada: un portátil táctil con ratón ve la rosa,
   * porque manda hover:hover, y una tableta con teclado y ratón acoplados también.
   */
  readonly mapaEnBarras = computed(() => !this.conPuntero());
  readonly mapaEnRosa = computed(() => this.conPuntero() && this.anchoAmplio());
  /** La pestaña solo se repliega en la lista cuando ninguna de las dos figuras cabe. */
  readonly vistaEfectiva: Signal<Vista> = computed(() =>
    this.vista() === 'mapa' && !this.mapaEnBarras() && !this.mapaEnRosa() ? 'lista' : this.vista(),
  );

  constructor() {
    // La URL no depende del API: se lee una sola vez y antes de pedir los datos.
    const pedido = leerPedido();
    this.consulta.set(pedido.q);
    this.qMarca.set(pedido.q);
    this.qFirme.set(pedido.q);
    this.tema.set(pedido.tema);
    this.vista.set(pedido.vista);

    this.destruir.onDestroy(() => {
      clearTimeout(this.tiempoMarca);
      clearTimeout(this.tiempoFirme);
    });

    // 1. La URL cuelga de qFirme, nunca de consulta, o se reescribe en cada tecla.
    // Y no se toca hasta que llegan los datos: sin ellos ningún tema es válido todavía y
    // el ?tema= de la URL se borraría solo mientras el API responde.
    effect(() => {
      const hayDatos = !!this.datos();
      const pedidoActual = { q: this.qFirme(), tema: this.temaActivo(), vista: this.vista() };
      if (hayDatos) escribirPedido(pedidoActual);
    });

    // 2. Cierre automático del tema que se queda sin resultados. Es un efecto y no un
    // derivado a propósito: el cierre es PERMANENTE y borrar la búsqueda no lo reabre.
    // Con temaActivo como puro derivado, el tema se reabriría solo.
    effect(() => {
      const aviso = this.resuelto().aviso;
      if (this.tema() && aviso) {
        this.tema.set('');
        this.anuncio.decir(aviso);
      }
    });

    // 3. Cada cambio de disposición mueve números de sitio: hay que revisarlos en el
    // cuadro siguiente, cuando ya están pintados.
    effect(() => {
      this.disposicion();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this.numeros.revisar());
      } else {
        this.numeros.revisar();
      }
    });

    this.cargar();
  }

  /* ─────────── Consultas por portal ─────────── */
  /** Clave estable del portal: track de los @for y base de los ids del documento. */
  claveDe(p: Portal): string {
    return this.claves().get(p.name + '|' + p.url) ?? '';
  }

  /** Posición del portal en los datos: con ella se casan fila, línea, punto y haz del mapa. */
  indiceDe(p: Portal): number {
    return this.indices().get(p.name + '|' + p.url) ?? -1;
  }

  /** Cuántos portales muestra un tema en la fase de marcado. */
  cuentaMarca(id: string): number {
    return this.cuentaDe().get(id) ?? 0;
  }

  cuentaFirme(t: TemaEnriquecido): number {
    return cuenta(this.estadoFirme(), t);
  }

  /** Cuántos resultados daría un término: lo usan las fichas de sugerencia. */
  cuentaPara(termino: string): number {
    return calcularEstado(this.fuente(), { q: termino }).resultados.length;
  }

  /* ─────────── Acciones ─────────── */
  cargar(): void {
    this.http.get<Directorio>('/api/sistemas').subscribe({
      next: (d) => this.datos.set(d),
      error: () => this.error.set('No fue posible cargar los portales.'),
    });
  }

  /** El único sitio con temporizadores: 120 ms para marcar, 400 ms para reacomodar. */
  escribir(texto: string): void {
    this.consulta.set(texto);
    clearTimeout(this.tiempoMarca);
    clearTimeout(this.tiempoFirme);
    this.tiempoMarca = setTimeout(() => this.qMarca.set(texto), 120);
    this.tiempoFirme = setTimeout(() => this.reacomodar(texto), 400);
  }

  /** Fija las tres señales de una y reacomoda ya, sin esperar los 400 ms. */
  buscarTermino(termino: string): void {
    this.consulta.set(termino);
    this.reacomodar(termino);
  }

  limpiarBusqueda(): void {
    this.buscarTermino('');
  }

  /** Enter en el campo: cancela los temporizadores y pasa a la fase completa. */
  reacomodarYa(): void {
    this.reacomodar(this.consulta());
  }

  abrirTema(id: string): void {
    this.tema.set(id);
    this.abiertoDesde.set(id);
  }

  cerrarTema(): void {
    this.tema.set('');
    this.abiertoDesde.set('');
  }

  alternarTema(id: string): void {
    if (this.tema() === id) this.cerrarTema();
    else this.abrirTema(id);
  }

  cambiarVista(v: Vista): void {
    this.vista.set(v);
    recordarVista(v);
  }

  decir(texto: string): void {
    this.anuncio.decir(texto);
  }

  /**
   * Pasa las dos fases al mismo texto dentro del FLIP y anuncia lo que quedó en pantalla.
   * El aviso se calcula ANTES del cambio: el efecto del cierre automático ya habrá puesto
   * el tema en vacío cuando el FLIP devuelva, y entonces el aviso ya no existiría.
   */
  private reacomodar(texto: string): void {
    clearTimeout(this.tiempoMarca);
    clearTimeout(this.tiempoFirme);
    const aviso = resolverEstado(this.fuente(), { q: texto, tema: this.tema() }).aviso;
    this.movimiento.conFlip(() => {
      this.qMarca.set(texto);
      this.qFirme.set(texto);
    });
    const e = this.estadoFirme();
    this.anuncio.decir(
      aviso || (e.hayConsulta ? textoConteo(e) : `Se muestran los ${e.total} portales.`),
    );
  }
}
