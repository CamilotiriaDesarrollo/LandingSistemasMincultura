import { Component, computed, input } from '@angular/core';
import { resaltar } from '../../nucleo/texto';

/**
 * Pinta un texto con la coincidencia de la búsqueda dentro de <mark>, sin innerHTML.
 * Lo usan el nombre y la descripción de la casilla del mosaico, los de la fila de la lista,
 * el nombre de la fila del mapa y el nombre de la ficha del centro.
 *
 * La plantilla va en UNA SOLA LÍNEA y sin espacios entre los bloques a propósito: Angular
 * convierte el salto de línea y la sangría en un espacio real, y ese espacio partiría la
 * palabra justo donde empieza el resaltado.
 */
@Component({
  selector: 'span[app-resaltado]',
  template: `@for (t of trozos(); track $index) {@if (t.marca) {<mark>{{ t.texto }}</mark>}@else {<ng-container>{{ t.texto }}</ng-container>}}`,
})
export class Resaltado {
  readonly texto = input.required<string>();
  readonly consulta = input<string>('');

  protected readonly trozos = computed(() => resaltar(this.texto(), this.consulta()));
}
