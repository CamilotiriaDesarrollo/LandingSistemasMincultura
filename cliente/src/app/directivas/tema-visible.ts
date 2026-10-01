import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';
import { TemasVisibles } from '../servicios/temas-visibles';

/**
 * Da de alta cada sección de tema en TemasVisibles, para que el índice marque el tema que
 * se está leyendo. Va en el host de cada section[app-tema].
 *
 * El alta va en un effect y no en el constructor porque una entrada obligatoria todavía no
 * tiene valor cuando el constructor corre; de paso, si el id cambiara, se reemplaza el alta.
 */
@Directive({ selector: '[appTemaVisible]' })
export class TemaVisible {
  readonly id = input.required<string>({ alias: 'appTemaVisible' });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly temas = inject(TemasVisibles);
  private registrado = '';

  constructor() {
    effect(() => {
      const id = this.id();
      if (id === this.registrado) return;
      if (this.registrado) this.temas.olvidar(this.registrado);
      this.registrado = id;
      this.temas.registrar(id, this.el);
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.registrado) this.temas.olvidar(this.registrado);
    });
  }
}
