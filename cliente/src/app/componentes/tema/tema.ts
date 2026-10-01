import { Component, computed, inject, input, output } from '@angular/core';
import { Marca } from '../../directivas/marca';
import { Numero } from '../../directivas/numero';
import { PortalEnriquecido, TemaEnriquecido } from '../../modelos/estado';
import {
  BloqueAbierto,
  BloqueFranja,
  BloqueLomo,
  BloqueSimple,
  COLUMNAS,
  Disposicion,
  anchosUltimaFila,
} from '../../nucleo/mosaico';
import { partirDominio, plural } from '../../nucleo/texto';
import { tonoDe } from '../../nucleo/tonos';
import { DirectorioStore } from '../../servicios/directorio.store';
import { Resaltado } from '../resaltado/resaltado';

type Bloque = BloqueFranja | BloqueAbierto | BloqueLomo | BloqueSimple;

/**
 * Un bloque de tema del mosaico: su cabecera y sus casillas.
 *
 * Selector de atributo porque el host ES el `.tema` y tiene que ser item directo de la
 * grilla del mosaico. Un selector de elemento metería una caja intermedia y morirían
 * .tema.abierto{grid-column:1 / -1} y los grid-template-columns de los tres data-modo.
 *
 * Las dos fases de la búsqueda se reparten así: el [hidden] de la casilla cuelga del
 * estado FIRME y la clase .apagada con inert del estado MARCADO. Es lo que evita que las
 * casillas aparezcan y desaparezcan mientras se escribe.
 */
@Component({
  selector: 'section[app-tema]',
  templateUrl: './tema.html',
  imports: [Numero, Marca, Resaltado],
  host: {
    class: 'tema',
    '[id]': "'tema-' + tema().id",
    '[attr.aria-labelledby]': "'h-' + tema().id",
    '[style.--fondo]': 'tono().fondo',
    '[style.--tinta]': 'tono().tinta',
    '[style.--vt]': "'tema-' + tema().id",
    '[style.--m]': 'varM()',
    '[style.--abiertas]': 'abiertas()',
    '[style.--ancho]': 'anchoEnGrilla()',
    '[style.grid-column]': 'columnaEnGrilla()',
    '[style.grid-row]': 'filaEnGrilla()',
    '[class.abierto]': 'esAbierto()',
    '[class.lomo]': 'esLomo()',
    '[class.apagado]': 'apagado()',
  },
})
export class Tema {
  readonly tema = input.required<TemaEnriquecido>();
  /* null cuando la búsqueda deja este tema fuera de la disposición. La sección sigue en el
     DOM y se oculta, igual que en el prototipo, para poder animar el reacomodo. */
  readonly bloque = input.required<Bloque | null>();
  readonly modo = input.required<Disposicion['modo']>();

  readonly pulsarTitulo = output<void>();
  readonly pulsarVolver = output<void>();

  protected readonly store = inject(DirectorioStore);

  /** El tono sale del ORDEN de las categorías del API, nunca de un id escrito a mano. */
  protected readonly tono = computed(() => tonoDe(this.store.categorias(), this.tema().id));

  /* El bloque llega como unión de las cuatro formas. Se lee una sola vez con los campos
     opcionales para no repartir `in` por el archivo: el operador `in` narra de más en
     TypeScript moderno y dejaría la unión sin resolver. */
  private readonly campos = computed<Partial<BloqueFranja & BloqueAbierto & BloqueLomo>>(
    () => this.bloque() ?? {},
  );
  protected readonly esAbierto = computed(() => this.campos().abierto === true);
  protected readonly esLomo = computed(() => this.campos().lomo === true);
  /** Solo la disposición en franjas coloca el bloque en la grilla y reparte los cierres. */
  protected readonly franja = computed<BloqueFranja | null>(() => {
    const b = this.bloque();
    return b && this.modo() === 'franjas' && typeof this.campos().franja === 'number'
      ? (b as BloqueFranja)
      : null;
  });

  protected readonly columnaEnGrilla = computed(() => {
    const b = this.franja();
    return b ? `${b.columna + 1} / span ${b.ancho}` : null;
  });
  protected readonly filaEnGrilla = computed(() => {
    const b = this.franja();
    return b ? String(b.franja + 1) : null;
  });

  /* ─────────── Fase de marcado: los números se mueven mientras se escribe ─────────── */
  protected readonly cuentaAhora = computed(() => this.store.cuentaMarca(this.tema().id));
  /** Escala el número del tema: calc(44px + 36px * var(--peso)). */
  protected readonly peso = computed(() =>
    (this.cuentaAhora() / this.store.maximoCuenta()).toFixed(3),
  );
  /** Un tema sin coincidencias solo cambia de fondo: su título conserva el contraste.
      Un tema fuera de la disposición no se apaga: está oculto, como en el prototipo. */
  protected readonly apagado = computed(
    () => !!this.bloque() && this.store.hayConsultaMarca() && !this.cuentaAhora(),
  );

  /* ─────────── Fase completa: el reparto de las casillas ─────────── */
  protected readonly mostradas = computed(() => this.tema().portales.filter((p) => p.coincide));
  /* Las variables de la grilla se pasan como cadena: son propiedades personalizadas y el
     CSS las usa dentro de repeat() y de clamp(), donde una unidad colada las invalidaría. */
  protected readonly varM = computed(() =>
    String(Math.min(COLUMNAS, Math.max(1, this.mostradas().length))),
  );
  protected readonly abiertas = computed(() => {
    const m = this.mostradas().length;
    return String(m <= 3 ? Math.max(1, m) : m === 4 ? 2 : 3);
  });
  protected readonly anchoEnGrilla = computed(() => {
    const b = this.franja();
    return b ? String(b.ancho) : null;
  });

  /**
   * Anchos de la última fila del bloque. La guarda por b.ensanche es OBLIGATORIA:
   * anchosUltimaFila solo es válida cuando esa fila está incompleta, y con la fila completa
   * devolvería un solo ancho que colapsaría la fila entera en una casilla.
   */
  protected readonly ensanches = computed<ReadonlyMap<string, string>>(() => {
    const b = this.franja();
    const mostradas = this.mostradas();
    const spans = new Map<string, string>();
    if (!b || !b.ensanche) return spans;
    const anchos = anchosUltimaFila(mostradas.length, b.ancho);
    const desde = mostradas.length - anchos.length;
    for (let i = 0; i < anchos.length; i++) {
      const p = mostradas[desde + i];
      if (p && anchos[i] > 1) spans.set(this.clave(p), `span ${anchos[i]}`);
    }
    return spans;
  });

  /** Las casillas de relleno del bloque. La primera lleva texto; las demás van vacías. */
  protected readonly cierres = computed<string[]>(() => {
    const b = this.franja();
    if (!b || b.cierre <= 0) return [];
    const e = this.store.estadoFirme();
    const fuera = this.tema().total - this.mostradas().length;
    const texto =
      e.hayConsulta && fuera > 0
        ? `Hay ${plural(fuera, 'portal más', 'portales más')} en este tema que no ${
            fuera === 1 ? 'coincide' : 'coinciden'
          } con «${e.consulta.trim()}».`
        : this.tema().desc;
    return Array.from({ length: b.cierre }, (_, i) => (i === 0 ? texto : ''));
  });

  /* ─────────── Textos y atributos accesibles ─────────── */
  protected readonly textoCuenta = computed(() => {
    const t = this.tema();
    const n = this.mostradas().length;
    const texto = this.store.estadoFirme().hayConsulta
      ? `${n} de ${plural(t.total, 'portal', 'portales')}`
      : plural(n, 'portal', 'portales');
    return ', ' + texto;
  });

  /* Solo el lomo y el tema abierto se pliegan de verdad: ahí va aria-expanded. En el
     mosaico las casillas ya están a la vista y el botón filtra, así que se nombra la acción. */
  protected readonly textoAccion = computed(() => {
    if (this.esLomo()) return `, abrir el tema ${this.tema().name}`;
    return this.esAbierto() ? '' : ', ver solo este tema';
  });
  private readonly sePliega = computed(() => this.esLomo() || this.esAbierto());
  protected readonly ariaExpanded = computed(() =>
    this.sePliega() ? String(this.esAbierto()) : null,
  );
  protected readonly ariaControls = computed(() =>
    this.sePliega() ? 'celdas-' + this.tema().id : null,
  );

  /* ─────────── Por portal ─────────── */
  protected clave(p: PortalEnriquecido): string {
    return this.store.claveDe(p);
  }

  /** Apagada viene de la fase MARCADA: se atenúa sin mover nada de sitio. */
  protected apagada(p: PortalEnriquecido): boolean {
    return !this.store.coincideMarca().has(this.clave(p));
  }

  /** Con un número impar de casillas, la última ocupa el ancho entero en móvil. */
  protected esAncha(p: PortalEnriquecido): boolean {
    const mostradas = this.mostradas();
    return mostradas.length % 2 === 1 && mostradas[mostradas.length - 1] === p;
  }

  protected spanDe(p: PortalEnriquecido): string | null {
    return this.ensanches().get(this.clave(p)) ?? null;
  }

  protected describedby(p: PortalEnriquecido): string {
    const k = this.clave(p);
    return `d-${k} m-${k}` + (p.favorito ? ` f-${k}` : '');
  }

  protected trozosDominio(p: PortalEnriquecido): string[] {
    return partirDominio(p.dominio);
  }
}
