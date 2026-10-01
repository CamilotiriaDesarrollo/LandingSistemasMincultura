import { Component, DOCUMENT, DestroyRef, NgZone, computed, inject, signal } from '@angular/core';
import { VISTAS, Vista } from '../../nucleo/pedido';
import { DirectorioStore } from '../../servicios/directorio.store';

/**
 * Desplazamiento a partir del cual el zócalo flota, en px, y el que lo vuelve a posar.
 *
 * Son dos cifras y no una para que el zócalo no parpadee en el borde: sube a flotar a los
 * 48 px de recorrido y no se vuelve a posar hasta que la página está a 16 px del principio.
 */
const FLOTA_DESDE = 48;
const SE_POSA_BAJO = 16;

/**
 * Zócalo táctil: buscador, conmutador de vistas y acceso a los temas al alcance del pulgar.
 *
 * Solo existe cuando el medio declara que no hay puntero fino. La guarda es
 * `store.conPuntero()`, que es `matchMedia('(hover: hover)')`, el mismo criterio de entrada
 * de toda la versión táctil. Con ratón el `@if` no pinta nada, así que el anfitrión queda
 * vacío y sin objetivos tocables: el censo de escritorio no cambia. La hoja lo tapa además
 * con `.zocalo{display:none}` fuera del bloque táctil y con `.zocalo:empty{display:none}`.
 *
 * REPITE CONTROLES QUE YA ESTÁN ARRIBA, y de ahí salen las tres decisiones del archivo:
 *
 * 1. NINGÚN ID SE DUPLICA. El campo de búsqueda sigue siendo uno, el `#query` del
 *    buscador: aquí no hay un segundo campo, hay un botón que lleva el foco al que ya
 *    existe. Por lo mismo el conmutador de aquí no lleva la clase `.conmutador` ni ningún
 *    id: los guiones de medición resuelven `.conmutador` y `#conteo` con querySelector, y
 *    un segundo elemento con el mismo gancho les cambiaría la lectura sin avisar. Los
 *    ganchos propios son `data-zocalo` y las clases `.zocalo-*`.
 *
 * 2. EL ATAJO CTRL K NO SE TOCA. El escuchador de teclado vive en `Buscador`, que es de
 *    quien es el campo, y aquí no se añade ninguno: el botón solo enfoca. Un segundo
 *    escuchador del mismo atajo llamaría dos veces a `focus()` y el `aria-keyshortcuts`
 *    dejaría de nombrar a un solo elemento.
 *
 * 3. EL ESTADO NO SE DUPLICA. `aria-pressed` se lee de `store.vistaEfectiva()` y el toque
 *    llama a `store.cambiarVista(v)`, igual que el conmutador de arriba. Los dos
 *    conmutadores muestran siempre lo mismo porque los dos leen la misma señal.
 *
 * El componente va después del pie en `app.html`, que es su sitio en el recorrido con Tab:
 * el zócalo es lo último de la página y es lo último que se enfoca, sin trampas de foco.
 */
@Component({
  selector: 'div[app-zocalo]',
  templateUrl: './zocalo.html',
  host: {
    // Presente solo mientras el zócalo flota: es el gancho de la hoja, que con él le pone
    // el anclaje de abajo y sin él lo deja en su sitio del flujo. Un atributo y no una
    // clase, para no meter nombres de clase nuevos en lo que mide el censo.
    '[attr.data-flotante]': "flotante() ? '' : null",
  },
})
export class Zocalo {
  protected readonly store = inject(DirectorioStore);
  private readonly documento = inject(DOCUMENT);
  private readonly zona = inject(NgZone);

  protected readonly VISTAS = VISTAS;

  /**
   * Si la página está desplazada. Lo escribe el escuchador de desplazamiento y solo cuando
   * el estado cambia de verdad, que son dos veces por recorrido.
   */
  private readonly desplazada = signal(false);

  /**
   * SI EL ZÓCALO FLOTA O SE QUEDA EN SU SITIO, y la razón de que exista esta señal.
   *
   * Un zócalo pegado abajo se pinta encima de lo que hay debajo, y con la página en su
   * principio lo que hay debajo son enlaces de portal, botones de tema y fichas de búsqueda
   * rápida: el censo los contaba como 26 pares de vecinos con 0,0 px de aire, que es un
   * fallo real y no un artefacto de la medición, porque ahí el dedo cae sobre dos cosas.
   *
   * Con la página en su principio el zócalo además no hace falta: el buscador, el
   * conmutador y los temas están a la vista por sí solos. Así que ahí se queda posado en su
   * sitio, que es el final del documento, y sube a flotar en cuanto la página se desplaza,
   * que es cuando esos tres controles se van de pantalla y el zócalo es lo único que los
   * devuelve al alcance del pulgar.
   *
   * Posado y flotando ocupa el mismo hueco en el flujo, así que el cambio no mueve ni un
   * píxel de la maquetación, y al final del recorrido las dos posiciones coinciden: la
   * última tarjeta sigue quedando entera.
   *
   * Con ratón no flota nunca, aunque el `@if` de la plantilla ya deje el anfitrión vacío.
   */
  protected readonly flotante = computed(() => !this.store.conPuntero() && this.desplazada());

  constructor() {
    const ventana = this.documento.defaultView;
    if (!ventana) return;

    /* Fuera de la zona de Angular: el desplazamiento dispara decenas de eventos por
       segundo y no hay nada que volver a pintar mientras el estado no cambie. Solo los dos
       cambios de estado entran a la zona, y con ellos la detección de cambios. */
    const mirar = (): void => {
      const y = ventana.scrollY;
      const quiere = this.desplazada() ? y > SE_POSA_BAJO : y > FLOTA_DESDE;
      if (quiere !== this.desplazada()) this.zona.run(() => this.desplazada.set(quiere));
    };
    this.zona.runOutsideAngular(() => {
      ventana.addEventListener('scroll', mirar, { passive: true });
    });
    // Una recarga puede devolver la página desplazada: el estado se lee de entrada.
    mirar();
    inject(DestroyRef).onDestroy(() => ventana.removeEventListener('scroll', mirar));
  }

  /** Los mismos rótulos del conmutador de arriba: nombran las mismas tres vistas. */
  protected readonly ETIQUETAS: Record<Vista, string> = {
    mosaico: 'Mosaico',
    mapa: 'Mapa',
    lista: 'Lista',
  };

  /**
   * Acceso al buscador: trae a la vista el campo que ya existe y le pasa el foco.
   *
   * El patrón es el de `Buscador.enfocarBuscador` y el del enlace del encabezado: primero
   * el desplazamiento, después el foco con `preventScroll`, para que el foco no corte el
   * desplazamiento que ya está en marcha. `block: 'center'` deja el campo lejos del borde
   * inferior, que es donde sube el teclado del teléfono.
   */
  protected irAlBuscador(): void {
    const campo = this.documento.getElementById('query');
    if (!campo) return;
    campo.scrollIntoView({ behavior: this.comportamiento(), block: 'center' });
    campo.focus({ preventScroll: true });
  }

  /**
   * Acceso a los temas: lleva la sección Explorar a la vista y el foco al primer tema del
   * índice pegado.
   *
   * El índice solo sirve al mosaico repartido, así que cuando está oculto el foco va al
   * título de la sección, que ya tiene `tabindex="-1"` para esto mismo. Son los dos ids
   * del contrato, `#explorar` y `#explorar-titulo`, y el índice se busca por
   * `nav#indice`: ninguna consulta más fuera del componente.
   *
   * Un solo significado por toque: esto desplaza y enfoca, no abre ni cierra ningún tema.
   */
  protected irATemas(): void {
    this.documento
      .getElementById('explorar')
      ?.scrollIntoView({ behavior: this.comportamiento(), block: 'start' });
    const indice = this.documento.querySelector<HTMLElement>('nav#indice');
    const destino =
      indice && !indice.hidden
        ? indice.querySelector<HTMLElement>('a')
        : this.documento.getElementById('explorar-titulo');
    destino?.focus({ preventScroll: true });
  }

  /** Sin desplazamiento suave cuando se pide reducir el movimiento. */
  private comportamiento(): ScrollBehavior {
    return this.store.menosMovimiento() ? 'auto' : 'smooth';
  }
}
