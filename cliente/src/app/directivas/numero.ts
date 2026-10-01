import { Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import { Numeros } from '../servicios/numeros';

/**
 * Un número que cuenta al entrar en pantalla. La clase .num y la variable --n son todo lo
 * que el CSS necesita: la cuenta la hace counter(n) sobre --n, y el servicio se encarga de
 * que el valor salga en cero y cambie después.
 *
 * Se pone en los dos números de las cifras y en el número de cada tema del mosaico.
 */
@Directive({
  selector: '[appNumero]',
  host: { class: 'num' },
})
export class Numero {
  readonly valor = input.required<number>({ alias: 'appNumero' });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly numeros = inject(Numeros);

  constructor() {
    // Tras el primer render: el elemento ya está en el documento cuando se observa, que es
    // lo que hace falta porque los datos llegan por HTTP y no existen antes.
    afterNextRender(() => this.numeros.observar(this.el));
    effect(() => this.numeros.fijar(this.el, this.valor()));
  }
}
