import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PortalEnriquecido, TemaEnriquecido } from '../../modelos/estado';
import { estiloTema } from '../../nucleo/geometria-rosa';
import { plural } from '../../nucleo/texto';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Resaltado } from '../resaltado/resaltado';

/** Un portal de una barra con su índice global: con él se casan cuadro, fila y descripción. */
interface FilaBarra {
  p: PortalEnriquecido;
  /** Índice global en los datos. Es el sufijo de m-desc-{i} que ya existe en mapa.html. */
  i: number;
  /** Posición dentro de su barra, con tope de 8: alimenta el barrido de --n. */
  retraso: number;
}

/** Un tema tal como lo pinta una barra, con su tono y sus portales ya indexados. */
interface BarraVista {
  t: TemaEnriquecido;
  solido: boolean;
  color: string;
  filas: FilaBarra[];
}

/**
 * Vista mapa sin puntero: Barras contadas. Una barra por tema, en el orden del directorio,
 * con un cuadro dibujado por portal. La repartición se lee contando cuadros y se confirma
 * con el número impreso a la derecha, así que no depende de estimar un área.
 *
 * POR QUÉ EXISTE ESTE COMPONENTE Y NO UNA RAMA DE mapa.html: la rosa se conserva intacta
 * para escritorio. geometria-rosa.ts y mapa.ts no se tocan; de la rosa solo se importa
 * estiloTema, que es lo que hace que los temas se distingan por patrón y por número.
 *
 * INVARIANTES:
 *   - El orden de las barras es el orden de los temas del API y NO depende de la búsqueda:
 *     buscar apaga y enciende cuadros, y nunca reacomoda la figura.
 *   - El tema abierto ES store.temaActivo(), el mismo ?tema= del mosaico. No hay estado
 *     propio: abrir aquí abre allá, y eso es deliberado.
 *   - Un solo gesto en toda la figura, tocar, y un solo significado por toque. La acción de
 *     la fila la dispara el click del enlace, nunca un pointerdown, así que arrastrar el
 *     dedo fuera antes de soltar la cancela.
 *   - Los cuadros son marcas, no mandos: aria-hidden y sin manejadores. El piso de 44 px
 *     haría que una barra de nueve portales midiera 480 px, que no cabe en un teléfono.
 *   - Lo apagado se apaga cambiando el relleno, nunca bajando la opacidad del texto.
 *
 * Las descripciones accesibles NO se duplican: los aria-describedby apuntan a t-desc-{id} y
 * m-desc-{i} del bloque #mapa-descripciones de mapa.html, que vive siempre en el DOM porque
 * las vistas se ocultan con [hidden] y nunca con @if. Duplicarlas daría ids repetidos.
 */
@Component({
  selector: 'div[app-mapa-barras]',
  templateUrl: './mapa-barras.html',
  imports: [Resaltado],
  host: {
    '(keydown)': 'alTeclearBarras($event)',
  },
})
export class MapaBarras {
  protected readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);
  private readonly destruir = inject(DestroyRef);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Lo pide afterNextRender cuando se llama fuera del constructor. */
  private readonly inyector = inject(Injector);

  protected readonly plural = plural;

  /* ─────────── La figura: cinco barras en el orden del API ─────────── */
  /**
   * Los temas de la fase de marcado, que trae los conteos y el coincide de cada portal sin
   * mover nada de sitio. No se filtran los temas sin portales, igual que en la rosa: un tema
   * vacío saldría como una barra de cero cuadros y eso es dato, no defecto.
   */
  protected readonly barras = computed<BarraVista[]>(() =>
    this.store.estado().temas.map((t, j) => {
      const e = estiloTema(j);
      return {
        t,
        solido: e.clase === 'solido',
        color: e.color,
        filas: t.portales.map((p, n) => ({
          p,
          i: this.store.indiceDe(p),
          retraso: Math.min(n, 8),
        })),
      };
    }),
  );

  /* ─────────── Banda de cabecera: el conteo que ya sabía decir el centro ─────────── */
  private readonly cuentaBanda = computed(() => {
    const e = this.store.estado();
    return e.hayConsulta ? e.resultados.length : e.total;
  });

  protected readonly lineaBanda = computed(() => {
    const e = this.store.estado();
    const n = this.cuentaBanda();
    if (!e.hayConsulta) return `${n === 1 ? 'portal' : 'portales'} en ${e.temas.length} temas`;
    return n ? (n === 1 ? 'portal coincide' : 'portales coinciden') : 'Sin coincidencias';
  });

  protected readonly subBanda = computed(() => {
    const e = this.store.estado();
    const n = this.cuentaBanda();
    if (!e.hayConsulta) return '';
    return n ? `de ${e.total}` : 'Prueba con otra palabra';
  });

  /* ─────────── El número que cuenta ─────────── */
  protected readonly numeroMostrado = signal(0);
  /** Espejo sin señal: contarHasta no puede leer la señal que escribe. */
  private mostrado = 0;
  /** Valor al que se está contando. */
  private objetivo = 0;
  private primeraVez = true;
  private cuadro = 0;
  private cierre: ReturnType<typeof setTimeout> | undefined;
  private readonly enPantalla = signal(false);

  constructor() {
    this.destruir.onDestroy(() => {
      clearTimeout(this.cierre);
      this.cancelarCuadro();
    });

    // Fuera de pantalla escribe directo; la primera vez que la figura aparece cuenta desde 0
    // en 900 ms y después en 300. La bandera de primera vez no se gasta mientras el API
    // responde: con la figura todavía vacía la primera cuenta se perdería.
    effect(() => {
      const n = this.cuentaBanda();
      const primera = this.primeraVez && !!this.store.datos();
      if (!this.enPantalla()) {
        this.contarHasta(n, 0);
      } else if (primera) {
        this.primeraVez = false;
        this.escribirNumero(0);
        this.objetivo = 0;
        this.contarHasta(n, 900);
      } else {
        this.contarHasta(n, 300);
      }
    });

    afterNextRender(() => this.observarVisibilidad());
  }

  /* ─────────── Consultas de la plantilla ─────────── */
  protected abierta(id: string): boolean {
    return this.store.temaActivo() === id;
  }

  protected coincide(p: PortalEnriquecido): boolean {
    return this.store.hayConsultaMarca() && p.coincide;
  }

  protected apagado(p: PortalEnriquecido): boolean {
    return this.store.hayConsultaMarca() && !p.coincide;
  }

  /* ─────────── Abrir y cerrar ─────────── */
  /**
   * La barra es el único mando de la figura. Llama a store.alternarTema, que es lo mismo que
   * hace la cabecera de la rosa, así que el tema abierto viaja por ?tema= y no se inventa
   * estado nuevo. El botón lleva aria-expanded y nunca aria-pressed: dos estados que dicen
   * lo mismo en el mismo botón se contradicen.
   */
  protected alternarBarra(b: BarraVista): void {
    const abre = !this.abierta(b.t.id);
    this.store.alternarTema(b.t.id);
    this.store.abiertoDesde.set('');
    if (abre) {
      this.store.decir(
        `${b.t.name}, ${plural(this.store.cuentaMarca(b.t.id), 'portal', 'portales')}`,
      );
      this.enfocar(b.t.id, '.barra-desc');
    } else {
      this.store.decir('Tema cerrado');
    }
  }

  /**
   * La segunda salida, al pie de la barra abierta. Con nueve portales el recorrido ya pide
   * volver arriba, así que cierra el tema y devuelve el foco a la cabecera de esa barra.
   */
  protected cerrarBarra(b: BarraVista): void {
    this.store.cerrarTema();
    this.store.decir('Tema cerrado');
    this.enfocar(b.t.id, '.barra-cabecera');
  }

  /**
   * Las flechas recorren cabeceras y filas, salteando lo que está apagado con inert. Es el
   * mismo recorrido que alTeclearMapa hace en la rosa, con las clases de esta figura.
   */
  protected alTeclearBarras(ev: Event): void {
    const tecla = ev as KeyboardEvent;
    if (tecla.key !== 'ArrowDown' && tecla.key !== 'ArrowUp') return;
    const items = Array.from(
      this.anfitrion.querySelectorAll<HTMLElement>('.barra-cabecera, .barra-fila'),
    ).filter((el) => !el.closest('[inert]') && !!el.offsetParent);
    const n = items.indexOf(this.documento.activeElement as HTMLElement);
    if (n < 0) return;
    ev.preventDefault();
    const paso = tecla.key === 'ArrowDown' ? 1 : -1;
    const destino = Math.max(0, Math.min(items.length - 1, n + paso));
    items[destino].focus();
  }

  /**
   * Mueve el foco dentro de la barra del tema, después del repintado.
   *
   * Va en afterNextRender y NO en un requestAnimationFrame: el cuadro de animación llega
   * antes de que Angular haya soltado el [hidden] del cuerpo, así que el nodo todavía no
   * tiene caja, offsetParent es nulo y el foco se queda donde estaba. Medido: con rAF el
   * foco no se movía de la cabecera.
   *
   * preventScroll porque la barra crece en su sitio: ni al abrir ni al cerrar se mueve el
   * desplazamiento, que es lo que hace que las otras cuatro barras no se pierdan de vista.
   */
  private enfocar(tema: string, selector: string): void {
    afterNextRender(
      () => {
        const el = Array.from(this.anfitrion.querySelectorAll<HTMLElement>(selector)).find(
          (x) => x.dataset['tema'] === tema,
        );
        if (el?.offsetParent) el.focus({ preventScroll: true });
      },
      { injector: this.inyector },
    );
  }

  /* ─────────── El contador de la banda ─────────── */
  /**
   * La banda cuenta del valor anterior al nuevo. Con ms = 0, con menos movimiento o sin
   * cambio escribe directo. Un temporizador escribe siempre el valor final, aunque el
   * navegador no pinte cuadros porque la pestaña está oculta.
   */
  private contarHasta(hasta: number, ms: number): void {
    const desde = this.objetivo;
    if (desde === hasta && this.mostrado === hasta) return;
    this.cancelarCuadro();
    clearTimeout(this.cierre);
    this.objetivo = hasta;
    const ventana = this.documento.defaultView;
    if (!ms || this.store.menosMovimiento() || desde === hasta || !ventana) {
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

  /**
   * Solo mueve la señal de visibilidad, que es lo único que necesita el contador. Con la
   * figura oculta por [hidden] el rectángulo es cero y la señal se queda en falso, así que
   * la primera cuenta se guarda para cuando la pestaña Mapa se elige de verdad.
   */
  private observarVisibilidad(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || !('IntersectionObserver' in ventana)) {
      this.enPantalla.set(true);
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) this.enPantalla.set(en.isIntersecting);
      },
      { threshold: 0 },
    );
    observador.observe(this.anfitrion);
    this.destruir.onDestroy(() => observador.disconnect());
  }
}
