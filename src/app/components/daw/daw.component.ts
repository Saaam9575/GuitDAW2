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
    TabSearchComponent,
    TabViewerComponent,
  ],
  templateUrl: './daw.component.html',
  styleUrls: ['./daw.component.scss'],
  providers: [GuitarAudioService],
})
export class DawComponent implements OnInit, OnDestroy {
  effects: string[] = [];
  isInitialized = false;
  isPlaying = false;
  isAudioContextStarted = false;

  availableDevices: AudioDevice[] = [];
  selectedDeviceId = '';

  isDeviceDrawerVisible = false;

  selectedTabUrl: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(public guitarAudioService: GuitarAudioService) {}

  ngOnInit() {
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

  onDrop(event: CdkDragDrop<string[]>) {
    if (!this.isAudioContextStarted) return;
    moveItemInArray(this.effects, event.previousIndex, event.currentIndex);
    this.guitarAudioService.reorderEffects(this.effects);
  }

  addEffect(effectType: string) {
    if (!this.isAudioContextStarted) return;
    let effect: Tone.ToneAudioNode | undefined;

    switch (effectType) {
      case 'delay':
        effect = new Tone.FeedbackDelay('8n', 0.5);
        break;
      case 'reverb':
        effect = new Tone.Reverb(3);
        break;
      case 'distortion':
        effect = new Tone.Distortion(0.8);
        break;
      case 'eq':
        effect = new Tone.EQ3();
        break;
    }

    if (effect) {
      this.effects.push(effectType);
      this.guitarAudioService.addEffect(effectType, effect);
    }
  }

  removeEffect(effectType: string) {
    if (!this.isAudioContextStarted) return;
    const index = this.effects.indexOf(effectType);
    if (index > -1) {
      this.effects.splice(index, 1);
      this.guitarAudioService.removeEffect(effectType);
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
