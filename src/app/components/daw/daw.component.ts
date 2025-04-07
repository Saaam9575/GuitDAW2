import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { FormsModule } from '@angular/forms';
import { TabSearchComponent } from '../tab-search/tab-search.component';
import { TabViewerComponent } from '../tab-viewer/tab-viewer.component';
import {
  AudioDevice,
  GuitarAudioService,
} from '../../services/guitar-audio.service';
import * as Tone from 'tone';
import { Subscription } from 'rxjs';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

// Interface pour stocker les informations des effets
interface EffectInfo {
  id: string; // Identifiant unique de l'effet
  type: string; // Type d'effet (delay, reverb, etc.)
  name: string; // Nom affiché
  effect: Tone.ToneAudioNode; // Instance Tone.js de l'effet
  isOpen: boolean; // État d'ouverture du panneau de paramètres
  params: EffectParam[]; // Paramètres de l'effet
}

// Interface pour les paramètres des effets
interface EffectParam {
  id: string; // Identifiant du paramètre
  name: string; // Nom affiché
  type: 'slider' | 'toggle' | 'select'; // Type de contrôle
  value: number | boolean | string; // Valeur actuelle
  min?: number; // Valeur minimale (pour slider)
  max?: number; // Valeur maximale (pour slider)
  step?: number; // Pas (pour slider)
  options?: { value: string; label: string }[]; // Options (pour select)
}

@Component({
  selector: 'app-daw',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    NzLayoutModule,
    NzButtonModule,
    NzIconModule,
    NzTabsModule,
    NzSelectModule,
    NzDrawerModule,
    NzSliderModule,
    NzCardModule,
    NzModalModule,
    NzInputModule,
    NzInputNumberModule,
    NzSwitchModule,
    TabSearchComponent,
    TabViewerComponent,
  ],
  templateUrl: './daw.component.html',
  styleUrls: ['./daw.component.scss'],
  providers: [GuitarAudioService],
})
export class DawComponent implements OnInit, OnDestroy {
  effectInfos: EffectInfo[] = [];
  isInitialized = false;
  isPlaying = false;
  isAudioContextStarted = false;

  availableDevices: AudioDevice[] = [];
  selectedDeviceId = '';

  isDeviceDrawerVisible = false;
  isEffectsPanelVisible = false;

  selectedTabUrl: string | null = null;

  private subscriptions: Subscription[] = [];
  private effectCounter = 0; // Compteur pour générer des IDs uniques

  constructor(public guitarAudioService: GuitarAudioService) {}

  ngOnInit() {
    this.initializeAudioService();

    this.subscriptions.push(
      this.guitarAudioService.availableDevices$.subscribe((devices) => {
        this.availableDevices = devices;
      }),

      this.guitarAudioService.currentDevice$.subscribe((deviceId) => {
        this.selectedDeviceId = deviceId;
      })
    );

    this.guitarAudioService.updateAvailableDevices();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  async startAudioContext() {
    if (this.isAudioContextStarted) return;
    try {
      await Tone.start();
      console.log('AudioContext démarré avec succès.');
      this.isAudioContextStarted = true;
      this.isInitialized = await this.guitarAudioService.initialize();
      if (!this.isInitialized) {
        console.error("Échec de l'initialisation de GuitarAudioService.");
      }
    } catch (error) {
      console.error("Erreur lors du démarrage de l'AudioContext:", error);
    }
  }

  async selectDevice(deviceId: string) {
    if (!this.isAudioContextStarted) return;
    await this.guitarAudioService.selectDevice(deviceId);
  }

  showDeviceDrawer() {
    this.isDeviceDrawerVisible = true;
    this.guitarAudioService.updateAvailableDevices();
  }

  closeDeviceDrawer() {
    this.isDeviceDrawerVisible = false;
  }

  onDrop(event: CdkDragDrop<EffectInfo[]>) {
    if (!this.isAudioContextStarted) return;
    moveItemInArray(this.effectInfos, event.previousIndex, event.currentIndex);
    // Mettre à jour l'ordre dans le service en transmettant les IDs
    this.guitarAudioService.reorderEffects(
      this.effectInfos.map((info) => info.id)
    );
  }

  addEffect(effectType: string) {
    if (!this.isAudioContextStarted) return;

    const effectId = `${effectType}_${this.effectCounter++}`;
    let effect: Tone.ToneAudioNode;
    let params: EffectParam[] = [];

    switch (effectType) {
      case 'delay':
        const delayEffect = new Tone.FeedbackDelay('8n', 0.5);
        effect = delayEffect;
        params = [
          {
            id: 'delayTime',
            name: 'Temps de délai',
            type: 'slider',
            value: 0.25, // Valeur en secondes
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          {
            id: 'feedback',
            name: 'Feedback',
            type: 'slider',
            value: 0.5,
            min: 0,
            max: 0.99,
            step: 0.01,
          },
          {
            id: 'wet',
            name: 'Mix',
            type: 'slider',
            value: 1,
            min: 0,
            max: 1,
            step: 0.01,
          },
        ];
        break;

      case 'reverb':
        const reverbEffect = new Tone.Reverb(3);
        effect = reverbEffect;
        params = [
          {
            id: 'decay',
            name: 'Déclin',
            type: 'slider',
            value: 3,
            min: 0.1,
            max: 10,
            step: 0.1,
          },
          {
            id: 'wet',
            name: 'Mix',
            type: 'slider',
            value: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
          },
        ];
        break;

      case 'distortion':
        const distortionEffect = new Tone.Distortion(0.8);
        effect = distortionEffect;
        params = [
          {
            id: 'distortion',
            name: 'Distorsion',
            type: 'slider',
            value: 0.8,
            min: 0,
            max: 1,
            step: 0.01,
          },
          {
            id: 'wet',
            name: 'Mix',
            type: 'slider',
            value: 1,
            min: 0,
            max: 1,
            step: 0.01,
          },
        ];
        break;

      case 'eq':
        const eqEffect = new Tone.EQ3();
        effect = eqEffect;
        params = [
          {
            id: 'low',
            name: 'Basses',
            type: 'slider',
            value: 0,
            min: -20,
            max: 20,
            step: 0.1,
          },
          {
            id: 'mid',
            name: 'Médiums',
            type: 'slider',
            value: 0,
            min: -20,
            max: 20,
            step: 0.1,
          },
          {
            id: 'high',
            name: 'Aigus',
            type: 'slider',
            value: 0,
            min: -20,
            max: 20,
            step: 0.1,
          },
        ];
        break;

      default:
        return; // Type d'effet non reconnu
    }

    const effectInfo: EffectInfo = {
      id: effectId,
      type: effectType,
      name: this.getEffectName(effectType),
      effect,
      isOpen: false,
      params,
    };

    this.effectInfos.push(effectInfo);
    this.guitarAudioService.addEffect(effectId, effect);
  }

  removeEffect(effectId: string) {
    if (!this.isAudioContextStarted) return;
    const index = this.effectInfos.findIndex((info) => info.id === effectId);
    if (index > -1) {
      this.effectInfos.splice(index, 1);
      this.guitarAudioService.removeEffect(effectId);
    }
  }

  toggleEffectPanel(effectId: string) {
    const effectInfo = this.effectInfos.find((info) => info.id === effectId);
    if (effectInfo) {
      // Fermer tous les autres panneaux
      this.effectInfos.forEach((info) => {
        if (info.id !== effectId) {
          info.isOpen = false;
        }
      });

      // Toggle le panneau actuel
      effectInfo.isOpen = !effectInfo.isOpen;
    }
  }

  updateEffectParam(effectInfo: EffectInfo, param: EffectParam, value: any) {
    param.value = value;

    // Mise à jour du paramètre sur l'effet Tone.js
    try {
      switch (effectInfo.type) {
        case 'delay':
          const delayEffect = effectInfo.effect as Tone.FeedbackDelay;
          if (param.id === 'delayTime') {
            delayEffect.delayTime.value = value;
          } else if (param.id === 'feedback') {
            delayEffect.feedback.value = value;
          } else if (param.id === 'wet') {
            delayEffect.wet.value = value;
          }
          break;

        case 'reverb':
          const reverbEffect = effectInfo.effect as Tone.Reverb;
          if (param.id === 'decay') {
            // La propriété decay n'est pas directement modifiable, on doit recréer l'effet
            // Pour l'instant, on modifie juste wet
            reverbEffect.wet.value =
              param.id === 'wet' ? value : reverbEffect.wet.value;
          } else if (param.id === 'wet') {
            reverbEffect.wet.value = value;
          }
          break;

        case 'distortion':
          const distortionEffect = effectInfo.effect as Tone.Distortion;
          if (param.id === 'distortion') {
            distortionEffect.distortion = value;
          } else if (param.id === 'wet') {
            distortionEffect.wet.value = value;
          }
          break;

        case 'eq':
          const eqEffect = effectInfo.effect as Tone.EQ3;
          if (param.id === 'low') {
            eqEffect.low.value = value;
          } else if (param.id === 'mid') {
            eqEffect.mid.value = value;
          } else if (param.id === 'high') {
            eqEffect.high.value = value;
          }
          break;
      }
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du paramètre ${param.id}:`,
        error
      );
    }
  }

  getEffectName(type: string): string {
    switch (type) {
      case 'delay':
        return 'Delay';
      case 'reverb':
        return 'Reverb';
      case 'distortion':
        return 'Distortion';
      case 'eq':
        return 'Égaliseur';
      default:
        return type;
    }
  }

  async togglePlayback() {
    if (!this.isAudioContextStarted) return;
    if (this.isPlaying) {
      await Tone.Transport.stop();
    } else {
      if (Tone.Transport.state !== 'started') {
        await Tone.Transport.start();
      }
    }
    this.isPlaying = !this.isPlaying;
  }

  loadSelectedTab(url: string) {
    console.log('Chargement de la tablature:', url);
    this.selectedTabUrl = url;
  }
}
