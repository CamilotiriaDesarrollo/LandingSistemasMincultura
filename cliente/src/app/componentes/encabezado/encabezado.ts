import { Component, DOCUMENT, inject } from '@angular/core';
import { DirectorioStore } from '../../servicios/directorio.store';

/** Barra institucional: logo, nombre del Ministerio y navegación principal. */
@Component({
  selector: 'header[app-encabezado]',
  templateUrl: './encabezado.html',
})
export class Encabezado {
  private readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);

  protected readonly enlaces = [
    { texto: 'Inicio', url: 'https://www.mincultura.gov.co/' },
    { texto: 'Ministerio', url: 'https://www.mincultura.gov.co/transparencia/Paginas/quienes-somos.aspx' },
    { texto: 'Portales y sistemas', url: '#explorar' },
    { texto: 'Participa', url: 'https://www.mincultura.gov.co/transparencia/Paginas/participa/participa.aspx' },
    { texto: 'Atención a la ciudadanía', url: 'https://www.mincultura.gov.co/atencion-y-servicio-a-la-ciudadania/Paginas/atencion-pqrs.aspx' },
    { texto: 'Transparencia', url: 'https://www.mincultura.gov.co/transparencia/Paginas/transparencia.aspx' },
  ];

  /**
   * Si un enlace del menú sale del sitio. Lo decide el esquema del href y nada más: los
   * cinco de mincultura.gov.co salen, y `#explorar` es de esta misma página.
   *
   * De aquí salen las tres cosas que la plantilla le pone a los que salen, `aria-label`,
   * `target="_blank"` y `rel="noopener noreferrer"`. El rótulo accesible REPITE el texto
   * visible a propósito, igual que en el zócalo: el nombre accesible no puede depender de
   * que la hoja conserve el texto, y un rótulo distinto del texto visible le daría dos
   * nombres al mismo enlace a quien lo lee y a quien lo oye.
   */
  protected esExterno(url: string): boolean {
    return /^https?:/i.test(url);
  }

  protected irABuscar(): void {
    const buscador = this.documento.getElementById('query');
    buscador?.scrollIntoView({ behavior: this.comportamiento(), block: 'center' });
    // preventScroll: el desplazamiento ya está en marcha y el foco no debe cortarlo.
    buscador?.focus({ preventScroll: true });
  }

  protected irAExplorar(): void {
    this.documento.getElementById('explorar')?.scrollIntoView({ behavior: this.comportamiento() });
  }

  /**
   * Sin desplazamiento suave cuando se pide reducir el movimiento.
   *
   * La consulta se hace aquí y no se deja en html{scroll-behavior:auto} de la hoja: un
   * behavior escrito en las opciones de scrollIntoView gana a la propiedad CSS, así que
   * con 'smooth' fijo los dos botones del encabezado seguían animando el recorrido
   * aunque el bloque de prefers-reduced-motion dijera lo contrario. Es la misma guarda de
   * Buscador, Indice y Zocalo, que son los otros sitios que desplazan.
   */
  private comportamiento(): ScrollBehavior {
    return this.store.menosMovimiento() ? 'auto' : 'smooth';
  }
}
