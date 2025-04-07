import { Injectable, OnDestroy } from '@angular/core';
import * as Tone from 'tone';
import { BehaviorSubject } from 'rxjs';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuitarAudioService implements OnDestroy {
  private input: Tone.UserMedia | null = null;
  private effects: Map<string, Tone.ToneAudioNode> = new Map();
  private effectChain: Tone.ToneAudioNode[] = [];
  private effectIds: string[] = []; // Liste ordonnée des IDs d'effets
  private isInitialized = false;
  private isInputOpen = false;

  private availableDevicesSubject = new BehaviorSubject<AudioDevice[]>([]);
  availableDevices$ = this.availableDevicesSubject.asObservable();

  private currentDeviceSubject = new BehaviorSubject<string>('');
  currentDevice$ = this.currentDeviceSubject.asObservable();

  constructor() {
    // Ne pas créer UserMedia ici, attendre l'initialisation
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  async updateAvailableDevices() {
    try {
      // Assurer que le contexte est démarré pour énumérer
      if (Tone.context.state !== 'running') {
        console.warn(
          'Contexte audio non démarré, impossible de lister les périphériques.'
        );
        // Peut-être attendre ou retourner une liste vide ?
        // await Tone.start(); // Ne pas démarrer ici, doit être une action utilisateur
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label:
            device.label ||
            `Périphérique audio ${device.deviceId.substring(0, 5)}...`,
        }));

      this.availableDevicesSubject.next(audioInputs);

      // Pré-sélectionner si aucun n'est sélectionné et qu'il y en a de disponibles
      if (audioInputs.length > 0 && !this.currentDeviceSubject.value) {
        this.currentDeviceSubject.next(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error("Erreur lors de l'énumération des périphériques:", error);
      this.availableDevicesSubject.next([]); // Vider en cas d'erreur
    }
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    // Vérifier si le contexte audio est démarré (devrait l'être par l'UI)
    if (Tone.context.state !== 'running') {
      console.error(
        "Le contexte audio doit être démarré par une interaction utilisateur avant l'initialisation."
      );
      return false;
    }

    await this.updateAvailableDevices();
    const initialDeviceId = this.currentDeviceSubject.value;

    if (!initialDeviceId) {
      console.warn("Aucun périphérique d'entrée audio trouvé ou sélectionné.");
      // Essayer d'ouvrir l'entrée par défaut si possible ?
      // Pour l'instant, on considère que l'initialisation échoue sans device
      // return false;
      // Tentative avec l'entrée par défaut
      console.log("Tentative d'initialisation avec l'entrée par défaut.");
      try {
        this.input = new Tone.UserMedia();
        await this.input.open();
        this.isInputOpen = true;
        this.rebuildChain();
        this.isInitialized = true;
        return true;
      } catch (defaultError) {
        console.error(
          "Impossible d'ouvrir l'entrée audio par défaut.",
          defaultError
        );
        return false;
      }
    }

    console.log(`Initialisation avec le périphérique : ${initialDeviceId}`);
    const success = await this.selectDevice(initialDeviceId);
    this.isInitialized = success;
    return success;
  }

  async selectDevice(deviceId: string): Promise<boolean> {
    // Ne pas sélectionner si le contexte n'est pas prêt
    if (Tone.context.state !== 'running') {
      console.error(
        'Impossible de sélectionner le périphérique, contexte audio non démarré.'
      );
      return false;
    }

    // Si c'est le même device et qu'il est déjà ouvert, ne rien faire
    if (deviceId === this.currentDeviceSubject.value && this.isInputOpen) {
      return true;
    }

    console.log(`Sélection du périphérique: ${deviceId}`);

    try {
      // Fermer l'entrée précédente si elle existe et est ouverte
      await this.closeCurrentInput();

      // Créer et ouvrir la nouvelle entrée
      this.input = new Tone.UserMedia();
      await this.input.open(deviceId); // Passer deviceId à open
      this.isInputOpen = true;
      console.log(`Périphérique ${deviceId} ouvert avec succès.`);

      // Mettre à jour l'état et reconstruire la chaîne
      this.currentDeviceSubject.next(deviceId);
      this.rebuildChain();

      return true;
    } catch (error) {
      console.error(
        `Erreur lors de la sélection/ouverture du périphérique ${deviceId}:`,
        error
      );
      this.isInputOpen = false;
      this.input = null; // Nettoyer en cas d'erreur
      return false;
    }
  }

  private async closeCurrentInput() {
    if (this.input && this.isInputOpen) {
      console.log("Fermeture de l'entrée audio précédente.");
      try {
        this.input.close();
        await this.input.dispose(); // S'assurer que les ressources sont libérées
      } catch (disposeError) {
        console.warn(
          "Erreur lors de la fermeture/disposition de l'entrée précédente:",
          disposeError
        );
      }
      this.isInputOpen = false;
      this.input = null;
    }
  }

  private buildEffectChain(): Tone.ToneAudioNode | null {
    if (!this.input || !this.isInputOpen) {
      console.warn(
        "Impossible de construire la chaîne d'effets: entrée non prête."
      );
      return null;
    }

    // Déconnecter l'entrée de tout pour éviter les connexions multiples
    this.input.disconnect();

    // Reconstruire la chaîne d'effets basée sur l'ordre actuel des IDs
    this.effectChain = [];
    for (const id of this.effectIds) {
      const effect = this.effects.get(id);
      if (effect) {
        this.effectChain.push(effect);
      }
    }

    let current: Tone.ToneAudioNode = this.input;
    if (this.effectChain.length === 0) {
      console.log("Connexion directe de l'entrée à la destination.");
      current.toDestination();
    } else {
      console.log("Construction de la chaîne d'effets:", this.effectIds);
      this.effectChain.forEach((effect) => {
        // S'assurer que les anciens effets sont déconnectés avant de reconnecter
        effect.disconnect();
        console.log(`Connexion ${current.name} -> ${effect.name}`);
        current.connect(effect);
        current = effect;
      });
      console.log(`Connexion ${current.name} -> Destination`);
      current.toDestination();
    }
    return current; // Retourne le dernier nœud de la chaîne (ou l'entrée si vide)
  }

  addEffect(id: string, effectInstance: Tone.ToneAudioNode) {
    if (this.effects.has(id)) {
      console.warn(`L'effet avec ID ${id} existe déjà.`);
      return; // Éviter les doublons
    }
    this.effects.set(id, effectInstance);
    this.effectIds.push(id);
    this.rebuildChain();
  }

  removeEffect(id: string) {
    const effectInstance = this.effects.get(id);
    if (effectInstance) {
      const index = this.effectIds.indexOf(id);
      if (index > -1) {
        this.effectIds.splice(index, 1);
        this.effects.delete(id);
        // Disposer l'effet pour libérer les ressources audio
        try {
          effectInstance.disconnect();
          effectInstance.dispose();
          console.log(`Effet ${id} supprimé et disposé.`);
        } catch (disposeError) {
          console.warn(
            `Erreur lors de la disposition de l'effet ${id}:`,
            disposeError
          );
        }
        this.rebuildChain();
      } else {
        console.warn(
          `Effet ${id} trouvé dans la map mais pas dans la liste d'IDs.`
        );
        // Nettoyer la map par sécurité
        this.effects.delete(id);
      }
    } else {
      console.warn(`Tentative de suppression d'un effet inexistant: ${id}`);
    }
  }

  reorderEffects(newOrder: string[]) {
    // Vérifier que tous les IDs existent
    const validIds = newOrder.filter((id) => this.effects.has(id));

    // Si la longueur est différente, il y a des IDs invalides
    if (validIds.length !== newOrder.length) {
      console.warn(
        'Certains IDs dans newOrder ne correspondent pas à des effets existants'
      );
    }

    // Si aucun ID valide, ne rien faire
    if (validIds.length === 0) {
      console.warn('Aucun ID valide fourni pour la réorganisation');
      return;
    }

    // Vérifier s'il y a un changement réel dans l'ordre
    let changed = false;
    if (validIds.length !== this.effectIds.length) {
      changed = true;
    } else {
      for (let i = 0; i < validIds.length; i++) {
        if (validIds[i] !== this.effectIds[i]) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      console.log("Réorganisation de la chaîne d'effets:", validIds);
      this.effectIds = validIds;
      this.rebuildChain();
    } else {
      console.log("Aucun changement d'ordre détecté.");
    }
  }

  private rebuildChain() {
    // Reconstruire seulement si l'entrée est prête
    if (this.input && this.isInputOpen) {
      console.log('Reconstruction de la chaîne audio...');
      this.buildEffectChain();
    } else {
      console.warn(
        "Demande de reconstruction de chaîne, mais l'entrée n'est pas prête."
      );
    }
  }

  dispose() {
    console.log('Disposition de GuitarAudioService...');
    this.closeCurrentInput();
    this.effectChain.forEach((effect) => {
      try {
        effect.dispose();
      } catch (e) {
        console.warn('Erreur disposition effet:', e);
      }
    });
    this.effects.clear();
    this.effectChain = [];
    this.effectIds = [];
    this.isInitialized = false;
  }
}
