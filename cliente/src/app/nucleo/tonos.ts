/* Parejas de fondo y tinta permitidas. Un solo archivo, o salen dos verdades: lo usan
   las cifras, el mosaico, la lista, el índice, la miniatura y los favoritos.
   Portado de propuesta-c-unificada.html. */

import { Categoria } from '../modelos/directorio';

export interface Tono {
  fondo: string;
  tinta: string;
}

/** Se asignan por el ORDEN de las categorías del API, nunca por id escrito a mano. */
export const TONOS: readonly Tono[] = [
  { fondo: '#e6e0ff', tinta: '#3f33b5' },
  { fondo: '#eee2fb', tinta: '#612cb0' },
  { fondo: '#dcd8fb', tinta: '#4934ae' },
  { fondo: '#ece7ff', tinta: '#4938c9' },
  { fondo: '#f9f7ff', tinta: 'var(--deep)' },
];

/** Parejas de los favoritos del 02 en adelante. Las dos primeras son las del original. */
export const TONOS_FAV: readonly Tono[] = [
  { fondo: '#eee2fb', tinta: '#612cb0' },
  { fondo: '#e6e0ff', tinta: '#3f33b5' },
  { fondo: '#dcd8fb', tinta: '#4934ae' },
  { fondo: '#ece7ff', tinta: '#4938c9' },
];

/** Un id que no está en las categorías cae en el primer tono, como en el prototipo. */
export function tonoDe(categorias: readonly Categoria[], id: string): Tono {
  const i = categorias.findIndex((c) => c.id === id);
  return TONOS[Math.max(0, i) % TONOS.length];
}

/**
 * El favorito 01 no usa tono: es la tarjeta grande y lleva el fondo del bento.
 * El prototipo indexa TONOS_FAV[(i - 1) % 4], que para i = 0 da -1 y en JS es undefined;
 * aquí se devuelve null explícitamente.
 */
export function tonoFavorito(i: number): Tono | null {
  if (i === 0) return null;
  return TONOS_FAV[(i - 1) % TONOS_FAV.length];
}
