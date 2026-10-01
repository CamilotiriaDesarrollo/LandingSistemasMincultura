/* Texto: normalización, dominios y resaltado. Funciones puras, sin DOM y sin Angular.
   Portado de propuestas/_recursos/nucleo.js. Nucleo.escapar no se porta: en Angular la
   interpolación y los bindings escapan solos. */

/** Quita tildes y pasa a minúsculas. Misma regla del original. */
export function normalizar(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Dominio sin www: señal de confianza para la persona que va a salir del sitio. */
export function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** true si el dominio es del Estado colombiano. */
export function esGovCo(url: string): boolean {
  return /\.gov\.co$/.test(dominio(url));
}

/** Un fragmento de texto y si va dentro de <mark>. */
export interface Trozo {
  texto: string;
  marca: boolean;
}

/**
 * Parte el texto en 1 o 3 trozos según la PRIMERA coincidencia de la búsqueda.
 * El normalize('NFC') no es adorno: normalizar() hace NFD y borra las marcas, así que
 * un carácter precompuesto ocupa una sola posición en los dos textos y los índices
 * quedan alineados. Sin el NFC el resaltado se corre un carácter en todo lo acentuado.
 */
export function resaltar(texto: string, q: string): Trozo[] {
  const original = String(texto).normalize('NFC');
  const nq = normalizar(String(q).trim());
  if (!nq) return [{ texto: original, marca: false }];
  const i = normalizar(original).indexOf(nq);
  if (i < 0) return [{ texto: original, marca: false }];
  return [
    { texto: original.slice(0, i), marca: false },
    { texto: original.slice(i, i + nq.length), marca: true },
    { texto: original.slice(i + nq.length), marca: false },
  ];
}

/** El dominio se parte solo después de un punto: la plantilla intercala <wbr>. */
export function partirDominio(d: string): string[] {
  return d.split('.');
}

export function plural(n: number, uno: string, varios: string): string {
  return n + ' ' + (n === 1 ? uno : varios);
}
