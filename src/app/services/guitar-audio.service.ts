import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as Tone from 'tone';

export interface AudioDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

@Injectable({
  providedIn: 'root',
})
export class GuitarAudioService {
  public availableDevices$ = new BehaviorSubject<AudioDevice[]>([]);
  public currentInputDevice$ = new BehaviorSubject<string>('');
  public currentOutputDevice$ = new BehaviorSubject<string>('');

  private inputNode: Tone.UserMedia | null = null;
  private outputNode: Tone.Gain | null = null;
  private analyzer: Tone.Analyser | null = null;
  private masterVolume: Tone.Volume | null = null;
  private masterPan: Tone.Panner | null = null;

  private effectChain: Map<string, Tone.ToneAudioNode> = new Map();
  private effectOrder: string[] = [];

  constructor() {
    this.initAudio();
  }

  private async initAudio() {
    try {
      // Démarrer Tone.js
      await Tone.start();

      // Demander l'autorisation d'accès aux périphériques audio
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Créer les noeuds audio de base
      this.inputNode = new Tone.UserMedia();
      await this.inputNode.open(); // Ouvrir avec le périphérique par défaut

      this.outputNode = new Tone.Gain();

      // Créer l'analyseur avec une taille de buffer plus grande pour une meilleure visualisation
      this.analyzer = new Tone.Analyser('waveform', 1024);

      // Créer les contrôleurs de mix
      this.masterVolume = new Tone.Volume(0);
      this.masterPan = new Tone.Panner(0);

      // Connexion de base: input -> analyser -> masterVolume -> masterPan -> output
      this.inputNode.connect(this.analyzer);
      this.inputNode.connect(this.masterVolume);
      this.masterVolume.connect(this.masterPan);
      this.masterPan.connect(this.outputNode);
      this.outputNode.toDestination();

      // Mettre à jour la liste des périphériques
      await this.updateAvailableDevices();

      console.log('Service audio initialisé avec succès');
    } catch (error) {
      console.error("Erreur d'initialisation du service audio:", error);
    }
  }

  public async updateAvailableDevices(): Promise<void> {
    try {
      // Demander l'autorisation d'accès aux périphériques audio
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices
        .filter(
          (device) =>
            device.kind === 'audioinput' || device.kind === 'audiooutput'
        )
        .map((device) => ({
          id: device.deviceId,
          label: device.label || `Périphérique ${device.kind}`,
          kind: device.kind as 'audioinput' | 'audiooutput',
        }));

      this.availableDevices$.next(audioDevices);
      console.log('Périphériques audio détectés:', audioDevices);
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour des périphériques audio:',
        error
      );
      this.availableDevices$.next([]);
    }
  }

  public async selectInputDevice(deviceId: string): Promise<void> {
    try {
      if (this.inputNode) {
        // Arrêter le flux actuel
        await this.inputNode.close();

        // Ouvrir avec le nouveau périphérique
        await this.inputNode.open(deviceId);
        this.currentInputDevice$.next(deviceId);
        console.log(`Périphérique d'entrée sélectionné: ${deviceId}`);
      }
    } catch (error) {
      console.error(
        "Erreur lors de la sélection du périphérique d'entrée:",
        error
      );
    }
  }

  public selectOutputDevice(deviceId: string): void {
    // Tone.js ne supporte pas directement le changement de périphérique de sortie
    // Cela nécessiterait une implémentation personnalisée avec l'API Web Audio
    console.log(
      `Sélection du périphérique de sortie non supportée: ${deviceId}`
    );
    this.currentOutputDevice$.next(deviceId);
  }

  public addEffect(effectId: string, effect: Tone.ToneAudioNode): void {
    if (!this.masterVolume) return;

    // Ajouter à notre map d'effets
    this.effectChain.set(effectId, effect);
    this.effectOrder.push(effectId);

    // Reconstruire la chaîne d'effets
    this.rebuildEffectChain();
  }

  public removeEffectById(effectId: string): void {
    if (this.effectChain.has(effectId)) {
      this.effectChain.delete(effectId);
      this.effectOrder = this.effectOrder.filter((id) => id !== effectId);
      this.rebuildEffectChain();
    }
  }

  public reorderEffects(newOrder: string[]): void {
    // Vérifier que tous les IDs sont présents
    if (
      newOrder.length === this.effectOrder.length &&
      newOrder.every((id) => this.effectChain.has(id))
    ) {
      this.effectOrder = [...newOrder];
      this.rebuildEffectChain();
    }
  }

  private rebuildEffectChain(): void {
    if (!this.inputNode || !this.masterVolume) return;

    // Déconnecter tous les noeuds
    this.inputNode.disconnect();

    // Si aucun effet, connexion directe
    if (this.effectOrder.length === 0) {
      if (this.analyzer) {
        this.inputNode.connect(this.analyzer);
      }
      this.inputNode.connect(this.masterVolume);
      return;
    }

    // Sinon, construire la chaîne d'effets
    let previousNode: Tone.ToneAudioNode = this.inputNode;

    // Connecter l'entrée à l'analyseur en premier
    if (this.analyzer) {
      previousNode.connect(this.analyzer);
    }

    // Puis construire la chaîne d'effets
    for (const effectId of this.effectOrder) {
      const effect = this.effectChain.get(effectId);
      if (effect) {
        previousNode.connect(effect);
        previousNode = effect;
      }
    }

    // Connecter le dernier effet au volume
    previousNode.connect(this.masterVolume);
  }

  public setMasterVolume(value: number): void {
    if (this.masterVolume) {
      this.masterVolume.volume.value = 20 * Math.log10(value);
    }
  }

  public setMasterPan(value: number): void {
    if (this.masterPan) {
      this.masterPan.pan.value = value;
    }
  }

  public getAnalyzer(): Tone.Analyser | null {
    return this.analyzer;
  }

  // Getters pour les observables
  public get availableDevices() {
    return this.availableDevices$.asObservable();
  }

  public get currentInputDevice() {
    return this.currentInputDevice$.asObservable();
  }

  public get currentOutputDevice() {
    return this.currentOutputDevice$.asObservable();
  }
}
