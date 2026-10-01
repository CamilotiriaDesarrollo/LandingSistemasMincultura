import { Component, computed, inject } from '@angular/core';
import { Marca } from '../../directivas/marca';
import { Resplandor } from '../../directivas/resplandor';
import { PortalEnriquecido } from '../../modelos/estado';
import { partirDominio } from '../../nucleo/texto';
import { Tono, tonoFavorito } from '../../nucleo/tonos';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Cifras } from '../cifras/cifras';

/**
 * Accesos favoritos: la tarjeta grande y las demás apiladas a su lado, con las cifras
 * cerrando la rejilla del bento.
 *
 * data-favoritos, data-otros, --filas y --filas-m son el mecanismo que evita huecos
 * cuando los favoritos del API no son cuatro: el CSS ya trae las salidas escritas para
 * uno, dos o tres, y .fav-otro.fav-sola para la última cuando quedan impares en móvil.
 *
 * El bento no se pinta hasta que llegan los datos: un bento vacío con un cero contando
 * es peor que no mostrar nada durante la primera fracción de segundo.
 */
@Component({
  selector: 'section[app-favoritos]',
  imports: [Cifras, Marca, Resplandor],
  templateUrl: './favoritos.html',
  host: {
    '[hidden]': '!store.datos()',
  },
})
export class Favoritos {
  protected readonly store = inject(DirectorioStore);

  /** No se filtran por la búsqueda, a propósito: el bento de la portada es fijo. */
  protected readonly favoritos = computed(() => this.store.favoritos());
  protected readonly otros = computed(() => Math.max(0, this.favoritos().length - 1));
  protected readonly filas = computed(() => (this.favoritos().length ? Math.max(2, this.otros()) : 1));
  protected readonly filasM = computed(() => (this.favoritos().length > 1 ? Math.max(2, this.otros()) : 1));

  /** La última tarjeta ocupa las dos columnas de móvil cuando quedan impares. */
  protected clase(i: number): string {
    if (i === 0) return 'fav fav-1';
    const sola = i === this.favoritos().length - 1 && this.otros() % 2;
    return 'fav fav-otro' + (sola ? ' fav-sola' : '');
  }

  /** El favorito 01 no lleva tono: es la tarjeta grande y trae su propio degradado. */
  protected tono(i: number): Tono | null {
    return tonoFavorito(i);
  }

  protected numero(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  protected clave(p: PortalEnriquecido): string {
    return this.store.claveDe(p);
  }

  protected trozosDominio(d: string): string[] {
    return partirDominio(d);
  }
}
