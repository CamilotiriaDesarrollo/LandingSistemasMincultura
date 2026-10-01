import { Component, computed, inject } from '@angular/core';
import { Numero } from '../../directivas/numero';
import { plural } from '../../nucleo/texto';
import { tonoDe } from '../../nucleo/tonos';
import { DirectorioStore } from '../../servicios/directorio.store';

/** Un tramo de la barra: su grosor es el conteo, que el CSS usa como flex-grow. */
interface Tramo {
  id: string;
  tinta: string;
  rayado: boolean;
  c: number;
  cero: boolean;
}

/** Una línea de la leyenda: la muestra de color y el conteo en texto. */
interface Renglon extends Tramo {
  short: string;
  texto: string;
}

/**
 * Los dos KPI, la barra por tema y la leyenda.
 *
 * El host lleva class="cifras" desde la plantilla del padre y es HIJO DIRECTO de .bento:
 * .cifras{display:contents} hace que este div desaparezca como caja y los dos .kpi pasen
 * a ser items de la rejilla de 12 columnas del bento, que es lo que permite colocarlos.
 *
 * Los tres números visibles son aria-hidden y el texto real va en los .solo-lector: un
 * contador a medio contar no se debe leer en voz alta.
 */
@Component({
  selector: 'div[app-cifras]',
  imports: [Numero],
  templateUrl: './cifras.html',
})
export class Cifras {
  private readonly store = inject(DirectorioStore);

  protected readonly portales = computed(() =>
    this.store.hayConsultaMarca() ? this.store.estado().resultados.length : this.store.total(),
  );

  protected readonly textoPortales = computed(() =>
    this.store.hayConsultaMarca() ? `de ${this.store.total()} coinciden` : 'portales públicos',
  );

  protected readonly lectorPortales = computed(() =>
    this.store.hayConsultaMarca()
      ? `${this.portales()} de ${this.store.total()} portales coinciden con la búsqueda`
      : `${this.store.total()} portales públicos`,
  );

  private readonly temas = computed(() => this.store.estado().temas);

  protected readonly temasConPortales = computed(
    () => this.temas().filter((t) => (this.store.cuentaDe().get(t.id) ?? 0) > 0).length,
  );

  protected readonly textoTemas = computed(() =>
    this.store.hayConsultaMarca()
      ? `de ${this.temas().length} temas`
      : this.temasConPortales() === 1
        ? 'tema'
        : 'temas',
  );

  protected readonly lectorTemas = computed(() =>
    this.store.hayConsultaMarca()
      ? `${this.temasConPortales()} de ${this.temas().length} temas con resultados`
      : plural(this.temas().length, 'tema', 'temas'),
  );

  /** La barra ordena por total, no por coincidencias: así no se reordena al escribir. */
  private readonly temasPorTotal = computed(() => [...this.temas()].sort((a, b) => b.total - a.total));

  protected readonly tramos = computed<Tramo[]>(() => {
    const categorias = this.store.categorias();
    const cuentas = this.store.cuentaDe();
    return this.temasPorTotal().map((t, i) => {
      const c = cuentas.get(t.id) ?? 0;
      return { id: t.id, tinta: tonoDe(categorias, t.id).tinta, rayado: i % 2 === 1, c, cero: c === 0 };
    });
  });

  protected readonly leyenda = computed<Renglon[]>(() => {
    const hay = this.store.hayConsultaMarca();
    const porTotal = this.temasPorTotal();
    return this.tramos().map((tramo, i) => ({
      ...tramo,
      short: porTotal[i].short,
      texto: hay ? `${tramo.c} de ${porTotal[i].total}` : String(tramo.c),
    }));
  });
}
