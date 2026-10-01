import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { TemaEnriquecido } from '../../modelos/estado';
import { Disposicion } from '../../nucleo/mosaico';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Movimiento } from '../../servicios/movimiento';
import { TemaVisible } from '../../directivas/tema-visible';
import { Tema } from '../tema/tema';

const DIRECCIONES: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

interface Centro {
  x: number;
  y: number;
}

/** Un tema con el bloque que le toca, o sin él si esta búsqueda lo deja fuera. */
interface Par {
  b: Disposicion['bloques'][number] | null;
  t: TemaEnriquecido;
}

/**
 * El mosaico: la grilla de temas y las acciones de abrir, cerrar y moverse entre casillas.
 *
 * El host ES el `.mosaico`, no un envoltorio: cada section[app-tema] tiene que ser item
 * DIRECTO de esta grilla, porque .tema.abierto{grid-column:1 / -1} y los
 * grid-template-columns de los tres data-modo solo funcionan así.
 *
 * El orden del arreglo de bloques ES el orden visual, así que el @for con track por el id
 * del tema da el orden del DOM sin mover nodos a mano.
 *
 * Sin puntero fino el componente no escucha el toque. La marca de agua de la tarjeta pasa a
 * ser estado permanente de la hoja dentro de la consulta táctil, y el toque conserva un solo
 * significado: abrir el portal. Antes un escucha de puntero dejaba la casilla activa 2200 ms
 * mientras ese mismo toque abría la pestaña nueva, de modo que la marca quedaba detrás y no
 * se alcanzaba a ver. Con ratón sigue mandando :hover y con teclado :focus-visible, los dos
 * en la hoja. Tampoco hay ya clase que el componente ponga o quite en la casilla.
 *
 * Queda constancia de que no todas las tarjetas enseñan marca: el índice de nucleo/marcas.ts
 * cubre 15 de los 25 portales del API, y las otras 10 no tienen archivo. Es un dato de la
 * carpeta de imágenes, no un defecto del mosaico, y se corrige añadiendo la imagen.
 */
@Component({
  selector: 'div[app-mosaico]',
  templateUrl: './mosaico.html',
  imports: [Tema, TemaVisible],
  host: {
    '[style.--columnas]': 'columnas()',
    '(keydown)': 'moverEntreCasillas($event)',
  },
})
export class Mosaico {
  protected readonly store = inject(DirectorioStore);
  private readonly movimiento = inject(Movimiento);
  private readonly documento = inject(DOCUMENT);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Cadena y no número: es una propiedad personalizada que el CSS mete en repeat(). */
  protected readonly columnas = computed(() => String(this.store.disposicion().columnas));

  /**
   * Cada tema con su bloque ya resuelto. Se emparejan aquí y no en la plantilla para que
   * el tipo de la entrada del tema no necesite ni `!` ni casts.
   *
   * Salen TODOS los temas, no solo los que la disposición coloca: los que esta búsqueda
   * deja fuera van al final con bloque null y la plantilla los oculta. Es lo que hace el
   * prototipo (`s.hidden = !b`), y hace falta porque si el @for los quitara del DOM, al
   * borrar la búsqueda se recrearían: volverían a correr sus animaciones de entrada y el
   * reacomodo no tendría nodos que animar.
   */
  protected readonly bloques = computed(() => {
    const temas = new Map(this.store.estadoFirme().temas.map((t) => [t.id, t]));
    const pares: Par[] = [];
    const colocados = new Set<string>();
    // Primero los colocados, en el orden de la disposición: ese orden ES el orden visual.
    for (const b of this.store.disposicion().bloques) {
      const t = temas.get(b.id);
      if (t) {
        pares.push({ b, t });
        colocados.add(b.id);
      }
    }
    for (const t of temas.values()) {
      if (!colocados.has(t.id)) pares.push({ b: null, t });
    }
    return pares;
  });

  constructor() {
    // El servicio necesita el elemento para medir el FLIP y para la clase .vt-activa.
    afterNextRender(() => this.movimiento.registrarMosaico(this.el));
    inject(DestroyRef).onDestroy(() => this.movimiento.registrarMosaico(null));
  }

  /**
   * Abrir o cerrar un tema. La corrección de scroll y el foco van DESPUÉS del cambio,
   * cuando la disposición nueva ya está pintada: al abrir, el foco va al título del tema;
   * al cerrar, al botón del tema que lo había abierto.
   */
  protected alPulsarTitulo(id: string): void {
    const volverA = this.store.abiertoDesde() || this.store.tema();
    const vaAAbrir = this.store.tema() !== id;

    this.movimiento.conTransicion(
      () => this.store.alternarTema(id),
      () => {
        if (vaAAbrir) {
          if (this.store.tema() !== id) return;
          this.acercar(id, 0.6, 'start');
          this.documento.getElementById('h-' + id)?.focus({ preventScroll: true });
          return;
        }
        if (this.store.tema() || !volverA) return;
        this.acercar(volverA, 0.8, 'center');
        const boton = this.documento
          .getElementById('tema-' + volverA)
          ?.querySelector<HTMLElement>('.tema-boton');
        if (boton?.offsetParent) boton.focus({ preventScroll: true });
      },
    );
  }

  /** Flechas: lleva el foco a la casilla vecina según su posición en pantalla. */
  protected moverEntreCasillas(ev: Event): void {
    const tecla = ev as KeyboardEvent;
    if (ev.defaultPrevented || !tecla.key || !tecla.key.startsWith('Arrow')) return;
    // Sin puntero fino las flechas son del lector de pantalla o del desplazamiento.
    if (!this.store.conPuntero()) return;
    const dir = DIRECCIONES[tecla.key];
    if (!dir) return;
    const destino = ev.target as HTMLElement | null;
    const actual = destino?.closest<HTMLElement>('.portal');
    if (!actual) return;

    const c0 = this.centro(actual);
    let mejor: HTMLElement | null = null;
    let distancia = Infinity;
    for (const a of Array.from(
      this.el.querySelectorAll<HTMLElement>('.casilla:not([hidden]) .portal'),
    )) {
      if (a === actual || !a.offsetParent) continue;
      const c = this.centro(a);
      const dx = c.x - c0.x;
      const dy = c.y - c0.y;
      const avance = dir[0] ? dx * dir[0] : dy * dir[1];
      if (avance <= 4) continue;
      // La perpendicular pesa más que el avance: así no salta de columna sin motivo.
      const d = avance + (dir[0] ? Math.abs(dy) : Math.abs(dx)) * 2.5;
      if (d < distancia) {
        distancia = d;
        mejor = a;
      }
    }
    if (mejor) {
      ev.preventDefault();
      mejor.focus();
    }
  }

  /** Si el tema quedó fuera de la ventana tras el cambio, se acerca sin animar. */
  private acercar(id: string, limite: number, bloque: ScrollLogicalPosition): void {
    const seccion = this.documento.getElementById('tema-' + id);
    if (!seccion || seccion.hidden) return;
    const alto = this.documento.defaultView?.innerHeight ?? 0;
    const arriba = seccion.getBoundingClientRect().top;
    if (arriba < 0 || arriba > alto * limite) {
      seccion.scrollIntoView({ block: bloque, behavior: 'auto' });
    }
  }

  private centro(el: HTMLElement): Centro {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}
