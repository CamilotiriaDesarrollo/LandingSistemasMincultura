import {
  ApplicationRef,
  DOCUMENT,
  Injectable,
  Injector,
  afterNextRender,
  inject,
} from '@angular/core';
import { Medios } from './medios';

/** Lo poco que el port necesita de View Transitions, sin depender de la versión de lib.dom. */
interface TransicionVista {
  readonly updateCallbackDone: Promise<void>;
  readonly finished: Promise<void>;
  skipTransition(): void;
}
interface DocumentoConTransiciones {
  /* El cierre puede devolver una promesa: el navegador espera a que se resuelva antes de
     capturar el estado nuevo. Es por donde entra el render de Angular. */
  startViewTransition?: (cambio: () => void | Promise<void>) => TransicionVista;
}

const OPCIONES: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' };

/**
 * El movimiento del mosaico: FLIP manual para el reacomodo al buscar y View Transitions
 * solo para abrir y cerrar un tema.
 *
 * El FLIP necesita que el DOM cambie de forma SINCRÓNICA dentro del cierre (medir,
 * cambiar, medir), y escribir una señal no cambia el DOM hasta el siguiente ciclo de
 * detección: de ahí el tick() justo después de cambio(). Es legal porque quien llama es un
 * setTimeout o un manejador de evento, nunca un effect ni un computed.
 *
 * View Transitions NO puede hacer lo mismo. Su cierre lo invoca el navegador aparte del
 * evento, y para entonces Angular ya tiene su propio ciclo en marcha: pedir otro es NG0101
 * y el error sale tres veces por cada tema que se abre. Ahí el cierre devuelve una promesa
 * y el navegador espera; Angular pinta a su ritmo y afterNextRender la resuelve. Mismo
 * resultado, sin forzar el ciclo.
 *
 * El elemento del mosaico llega por registrarMosaico y no se busca en el documento: así
 * el servicio no depende del store y no hay ciclo de inyección.
 */
@Injectable({ providedIn: 'root' })
export class Movimiento {
  private readonly app = inject(ApplicationRef);
  private readonly documento = inject(DOCUMENT);
  private readonly inyector = inject(Injector);
  private readonly menos = inject(Medios).consultar('(prefers-reduced-motion: reduce)');

  private mosaico: HTMLElement | null = null;
  private enCurso = false;
  /** Cada cambio lleva un número: si llega tarde un cambio viejo, no mueve el foco. */
  private generacion = 0;

  registrarMosaico(el: HTMLElement | null): void {
    this.mosaico = el;
  }

  conFlip<T>(cambio: () => T): T {
    const aplicar = (): T => {
      const r = cambio();
      this.app.tick();
      return r;
    };
    const mosaico = this.mosaico;
    // El mosaico oculto cubre también «la vista no es mosaico»: es el mismo [hidden].
    if (
      !mosaico ||
      mosaico.hidden ||
      this.menos() ||
      typeof Element.prototype.animate !== 'function'
    ) {
      return aplicar();
    }

    const antes = new Map<Element, DOMRect>();
    for (const n of Array.from(mosaico.querySelectorAll<HTMLElement>('.tema, .casilla'))) {
      if (n.offsetParent) antes.set(n, n.getBoundingClientRect());
    }

    const resultado = aplicar();
    if (mosaico.hidden) return resultado;

    const movido = new Map<Element, [number, number]>();
    // Los temas primero: a cada casilla se le resta el desplazamiento de su tema, o el
    // movimiento se suma dos veces.
    for (const selector of ['.tema', '.casilla'] as const) {
      for (const n of Array.from(mosaico.querySelectorAll<HTMLElement>(selector))) {
        if (!n.offsetParent) continue;
        const r1 = antes.get(n);
        if (!r1) {
          n.animate([{ opacity: 0 }, { opacity: 1 }], OPCIONES);
          continue;
        }
        const r2 = n.getBoundingClientRect();
        let dx = r1.left - r2.left;
        let dy = r1.top - r2.top;
        if (selector === '.tema') {
          movido.set(n, [dx, dy]);
        } else {
          const padre = n.closest('.tema');
          const [px, py] = (padre && movido.get(padre)) || [0, 0];
          dx -= px;
          dy -= py;
        }
        if (Math.abs(dx) + Math.abs(dy) < 1) continue;
        n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], OPCIONES);
      }
    }
    return resultado;
  }

  conTransicion(cambio: () => void, despues?: () => void): void {
    const mia = ++this.generacion;
    const alFinal = () => {
      if (mia === this.generacion && despues) despues();
    };
    /* Sin View Transitions el cambio corre dentro del manejador del evento, donde no hay
       ningún ciclo en marcha todavía: ahí el tick() sí es seguro y hace falta para que
       quien llame vea el DOM ya cambiado. */
    const aplicarYa = () => {
      cambio();
      this.app.tick();
    };

    const doc = this.documento as unknown as DocumentoConTransiciones;
    if (typeof doc.startViewTransition !== 'function' || this.enCurso) {
      aplicarYa();
      alFinal();
      return;
    }
    /* Se guarda ya ligada: dentro del cierre, TypeScript no puede dar por hecho que la
       propiedad sigue siendo la misma función. */
    const iniciarTransicion = doc.startViewTransition.bind(doc);

    const mosaico = this.mosaico;
    if (!this.menos()) mosaico?.classList.add('vt-activa');
    this.enCurso = true;
    const terminar = () => {
      this.enCurso = false;
      mosaico?.classList.remove('vt-activa');
    };

    try {
      let aplicado = false;
      const vt = iniciarTransicion(() => {
        aplicado = true;
        cambio();
        // El navegador espera esta promesa antes de capturar el estado nuevo: nada de
        // pedir un ciclo a mano, que aquí sería uno dentro de otro.
        return this.trasElRender();
      });
      // Si el navegador tarda en capturar el estado anterior se salta la animación y el
      // cambio ocurre igual: nunca se queda la pantalla a medias.
      const espera = setTimeout(() => {
        if (!aplicado) vt.skipTransition();
      }, 250);
      vt.updateCallbackDone.then(alFinal, alFinal).finally(() => clearTimeout(espera));
      vt.finished.then(terminar, terminar);
    } catch {
      terminar();
      aplicarYa();
      alFinal();
    }
  }

  /**
   * Promesa que se cumple cuando Angular ya pintó el cambio. Es lo que el cierre de la
   * transición devuelve para que el navegador capture el estado nuevo, y no el anterior.
   *
   * Lleva su propio plazo: si por lo que sea no llega un render, la transición sigue en
   * vez de quedarse esperando y dejar la pantalla congelada.
   */
  private trasElRender(): Promise<void> {
    return new Promise<void>((resolver) => {
      const plazo = setTimeout(resolver, 200);
      afterNextRender(
        () => {
          clearTimeout(plazo);
          resolver();
        },
        { injector: this.inyector },
      );
    });
  }
}
