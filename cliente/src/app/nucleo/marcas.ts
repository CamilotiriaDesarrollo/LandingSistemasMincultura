/* Índice de marcas de agua de las tarjetas. NO EDITAR A MANO: es la transcripción de
   propuestas/_recursos/logos.js, que genera _herramientas/marcas.py junto con las
   imágenes. Las imágenes viven en cliente/public/marcas/ y angular.json las sirve
   desde la raíz, así que BASE es siempre '/marcas/'.

   archivo, ancho y alto son la máscara ya recortada; maxAncho es hasta dónde se deja
   ampliar; opacidad y desenfoque, cómo se pinta; cobertura es cuánto del recorte es
   tinta, y solo la usa la herramienta que genera el índice.

   LA CLAVE ES EL NOMBRE EXACTO DEL PORTAL, con tilde en Maguaré y mayúsculas en
   MaguaRED. Renombrar un portal en servidor/Datos/portales.json apaga su marca en
   silencio, y esa es la conducta querida: la marca es un dato de imagen, no un portal.
   No son portales escritos en el código: son metadatos de las imágenes. */

export interface Marca {
  archivo: string;
  ancho: number;
  alto: number;
  maxAncho: number;
  escala: number;
  opacidad: number;
  desenfoque: number;
  cobertura: number;
}

export const BASE = '/marcas/';

export const MARCAS: Readonly<Record<string, Marca>> = {
  'Museo Nacional de Colombia': {
    archivo: 'museo-nacional-de-colombia.png',
    ancho: 97,
    alto: 76,
    maxAncho: 194,
    escala: 1.13,
    opacidad: 0.3,
    desenfoque: 1.64,
    cobertura: 0.113,
  },
  'Museo Colonial y Santa Clara': {
    archivo: 'museo-colonial-y-santa-clara.png',
    ancho: 365,
    alto: 261,
    maxAncho: 730,
    escala: 1.183,
    opacidad: 0.3,
    desenfoque: 0.79,
    cobertura: 0.129,
  },
  'Archivo General de la Nación': {
    archivo: 'archivo-general-de-la-nacion-v2.png',
    ancho: 39,
    alto: 44,
    maxAncho: 148,
    escala: 0.941,
    opacidad: 0.3,
    desenfoque: 0.0,
    cobertura: 0.138,
  },
  ICANH: {
    archivo: 'icanh.png',
    ancho: 174,
    alto: 173,
    maxAncho: 348,
    escala: 1.003,
    opacidad: 0.3,
    desenfoque: 2.68,
    cobertura: 0.224,
  },
  'Gastroherencia Colombia': {
    archivo: 'gastroherencia-colombia.png',
    ancho: 107,
    alto: 107,
    maxAncho: 237,
    escala: 1.0,
    opacidad: 0.19,
    desenfoque: 0.22,
    cobertura: 0.448,
  },
  'Centro Nacional de las Artes': {
    archivo: 'centro-nacional-de-las-artes.png',
    ancho: 96,
    alto: 112,
    maxAncho: 325,
    escala: 0.926,
    opacidad: 0.131,
    desenfoque: 0.0,
    cobertura: 0.651,
  },
  CoCrea: {
    archivo: 'cocrea.png',
    ancho: 159,
    alto: 74,
    maxAncho: 473,
    escala: 1.35,
    opacidad: 0.162,
    desenfoque: 0.0,
    cobertura: 0.524,
  },
  'Artes para la Paz': {
    archivo: 'artes-para-la-paz-v2.png',
    ancho: 83,
    alto: 83,
    maxAncho: 257,
    escala: 1.0,
    opacidad: 0.3,
    desenfoque: 0.0,
    cobertura: 0.251,
  },
  'Concertación Cultural': {
    archivo: 'concertacion-cultural.png',
    ancho: 321,
    alto: 306,
    maxAncho: 1086,
    escala: 1.024,
    opacidad: 0.297,
    desenfoque: 0.0,
    cobertura: 0.286,
  },
  Estímulos: {
    archivo: 'estimulos.png',
    ancho: 320,
    alto: 348,
    maxAncho: 1068,
    escala: 0.959,
    opacidad: 0.278,
    desenfoque: 0.0,
    cobertura: 0.306,
  },
  'Biblioteca Nacional de Colombia': {
    archivo: 'biblioteca-nacional-de-colombia.png',
    ancho: 25,
    alto: 36,
    maxAncho: 90,
    escala: 0.833,
    opacidad: 0.21,
    desenfoque: 0.0,
    cobertura: 0.405,
  },
  'Instituto Caro y Cuervo': {
    archivo: 'instituto-caro-y-cuervo.png',
    ancho: 174,
    alto: 174,
    maxAncho: 348,
    escala: 1.0,
    opacidad: 0.262,
    desenfoque: 3.0,
    cobertura: 0.325,
  },
  Maguaré: {
    archivo: 'maguar.png',
    ancho: 180,
    alto: 172,
    maxAncho: 594,
    escala: 1.023,
    opacidad: 0.137,
    desenfoque: 0.0,
    cobertura: 0.619,
  },
  MaguaRED: {
    archivo: 'maguared.png',
    ancho: 512,
    alto: 252,
    maxAncho: 1460,
    escala: 1.35,
    opacidad: 0.3,
    desenfoque: 0.0,
    cobertura: 0.274,
  },
  PULEP: {
    archivo: 'pulep-v2.png',
    ancho: 105,
    alto: 110,
    maxAncho: 397,
    escala: 0.977,
    opacidad: 0.3,
    desenfoque: 0.0,
    cobertura: 0.281,
  },
};

/** Las cinco variables inline que el CSS de .p-marca espera y no declara. */
export function variablesDeMarca(m: Marca): Record<string, string> {
  return {
    '--prop': (m.ancho / m.alto).toFixed(4),
    '--esc': String(m.escala || 1),
    '--maxw': m.maxAncho + 'px',
    '--op': String(m.opacidad),
    '--tenue': (m.desenfoque || 0) + 'px',
  };
}
