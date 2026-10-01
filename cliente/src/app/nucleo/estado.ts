/* Estado del directorio: todo lo que una vista necesita a partir de los datos y la
   búsqueda. Funciones puras, sin DOM y sin Angular: se prueban con node.
   Portado de propuestas/_recursos/nucleo.js y del bloque 1 de propuesta-c-unificada.html. */

import { Categoria, Directorio, Portal } from '../modelos/directorio';
import { EstadoDirectorio, PortalEnriquecido, TemaEnriquecido } from '../modelos/estado';
import type { Conteo } from './mosaico';
import { dominio, esGovCo, normalizar, plural } from './texto';

/** Lo que la persona eligió: el texto crudo del campo y el tema abierto. */
export interface Pregunta {
  q?: string;
  tema?: string;
}

/**
 * Calcula todo lo que una vista necesita a partir de los datos y la búsqueda.
 * La coincidencia se busca contra el nombre, la descripción y el NOMBRE DEL TEMA,
 * para que escribir «patrimonio» traiga los portales de ese tema.
 */
export function calcularEstado(d: Directorio, pedido: Pregunta = {}): EstadoDirectorio {
  const q = pedido.q ?? '';
  const tema = pedido.tema ?? '';
  const nq = normalizar(q.trim());
  const temaDe = (id: string): Categoria | undefined => d.categories.find((c) => c.id === id);
  const coincide = (p: Portal): boolean =>
    !nq || normalizar([p.name, p.desc, temaDe(p.category)?.name ?? ''].join(' ')).includes(nq);
  const enriquecer = (p: Portal): PortalEnriquecido => ({
    ...p,
    coincide: coincide(p),
    dominio: dominio(p.url),
    govco: esGovCo(p.url),
    favorito: d.favorites.includes(p.name),
    tema: temaDe(p.category),
  });

  const temas: TemaEnriquecido[] = d.categories.map((c, i) => {
    const portales = d.portals.filter((p) => p.category === c.id).map(enriquecer);
    return {
      ...c,
      numero: String(i + 1).padStart(2, '0'),
      total: portales.length,
      portales,
      coincidencias: portales.filter((p) => p.coincide).length,
    };
  });

  return {
    consulta: q,
    hayConsulta: !!nq,
    total: d.portals.length,
    temas,
    resultados: d.portals.map(enriquecer).filter((p) => p.coincide),
    // Los favoritos se mapean por NOMBRE y no se filtran por la búsqueda, a propósito:
    // el bento de la portada es fijo y no depende de lo que se esté buscando.
    favoritos: d.favorites
      .map((n) => d.portals.find((p) => p.name === n))
      .filter((p): p is Portal => !!p)
      .map(enriquecer),
    temaActivo: d.categories.some((c) => c.id === tema) ? tema : '',
  };
}

/**
 * El estado del núcleo más una regla propia: si el tema abierto se queda sin resultados,
 * se cierra y se devuelve el aviso para que quien llama lo anuncie en ese momento.
 */
export function resolverEstado(
  d: Directorio,
  pedido: Pregunta = {},
): { e: EstadoDirectorio; aviso: string } {
  let e = calcularEstado(d, pedido);
  let aviso = '';
  if (e.temaActivo && e.hayConsulta) {
    const t = e.temas.find((x) => x.id === e.temaActivo);
    if (t && !t.coincidencias) {
      aviso = `${t.name} no tiene portales con «${e.consulta.trim()}». Volvimos al mosaico.`;
      e = calcularEstado(d, { q: pedido.q, tema: '' });
    }
  }
  return { e, aviso };
}

/* Palabras demasiado comunes para servir de sugerencia. */
const VACIAS: ReadonlySet<string> = new Set([
  'para',
  'entre',
  'sobre',
  'desde',
  'hacia',
  'sector',
  'cultural',
  'culturales',
  'cultura',
  'colombia',
  'nacional',
  'portal',
  'portales',
]);

/**
 * Palabras que sí producen resultados, sacadas de los datos. Se usan cuando una
 * búsqueda no encuentra nada, en vez de escribir sugerencias a mano.
 */
export function sugerencias(d: Directorio, cuantas = 4): string[] {
  const conteo = new Map<string, number>();
  const forma = new Map<string, string>(); // palabra normalizada -> cómo se escribe, con tildes
  for (const p of d.portals) {
    const texto = [p.name, p.desc].join(' ').normalize('NFC').toLowerCase();
    const vistas = new Set<string>();
    for (const w of texto.match(/[a-záéíóúüñ]{5,}/g) ?? []) {
      const n = normalizar(w);
      if (VACIAS.has(n) || vistas.has(n)) continue;
      vistas.add(n);
      conteo.set(n, (conteo.get(n) ?? 0) + 1);
      if (!forma.has(n)) forma.set(n, w);
    }
  }
  return [...conteo.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cuantas)
    .map(([n]) => forma.get(n) ?? n);
}

/** Cuántos portales muestra un tema en este momento. */
export function cuenta(e: EstadoDirectorio, t: TemaEnriquecido): number {
  return e.hayConsulta ? t.coincidencias : t.total;
}

/** Conteos de TODOS los temas, en el orden de los datos: la entrada del mosaico. */
export function conteosDe(e: EstadoDirectorio): Conteo[] {
  return e.temas.map((t) => ({ id: t.id, n: cuenta(e, t) }));
}

/** Los temas de mayor a menor; con empate, el orden de los datos. */
export function temasEnOrden(e: EstadoDirectorio): TemaEnriquecido[] {
  return e.temas
    .map((t, i) => ({ t, i }))
    .sort((a, b) => cuenta(e, b.t) - cuenta(e, a.t) || a.i - b.i)
    .map((x) => x.t);
}

/** El texto del conteo. M cuenta los temas con coincidencias, no los temas totales. */
export function textoConteo(e: EstadoDirectorio): string {
  const n = e.resultados.length;
  const temas = e.temas.filter((t) => t.coincidencias).length;
  if (!n) return `Ningún portal coincide con «${e.consulta.trim()}»`;
  const base = `${plural(n, 'portal', 'portales')} en ${plural(temas, 'tema', 'temas')}`;
  return e.hayConsulta ? `${base} para «${e.consulta.trim()}»` : base;
}

/**
 * Clave estable por portal: 'name|url' -> kebab del nombre normalizado. Sirve de track
 * de todos los @for y de base de los ids del documento. El sufijo -2, -3 para nombres
 * repetidos no se activa hoy porque DirectorioService ya los rechaza; se conserva igual.
 */
export function clavesDe(portales: readonly Portal[]): Map<string, string> {
  const claves = new Map<string, string>();
  const usadas = new Set<string>();
  for (const p of portales) {
    const base =
      normalizar(p.name)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'portal';
    let k = base;
    let i = 2;
    while (usadas.has(k)) k = base + '-' + i++;
    usadas.add(k);
    claves.set(p.name + '|' + p.url, k);
  }
  return claves;
}
