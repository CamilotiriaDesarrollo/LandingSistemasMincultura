import { Component, OnInit, inject } from '@angular/core';
import { DirectorioStore } from './servicios/directorio.store';
import { Encabezado } from './componentes/encabezado/encabezado';
import { Accesibilidad } from './componentes/accesibilidad/accesibilidad';
import { Portada } from './componentes/portada/portada';
import { Favoritos } from './componentes/favoritos/favoritos';
import { Explorador } from './componentes/explorador/explorador';
import { Pie } from './componentes/pie/pie';
import { Zocalo } from './componentes/zocalo/zocalo';

@Component({
  selector: 'app-root',
  imports: [Encabezado, Accesibilidad, Portada, Favoritos, Explorador, Pie, Zocalo],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(DirectorioStore);

  ngOnInit(): void {
    this.store.cargar();
  }
}
