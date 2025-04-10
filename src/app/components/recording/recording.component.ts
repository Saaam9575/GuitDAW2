import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { GuitarAudioService } from '../../services/guitar-audio.service';
import * as Tone from 'tone';

@Component({
  selector: 'app-recording',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzIconModule,
    NzMessageModule
  ],
  template: `
    <div class="recording-container">
      <div class="mic-permission-warning" *ngIf="!hasMicrophonePermission">
        <span nz-icon nzType="warning" nzTheme="outline"></span>
        <div class="warning-text">
          <h4>Accès au microphone requis</h4>
          <p>Pour enregistrer, veuillez autoriser l'accès au microphone dans les paramètres de votre navigateur.</p>
          <button nz-button nzType="primary" (click)="requestMicrophonePermission()">
            <span nz-icon nzType="audio" nzTheme="outline"></span>
            Autoriser le microphone
          </button>
        </div>
      </div>

      <div class="controls" *ngIf="hasMicrophonePermission">
        <button 
          nz-button 
          [nzType]="isRecording ? 'primary' : 'default'"
          (click)="toggleRecording()"
          [nzDanger]="isRecording"
        >
          <span nz-icon [nzType]="isRecording ? 'stop' : 'audio'" nzTheme="outline"></span>
          {{ isRecording ? 'Stop' : 'Start Recording' }}
        </button>
        
        <button 
          nz-button 
          (click)="saveRecording()"
          [disabled]="!recordedChunks.length"
        >
          <span nz-icon nzType="save" nzTheme="outline"></span>
          Save Recording
        </button>
      </div>

      <div class="recording-status" *ngIf="isRecording">
        <span nz-icon nzType="loading" nzTheme="outline" nzSpin></span>
        Recording in progress...
        <div class="recording-time">{{ recordingTime }}</div>
      </div>

      <div class="playback" *ngIf="audioUrl">
        <audio controls [src]="audioUrl" #audioPlayer></audio>
      </div>
    </div>
  `,
  styles: [`
    .recording-container {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .mic-permission-warning {
      background: #2a2a2a;
      border: 1px solid #ff4d4f;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .mic-permission-warning span[nz-icon] {
      font-size: 24px;
      color: #ff4d4f;
    }

    .warning-text {
      flex: 1;
    }

    .warning-text h4 {
      color: #fff;
      margin-bottom: 8px;
    }

    .warning-text p {
      color: #fff;
      opacity: 0.8;
      margin-bottom: 16px;
    }

    .controls {
      display: flex;
      gap: 10px;
    }

    .recording-status {
      color: #ff4d4f;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .recording-time {
      font-family: monospace;
      font-size: 1.2em;
      color: #fff;
    }

    .playback {
      margin-top: 20px;
    }

    audio {
      width: 100%;
      background: #2a2a2a;
      border-radius: 8px;
      height: 40px;
    }

    audio::-webkit-media-controls-panel {
      background: #2a2a2a;
    }

    audio::-webkit-media-controls-current-time-display,
    audio::-webkit-media-controls-time-remaining-display {
      color: #fff;
    }

    audio::-webkit-media-controls-timeline {
      background-color: #1f1f1f;
      border-radius: 4px;
      height: 4px;
    }

    audio::-webkit-media-controls-volume-slider {
      background-color: #1f1f1f;
      border-radius: 4px;
      padding: 0;
    }
  `]
})
export class RecordingComponent implements OnInit, OnDestroy {
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  isRecording = false;
  audioUrl: string | null = null;
  recordingTime = '00:00';
  hasMicrophonePermission = false;
  private timer: any;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  constructor(
    private message: NzMessageService,
    private guitarAudioService: GuitarAudioService
  ) {
    // Ne plus créer de nouveau contexte audio ici
  }

  ngOnInit() {
    this.checkMicrophonePermission();
  }

  ngOnDestroy() {
    this.stopRecording();
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
  }

  private async checkMicrophonePermission() {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.hasMicrophonePermission = result.state === 'granted';
      
      result.addEventListener('change', () => {
        this.hasMicrophonePermission = result.state === 'granted';
        if (result.state === 'granted') {
          this.setupRecording();
        }
      });

      if (this.hasMicrophonePermission) {
        this.setupRecording();
      }
    } catch (err) {
      console.error('Error checking microphone permission:', err);
      // Si on ne peut pas vérifier les permissions, on essaie quand même de configurer l'enregistrement
      this.setupRecording();
    }
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16
        } 
      });
      stream.getTracks().forEach(track => track.stop()); // On arrête le stream tout de suite
      this.hasMicrophonePermission = true;
      this.setupRecording();
      this.message.success('Accès au microphone autorisé');
    } catch (err) {
      console.error('Error requesting microphone permission:', err);
      this.message.error('Impossible d\'accéder au microphone. Veuillez vérifier les permissions dans les paramètres de votre navigateur.');
    }
  }

  private async setupRecording() {
    try {
      // S'assurer que Tone.js est démarré
      await Tone.start();
      
      // Obtenir un flux audio pour l'enregistrement direct
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16
        } 
      });
      
      // Utiliser le contexte audio de Tone.js
      const audioContext = Tone.getContext().rawContext as AudioContext;
      
      // Nœuds pour l'enregistrement direct
      this.sourceNode = audioContext.createMediaStreamSource(stream);
      this.destinationNode = audioContext.createMediaStreamDestination();

      if (!this.sourceNode || !this.destinationNode) {
        throw new Error('Failed to create audio nodes');
      }

      // Configurer l'analyseur pour le visualisateur
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      console.log('Initialisation du système d\'enregistrement et des effets...');
      
      // MÉTHODE SIMPLE: Activer le microphone directement dans la chaîne d'effets pour le monitoring
      // Cette méthode utilise uniquement Tone.js pour les effets et le monitoring
      const effectsEnabled = this.guitarAudioService.connectInternalMicToEffects();
      
      if (effectsEnabled) {
        console.log('✅ Monitoring avec chaîne d\'effets activé');
      } else {
        console.warn('⚠️ Impossible d\'activer les effets pour le monitoring');
      }
      
      // FLUX SÉPARÉ: Enregistrement direct sans effets (fiable)
      // Configurer un flux séparé pour l'enregistrement (sans effets)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.5; // Amplification modérée
      
      // Chaîne d'enregistrement: Source -> Gain -> Analyseur -> Destination d'enregistrement
      this.sourceNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(this.destinationNode);
      
      // Si les effets ne fonctionnent pas pour le monitoring, utiliser ce flux
      if (!effectsEnabled) {
        console.log('Activation du monitoring direct (sans effets)');
        gainNode.connect(audioContext.destination);
      }
      
      console.log('✅ Système d\'enregistrement configuré');
      console.log('   - Monitoring: ' + (effectsEnabled ? 'Avec effets (Tone.js)' : 'Direct (sans effets)'));
      console.log('   - Enregistrement: Direct (sans effets)');

      // Monitorer le volume en temps réel (pour débogage)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (this.isRecording) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          
          // Afficher uniquement les valeurs significatives pour éviter le spam
          if (average > 20) {
            console.log('Volume actuel:', average.toFixed(0));
          }
          
          requestAnimationFrame(checkVolume);
        }
      };

      // Configurer le MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
        if (this.audioUrl) {
          URL.revokeObjectURL(this.audioUrl);
        }
        this.audioUrl = URL.createObjectURL(audioBlob);
      };

      // Démarrer le monitoring du volume
      checkVolume();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      this.hasMicrophonePermission = false;
      this.message.error('Impossible d\'accéder au microphone. Veuillez vérifier les permissions dans les paramètres de votre navigateur.');
    }
  }

  toggleRecording() {
    if (!this.mediaRecorder) {
      this.message.error('Recording is not available');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private startRecording() {
    this.recordedChunks = [];
    this.audioUrl = null;
    this.isRecording = true;
    this.mediaRecorder?.start();
    this.startTimer();
  }

  private stopRecording() {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.stopTimer();
  }

  private startTimer() {
    let seconds = 0;
    this.timer = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      this.recordingTime = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  saveRecording() {
    if (!this.recordedChunks.length) {
      this.message.warning('No recording to save');
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
} 