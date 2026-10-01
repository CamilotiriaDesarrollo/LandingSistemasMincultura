/** Tema bajo el que se agrupan los portales. */
export interface Categoria {
  id: string;
  name: string;
  /** Nombre corto, usado en las pestañas de móvil. */
  short: string;
  desc: string;
  color: string;
}

/** Portal o sistema de información enlazado desde la landing. */
export interface Portal {
  name: string;
  desc: string;
  url: string;
  /** Id de la categoría a la que pertenece. */
  category: string;
}

/** Respuesta de GET /api/sistemas. */
export interface Directorio {
  categories: Categoria[];
  portals: Portal[];
  /** Nombres de los portales destacados en el carrusel, en orden. */
  favorites: string[];
}
