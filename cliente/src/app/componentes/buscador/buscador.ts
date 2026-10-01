import { DOCUMENT, Component, ElementRef, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { normalizar } from '../../nucleo/texto';
import { DirectorioStore } from '../../servicios/directorio.store';

/**
 * Atajo del buscador CON MODIFICADOR (Ctrl K, o ⌘ K en Mac). Un atajo de una sola tecla,
 * como «/», se dispara sin querer con control por voz: incumple WCAG 2.1.4. No cambiarlo.
 */
const esAtajoBuscar = (ev: KeyboardEvent): boolean =>
  (ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'k';

/**
 * El buscador: campo con su atajo, y las búsquedas rápidas. Vive al principio de
 * `section[app-explorador]`, que es quien muestra lo que se busca: el hero de arriba
 * es solo el título.
 */
@Component({
  selector: 'div[app-buscador]',
  templateUrl: './buscador.html',
  host: {
    '(document:keydown)': 'alTeclearPagina($event)',
  },
})
export class Buscador {
  protected readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly botones = viewChildren<ElementRef<HTMLButtonElement>>('ficha');

  /* Texto de interfaz, no contenido de portales: no rompe la regla de una sola fuente de
     verdad. Cada término se muestra solo si hoy devuelve algo. */
  private readonly RAPIDAS: readonly string[] = [
    'museo',
    'becas',
    'primera infancia',
    'cine',
    'archivos',
    'lenguas',
    'música',
    'espectáculos',
  ];

  protected readonly fichas = computed(() => this.RAPIDAS.filter((t) => this.store.cuentaPara(t) > 0));

  /** Única parada de Tab de la fila de fichas: el resto se recorre con las flechas. */
  protected readonly focoFicha = signal(0);

  protected readonly tecla = computed(() => {
    const nav = this.documento.defaultView?.navigator;
    return nav && /Mac|iPhone|iPad/.test(nav.platform || nav.userAgent) ? '⌘ K' : 'Ctrl K';
  });

  /** El placeholder sale del total del API: nunca un número escrito a mano. */
  protected textoBuscador(): string {
    const total = this.store.portales().length;
    return total ? `Buscar entre ${total} portales públicos...` : 'Buscar portales públicos...';
  }

  /** Estado de la ficha: se lee de la fase de marcado, que es la que ya está pintada. */
  protected pulsada(t: string): boolean {
    const nq = normalizar(this.store.consultaMarca().trim());
    return !!nq && normalizar(t) === nq;
  }

  /* ─────────── Manejadores ─────────── */

  protected alEscribir(valor: string): void {
    this.store.escribir(valor);
  }

  protected alTeclearCampo(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.store.reacomodarYa();
      this.enfocarPrimero();
    } else if (ev.key === 'Escape' && this.store.consulta()) {
      // stopPropagation: el Escape del campo limpia la búsqueda y no cierra además el tema.
      ev.preventDefault();
      ev.stopPropagation();
      this.store.limpiarBusqueda();
    }
  }

  /** Pulsar la ficha ya activa la desactiva: es un interruptor, no un enlace. */
  protected alPulsarFicha(t: string, i: number): void {
    this.moverFocoFicha(i, false);
    this.store.buscarTermino(this.pulsada(t) ? '' : t);
  }

  protected alTeclearFichas(ev: KeyboardEvent): void {
    const total = this.fichas().length;
    const actual = this.botones().findIndex((b) => b.nativeElement === ev.target);
    if (!total || actual < 0) return;
    const destino =
      ev.key === 'ArrowRight'
        ? (actual + 1) % total
        : ev.key === 'ArrowLeft'
          ? (actual - 1 + total) % total
          : ev.key === 'Home'
            ? 0
            : ev.key === 'End'
              ? total - 1
              : -1;
    if (destino < 0) return;
    ev.preventDefault();
    this.moverFocoFicha(destino);
  }

  protected alTeclearPagina(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || !esAtajoBuscar(ev)) return;
    ev.preventDefault();
    this.enfocarBuscador();
  }

  /* ─────────── Foco ─────────── */

  private moverFocoFicha(i: number, enfocar = true): void {
    this.focoFicha.set(i);
    if (!enfocar) return;
    const el = this.botones()[i]?.nativeElement;
    if (!el) return;
    el.focus();
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: this.store.menosMovimiento() ? 'auto' : 'smooth',
    });
  }

  private enfocarBuscador(): void {
    const el = this.campo().nativeElement;
    el.scrollIntoView({ behavior: this.store.menosMovimiento() ? 'auto' : 'smooth', block: 'center' });
    // preventScroll: el desplazamiento suave ya está en marcha y el foco no debe cortarlo.
    el.focus({ preventScroll: true });
  }

  /**
   * Enter en el campo lleva el foco al primer resultado, que vive en el explorador.
   * Es la única consulta al documento fuera del componente propio, y va limitada a los
   * dos ids del contrato.
   */
  private enfocarPrimero(): void {
    const doc = this.documento;
    const primero =
      this.store.vistaEfectiva() === 'lista'
        ? doc.querySelector<HTMLElement>('#lista .fila')
        : Array.from(doc.querySelectorAll<HTMLElement>('#mosaico .casilla:not([hidden]) .portal')).find(
            (a) => a.offsetParent,
          );
    primero?.focus();
  }
}
