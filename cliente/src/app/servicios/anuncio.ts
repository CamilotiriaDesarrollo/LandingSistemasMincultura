import { DestroyRef, Injectable, inject } from '@angular/core';

/**
 * Región aria-live de la página. Escribe DIRECTO en el elemento, nunca por señal
 * interpolada: el truco de poner textContent a '' y acto seguido al texto es lo que
 * hace que el lector de pantalla vuelva a leer un aviso repetido, y con una señal los
 * dos cambios se colapsan en el mismo ciclo de detección y el aviso deja de leerse.
 *
 * Los 400 ms de espera dejan que la persona termine de escribir antes de hablar.
 */
@Injectable({ providedIn: 'root' })
export class Anuncio {
  private region: HTMLElement | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  /** El Explorador registra su #anuncio con viewChild dentro de afterNextRender. */
  registrar(el: HTMLElement): void {
    this.region = el;
  }

  decir(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      const el = this.region;
      if (!el) return;
      el.textContent = '';
      el.textContent = texto;
    }, 400);
  }
}
