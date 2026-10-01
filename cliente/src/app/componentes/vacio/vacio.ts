import { Component, DOCUMENT, computed, inject } from '@angular/core';
import { DirectorioStore } from '../../servicios/directorio.store';

/**
 * Bloque de búsqueda sin resultados. No es un callejón sin salida: ofrece palabras que sí
 * tienen portales y la vuelta al directorio completo.
 *
 * Las sugerencias salen de los propios datos (nucleo/estado.ts las saca de los nombres y las
 * descripciones), nunca de una lista escrita en el código: con otro portales.json cambian
 * solas y nunca sugieren algo que no da resultados.
 */
@Component({
  selector: 'div[app-vacio]',
  templateUrl: './vacio.html',
})
export class Vacio {
  protected readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);

  /** Lo que se muestra es la consulta del estado FIRME: la del reacomodo, no la de la tecla. */
  protected readonly consulta = computed(() => this.store.estadoFirme().consulta.trim());

  protected buscar(termino: string): void {
    this.store.buscarTermino(termino);
  }

  /** Al volver al directorio completo el foco sube a la cabecera de la sección. */
  protected verTodos(): void {
    this.store.limpiarBusqueda();
    this.documento.querySelector<HTMLElement>('#explorar-titulo')?.focus();
  }
}
