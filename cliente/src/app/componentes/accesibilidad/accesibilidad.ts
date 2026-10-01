import { Component, DOCUMENT, inject, signal } from '@angular/core';

/* El contraste y el tamaño de letra se recuerdan entre visitas: quien necesita la letra
   grande no tiene que volver a pedirla en cada carga.

   Es el segundo módulo que toca localStorage, además de nucleo/pedido.ts, y sigue su mismo
   patrón: cada acceso va envuelto en try/catch, porque localStorage lanza en modo privado,
   con el almacenamiento bloqueado y en algunos navegadores desde file://. Sin almacenamiento
   la barra funciona igual y la preferencia vale solo para esta visita. */

/** Claves de la preferencia guardada: cambiarlas pierde lo que ya esté guardado. */
export const CLAVE_CONTRASTE = 'mosaico-editorial-contraste';
export const CLAVE_ZOOM = 'mosaico-editorial-zoom';

/* El piso es 1,0 y no 0,9: reducir la letra por debajo de lo normal no es una ayuda de
   accesibilidad y era lo que dejaba el campo de búsqueda en 41 px de alto, por debajo de los
   44 px que necesita un objetivo tocable. */
const ZOOM_MINIMO = 1;
const ZOOM_MAXIMO = 1.3;

/** Deja el valor dentro del rango y con una sola décima, que es el paso de los botones. */
const acotar = (valor: number): number => Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, +valor.toFixed(1)));

function leerContraste(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRASTE) === 'si';
  } catch {
    return false;
  }
}

function leerZoom(): number {
  try {
    const guardado = Number.parseFloat(localStorage.getItem(CLAVE_ZOOM) ?? '');
    return Number.isFinite(guardado) ? acotar(guardado) : ZOOM_MINIMO;
  } catch {
    return ZOOM_MINIMO;
  }
}

/** Barra flotante de accesibilidad: contraste y tamaño de letra. */
@Component({
  selector: 'div[app-accesibilidad]',
  template: `
    <button type="button" (click)="alternarContraste()"
            [attr.aria-pressed]="contraste()" aria-label="Cambiar contraste">C</button>
    <button type="button" (click)="cambiarZoom(-0.1)" aria-label="Reducir letra">A−</button>
    <button type="button" (click)="cambiarZoom(0.1)" aria-label="Aumentar letra">A+</button>
  `,
})
export class Accesibilidad {
  private readonly documento = inject(DOCUMENT);

  /** Única fuente del estado del contraste: de aquí salen aria-pressed y la clase de body. */
  protected readonly contraste = signal(false);
  private zoom = ZOOM_MINIMO;

  constructor() {
    /* La preferencia se aplica al construir, antes de que lleguen los portales, así que el
       mapa y el resplandor ya miden con la letra puesta. Se escribe siempre, también cuando
       vale 1,0, para que body.style.zoom diga siempre la preferencia: medido en 1440x900,
       zoom 1,0 no mueve ninguna caja ni el tamaño del documento. */
    this.aplicarContraste(leerContraste());
    this.aplicarZoom(leerZoom());
  }

  protected alternarContraste(): void {
    this.aplicarContraste(!this.contraste());
    this.recordar(CLAVE_CONTRASTE, this.contraste() ? 'si' : 'no');
  }

  /** El zoom va de 1,0 a 1,3, en pasos de una décima. */
  protected cambiarZoom(paso: number): void {
    this.aplicarZoom(acotar(this.zoom + paso));
    this.recordar(CLAVE_ZOOM, String(this.zoom));
  }

  private aplicarContraste(activo: boolean): void {
    this.contraste.set(activo);
    this.documento.body.classList.toggle('high-contrast', activo);
  }

  private aplicarZoom(valor: number): void {
    this.zoom = valor;
    this.documento.body.style.setProperty('zoom', String(valor));
  }

  private recordar(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento: la preferencia vale solo para esta visita */
    }
  }
}
