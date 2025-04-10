import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-metronome',
  standalone: true,
  imports: [CommonModule, FormsModule, NzInputNumberModule, NzButtonModule, NzIconModule],
  template: `
    <div class="metronome-container">
      <label for="bpm-input" class="bpm-label">BPM</label>
      <nz-input-number
        id="bpm-input"
        name="bpm"
        [(ngModel)]="bpm"
        [nzMin]="30"
        [nzMax]="250"
        [nzStep]="1"
        [nzPlaceHolder]="'Tempo en BPM'"
        [attr.aria-label]="'Contrôle du tempo en battements par minute'"
      ></nz-input-number>
      <button 
        nz-button 
        nzType="default" 
        (click)="toggleMetronome()"
        [class.playing]="isPlaying"
        [attr.aria-label]="(isPlaying ? 'Arrêter' : 'Démarrer') + ' le métronome'"
      >
        <span nz-icon [nzType]="isPlaying ? 'pause' : 'play-circle'" nzTheme="outline"></span>
      </button>
    </div>
  `,
  styles: [`
    .metronome-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bpm-label {
      color: #fff;
      margin-right: 4px;
    }

    button {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .playing {
      color: #1890ff;
    }
  `]
})
export class MetronomeComponent implements OnDestroy {
  bpm: number = 120;
  isPlaying: boolean = false;
  private audioContext: AudioContext | null = null;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  private current16thNote: number = 0;

  constructor() {
    this.audioContext = new AudioContext();
  }

  ngOnDestroy() {
    this.stopMetronome();
    this.audioContext?.close();
  }

  toggleMetronome() {
    if (this.isPlaying) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
    this.isPlaying = !this.isPlaying;
  }

  updateBpm(newBpm: number) {
    this.bpm = newBpm;
    if (this.isPlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }

  private startMetronome() {
    if (!this.audioContext) return;
    
    this.nextNoteTime = this.audioContext.currentTime;
    this.scheduler();
  }

  private stopMetronome() {
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private scheduler() {
    if (!this.audioContext) return;

    while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.frequency.value = beatNumber % 16 === 0 ? 880.0 : 440.0;
    envelope.gain.value = 1.0;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.03);
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.current16thNote++;
    if (this.current16thNote === 16) {
      this.current16thNote = 0;
    }
  }
} 