/* =====================================================================
   DISPOSICIÓN DEL MOSAICO. Funciones puras: sin DOM, sin Angular, sin signals.
   Portado del bloque 2 de propuestas/propuesta-c-unificada.html.

   Etapa 1, la del concepto: ordena los temas de mayor a menor, prueba todas las
   formas de partirlos en franjas seguidas de 5 columnas y reparte las columnas en
   proporción (mayor residuo). Sirve si deja 2 casillas de cierre o menos.
   Etapa 2, para cuando cambian los datos: la última franja puede quedar más corta
   que las 5 columnas y, si la última fila de un bloque queda incompleta, sus
   casillas se ensanchan para cubrirla (como en móvil). El cierre sigue con el tope
   de 2 y el ensanche total con un tope de 1 casilla por cada 10 portales (mínimo 2).
   Solo corre con 2 temas o más y 10 portales o más a la vista.
   Si ninguna etapa cumple, el mosaico pasa al apilado.

   LAS DOS ETAPAS SE NECESITAN: con los 25 portales del API gana la etapa 1 y sale
   un 5 por 5 exacto; con los 27 de la propuesta la etapa 1 deja cierre 3, pasa de
   MAX_CIERRE y gana la etapa 2, que sale 5 por 6. La etapa 2 no es código muerto.
   ===================================================================== */

export const COLUMNAS = 5;
export const MAX_CIERRE = 2;

/** Cuántos portales muestra un tema: la entrada del algoritmo. */
export interface Conteo {
  id: string;
  n: number;
}

/** Conteo con su posición en los datos, para desempatar por el orden original. */
interface Item extends Conteo {
  i: number;
}

/** Una banda horizontal de temas. Solo la última puede ser más corta que las columnas. */
interface Franja {
  items: Item[];
  anchos: number[];
  alto: number;
  cierre: number;
  ensanche?: number;
  hueco?: number;
  desvio?: number;
  flexible?: boolean;
  clave?: number[];
}

/** Un tema colocado dentro de la grilla de franjas. */
export interface BloqueFranja {
  id: string;
  franja: number;
  columna: number;
  ancho: number;
  alto: number;
  filaCelda: number;
  n: number;
  /** Casillas que le faltan a la última fila del bloque: 0 si la fila está completa. */
  ensanche: number;
  /** Casillas del bloque que no son un portal y no se cubren ensanchando. */
  cierre: number;
}

export interface BloqueAbierto {
  id: string;
  abierto: true;
}

export interface BloqueLomo {
  id: string;
  lomo: true;
}

export interface BloqueSimple {
  id: string;
}

/* Unión discriminada por `modo` para que la plantilla no necesite `!` ni casts.
   El orden del arreglo `bloques` ES el orden visual: con @for y track b.id el orden
   del DOM sale gratis. */
export type Disposicion =
  | { modo: 'vacio'; columnas: number; cierre: 0; bloques: BloqueSimple[] }
  | { modo: 'abierto'; columnas: number; cierre: 0; bloques: (BloqueAbierto | BloqueLomo)[] }
  | { modo: 'apilado'; columnas: 1; cierre: 0; descartado: number; bloques: BloqueSimple[] }
  | {
      modo: 'franjas';
      columnas: number;
      cierre: number;
      ensanche: number;
      filas: number;
      bloques: BloqueFranja[];
    };

export interface OpcionesMosaico {
  columnas?: number;
  abierto?: string;
  apilar?: boolean;
  maxCierre?: number;
}

/**
 * Cuatro salidas en este orden: sin items, tema abierto, apilado forzado y franjas.
 * Los temas con 0 portales a la vista se descartan antes de repartir.
 */
export function calcularMosaico(
  conteos: readonly Conteo[],
  opciones: OpcionesMosaico = {},
): Disposicion {
  const columnas = opciones.columnas ?? COLUMNAS;
  const abierto = opciones.abierto ?? '';
  const apilar = opciones.apilar ?? false;
  const maxCierre = opciones.maxCierre ?? MAX_CIERRE;

  const items: Item[] = conteos
    .map((t, i) => ({ ...t, i }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i);
  if (!items.length) return { modo: 'vacio', columnas, cierre: 0, bloques: [] };

  if (abierto && items.some((t) => t.id === abierto)) {
    const lomos = items.filter((t) => t.id !== abierto);
    return {
      modo: 'abierto',
      columnas: Math.max(1, lomos.length),
      cierre: 0,
      bloques: [
        { id: abierto, abierto: true } as BloqueAbierto,
        ...lomos.map((t): BloqueLomo => ({ id: t.id, lomo: true })),
      ],
    };
  }

  const apilado = (cierre: number): Disposicion => ({
    modo: 'apilado',
    columnas: 1,
    cierre: 0,
    descartado: cierre,
    bloques: items.map((t) => ({ id: t.id })),
  });
  if (apilar) return apilado(0);

  const total = items.reduce((s, t) => s + t.n, 0);
  const maxEnsanche = Math.max(2, Math.round(total / 10));
  let mejor = particionExacta(items, columnas);
  if (!mejor || mejor.cierre > maxCierre) {
    /* Un solo tema o una búsqueda con pocos resultados no necesita comparar áreas:
       si no cuadra exacto, el apilado ancho la muestra mejor. */
    const flexible =
      items.length > 1 && total >= 2 * columnas ? particionFlexible(items, columnas) : null;
    if (!flexible || flexible.cierre > maxCierre || (flexible.ensanche ?? 0) > maxEnsanche) {
      return apilado(mejor ? mejor.cierre : Infinity);
    }
    mejor = flexible;
  }

  const bloques: BloqueFranja[] = [];
  let filaCelda = 0;
  mejor.franjas.forEach((f, franja) => {
    let columna = 0;
    f.items.forEach((t, k) => {
      const ancho = f.anchos[k];
      const propias = Math.ceil(t.n / ancho);
      /* En la etapa 1 todo hueco es cierre; en la 2, la última fila se cubre ensanchando. */
      const ensanche = f.flexible ? ancho * propias - t.n : 0;
      bloques.push({
        id: t.id,
        franja,
        columna,
        ancho,
        alto: f.alto,
        filaCelda,
        n: t.n,
        ensanche,
        cierre: ancho * f.alto - t.n - ensanche,
      });
      columna += ancho;
    });
    filaCelda += f.alto;
  });
  return {
    modo: 'franjas',
    columnas,
    cierre: mejor.cierre,
    ensanche: mejor.ensanche ?? 0,
    filas: filaCelda,
    bloques,
  };
}

/**
 * Cuántas columnas ocupa cada casilla de la última fila de un bloque cuando hay
 * ensanche. Las más anchas quedan al final, como la casilla ancha de móvil.
 *
 * SOLO es válida cuando la última fila del bloque está INCOMPLETA: con (7, 3), que es
 * fila completa, devuelve [3] y colapsaría la fila entera en una casilla. Sus llamadas
 * van guardadas por b.ensanche, que vale 0 exactamente cuando la fila está completa.
 */
export function anchosUltimaFila(n: number, ancho: number): number[] {
  const r = n - ancho * (Math.ceil(n / ancho) - 1);
  const base = Math.floor(ancho / r);
  const extra = ancho % r;
  return Array.from({ length: r }, (_, i) => base + (i >= r - extra ? 1 : 0));
}

/**
 * Dónde cae cada una de las `cuantos` casillas de un bloque, en base 0: la plantilla
 * suma 1 al escribir grid-column y grid-row. Reemplaza la cuenta que el prototipo
 * tenía duplicada en pintarMiniatura y en pintarTema.
 */
export function celdasDelBloque(
  b: BloqueFranja,
  cuantos: number,
): { col: number; fila: number; span: number }[] {
  // La guarda por b.ensanche es la que hace válida anchosUltimaFila. No se quita.
  const ultima = b.ensanche ? anchosUltimaFila(cuantos, b.ancho) : null;
  const inicioUltima = cuantos - (ultima ? ultima.length : 0);
  const celdas: { col: number; fila: number; span: number }[] = [];
  for (let i = 0; i < cuantos; i++) {
    let col = b.columna + (i % b.ancho);
    let span = 1;
    const fila = b.filaCelda + Math.floor(i / b.ancho);
    if (ultima && i >= inicioUltima) {
      const j = i - inicioUltima;
      col = b.columna + ultima.slice(0, j).reduce((s, a) => s + a, 0);
      span = ultima[j];
    }
    celdas.push({ col, fila, span });
  }
  return celdas;
}

/* ─────────── Privadas del módulo ─────────── */

/** Compara dos claves de preferencia posición por posición. */
function comparar(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Etapa 1: franjas completas de 5 columnas, reparto proporcional por mayor residuo. */
function repartirFranja(items: Item[], columnas: number): Franja | null {
  if (items.length > columnas) return null;
  const suma = items.reduce((s, t) => s + t.n, 0);
  const crudo = items.map((t) => (columnas * t.n) / suma);
  const anchos = crudo.map((c) => Math.max(1, Math.floor(c)));
  let libre = columnas - anchos.reduce((s, a) => s + a, 0);
  while (libre < 0) {
    anchos[anchos.indexOf(Math.max(...anchos))]--;
    libre++;
  }
  const resto = crudo.map((c, k) => c - anchos[k]);
  while (libre > 0) {
    const k = resto.indexOf(Math.max(...resto));
    anchos[k]++;
    resto[k]--;
    libre--;
  }
  // Math.max sobre arreglo vacío daría -Infinity; no ocurre porque items nunca viene vacío
  // (calcularMosaico ya filtró los n = 0 y particionExacta siempre corta en tramos de 1 o más).
  const alto = Math.max(...items.map((t, k) => Math.ceil(t.n / anchos[k])));
  const cierre = items.reduce((s, t, k) => s + anchos[k] * alto - t.n, 0);
  return { items, anchos, alto, cierre };
}

/** Prueba todos los cortes seguidos de la lista ordenada y se queda con el de menos cierre. */
function particionExacta(
  items: Item[],
  columnas: number,
): { franjas: Franja[]; cierre: number; ensanche?: number } | null {
  const k = items.length;
  if (k > 12) return null; // 2^(k-1) cortes: por encima de 12 temas deja de ser instantáneo
  let mejor: { franjas: Franja[]; cierre: number } | null = null;
  for (let cortes = 0; cortes < 1 << (k - 1); cortes++) {
    const franjas: Franja[] = [];
    let inicio = 0;
    let valida = true;
    for (let j = 0; j < k && valida; j++) {
      if (j < k - 1 && !(cortes & (1 << j))) continue;
      const f = repartirFranja(items.slice(inicio, j + 1), columnas);
      if (!f) valida = false;
      else {
        franjas.push(f);
        inicio = j + 1;
      }
    }
    if (!valida) continue;
    const cierre = franjas.reduce((s, f) => s + f.cierre, 0);
    if (
      !mejor ||
      cierre < mejor.cierre ||
      (cierre === mejor.cierre && franjas.length < mejor.franjas.length)
    ) {
      mejor = { franjas, cierre };
    }
  }
  return mejor;
}

/** Etapa 2. Todas las formas de repartir los anchos de una franja (composiciones). */
function composiciones(total: number, partes: number): number[][] {
  if (partes === 1) return total >= 1 ? [[total]] : [];
  const salida: number[][] = [];
  for (let a = 1; a <= total - partes + 1; a++) {
    for (const resto of composiciones(total - a, partes - 1)) salida.push([a, ...resto]);
  }
  return salida;
}

/**
 * Mejor franja para un grupo de temas. Solo la última puede ser más corta que las columnas.
 *
 * Las dos reglas de forma son decisiones de diseño, no de cálculo, y son lo que impide
 * que salgan bloques de 1 columna por 4 filas:
 *   1. Sin torres: se descarta el bloque cuyo alto pase del doble de su ancho.
 *   2. La última fila de cada bloque ocupa al menos un tercio del ancho del bloque.
 */
function franjaFlexible(items: Item[], columnas: number, esUltima: boolean): Franja | null {
  if (items.length > columnas) return null;
  const suma = items.reduce((s, t) => s + t.n, 0);
  let mejor: Franja | null = null;
  for (let W = columnas; W >= (esUltima ? items.length : columnas); W--) {
    for (const anchos of composiciones(W, items.length)) {
      const propias = items.map((t, k) => Math.ceil(t.n / anchos[k]));
      const alto = Math.max(...propias);
      if (items.some((t, k) => alto > 2 * anchos[k])) continue;
      if (items.some((t, k) => (t.n - anchos[k] * (propias[k] - 1)) * 3 < anchos[k])) continue;
      const cierre = items.reduce((s, t, k) => s + anchos[k] * (alto - propias[k]), 0);
      const ensanche = items.reduce((s, t, k) => s + anchos[k] * propias[k] - t.n, 0);
      const hueco = (columnas - W) * alto;
      const desvio = items.reduce((s, t, k) => s + Math.abs(anchos[k] - (W * t.n) / suma), 0);
      const f: Franja = {
        items,
        anchos,
        alto,
        cierre,
        ensanche,
        hueco,
        desvio,
        flexible: true,
        clave: [cierre + ensanche, cierre, hueco, desvio],
      };
      if (!mejor || comparar(f.clave!, mejor.clave!) < 0) mejor = f;
    }
  }
  return mejor;
}

/** Todas las formas de agrupar los temas (particiones del conjunto). */
function agrupaciones(items: readonly Item[]): Item[][][] {
  if (!items.length) return [[]];
  const [primero, ...resto] = items;
  const salida: Item[][][] = [];
  for (const p of agrupaciones(resto)) {
    salida.push([[primero], ...p]);
    p.forEach((_, i) => salida.push(p.map((g, j) => (j === i ? [primero, ...g] : g))));
  }
  return salida;
}

/**
 * Prefiere, en este orden: menos casillas que no son un portal (cierre más ensanche),
 * menos cierre, menos espacio libre al final, el orden de mayor a menor, menos franjas
 * y anchos proporcionales.
 *
 * Es exponencial (número de Bell por composiciones): devuelve null con más de 8 temas.
 * Medido en node: 5 temas menos de 1 ms, 7 temas 5 ms, 8 temas 17 ms.
 */
function particionFlexible(
  items: Item[],
  columnas: number,
): { franjas: Franja[]; cierre: number; ensanche: number; clave: number[] } | null {
  if (items.length > 8) return null;
  let mejor: { franjas: Franja[]; cierre: number; ensanche: number; clave: number[] } | null = null;
  for (const grupos of agrupaciones(items)) {
    const franjasPedidas = grupos
      .map((g) => g.slice().sort((a, b) => b.n - a.n || a.i - b.i))
      .sort((a, b) => b[0].n - a[0].n || a[0].i - b[0].i);
    const franjas: Franja[] = [];
    let valida = true;
    for (let j = 0; j < franjasPedidas.length && valida; j++) {
      const f = franjaFlexible(franjasPedidas[j], columnas, j === franjasPedidas.length - 1);
      if (f) franjas.push(f);
      else valida = false;
    }
    if (!valida) continue;
    const suma = (dato: 'cierre' | 'ensanche' | 'desvio'): number =>
      franjas.reduce((s, f) => s + (f[dato] ?? 0), 0);
    /* Pares fuera del orden de mayor a menor (con empate, el orden de los datos). */
    const orden = franjas.flatMap((f) => f.items);
    let desorden = 0;
    for (let x = 0; x < orden.length; x++) {
      for (let y = x + 1; y < orden.length; y++) {
        if (orden[x].n < orden[y].n || (orden[x].n === orden[y].n && orden[x].i > orden[y].i)) {
          desorden++;
        }
      }
    }
    const clave = [
      suma('cierre') + suma('ensanche'),
      suma('cierre'),
      franjas[franjas.length - 1].hueco ?? 0,
      desorden,
      franjas.length,
      suma('desvio'),
    ];
    if (!mejor || comparar(clave, mejor.clave) < 0) {
      mejor = { franjas, cierre: suma('cierre'), ensanche: suma('ensanche'), clave };
    }
  }
  return mejor;
}
