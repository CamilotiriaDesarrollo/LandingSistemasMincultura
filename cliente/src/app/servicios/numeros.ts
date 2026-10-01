import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';
import { Medios } from './medios';

interface OpcionesRevision {
  /** Fija todos los números, estén o no en pantalla. */
  todos?: boolean;
  /** Los pone en su valor final sin animar la cuenta: impresión y capturas. */
  sinCuenta?: boolean;
}

/**
 * Los números que cuentan. El valor viaja en la variable --n y la cuenta la hace el CSS
 * con counter(n); por eso el valor tiene que SALIR EN 0 y cambiar después, y no sirve
 * atar [style.--n] en la plantilla: la cuenta no se vería.
 *
 * Un solo IntersectionObserver para los tres tipos de .num de la página. El rootMargin
 * generoso arranca la cuenta antes de que el número entre, para que llegue a la vista ya
 * en movimiento.
 */
@Injectable({ providedIn: 'root' })
export class Numeros {
  private readonly documento = inject(DOCUMENT);
  private readonly menosMovimiento = inject(Medios).consultar('(prefers-reduced-motion: reduce)');
  private readonly observador: IntersectionObserver | null;

  constructor() {
    const ventana = this.documento.defaultView;
    this.observador =
      ventana && 'IntersectionObserver' in ventana
        ? new IntersectionObserver(
            (entradas) => {
              for (const en of entradas) {
                if (!en.isIntersecting) continue;
                const el = en.target as HTMLElement;
                el.dataset['visto'] = '1';
                el.style.setProperty('--n', el.dataset['n'] ?? '0');
                this.observador?.unobserve(el);
              }
            },
            { threshold: 0.2, rootMargin: '400px 0px' },
          )
        : null;

    // Una sola vez: al imprimir no hay scroll que dispare al observador.
    const alImprimir = () => this.revisar({ todos: true, sinCuenta: true });
    ventana?.addEventListener('beforeprint', alImprimir);
    inject(DestroyRef).onDestroy(() => {
      ventana?.removeEventListener('beforeprint', alImprimir);
      this.observador?.disconnect();
    });
  }

  observar(el: HTMLElement): void {
    this.observador?.observe(el);
  }

  /** Guarda SIEMPRE el valor; solo lo pinta si el número ya se vio o si no hay cuenta. */
  fijar(el: HTMLElement, n: number): void {
    el.dataset['n'] = String(n);
    if (el.dataset['visto'] || !this.observador || this.menosMovimiento()) {
      el.dataset['visto'] = '1';
      el.style.setProperty('--n', String(n));
    }
  }

  /**
   * Red de seguridad: un número que ya está en pantalla nunca se queda en cero esperando
   * al observador. Hace falta tras cada cambio de disposición del mosaico, al imprimir y
   * en las capturas.
   */
  revisar(opciones: OpcionesRevision = {}): void {
    const { todos = false, sinCuenta = false } = opciones;
    const raiz = this.documento.documentElement;
    const ventana = this.documento.defaultView;
    if (sinCuenta) raiz.classList.add('numeros-quietos');

    const alto = ventana?.innerHeight ?? 0;
    for (const el of Array.from(
      this.documento.querySelectorAll<HTMLElement>('.num:not([data-visto])'),
    )) {
      const r = el.getBoundingClientRect();
      if (todos || (r.width && r.bottom > 0 && r.top < alto)) {
        el.dataset['visto'] = '1';
        el.style.setProperty('--n', el.dataset['n'] ?? '0');
        this.observador?.unobserve(el);
      }
    }

    if (sinCuenta) {
      // Leer un valor calculado aplica los cambios antes de quitar la clase, así el salto
      // al valor final no se anima.
      ventana?.getComputedStyle(raiz).getPropertyValue('--curva');
      const quitar = () => raiz.classList.remove('numeros-quietos');
      if (ventana) ventana.requestAnimationFrame(quitar);
      else quitar();
    }
  }
}
