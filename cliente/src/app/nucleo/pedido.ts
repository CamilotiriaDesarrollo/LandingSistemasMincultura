/* URL y preferencia de vista: el ÚNICO módulo que lee y escribe location, history y
   localStorage. Portado de _recursos/nucleo.js y del bloque 1 de la unificada.

   No hay Router ni router-outlet a propósito: el estado por URL se resuelve con
   history.replaceState y URLSearchParams. Agregar @angular/router solo para leer ?q=
   metería el paquete entero y arriesgaría que el MapFallbackToFile del servidor y las
   rutas empiecen a pisarse.

   Los cuatro accesos van envueltos en try/catch: localStorage y replaceState lanzan en
   modo privado, con el almacenamiento bloqueado y en algunos navegadores desde file://. */

export type Vista = 'mosaico' | 'mapa' | 'lista';

/** Las tres formas de ver los mismos portales. El orden es el de las pestañas. */
export const VISTAS: readonly Vista[] = ['mosaico', 'mapa', 'lista'];

/** Clave exacta del prototipo: cambiarla pierde la preferencia ya guardada. */
export const CLAVE_VISTA = 'mosaico-editorial-vista';

export interface Pedido {
  q: string;
  tema: string;
  vista: Vista;
}

const esVista = (v: string | null): v is Vista => !!v && (VISTAS as readonly string[]).includes(v);

/** Lee ?q= y ?tema= de la URL. */
export function leerURL(): { q: string; tema: string } {
  try {
    const p = new URLSearchParams(location.search);
    return { q: p.get('q') ?? '', tema: p.get('tema') ?? '' };
  } catch {
    return { q: '', tema: '' };
  }
}

/** Escribe ?q= y ?tema= sin recargar ni llenar el historial. */
export function escribirURL(pedido: { q?: string; tema?: string } = {}): void {
  const q = pedido.q ?? '';
  const tema = pedido.tema ?? '';
  try {
    const p = new URLSearchParams(location.search);
    if (q) p.set('q', q);
    else p.delete('q');
    if (tema) p.set('tema', tema);
    else p.delete('tema');
    const s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  } catch {
    /* sin permiso para tocar el historial; no es crítico */
  }
}

/** La vista sale de ?vista= si es una de las tres; si no de localStorage; si no, mosaico. */
export function leerPedido(): Pedido {
  const { q, tema } = leerURL();
  let vista: Vista = 'mosaico';
  let enURL: string | null = null;
  try {
    enURL = new URLSearchParams(location.search).get('vista');
  } catch {
    enURL = null;
  }
  if (esVista(enURL)) {
    vista = enURL;
  } else {
    try {
      const guardada = localStorage.getItem(CLAVE_VISTA);
      vista = esVista(guardada) ? guardada : 'mosaico';
    } catch {
      vista = 'mosaico';
    }
  }
  return { q, tema, vista };
}

/** El trim se aplica SOLO al escribir la URL, nunca al estado que pinta la vista. */
export function escribirPedido(p: Pedido): void {
  escribirURL({ q: p.q.trim(), tema: p.tema });
  try {
    const par = new URLSearchParams(location.search);
    const quiere = p.vista === 'mosaico' ? null : p.vista;
    // Si ya vale lo que se quiere, sale sin tocar el historial.
    if (par.get('vista') === quiere) return;
    if (quiere) par.set('vista', quiere);
    else par.delete('vista');
    const s = par.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  } catch {
    /* sin permiso para tocar el historial */
  }
}

export function recordarVista(v: Vista): void {
  try {
    localStorage.setItem(CLAVE_VISTA, v);
  } catch {
    /* sin almacenamiento */
  }
}
