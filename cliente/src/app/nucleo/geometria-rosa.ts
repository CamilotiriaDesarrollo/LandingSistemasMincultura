/* =====================================================================
   GEOMETRÍA DE LA ROSA DE LOS SABERES (vista mapa).
   Portado de propuestas/_herramientas/unificada/mapa.js. Cero DOM, cero Angular,
   cero signals: se prueba con un arreglo a mano.

   Las coordenadas son las del SVG. Filas y cabeceras tienen alto fijo, así que el
   A− y el A+ (body.style.zoom) escalan todo junto sin recalcular nada.
   ===================================================================== */

export type Par = readonly [number, number];
export type Lado = 'izq' | 'der';

export interface ConfRosa {
  ancho: number;
  rCentro: number;
  rIn: number;
  rOut: number;
  rPunto: number;
  orbitas: readonly number[];
  hueco: number;
  izq: readonly [number, number];
  der: readonly [number, number];
  cab: number;
  sep: number;
  fila: number;
  filaApretada: number;
  altoMin: number;
}

/** Medidas de la rosa. Es la única constante numérica del mapa. */
export const CONF: ConfRosa = {
  ancho: 440,
  rCentro: 100,
  rIn: 112,
  rOut: 136,
  rPunto: 158,
  orbitas: [182, 197],
  hueco: 6,
  izq: [330, 210],
  der: [30, 150],
  cab: 36,
  sep: 12,
  fila: 32,
  filaApretada: 28,
  altoMin: 420,
};

/* Temas pares en tono sólido, impares en lavanda con borde: se distinguen por patrón
   y por número, no solo por color. */
export const SOLIDOS: readonly string[] = ['#4938c9', '#3f33b5', '#2e286e'];

export function estiloTema(j: number): { clase: 'solido' | 'claro'; color: string } {
  return j % 2 === 0
    ? { clase: 'solido', color: SOLIDOS[(j / 2) % SOLIDOS.length] }
    : { clase: 'claro', color: '#dcd8fb' };
}

export const f1 = (n: number): number => Math.round(n * 10) / 10;

export const pt = (p: Par): string => f1(p[0]) + ' ' + f1(p[1]);

/** Ángulo de reloj: 0 arriba, crece en el sentido de las agujas. */
export const polar = (cx: number, cy: number, r: number, a: number): Par => {
  const t = (a * Math.PI) / 180;
  return [cx + r * Math.sin(t), cy - r * Math.cos(t)];
};

/** Vector unitario del ángulo, para --ux y --uy. */
export const unidad = (a: number): Par => {
  const t = (a * Math.PI) / 180;
  return [f1(Math.sin(t) * 100) / 100, f1(-Math.cos(t) * 100) / 100];
};

/** Sector de anillo entre dos radios y dos ángulos. */
export function arcoPath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  a0: number,
  a1: number,
): string {
  const s = Math.min(a0, a1);
  const e = Math.max(a0, a1);
  const g = e - s > 180 ? 1 : 0;
  return (
    `M${pt(polar(cx, cy, r2, s))} A${r2} ${r2} 0 ${g} 1 ${pt(polar(cx, cy, r2, e))} ` +
    `L${pt(polar(cx, cy, r1, e))} A${r1} ${r1} 0 ${g} 0 ${pt(polar(cx, cy, r1, s))}Z`
  );
}

/* Entradas mínimas del cálculo. Reciben el índice global del portal y si es favorito,
   que es lo que el prototipo sacaba del cierre (idx y p.favorito): así la geometría
   queda pura de verdad y se puede probar con un arreglo a mano. */
export interface PortalGeo {
  /** Índice global del portal: su lugar en el arreglo de portales del API. */
  i: number;
  fav: boolean;
}

export interface TemaGeo {
  id: string;
  numero: string;
  total: number;
  portales: readonly PortalGeo[];
}

/**
 * Cuántos temas van a la columna izquierda, sin partir ninguno: la suma de portales
 * de los dos lados queda lo más pareja posible. Con un solo tema devuelve 1.
 */
export function dividirLados(temas: readonly TemaGeo[]): number {
  const total = temas.reduce((s, t) => s + t.total, 0);
  let mejor = 1;
  let dif = Infinity;
  let izq = 0;
  for (let k = 1; k < temas.length; k++) {
    izq += temas[k - 1].total;
    const d = Math.abs(total - 2 * izq);
    if (d < dif) {
      dif = d;
      mejor = k;
    }
  }
  return mejor;
}

export interface ArcoBruto {
  id: string;
  j: number;
  numero: string;
  lado: Lado;
  a0: number;
  a1: number;
  medio: number;
}

export interface PuntoBruto {
  i: number;
  fav: boolean;
  tema: string;
  lado: Lado;
  ang: number;
}

/**
 * Reparte los arcos y los puntos en los dos lados del anillo, en proporción a sus
 * portales. peso(t) = max(1, total): un tema vacío igual ocupa tajada. gpp es el mínimo
 * de los dos lados, para que los dos usen la misma escala de grados por portal.
 */
export function repartirAngulos(
  temas: readonly TemaGeo[],
  c: ConfRosa,
): { k: number; arcos: ArcoBruto[]; puntos: PuntoBruto[] } {
  const k = dividirLados(temas);
  const peso = (t: TemaGeo): number => Math.max(1, t.total);
  const ambos: { lado: Lado; temas: readonly TemaGeo[]; desde: number; hasta: number }[] = [
    { lado: 'izq', temas: temas.slice(0, k), desde: c.izq[0], hasta: c.izq[1] },
    { lado: 'der', temas: temas.slice(k), desde: c.der[0], hasta: c.der[1] },
  ];
  // Un lado sin temas no entra en el reparto: con un solo tema solo hay columna izquierda.
  const lados = ambos.filter((l) => l.temas.length);
  const gpp = Math.min(
    ...lados.map(
      (l) =>
        (Math.abs(l.hasta - l.desde) - (l.temas.length - 1) * c.hueco) /
        l.temas.reduce((s, t) => s + peso(t), 0),
    ),
  );
  const arcos: ArcoBruto[] = [];
  const puntos: PuntoBruto[] = [];
  lados.forEach((l) => {
    const dir = Math.sign(l.hasta - l.desde);
    const ocupado =
      l.temas.reduce((s, t) => s + peso(t), 0) * gpp + (l.temas.length - 1) * c.hueco;
    let a = l.desde + (dir * (Math.abs(l.hasta - l.desde) - ocupado)) / 2;
    l.temas.forEach((t) => {
      const a0 = a;
      const a1 = a + dir * peso(t) * gpp;
      arcos.push({
        id: t.id,
        j: temas.indexOf(t),
        numero: t.numero,
        lado: l.lado,
        a0,
        a1,
        medio: (a0 + a1) / 2,
      });
      // El punto queda en el centro de su tajada.
      t.portales.forEach((p, n) =>
        puntos.push({ i: p.i, fav: p.fav, tema: t.id, lado: l.lado, ang: a0 + dir * (n + 0.5) * gpp }),
      );
      a = a1 + dir * c.hueco;
    });
  });
  return { k, arcos, puntos };
}

export interface Arco extends ArcoBruto {
  /** Vector unitario del ángulo medio: --ux y --uy del arco. */
  u: Par;
  d: string;
  num: Par;
}

export interface Punto extends PuntoBruto {
  punto: Par;
  filaY: number;
  d: string;
}

export interface Columna {
  lado: Lado;
  temas: string[];
  offset: number;
}

export interface Geo {
  conf: ConfRosa;
  fila: number;
  alto: number;
  cx: number;
  cy: number;
  /** SIEMPRE dos entradas; la segunda puede quedar vacía. */
  columnas: Columna[];
  arcos: Arco[];
  puntos: Punto[];
}

/**
 * Geometría completa del mapa: columnas, filas, arcos, puntos y líneas guía.
 * La línea guía arranca en rCentro + 3, pasa recta por el punto del anillo y sigue en
 * curva cúbica hasta x = 0 (izquierda) o x = ancho (derecha), a la altura de su fila.
 */
export function calcularGeometria(temas: readonly TemaGeo[], c: ConfRosa = CONF): Geo {
  const { k, arcos, puntos } = repartirAngulos(temas, c);
  const cols: readonly TemaGeo[][] = [temas.slice(0, k), temas.slice(k)];
  const filas = (ts: readonly TemaGeo[]): number => ts.reduce((s, t) => s + t.total, 0);
  const fila = Math.max(...cols.map(filas)) > 18 ? c.filaApretada : c.fila;
  const altoCol = (ts: readonly TemaGeo[]): number =>
    ts.length ? ts.length * c.cab + (ts.length - 1) * c.sep + filas(ts) * fila : 0;
  const alto = Math.max(c.altoMin, ...cols.map(altoCol));
  const cx = c.ancho / 2;
  const cy = alto / 2;
  const filaY = new Map<number, number>();
  const columnas: Columna[] = cols.map((ts, n) => {
    const offset = (alto - altoCol(ts)) / 2;
    let y = offset;
    ts.forEach((t, j) => {
      if (j) y += c.sep;
      y += c.cab;
      t.portales.forEach((p) => {
        filaY.set(p.i, y + fila / 2);
        y += fila;
      });
    });
    return { lado: n ? 'der' : 'izq', temas: ts.map((t) => t.id), offset };
  });
  return {
    conf: c,
    fila,
    alto,
    cx,
    cy,
    columnas,
    arcos: arcos.map((a) => ({
      ...a,
      u: unidad(a.medio),
      d: arcoPath(cx, cy, c.rIn, c.rOut, a.a0, a.a1),
      num: polar(cx, cy, (c.rIn + c.rOut) / 2, a.medio),
    })),
    puntos: puntos.map((p) => {
      const ini = polar(cx, cy, c.rCentro + 3, p.ang);
      const punto = polar(cx, cy, c.rPunto, p.ang);
      // Las dos columnas cubren todos los temas, así que filaY siempre tiene el punto.
      const fin: Par = [p.lado === 'izq' ? 0 : c.ancho, filaY.get(p.i) ?? cy];
      const dx = Math.abs(fin[0] - punto[0]);
      const [ux, uy] = unidad(p.ang);
      const c1: Par = [punto[0] + ux * dx * 0.45, punto[1] + uy * dx * 0.45];
      const c2: Par = [fin[0] + (p.lado === 'izq' ? 1 : -1) * dx * 0.45, fin[1]];
      return { ...p, punto, filaY: fin[1], d: `M${pt(ini)} L${pt(punto)} C${pt(c1)} ${pt(c2)} ${pt(fin)}` };
    }),
  };
}

/** Lo que el mapa señala. Teclado y puntero van por separado y manda el teclado. */
export type Foco = { tipo: 'portal'; i: number } | { tipo: 'tema'; id: string };

/**
 * Sigue haciendo falta con signals: no para evitar repintados, que los computed ya
 * comparan, sino para no relanzar el haz ni girar las órbitas cuando el puntero se
 * mueve dentro de la misma fila.
 */
export const mismoFoco = (a: Foco | null, b: Foco | null): boolean => {
  if (!a && !b) return true;
  if (!a || !b || a.tipo !== b.tipo) return false;
  if (a.tipo === 'portal' && b.tipo === 'portal') return a.i === b.i;
  if (a.tipo === 'tema' && b.tipo === 'tema') return a.id === b.id;
  return false;
};
