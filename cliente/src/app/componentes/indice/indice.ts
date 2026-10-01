import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { tonoDe } from '../../nucleo/tonos';
import { DirectorioStore } from '../../servicios/directorio.store';
import { TemasVisibles } from '../../servicios/temas-visibles';

/** Un enlace del índice, ya resuelto: la plantilla no calcula nada. */
interface EnlaceIndice {
  id: string;
  short: string;
  name: string;
  n: number;
  tinta: string;
  actual: boolean;
}

/**
 * Barra pegada de temas para pantallas de menos de 1100 px. El CSS la enciende
 * (.indice{display:none} y display:block dentro del @media): aquí no se decide nada de eso.
 *
 * Es la pieza con más dependencia cruzada del explorador, y las dos dependencias son
 * contratos: el ORDEN sale de la disposición del mosaico (no de temasEnOrden) y el tema
 * que se está leyendo sale de TemasVisibles, que es quien tiene el IntersectionObserver.
 */
@Component({
  selector: 'nav[app-indice]',
  templateUrl: './indice.html',
})
export class Indice {
  protected readonly store = inject(DirectorioStore);
  private readonly temasVisibles = inject(TemasVisibles);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly barra = viewChild.required<ElementRef<HTMLElement>>('barra');

  /**
   * El orden es el del MOSAICO: el índice tiene que llevar al tema que se ve, en el sitio
   * donde se ve. Y solo el PRIMER tema visible queda marcado, aunque haya dos en pantalla.
   */
  protected readonly enlaces = computed<EnlaceIndice[]>(() => {
    const e = this.store.estadoFirme();
    const categorias = this.store.categorias();
    const visibles = this.temasVisibles.visibles();
    const salida: EnlaceIndice[] = [];
    let marcado = false;
    for (const b of this.store.disposicion().bloques) {
      const t = e.temas.find((x) => x.id === b.id);
      if (!t) continue;
      const actual = !marcado && visibles.has(t.id);
      if (actual) marcado = true;
      salida.push({
        id: t.id,
        short: t.short,
        name: t.name,
        n: this.store.cuentaFirme(t),
        tinta: tonoDe(categorias, t.id).tinta,
        actual,
      });
    }
    return salida;
  });

  constructor() {
    // Si el tema que se está leyendo quedó fuera de la barra, la barra se mueve hasta él.
    // Va en afterRenderEffect y no en effect porque mide offsetLeft y clientWidth: el
    // aria-current tiene que estar ya pintado, o se mide el enlace anterior.
    afterRenderEffect(() => {
      const posicion = this.enlaces().findIndex((e) => e.actual);
      if (posicion < 0 || this.anfitrion.hidden) return;
      const ul = this.barra().nativeElement;
      // El @for emite un <li> por enlace y en el mismo orden: la posición basta y no hace
      // falta buscar por selector.
      const li = ul.children.item(posicion) as HTMLElement | null;
      if (!li) return;
      const izq = li.offsetLeft;
      const der = izq + li.offsetWidth;
      if (izq < ul.scrollLeft || der > ul.scrollLeft + ul.clientWidth) {
        ul.scrollTo({
          left: izq - 17,
          behavior: this.store.menosMovimiento() ? 'auto' : 'smooth',
        });
      }
    });
  }
}
