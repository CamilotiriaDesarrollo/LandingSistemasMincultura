import { DOCUMENT, Directive, inject } from '@angular/core';
import { Medios } from '../servicios/medios';

/**
 * El resplandor que sigue al cursor en las tarjetas favoritas. Va en el DIV.BENTO y no en
 * cada tarjeta: un solo manejador para todas, que busca la tarjeta con closest.
 *
 * La división por el zoom es obligatoria: el A+ de la barra de accesibilidad escribe
 * body.style.zoom, y sin dividir el resplandor queda lejos del cursor.
 */
@Directive({
  selector: '[appResplandor]',
  host: { '(pointermove)': 'seguir($event)' },
})
export class Resplandor {
  private readonly documento = inject(DOCUMENT);
  private readonly medios = inject(Medios);
  private readonly conPuntero = this.medios.consultar('(hover: hover)');
  private readonly menosMovimiento = this.medios.consultar('(prefers-reduced-motion: reduce)');

  /** Un solo cuadro pendiente: el puntero se mueve muchas más veces que la pantalla. */
  private pendiente: { fav: HTMLElement; x: number; y: number } | null = null;

  seguir(ev: PointerEvent): void {
    if (!this.conPuntero() || this.menosMovimiento()) return;
    const destino = ev.target instanceof Element ? ev.target : null;
    const fav = destino?.closest<HTMLElement>('.fav') ?? null;
    if (!fav) return;
    const habia = !!this.pendiente;
    this.pendiente = { fav, x: ev.clientX, y: ev.clientY };
    if (!habia) this.documento.defaultView?.requestAnimationFrame(() => this.aplicar());
  }

  private aplicar(): void {
    const p = this.pendiente;
    this.pendiente = null;
    if (!p) return;
    const zoom = parseFloat(this.documento.body.style.getPropertyValue('zoom')) || 1;
    const r = p.fav.getBoundingClientRect();
    p.fav.style.setProperty('--x', (p.x - r.left) / zoom + 'px');
    p.fav.style.setProperty('--y', (p.y - r.top) / zoom + 'px');
  }
}
