import { Directive, ElementRef, Renderer2, afterNextRender, inject, input } from '@angular/core';
import { BASE, MARCAS, variablesDeMarca } from '../nucleo/marcas';

/**
 * Marca de agua de una tarjeta. La imagen se crea a mano y no en la plantilla porque el
 * ORDEN importa: primero la imagen con sus variables, después el respaldo del archivo
 * roto, después la clase que reserva el sitio, y SOLO AL FINAL el src. Puesto de otra
 * forma, una marca que no carga deja la tarjeta oscurecida y sin imagen.
 *
 * Sin loading="lazy" a propósito: son ocho archivos de 44 KB en total, y las diferidas
 * dentro de un tema cerrado no se pedirían nunca.
 *
 * La marca se aplica una sola vez. El @for que crea las tarjetas lleva track por la clave
 * estable del portal, así que cada nodo queda atado a su portal y el nombre no cambia.
 */
@Directive({ selector: '[appMarca]' })
export class Marca {
  readonly nombre = input.required<string>({ alias: 'appMarca' });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly render = inject(Renderer2);

  constructor() {
    afterNextRender(() => this.poner());
  }

  private poner(): void {
    const m = MARCAS[this.nombre()];
    if (!m) return;

    const a = this.el;
    const img: HTMLImageElement = this.render.createElement('img');
    img.className = 'p-marca';
    img.alt = '';
    img.decoding = 'async';
    for (const [clave, valor] of Object.entries(variablesDeMarca(m))) {
      img.style.setProperty(clave, valor);
    }
    // addEventListener y no Renderer2.listen: hace falta { once: true } y quitarse solo.
    img.addEventListener(
      'error',
      () => {
        img.remove();
        this.render.removeClass(a, 'con-marca');
      },
      { once: true },
    );
    this.render.addClass(a, 'con-marca');
    this.render.appendChild(a, img);
    img.src = BASE + m.archivo;
  }
}
