import { Component } from '@angular/core';

/**
 * Hero: solo el título de la landing. El buscador y las búsquedas rápidas viven en
 * `Buscador`, al principio del explorador, que es donde se necesitan: el hero no navega
 * a nada propio y no tiene por qué competir en tamaño con lo que sí se usa.
 */
@Component({
  selector: 'section[app-portada]',
  templateUrl: './portada.html',
})
export class Portada {}
