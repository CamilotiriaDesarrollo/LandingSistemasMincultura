import {
  Component,
  DOCUMENT,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { VISTAS, Vista } from '../../nucleo/pedido';
import { Anuncio } from '../../servicios/anuncio';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Numeros } from '../../servicios/numeros';
import { Buscador } from '../buscador/buscador';
import { Indice } from '../indice/indice';
import { Lista } from '../lista/lista';
import { Mapa } from '../mapa/mapa';
import { MapaBarras } from '../mapa-barras/mapa-barras';
import { Mosaico } from '../mosaico/mosaico';
import { Vacio } from '../vacio/vacio';

/** Lo poco que hace falta de FontFaceSet, sin depender de la versión de lib.dom. */
interface DocumentoConFuentes {
  fonts?: { ready?: Promise<unknown> };
}

/**
 * Sección Explorar: la cabecera con el conmutador de tres vistas, el conteo y los cinco
 * bloques del directorio.
 *
 * Las tres vistas viven SIEMPRE en el DOM y se ocultan con [hidden], nunca con @if: el
 * IntersectionObserver del mapa observa #mapa, y si el bloque se desmonta se pierden el
 * contador del centro que arranca en cero y los haces que se encienden al veinte por
 * ciento de visibilidad.
 *
 * La pestaña Mapa son dos bloques y una sola pestaña: la rosa cuando hay puntero, las
 * barras contadas cuando no lo hay. Quién decide es el store, no este componente.
 */
@Component({
  selector: 'section[app-explorador]',
  templateUrl: './explorador.html',
  imports: [Buscador, Indice, Mosaico, Mapa, MapaBarras, Lista, Vacio],
  host: {
    '(click)': 'alPulsar($event)',
    '(document:keydown)': 'alTeclearPagina($event)',
  },
})
export class Explorador {
  protected readonly store = inject(DirectorioStore);
  private readonly anuncio = inject(Anuncio);
  private readonly numeros = inject(Numeros);
  private readonly documento = inject(DOCUMENT);

  protected readonly VISTAS = VISTAS;
  protected readonly cargando = this.store.cargando;

  /* Cada pestaña nombra lo que muestra. El mosaico y la lista enseñan lo mismo de dos
     formas, así que comparten encabezado a propósito. */
  private readonly CABEZA: Record<Vista, readonly [string, string]> = {
    mosaico: ['Cada casilla es un portal', 'Los temas con más portales ocupan más espacio.'],
    lista: ['Cada casilla es un portal', 'Los temas con más portales ocupan más espacio.'],
    mapa: [
      'Explora por tema',
      'Pasa el cursor o usa Tab para ver cada portal. Haz clic para abrirlo en una pestaña nueva.',
    ],
  };

  /**
   * La vista mapa tiene dos figuras, así que tiene dos ayudas: la de la rosa nombra el
   * cursor y el clic, que es lo que hay con ratón, y la de las barras no puede nombrarlos
   * porque ahí no hay ratón. El título es el mismo en las dos.
   */
  private readonly AYUDA_BARRAS =
    'Toca un tema para ver sus portales. Cada portal abre en una pestaña nueva.';

  protected readonly cabeza = computed<readonly [string, string]>(() => {
    const vista = this.store.vistaEfectiva();
    const par = this.CABEZA[vista];
    if (vista === 'mapa' && this.store.mapaEnBarras()) return [par[0], this.AYUDA_BARRAS];
    return par;
  });

  protected readonly ETIQUETAS: Record<Vista, string> = {
    mosaico: 'Mosaico',
    mapa: 'Mapa',
    lista: 'Lista',
  };

  /** El índice solo sirve al mosaico repartido: con un tema abierto no hay a dónde ir. */
  protected readonly verIndice = computed(
    () =>
      this.store.hayResultados() &&
      this.store.vistaEfectiva() === 'mosaico' &&
      this.store.disposicion().modo !== 'abierto',
  );

  /**
   * Una pestaña, dos bloques, y nunca los dos a la vez. La plantilla ata el [hidden] de
   * #mapa a verMapaRosa y el de #mapa-barras a verMapaBarras: con vistaEfectiva sola los
   * dos quedarían visibles.
   */
  protected readonly verMapaRosa = computed(
    () =>
      this.store.hayResultados() &&
      this.store.vistaEfectiva() === 'mapa' &&
      this.store.mapaEnRosa(),
  );
  protected readonly verMapaBarras = computed(
    () =>
      this.store.hayResultados() &&
      this.store.vistaEfectiva() === 'mapa' &&
      this.store.mapaEnBarras(),
  );

  private readonly region = viewChild.required<ElementRef<HTMLElement>>('anuncio');
  private readonly titulo = viewChild.required<ElementRef<HTMLElement>>('titulo');

  constructor() {
    afterNextRender(() => {
      this.anuncio.registrar(this.region().nativeElement);
      // El tamaño del número de cada tema depende de la letra cargada: hasta que las
      // fuentes no están, un número que ya se ve puede quedarse en cero.
      const doc = this.documento as unknown as DocumentoConFuentes;
      doc.fonts?.ready?.then(() => this.numeros.revisar());
    });
  }

  /**
   * Un solo manejador para lo que no tiene componente propio.
   *
   * El clic de `.volver` NO se atiende aquí: el botón vive dentro de section[app-tema] y
   * ya emite su salida, que cierra el tema dentro de la transición de vista y devuelve el
   * foco. Atenderlo también aquí cerraría el tema ANTES de que corriera el cierre de la
   * transición, y el alternar volvería a abrirlo.
   */
  protected alPulsar(ev: Event): void {
    const destino = ev.target as HTMLElement | null;
    if (!destino?.closest) return;

    const sugerencia = destino.closest<HTMLElement>('#vacio .ficha');
    if (sugerencia) {
      this.store.buscarTermino(sugerencia.dataset['termino'] ?? '');
      return;
    }
    if (destino.closest('[data-accion="todos"]')) {
      this.store.limpiarBusqueda();
      this.titulo().nativeElement.focus({ preventScroll: true });
    }
  }

  /**
   * Escape cierra el tema abierto. Ctrl K lo atiende `Buscador`, que es de quien es el campo.
   * El parámetro va como Event porque el escuchador es global y el tipo que Angular le da
   * a un objetivo con prefijo no siempre es KeyboardEvent.
   */
  protected alTeclearPagina(ev: Event): void {
    if (ev.defaultPrevented) return;
    const tecla = ev as KeyboardEvent;
    if (tecla.key === 'Escape' && this.store.tema()) {
      ev.preventDefault();
      this.store.cerrarTema();
    }
  }
}
