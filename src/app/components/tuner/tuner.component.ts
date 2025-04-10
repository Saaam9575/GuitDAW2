import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-tuner',
  standalone: true,
  imports: [CommonModule, NzModalModule, NzMessageModule],
  template: `
    <div class="tuner-container" role="complementary" aria-label="Accordeur de guitare">
      <div *ngIf="error" class="error-message" role="alert">
        {{ error }}
      </div>
      <div *ngIf="!error" class="tuner-content">
        <div class="note-display" role="status" aria-live="polite">
          <div class="current-note" aria-label="Note détectée">{{ currentNote || '-' }}</div>
          <div class="tuning-indicator" role="meter" aria-label="Indicateur d'accord" 
               aria-valuemin="-50" aria-valuemax="50" [attr.aria-valuenow]="tuningOffset">
            <div class="indicator-line"></div>
            <div class="indicator-bar" [style.transform]="'translateX(' + tuningOffset + 'px)'"></div>
          </div>
          <div class="frequency" aria-label="Fréquence">{{ frequency.toFixed(1) }} Hz</div>
        </div>
        <div class="reference-notes" role="list" aria-label="Notes de référence">
          <div *ngFor="let note of standardTuning" 
               [class.active]="note === currentNote"
               class="reference-note"
               role="listitem"
               [attr.aria-current]="note === currentNote">
            {{ note }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tuner-container {
      background: #1f1f1f;
      padding: 20px;
      border-radius: 8px;
      width: 300px;
      margin: 0 auto;
    }

    .error-message {
      color: #ff4d4f;
      text-align: center;
      padding: 20px;
      font-size: 14px;
    }

    .tuner-content {
      opacity: 1;
      transition: opacity 0.3s ease;
    }

    .note-display {
      text-align: center;
      margin-bottom: 20px;
    }

    .current-note {
      font-size: 48px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 10px;
    }

    .tuning-indicator {
      width: 200px;
      height: 4px;
      background: #333;
      margin: 10px auto;
      position: relative;
      border-radius: 2px;
    }

    .indicator-line {
      position: absolute;
      left: 50%;
      height: 12px;
      width: 2px;
      background: #666;
      top: -4px;
      transform: translateX(-50%);
    }

    .indicator-bar {
      width: 10px;
      height: 20px;
      background: #1890ff;
      position: absolute;
      top: -8px;
      left: 95px;
      border-radius: 3px;
      transition: transform 0.1s ease;
    }

    .frequency {
      font-size: 14px;
      color: #888;
    }

    .reference-notes {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 20px;
    }

    .reference-note {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #333;
      color: #fff;
      font-weight: bold;
      transition: background-color 0.2s ease;
    }

    .reference-note.active {
      background: #1890ff;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `]
})
export class TunerComponent implements OnInit, OnDestroy {
  currentNote: string = '';
  frequency: number = 0;
  tuningOffset: number = 0;
  standardTuning = ['E', 'A', 'D', 'G', 'B', 'E'];
  error: string | null = null;
  
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;
  private animationId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(private message: NzMessageService) {}

  ngOnInit() {
    this.initAudioContext();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private async initAudioContext() {
    try {
      // Vérifier si le navigateur supporte l'API Web Audio
      if (!window.AudioContext) {
        throw new Error("Votre navigateur ne supporte pas l'API Web Audio");
      }

      // Demander la permission d'accès au microphone
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      
      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
      this.error = null;
      this.updatePitch();
      
    } catch (error: any) {
      console.error('Erreur lors de l\'initialisation de l\'accordeur:', error);
      if (error.name === 'NotAllowedError') {
        this.error = "Veuillez autoriser l'accès au microphone pour utiliser l'accordeur";
      } else {
        this.error = "Une erreur est survenue lors de l'initialisation de l'accordeur";
      }
      this.message.error(this.error);
    }
  }

  private updatePitch() {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getFloatTimeDomainData(this.dataArray);
    const pitch = this.autoCorrelate(this.dataArray, this.audioContext!.sampleRate);
    
    if (pitch !== -1) {
      this.frequency = pitch;
      this.currentNote = this.getNoteFromFrequency(pitch);
      this.tuningOffset = this.calculateTuningOffset(pitch);
    }

    this.animationId = requestAnimationFrame(() => this.updatePitch());
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE/2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;
    let foundGoodCorrelation = false;

    // Calculer RMS et vérifier le niveau sonore
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let lastCorrelation = 1;
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      let sumX = 0, sumY = 0;
      
      for (let i = 0; i < MAX_SAMPLES; i++) {
        const x = buffer[i];
        const y = buffer[i + offset];
        sumX += x * x;
        sumY += y * y;
        correlation += x * y;
      }
      
      // Normalisation de la corrélation
      correlation = correlation / Math.sqrt(sumX * sumY);

      if (correlation > 0.9 && correlation > lastCorrelation) {
        foundGoodCorrelation = true;
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      } else if (foundGoodCorrelation) {
        break;
      }
      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01) {
      return sampleRate / bestOffset;
    }
    return -1;
  }

  private getNoteFromFrequency(frequency: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const a4 = 440;
    const c0 = a4 * Math.pow(2, -4.75);
    const halfStepsBelowMiddleC = Math.round(12 * Math.log2(frequency / c0));
    const octave = Math.floor(halfStepsBelowMiddleC / 12);
    const noteIndex = (halfStepsBelowMiddleC % 12 + 12) % 12;
    return notes[noteIndex];
  }

  private calculateTuningOffset(frequency: number): number {
    const closestNote = this.getNoteFromFrequency(frequency);
    const expectedFrequency = this.getFrequencyFromNote(closestNote);
    const cents = 1200 * Math.log2(frequency / expectedFrequency);
    // Limiter le déplacement de l'indicateur
    return Math.max(-50, Math.min(50, cents / 2));
  }

  private getFrequencyFromNote(note: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const a4 = 440;
    const noteIndex = notes.indexOf(note);
    if (noteIndex === -1) return a4;
    return a4 * Math.pow(2, (noteIndex - 9) / 12);
  }
} 