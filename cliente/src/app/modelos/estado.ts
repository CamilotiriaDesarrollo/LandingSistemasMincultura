import { Categoria, Directorio, Portal } from './directorio';

/** Portal con lo que la vista necesita y el API no manda: se calcula, no se guarda. */
export interface PortalEnriquecido extends Portal {
  /** true si el portal pasa la búsqueda actual. Sin búsqueda, todos coinciden. */
  coincide: boolean;
  dominio: string;
  govco: boolean;
  favorito: boolean;
  tema?: Categoria;
}

/** Tema con sus portales ya enriquecidos y sus dos conteos. */
export interface TemaEnriquecido extends Categoria {
  /** '01'..'05': la posición en categories a dos dígitos. */
  numero: string;
  total: number;
  portales: PortalEnriquecido[];
  coincidencias: number;
}

/** Todo lo que una vista necesita para pintarse, sin tocar el DOM. */
export interface EstadoDirectorio {
  /** El texto crudo del campo, sin trim: el trim solo se aplica al escribir la URL. */
  consulta: string;
  /** Una consulta de solo espacios cuenta como sin consulta. */
  hayConsulta: boolean;
  total: number;
  temas: TemaEnriquecido[];
  resultados: PortalEnriquecido[];
  favoritos: PortalEnriquecido[];
  temaActivo: string;
}

/** Sustituto del directorio mientras el API responde: evita ramas de null en cada derivado. */
export const DIRECTORIO_VACIO: Directorio = { categories: [], portals: [], favorites: [] };
