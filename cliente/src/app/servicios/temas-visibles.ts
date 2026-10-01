import { DOCUMENT, DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

/**
 * Qué temas están en pantalla. Un solo IntersectionObserver para todos: el índice solo
 * LEE esta señal, así que la dependencia entre el índice y el mosaico queda en un
 * contrato y no en dos implementaciones que se buscan por el documento.
 *
 * El margen negativo descarta el tema que apenas asoma por abajo: marca el que de
 * verdad se está leyendo.
 */
@Injectable({ providedIn: 'root' })
export class TemasVisibles {
  private readonly documento = inject(DOCUMENT);
  private readonly conjunto = signal<ReadonlySet<string>>(new Set<string>());
  readonly visibles: Signal<ReadonlySet<string>> = this.conjunto.asReadonly();

  private readonly dentro = new Set<string>();
  private readonly porElemento = new Map<Element, string>();
  private readonly porId = new Map<string, HTMLElement>();
  private readonly observador: IntersectionObserver | null;

  constructor() {
    const ventana = this.documento.defaultView;
    this.observador =
      ventana && 'IntersectionObserver' in ventana
        ? new IntersectionObserver(
            (entradas) => {
              for (const en of entradas) {
                const id = this.porElemento.get(en.target);
                if (!id) continue;
                if (en.isIntersecting) this.dentro.add(id);
                else this.dentro.delete(id);
              }
              this.conjunto.set(new Set(this.dentro));
            },
            { rootMargin: '-70px 0px -55% 0px' },
          )
        : null;
    inject(DestroyRef).onDestroy(() => this.observador?.disconnect());
  }

  registrar(id: string, el: HTMLElement): void {
    this.porElemento.set(el, id);
    this.porId.set(id, el);
    this.observador?.observe(el);
  }

  olvidar(id: string): void {
    const el = this.porId.get(id);
    if (el) {
      this.observador?.unobserve(el);
      this.porElemento.delete(el);
      this.porId.delete(id);
    }
    if (this.dentro.delete(id)) this.conjunto.set(new Set(this.dentro));
  }
}
