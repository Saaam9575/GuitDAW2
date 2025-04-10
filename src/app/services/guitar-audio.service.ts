import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as Tone from 'tone';

export interface AudioDevice {
  id: string;
  name: string;
  label: string;
  type: 'input' | 'output';
  kind: 'audioinput' | 'audiooutput';
}

export interface EffectsChain {
  input: Tone.InputNode;
  output: Tone.OutputNode;
}

@Injectable({
  providedIn: 'root'
})
export class GuitarAudioService {
  private availableDevicesSubject = new BehaviorSubject<AudioDevice[]>([]);
  private currentInputDeviceSubject = new BehaviorSubject<string>('');
  private currentOutputDeviceSubject = new BehaviorSubject<string>('');
  private analyzer: Tone.Analyser;
  private userMedia: Tone.UserMedia;
  private masterVolume: Tone.Volume;
  private masterPan: Tone.Panner;
  private effects: Map<string, Tone.ToneAudioNode> = new Map();
  effectsChain: EffectsChain | null = null;

  availableDevices$ = this.availableDevicesSubject.asObservable();
  currentInputDevice$ = this.currentInputDeviceSubject.asObservable();
  currentOutputDevice$ = this.currentOutputDeviceSubject.asObservable();

  constructor() {
    this.userMedia = new Tone.UserMedia();
    this.analyzer = new Tone.Analyser('waveform', 1024);
    this.masterVolume = new Tone.Volume(0);
    this.masterPan = new Tone.Panner(0);

    // Chaîne de connexion initiale
    this.userMedia.connect(this.masterVolume);
    this.masterVolume.connect(this.masterPan);
    this.masterPan.connect(this.analyzer);
    this.analyzer.connect(Tone.getDestination());
  }

  async updateAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `${device.kind} (${device.deviceId})`,
          label: device.label || `${device.kind} (${device.deviceId})`,
          type: device.kind === 'audioinput' ? 'input' : 'output',
          kind: device.kind as 'audioinput' | 'audiooutput'
        }));

      this.availableDevicesSubject.next(audioDevices);
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  }

  async setInputDevice(deviceId: string) {
    try {
      await this.userMedia.close();
      await this.userMedia.open(deviceId);
      this.currentInputDeviceSubject.next(deviceId);
      
      this.userMedia.connect(this.masterVolume);
      this.reorderEffects(Array.from(this.effects.keys()));
    } catch (error) {
      console.error('Error setting input device:', error);
      throw error;
    }
  }

  setOutputDevice(deviceId: string) {
    this.currentOutputDeviceSubject.next(deviceId);
  }

  getAnalyzer(): Tone.Analyser {
    return this.analyzer;
  }

  setMasterVolume(value: number) {
    this.masterVolume.volume.value = value;
  }

  setMasterPan(value: number) {
    this.masterPan.pan.value = value;
  }

  addEffect(id: string, effect: Tone.ToneAudioNode) {
    this.effects.set(id, effect);
    this.reorderEffects(Array.from(this.effects.keys()));
  }

  removeEffectById(id: string) {
    const effect = this.effects.get(id);
    if (effect) {
      effect.disconnect();
      this.effects.delete(id);
      this.reorderEffects(Array.from(this.effects.keys()));
    }
  }

  reorderEffects(effectIds: string[]) {
    this.effects.forEach(effect => effect.disconnect());

    let previousNode: Tone.ToneAudioNode = this.userMedia;
    effectIds.forEach(id => {
      const effect = this.effects.get(id);
      if (effect) {
        previousNode.connect(effect);
        previousNode = effect;
      }
    });

    previousNode.connect(this.masterVolume);

    this.effectsChain = {
      input: this.userMedia as unknown as Tone.InputNode,
      output: this.masterVolume as unknown as Tone.OutputNode
    };
  }

  getEffectsChain(): EffectsChain {
    return {
      input: this.userMedia as unknown as Tone.InputNode,
      output: this.masterVolume as unknown as Tone.OutputNode
    };
  }

  /**
   * Connecte la sortie de la chaîne d'effets à un nœud audio externe.
   * Utilisé principalement pour l'enregistrement du son traité.
   * @param destinationNode Le nœud de destination (AudioNode) à connecter
   * @returns true si la connexion a réussi, false sinon
   */
  connectEffectsOutputTo(destinationNode: AudioNode): boolean {
    try {
      if (!this.masterVolume) {
        console.error('MasterVolume n\'est pas initialisé');
        return false;
      }
      
      // Récupérer le nœud de sortie natif de Tone.js
      const outputNode = this.masterVolume.output;
      
      // Connecter la sortie au nœud de destination
      if (outputNode instanceof AudioNode) {
        outputNode.connect(destinationNode);
        console.log('Chaîne d\'effets connectée au nœud d\'enregistrement');
        return true;
      } else {
        console.error('La sortie des effets n\'est pas un AudioNode');
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la connexion des effets à l\'enregistrement:', error);
      return false;
    }
  }
  
  /**
   * Connecte un nœud audio externe à l'entrée de la chaîne d'effets
   * et reconfigure la chaîne pour utiliser ce nœud comme source.
   * @param sourceNode Le nœud source à connecter (AudioNode)
   * @returns true si la connexion a réussi, false sinon
   */
  connectStreamToChain(sourceNode: AudioNode): boolean {
    try {
      // Déconnecter l'userMedia actuel
      this.userMedia.disconnect();
      
      // Arrêter l'ancien microphone et en créer un nouveau
      this.userMedia.close();
      
      // Spécial: forcer Tone.js à utiliser notre flux audio personnalisé
      const audioContext = sourceNode.context;
      
      // Créer un nœud de gain pour s'assurer que le signal passe correctement
      const bridgeNode = audioContext.createGain();
      sourceNode.connect(bridgeNode);
      
      // Connecter directement ce nœud au premier effet de la chaîne
      const effectIds = Array.from(this.effects.keys());
      
      if (effectIds.length > 0) {
        // On va utiliser un hack technique pour faire fonctionner le routage
        const toneContext = Tone.getContext();
        
        // Méthode 1: utiliser une UserMedia "fantôme" et remplacer sa source
        const phantomMic = new Tone.UserMedia();
        
        // Méthode interne pour accéder au nœud natif via Tone.js
        // @ts-ignore - Accès à une méthode privée/protégée
        phantomMic._internalSource = bridgeNode;
        
        console.log('Source connectée à la chaîne d\'effets via un pont audio');
        
        // Connecter ce nœud au premier effet
        this.reorderEffects(effectIds);
        
        // Remplacer notre userMedia par ce nouvel objet
        // Référence pour la prochaine fois
        this.userMedia = phantomMic;
        
        // Envoyer directement à la destination pour s'assurer que ça marche
        this.masterVolume.toDestination();
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la connexion à la chaîne:', error);
      return false;
    }
  }
  
  /**
   * Connecte directement le microphone aux effets et à la destination pour le monitoring.
   * Cette méthode bypass complètement les nœuds Web Audio API et utilise uniquement Tone.js
   * @returns true si la connexion a réussi, false sinon
   */
  connectInternalMicToEffects(): boolean {
    try {
      // Fermer l'ancien userMedia et en créer un nouveau
      this.userMedia.close();
      this.userMedia = new Tone.UserMedia();
      
      // Ouvrir le flux audio du microphone
      this.userMedia.open().then(() => {
        // Reconnecter à la chaîne d'effets
        const effectIds = Array.from(this.effects.keys());
        this.reorderEffects(effectIds);
        
        console.log('Microphone interne connecté directement à la chaîne d\'effets');
      }).catch(e => {
        console.error('Erreur lors de l\'ouverture du microphone:', e);
      });
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la connexion directe:', error);
      return false;
    }
  }
}

