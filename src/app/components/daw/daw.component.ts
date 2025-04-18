import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { RecordingComponent } from '../recording/recording.component';

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

// Interface pour les presets
interface Preset {
  id: string;
  name: string;
  effects: {
    type: string;
    params: {
      id: string;
      value: number | boolean | string;
    }[];
  }[];
}

interface FavoriteVideo {
  url: string;
  title: string;
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
    NzTagModule,
    NzEmptyModule,
    NzRadioModule,
    NzToolTipModule,
    SafeUrlPipe,
    RecordingComponent
  ],
  templateUrl: './daw.component.html',
  styleUrls: ['./daw.component.scss'],
  providers: [GuitarAudioService],
})
export class DawComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('visualizer') visualizerCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mainVisualizer')
  mainVisualizerCanvas!: ElementRef<HTMLCanvasElement>;
  private animationFrameId: number | null = null;

  bandlabUrl = 'https://www.bandlab.com/studio';
  effectInfos: EffectInfo[] = [];
  isAudioContextStarted = false;

  availableDevices: AudioDevice[] = [];
  selectedInputDevice = '';
  selectedOutputDevice = '';

  isDeviceDrawerVisible = false;
  isEffectsPanelVisible = false;

  selectedTabUrl: string | null = null;

  private subscriptions: Subscription[] = [];
  private effectCounter = 0;

  presets: Preset[] = [];
  newPresetName: string = '';

  // Propriétés pour le mix
  masterVolume: number = 0;
  masterPan: number = 0;
  vuMeterLevel: number = 0;
  private vuMeterAnimationId: number | null = null;

  // Propriétés pour le visualisateur
  visualizerType: 'waveform' | 'frequency' = 'waveform';
  private mainVisualizerAnimationId: number | null = null;

  youtubeUrl: string = '';
  youtubeEmbedUrl: string | null = null;
  currentVideoTitle: string = '';
  favorites: FavoriteVideo[] = [];

  tabSearchQuery: string = '';

  constructor(public guitarAudioService: GuitarAudioService) {}

  ngOnInit() {
    // Souscrire aux changements de périphériques
    this.subscriptions.push(
      this.guitarAudioService.availableDevices$.subscribe((devices) => {
        this.availableDevices = devices;
      }),
      this.guitarAudioService.currentInputDevice$.subscribe((deviceId) => {
        this.selectedInputDevice = deviceId;
      }),
      this.guitarAudioService.currentOutputDevice$.subscribe((deviceId) => {
        this.selectedOutputDevice = deviceId;
      })
    );

    this.guitarAudioService.updateAvailableDevices();

    // Charger les presets sauvegardés
    const savedPresets = localStorage.getItem('daw-presets');
    if (savedPresets) {
      this.presets = JSON.parse(savedPresets);
    }

    // Initialiser le VU-mètre
    this.updateVuMeter();
    this.loadFavorites();
  }

  ngAfterViewInit() {
    this.setupVisualizer();
    this.setupMainVisualizer();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.vuMeterAnimationId) {
      cancelAnimationFrame(this.vuMeterAnimationId);
    }
    if (this.mainVisualizerAnimationId) {
      cancelAnimationFrame(this.mainVisualizerAnimationId);
    }
  }

  async startAudioContext() {
    try {
      await Tone.start();
      this.isAudioContextStarted = true;
      console.log('Contexte audio démarré');

      // Demander l'autorisation d'accès aux périphériques audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Autorisation audio obtenue:', stream);

      // Initialiser le service audio et mettre à jour les périphériques
      await this.guitarAudioService.updateAvailableDevices();

      // Démarrer la visualisation
      this.setupVisualizer();
      this.setupMainVisualizer();
    } catch (error) {
      console.error('Erreur lors du démarrage du contexte audio:', error);
    }
  }

  async onInputDeviceChange(deviceId: string) {
    try {
      await this.guitarAudioService.setInputDevice(deviceId);
    } catch (error) {
      console.error("Erreur lors du changement de périphérique d'entrée:", error);
    }
  }

  async onOutputDeviceChange(deviceId: string) {
    try {
      await this.guitarAudioService.setOutputDevice(deviceId);
    } catch (error) {
      console.error("Erreur lors du changement de périphérique de sortie:", error);
    }
  }

  showDeviceDrawer() {
    this.isDeviceDrawerVisible = true;
    console.log('Mise à jour des périphériques...');
    this.guitarAudioService.updateAvailableDevices().then(() => {
      console.log('Périphériques mis à jour');
    });
  }

  closeDeviceDrawer() {
    this.isDeviceDrawerVisible = false;
  }

  onDrop(event: CdkDragDrop<EffectInfo[]>) {
    if (!this.isAudioContextStarted) return;
    moveItemInArray(this.effectInfos, event.previousIndex, event.currentIndex);
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
            value: 0.25,
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

      case 'pitchShifter':
        const pitchShifter = new Tone.PitchShift({
          pitch: 0,
          windowSize: 0.1,
          delayTime: 0,
          feedback: 0,
        });
        effect = pitchShifter;
        params = [
          {
            id: 'pitch',
            name: 'Pitch',
            type: 'slider',
            value: 0,
            min: -12,
            max: 12,
            step: 1,
          },
          {
            id: 'windowSize',
            name: 'Taille de fenêtre',
            type: 'slider',
            value: 0.1,
            min: 0.01,
            max: 0.5,
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

      case 'compressor':
        const compressor = new Tone.Compressor({
          threshold: -24,
          ratio: 12,
          attack: 0.003,
          release: 0.25,
        });
        effect = compressor;
        params = [
          {
            id: 'threshold',
            name: 'Seuil',
            type: 'slider',
            value: -24,
            min: -60,
            max: 0,
            step: 1,
          },
          {
            id: 'ratio',
            name: 'Ratio',
            type: 'slider',
            value: 12,
            min: 1,
            max: 20,
            step: 1,
          },
          {
            id: 'attack',
            name: 'Attaque',
            type: 'slider',
            value: 0.003,
            min: 0.001,
            max: 1,
            step: 0.001,
          },
          {
            id: 'release',
            name: 'Relâchement',
            type: 'slider',
            value: 0.25,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
        ];
        break;

      case 'phaser':
        const phaser = new Tone.Phaser({
          frequency: 0.5,
          octaves: 3,
          baseFrequency: 350,
          wet: 1,
        });
        effect = phaser;
        params = [
          {
            id: 'frequency',
            name: 'Fréquence',
            type: 'slider',
            value: 0.5,
            min: 0.1,
            max: 10,
            step: 0.1,
          },
          {
            id: 'octaves',
            name: 'Octaves',
            type: 'slider',
            value: 3,
            min: 1,
            max: 6,
            step: 1,
          },
          {
            id: 'baseFrequency',
            name: 'Fréquence de base',
            type: 'slider',
            value: 350,
            min: 50,
            max: 1000,
            step: 10,
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

      case 'flanger':
        const flanger = new Tone.FeedbackDelay({
          delayTime: 0.005,
          feedback: 0.5,
          wet: 1,
        });
        effect = flanger;
        params = [
          {
            id: 'delayTime',
            name: 'Temps de délai',
            type: 'slider',
            value: 0.005,
            min: 0.001,
            max: 0.02,
            step: 0.001,
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

      case 'fuzz':
        const fuzz = new Tone.Distortion({
          distortion: 2,
          oversample: '4x',
          wet: 1,
        });
        effect = fuzz;
        params = [
          {
            id: 'distortion',
            name: 'Distorsion',
            type: 'slider',
            value: 2,
            min: 0,
            max: 10,
            step: 0.1,
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

      case 'overdrive':
        const overdrive = new Tone.Distortion({
          distortion: 0.4,
          oversample: '2x',
          wet: 1,
        });
        effect = overdrive;
        params = [
          {
            id: 'distortion',
            name: 'Drive',
            type: 'slider',
            value: 0.4,
            min: 0,
            max: 2,
            step: 0.1,
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

    if (effect) {
      this.guitarAudioService.addEffect(effectId, effect);
      this.effectInfos.push({
        id: effectId,
        type: effectType,
        name: this.getEffectName(effectType),
        effect,
        isOpen: true,
        params,
      });
    }
  }

  removeEffect(effectId: string) {
    const index = this.effectInfos.findIndex((info) => info.id === effectId);
    if (index !== -1) {
      this.effectInfos.splice(index, 1);
      this.guitarAudioService.removeEffectById(effectId);
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
            // Pour l'instant, on ignore les mises à jour de decay mais on conserve le paramètre
            console.log(
              `Paramètre non modifiable à chaud: ${param.id}=${value}`
            );
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

  formatParamValue(value: number | string | boolean): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number') {
      // Formater les nombres avec 2 décimales
      return value.toFixed(2);
    }

    // Convertir les booléens et les chaînes en texte
    return String(value);
  }

  getEffectName(type: string): string {
    const effectNames: { [key: string]: string } = {
      delay: 'Delay',
      reverb: 'Reverb',
      distortion: 'Distortion',
      eq: 'Égaliseur',
      pitchShifter: 'Pitch Shifter',
      compressor: 'Compresseur',
      phaser: 'Phaser',
      flanger: 'Flanger',
      fuzz: 'Fuzz',
      overdrive: 'Overdrive',
    };
    return effectNames[type] || type;
  }

  loadSelectedTab(url: string) {
    console.log('Chargement de la tablature:', url);
    this.selectedTabUrl = url;
  }

  getInputDevices(): AudioDevice[] {
    return this.availableDevices.filter(device => device.kind === 'audioinput');
  }

  getOutputDevices(): AudioDevice[] {
    return this.availableDevices.filter(device => device.kind === 'audiooutput');
  }

  private setupVisualizer() {
    const canvas = this.visualizerCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawVisualizer = () => {
      const analyzer = this.guitarAudioService.getAnalyzer();
      if (!analyzer) return;

      const dataArray = analyzer.getValue() as Float32Array;
      const bufferLength = dataArray.length;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const y = ((v + 1) * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      this.animationFrameId = requestAnimationFrame(drawVisualizer);
    };

    drawVisualizer();
  }

  savePreset() {
    if (!this.newPresetName.trim()) return;

    const preset: Preset = {
      id: Date.now().toString(),
      name: this.newPresetName.trim(),
      effects: this.effectInfos.map((effect) => ({
        type: effect.type,
        params: effect.params.map((param) => ({
          id: param.id,
          value: param.value,
        })),
      })),
    };

    this.presets.push(preset);
    this.newPresetName = '';

    // Sauvegarder dans le localStorage
    localStorage.setItem('daw-presets', JSON.stringify(this.presets));
  }

  loadPreset(preset: Preset) {
    // Supprimer tous les effets actuels
    while (this.effectInfos.length > 0) {
      this.removeEffect(this.effectInfos[0].id);
    }

    // Recréer les effets du preset
    preset.effects.forEach((effectData) => {
      this.addEffect(effectData.type);
      const newEffect = this.effectInfos[this.effectInfos.length - 1];

      // Appliquer les paramètres
      effectData.params.forEach((paramData) => {
        const param = newEffect.params.find((p) => p.id === paramData.id);
        if (param) {
          this.updateEffectParam(newEffect, param, paramData.value);
        }
      });
    });
  }

  deletePreset(preset: Preset) {
    this.presets = this.presets.filter((p) => p.id !== preset.id);
    localStorage.setItem('daw-presets', JSON.stringify(this.presets));
  }

  // Méthodes pour le mix
  updateMasterVolume(value: number) {
    if (!this.isAudioContextStarted) return;
    this.guitarAudioService.setMasterVolume(Math.pow(10, value / 20));
  }

  updateMasterPan(value: number) {
    if (!this.isAudioContextStarted) return;
    this.guitarAudioService.setMasterPan(value);
  }

  private updateVuMeter() {
    const updateLevel = () => {
      if (!this.isAudioContextStarted) {
        this.vuMeterLevel = 0;
      } else {
        const analyzer = this.guitarAudioService.getAnalyzer();
        if (analyzer) {
          const data = analyzer.getValue() as Float32Array;
          // Calculer la valeur RMS
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
          }
          const rms = Math.sqrt(sum / data.length);
          // Convertir en pourcentage (0-100)
          this.vuMeterLevel = Math.min(100, Math.max(0, rms * 200));
        }
      }
      this.vuMeterAnimationId = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }

  // Méthodes pour le visualisateur
  updateVisualizerType() {
    // Le changement de type sera pris en compte au prochain frame
  }

  private setupMainVisualizer() {
    if (!this.mainVisualizerCanvas) return;

    const canvas = this.mainVisualizerCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajuster la taille du canvas
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const drawVisualizer = () => {
      const analyzer = this.guitarAudioService.getAnalyzer();
      if (!analyzer) return;

      const bufferLength = 1024; // Taille fixe du buffer
      const dataArray = new Float32Array(bufferLength);

      if (this.visualizerType === 'waveform') {
        analyzer.getValue(); // Met à jour les données
        this.drawWaveform(ctx, analyzer.getValue() as Float32Array, canvas.width, canvas.height);
      } else {
        analyzer.getValue(); // Met à jour les données
        this.drawFrequencyBars(ctx, analyzer.getValue() as Float32Array, canvas.width, canvas.height);
      }

      this.mainVisualizerAnimationId = requestAnimationFrame(drawVisualizer);
    };

    drawVisualizer();
  }

  private drawWaveform(ctx: CanvasRenderingContext2D, data: Float32Array, width: number, height: number) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();

    const sliceWidth = width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const y = (v + 1) * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  private drawFrequencyBars(ctx: CanvasRenderingContext2D, data: Float32Array, width: number, height: number) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Utiliser seulement la moitié des données pour une meilleure visualisation
    const usableDataLength = Math.floor(data.length / 2);
    const barWidth = width / usableDataLength;
    const minDb = -100;
    const maxDb = 0;

    for (let i = 0; i < usableDataLength; i++) {
      // Normaliser les données entre 0 et 1
      const db = Math.max(minDb, Math.min(maxDb, data[i]));
      const normalized = (db - minDb) / (maxDb - minDb);
      
      // Calculer la hauteur de la barre
      const barHeight = normalized * height;

      // Créer un dégradé de couleur basé sur la fréquence et l'amplitude
      const hue = (i / usableDataLength) * 270; // 0-270 degrés (violet à rouge)
      const saturation = 80 + normalized * 20; // 80-100%
      const lightness = 40 + normalized * 20; // 40-60%
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // Dessiner la barre
      const x = i * barWidth;
      const y = height - barHeight;
      ctx.fillRect(x, y, barWidth - 1, barHeight);

      // Ajouter un effet de brillance
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }

  selectDevice(deviceId: string, isInput: boolean) {
    if (!this.isAudioContextStarted) return;

    try {
      console.log(`Sélection du périphérique ${isInput ? 'entrée' : 'sortie'}:`, deviceId);
      if (isInput) {
        this.guitarAudioService.setInputDevice(deviceId);
      } else {
        this.guitarAudioService.setOutputDevice(deviceId);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du périphérique:', error);
    }
  }

  public updateYoutubeEmbed() {
    const videoId = this.extractVideoId(this.youtubeUrl);
    if (videoId) {
      this.youtubeEmbedUrl = `https://www.youtube.com/embed/${videoId}`;
      if (!this.isFavorite(this.youtubeUrl)) {
        this.updateVideoTitle(videoId);
      }
    } else {
      this.youtubeEmbedUrl = null;
    }
  }

  private extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  private async updateVideoTitle(videoId: string) {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      this.currentVideoTitle = data.title || 'Vidéo sans titre';
    } catch (error) {
      console.error('Erreur lors de la récupération du titre:', error);
      this.currentVideoTitle = 'Vidéo sans titre';
    }
  }

  loadFavorites() {
    const savedFavorites = localStorage.getItem('youtube-favorites');
    this.favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
  }

  async toggleFavorite(url: string) {
    if (!url || !this.youtubeEmbedUrl) return;

    if (this.isFavorite(url)) {
      this.favorites = this.favorites.filter(fav => fav.url !== url);
    } else {
      const videoId = this.extractVideoId(url);
      if (videoId) {
        try {
          const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          const data = await response.json();
          const title = data.title || 'Vidéo sans titre';
          this.favorites.push({ url, title });
        } catch (error) {
          console.error('Erreur lors de la récupération du titre:', error);
          this.favorites.push({ url, title: 'Vidéo sans titre' });
        }
      }
    }
    localStorage.setItem('youtube-favorites', JSON.stringify(this.favorites));
  }

  isFavorite(url: string): boolean {
    return this.favorites.some(fav => fav.url === url);
  }

  selectFavorite(url: string) {
    this.youtubeUrl = url;
    this.updateYoutubeEmbed();
  }

  onDeviceChange(deviceId: string, type: 'input' | 'output'): void {
    if (type === 'input') {
      this.guitarAudioService.setInputDevice(deviceId);
    } else {
      this.guitarAudioService.setOutputDevice(deviceId);
    }
  }

  public openSongsterrTab() {
    if (this.tabSearchQuery) {
      const songsterrUrl = `https://www.songsterr.com/a/wa/search?pattern=${encodeURIComponent(this.tabSearchQuery)}`;
      window.open(songsterrUrl, '_blank');
    }
  }

  removeFavorite(url: string) {
    this.favorites = this.favorites.filter(fav => fav.url !== url);
    localStorage.setItem('youtube-favorites', JSON.stringify(this.favorites));
  }
}
