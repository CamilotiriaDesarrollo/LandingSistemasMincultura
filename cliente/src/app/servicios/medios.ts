import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

/**
 * matchMedia como señales. Una por consulta, cacheada: el MediaQueryList y su listener
 * se crean una sola vez aunque la pidan cinco componentes.
 *
 * Señales y no funciones porque la preferencia cambia en caliente: al girar el teléfono
 * o al activar «reducir movimiento» la señal reacciona y el prototipo necesitaba un
 * listener de 'change' propio para lo mismo.
 */
@Injectable({ providedIn: 'root' })
export class Medios {
  private readonly destruir = inject(DestroyRef);
  private readonly cache = new Map<string, Signal<boolean>>();

  consultar(consulta: string): Signal<boolean> {
    const guardada = this.cache.get(consulta);
    if (guardada) return guardada;

    const estado = signal(false);
    // Sin matchMedia (render en servidor, pruebas) la señal se queda en false y nada falla.
    if (typeof matchMedia === 'function') {
      const lista = matchMedia(consulta);
      estado.set(lista.matches);
      const alCambiar = (ev: MediaQueryListEvent) => estado.set(ev.matches);
      lista.addEventListener('change', alCambiar);
      this.destruir.onDestroy(() => lista.removeEventListener('change', alCambiar));
    }

    const resultado = estado.asReadonly();
    this.cache.set(consulta, resultado);
    return resultado;
  }
}
