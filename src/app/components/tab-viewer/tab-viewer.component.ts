import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as alphaTab from '@coderline/alphatab';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-tab-viewer',
  standalone: true,
  imports: [
    CommonModule,
    NzSpinModule,
    NzMessageModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './tab-viewer.component.html',
  styleUrls: ['./tab-viewer.component.scss'],
})
export class TabViewerComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() tabUrl: string | null = null;
  @ViewChild('alphaTabContainer') alphaTabContainer!: ElementRef;

  private alphaTabApi: alphaTab.AlphaTabApi | null = null;
  isLoading = false;
  errorLoading = false;
  tabTitle = 'Tablature';

  constructor(private message: NzMessageService) {}

  ngAfterViewInit(): void {
    this.initializeAlphaTab();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['tabUrl'] &&
      this.tabUrl &&
      this.alphaTabApi &&
      this.alphaTabContainer?.nativeElement
    ) {
      this.loadTab(this.tabUrl);
    }
  }

  ngOnDestroy(): void {
    if (this.alphaTabApi) {
      this.alphaTabApi.destroy();
      this.alphaTabApi = null;
    }
  }

  private initializeAlphaTab() {
    if (!this.alphaTabContainer?.nativeElement) {
      console.error("alphaTabContainer non trouvé pour l'initialisation.");
      return;
    }
    if (this.alphaTabApi) {
      return;
    }

    const settings: any = {
      core: {
        resourcesUrl: '/alphatab/dist/',
      },
      player: {
        enablePlayer: true,
        enableUserInteraction: true,
        enableCursor: true,
        soundFont: '/alphatab/dist/soundfont/sonivox.sf2',
      },
    };

    try {
      this.alphaTabApi = new alphaTab.AlphaTabApi(
        this.alphaTabContainer.nativeElement,
        settings
      );

      this.alphaTabApi.soundFontLoad.on((e: any) => {
        console.log('Soundfont chargée:', e);
      });

      this.alphaTabApi.playerReady.on(() => {
        console.log('Lecteur audio prêt');
      });

      this.alphaTabApi.scoreLoaded.on((score: alphaTab.model.Score) => {
        this.isLoading = false;
        this.errorLoading = false;
        this.tabTitle = score.title || 'Tablature sans titre';
        console.log('Tablature chargée:', score);
      });

      this.alphaTabApi.renderFinished.on(() => {
        console.log('Rendu terminé');
      });

      this.alphaTabApi.error.on((e: any) => {
        this.isLoading = false;
        this.errorLoading = true;
        console.error('Erreur AlphaTab:', e);
        this.message.error(
          "Erreur lors du chargement ou de l'affichage de la tablature."
        );
      });

      if (this.tabUrl) {
        this.loadTab(this.tabUrl);
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation d'AlphaTab:", error);
      this.errorLoading = true;
      this.message.error("Impossible d'initialiser le lecteur de tablatures.");
    }
  }

  private loadTab(url: string) {
    if (!this.alphaTabApi) {
      console.warn(
        "Essai de chargement de tablature avant initialisation d'alphaTab."
      );
      return;
    }

    this.isLoading = true;
    this.errorLoading = false;
    this.tabTitle = 'Chargement...';
    console.log(`AlphaTab: Tentative de chargement de ${url}`);
    try {
      this.alphaTabApi.load(url);
    } catch (err) {
      console.error(
        `Erreur synchrone lors de l'appel AlphaTab.load(${url}):`,
        err
      );
      this.isLoading = false;
      this.errorLoading = true;
      this.message.error('Erreur inattendue lors du chargement du fichier.');
    }
  }

  playPause() {
    this.alphaTabApi?.playPause();
  }

  stop() {
    this.alphaTabApi?.stop();
  }

  print() {
    this.alphaTabApi?.print();
  }
}
