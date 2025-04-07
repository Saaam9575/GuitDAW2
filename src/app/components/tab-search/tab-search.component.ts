import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

// Mocked result interface
interface TabResult {
  title: string;
  url: string; // Doit pointer vers un fichier chargeable par alphaTab (.gp5, .gp, .gpx, etc.)
  source: string;
}

@Component({
  selector: 'app-tab-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzListModule,
    NzSkeletonModule,
  ],
  templateUrl: './tab-search.component.html',
  styleUrls: ['./tab-search.component.scss'],
})
export class TabSearchComponent {
  searchQuery = '';
  isLoading = false;
  searchResults: TabResult[] = [];
  @Output() tabSelected = new EventEmitter<string>();

  searchTabs() {
    if (!this.searchQuery) {
      return;
    }
    this.isLoading = true;
    this.searchResults = [];

    console.log(`Recherche de tablatures pour : ${this.searchQuery}`);
    // --- Simulation d'un appel API SerpApi ---
    // Remplacer par un appel réel qui retourne des URL directes vers des fichiers (.gp5, etc.)
    setTimeout(() => {
      this.searchResults = [
        {
          title: 'Stairway to Heaven - Led Zeppelin',
          url: 'assets/tabs/stairway.gp5', // Assurez-vous que ce fichier existe
          source: 'Local Mock',
        },
        {
          title: 'Hotel California - Eagles (Mock)',
          url: 'assets/tabs/hotel_california.gp5', // Fichier mock - doit exister localement
          source: 'Local Mock',
        },
        {
          title: 'Nothing Else Matters - Metallica (Mock)',
          url: 'assets/tabs/nothing_else.gp5', // Fichier mock - doit exister localement
          source: 'Local Mock',
        },
        {
          title: 'Lien Externe - Exemple',
          url: 'https://www.google.com', // Ceci ne sera pas chargé par alphaTab
          source: 'External Link',
        },
      ];
      this.isLoading = false;
    }, 1500);
    // --- Fin de la simulation ---
  }

  selectTab(result: TabResult) {
    // Toujours émettre l'URL pour essayer de la charger dans le viewer local
    console.log(`Tab sélectionnée: ${result.title}, URL: ${result.url}`);
    this.tabSelected.emit(result.url);
    // Note : Si l'URL n'est pas un fichier valide ou accessible par alphaTab
    // (ex: une page HTML, un lien externe non direct), alphaTab générera une erreur
    // qui est (normalement) interceptée par le TabViewerComponent.
  }
}
