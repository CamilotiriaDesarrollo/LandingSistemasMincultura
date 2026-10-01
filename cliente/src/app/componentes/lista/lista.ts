import { Component, computed, inject } from '@angular/core';
import { PortalEnriquecido, TemaEnriquecido } from '../../modelos/estado';
import { plural } from '../../nucleo/texto';
import { tonoDe } from '../../nucleo/tonos';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Resaltado } from '../resaltado/resaltado';

/**
 * Vista en lista: los mismos portales del mosaico en filas de 48 px, agrupados por tema.
 * No tiene datos propios ni estado: todo sale del estado FIRME del store, así que la lista
 * y el mosaico nunca pueden discrepar.
 *
 * Vive siempre en el DOM y el padre la oculta con [hidden].
 */
@Component({
  selector: 'div[app-lista]',
  templateUrl: './lista.html',
  imports: [Resaltado],
})
export class Lista {
  protected readonly store = inject(DirectorioStore);

  /** Temas de mayor a menor, sin los que no muestran ningún portal. */
  protected readonly temas = computed(() => this.store.temasLista());

  protected cuentaDe(t: TemaEnriquecido): number {
    return this.store.cuentaFirme(t);
  }

  /** Con búsqueda se dice cuántos de cuántos, para que se vea que el tema tiene más. */
  protected texto(t: TemaEnriquecido): string {
    const n = this.cuentaDe(t);
    return this.store.estadoFirme().hayConsulta
      ? `${n} de ${plural(t.total, 'portal', 'portales')}`
      : plural(n, 'portal', 'portales');
  }

  /** El tono va por el ORDEN de las categorías del API, nunca por id escrito a mano. */
  protected tinta(t: TemaEnriquecido): string {
    return tonoDe(this.store.categorias(), t.id).tinta;
  }

  protected filasDe(t: TemaEnriquecido): PortalEnriquecido[] {
    return t.portales.filter((p) => p.coincide);
  }

  protected clave(p: PortalEnriquecido): string {
    return this.store.claveDe(p);
  }

  protected dosDigitos(n: number): string {
    return String(n).padStart(2, '0');
  }
}
