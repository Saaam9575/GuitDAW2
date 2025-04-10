import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzInputModule } from 'ng-zorro-antd/input';
import { DragDropModule } from '@angular/cdk/drag-drop';
import * as Tone from 'tone';
import { GuitarAudioService } from '../../services/guitar-audio.service';

interface AudioTrack {
  id: string;
  name: string;
  segments: AudioSegment[];
  volume: number;
  muted: boolean;
  soloed: boolean;
  color: string;
}

interface AudioSegment {
  id: string;
  startTime: number;
  duration: number;
  buffer: AudioBuffer;
  offset: number;
  selected: boolean;
}

@Component({
  selector: 'app-recording-studio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSliderModule,
    NzInputModule,
    DragDropModule
  ],
  template: `
    <div class="studio-container">
      <!-- Transport Controls -->
      <div class="transport-controls">
        <button nz-button nzType="primary" (click)="togglePlayback()">
          <i nz-icon [nzType]="isPlaying ? 'pause' : 'play-circle'" nzTheme="outline"></i>
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
        <button nz-button nzType="primary" [nzDanger]="isRecording" (click)="toggleRecording()">
          <i nz-icon [nzType]="isRecording ? 'stop' : 'audio'" nzTheme="outline"></i>
          {{ isRecording ? 'Stop' : 'Record' }}
        </button>
        <div class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}</div>
      </div>

      <!-- Timeline -->
      <div class="timeline" #timeline>
        <div class="time-markers">
          <!-- Time markers will be generated dynamically -->
        </div>
      </div>

      <!-- Tracks -->
      <div class="tracks-container" cdkDropListGroup>
        <div class="track" *ngFor="let track of tracks">
          <div class="track-controls">
            <input nz-input [(ngModel)]="track.name" class="track-name" />
            <button nz-button nzType="text" (click)="toggleMute(track)">
              <i nz-icon [nzType]="track.muted ? 'sound-filled' : 'sound'" nzTheme="outline"></i>
            </button>
            <button nz-button nzType="text" (click)="toggleSolo(track)">
              <i nz-icon [nzType]="track.soloed ? 'star-filled' : 'star'" nzTheme="outline"></i>
            </button>
            <nz-slider [(ngModel)]="track.volume" [nzMin]="-60" [nzMax]="0" [nzStep]="1"></nz-slider>
          </div>
          <div class="track-content" cdkDropList [cdkDropListData]="track.segments"
               (cdkDropListDropped)="dropSegment($event)">
            <div class="segment" *ngFor="let segment of track.segments"
                 [style.left.px]="segment.startTime * pixelsPerSecond"
                 [style.width.px]="segment.duration * pixelsPerSecond"
                 [style.background-color]="track.color"
                 [class.selected]="segment.selected"
                 cdkDrag
                 (click)="selectSegment(segment)">
            </div>
          </div>
        </div>
      </div>

      <!-- Add Track Button -->
      <button nz-button nzType="dashed" (click)="addTrack()">
        <i nz-icon nzType="plus"></i>
        Add Track
      </button>
    </div>
  `,
  styles: [`
    .studio-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      background-color: #1f1f1f;
      color: white;
    }

    .transport-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background-color: #2a2a2a;
      border-radius: 4px;
    }

    .time-display {
      font-family: monospace;
      font-size: 1.2rem;
    }

    .timeline {
      height: 30px;
      background-color: #2a2a2a;
      position: relative;
      overflow: hidden;
    }

    .tracks-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .track {
      display: flex;
      gap: 1rem;
      background-color: #2a2a2a;
      padding: 0.5rem;
      border-radius: 4px;
    }

    .track-controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      width: 300px;
      flex-shrink: 0;
    }

    .track-name {
      width: 120px;
    }

    .track-content {
      flex-grow: 1;
      height: 100px;
      background-color: #333;
      position: relative;
      border-radius: 4px;
    }

    .segment {
      position: absolute;
      height: 100%;
      opacity: 0.8;
      cursor: pointer;
      border-radius: 4px;
      transition: opacity 0.2s;
    }

    .segment:hover {
      opacity: 1;
    }

    .segment.selected {
      border: 2px solid white;
    }
  `]
})
export class RecordingStudioComponent implements OnInit, OnDestroy {
  tracks: AudioTrack[] = [];
  isPlaying = false;
  isRecording = false;
  currentTime = 0;
  totalDuration = 0;
  pixelsPerSecond = 100;
  private recorder: MediaRecorder | null = null;
  private recordingTrack: AudioTrack | null = null;
  private transport: Tone.Transport;
  private chunks: Blob[] = [];

  constructor(private guitarAudioService: GuitarAudioService) {
    this.transport = Tone.Transport;
  }

  ngOnInit() {
    // Ajouter une première piste par défaut
    this.addTrack();

    // Configurer le transport
    this.transport.scheduleRepeat((time) => {
      this.currentTime = this.transport.seconds;
    }, '0.1');
  }

  ngOnDestroy() {
    this.stopRecording();
    this.transport.stop();
  }

  addTrack() {
    const colors = ['#ff7f50', '#87cefa', '#da70d6', '#32cd32', '#ffa500'];
    this.tracks.push({
      id: `track-${this.tracks.length + 1}`,
      name: `Track ${this.tracks.length + 1}`,
      segments: [],
      volume: 0,
      muted: false,
      soloed: false,
      color: colors[this.tracks.length % colors.length]
    });
  }

  async toggleRecording() {
    if (!this.isRecording) {
      // Démarrer l'enregistrement
      try {
        const stream = await this.guitarAudioService.getInputStream();
        this.recorder = new MediaRecorder(stream);
        this.chunks = [];

        this.recorder.ondataavailable = (e) => {
          this.chunks.push(e.data);
        };

        this.recorder.onstop = async () => {
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          const audioBuffer = await this.blobToAudioBuffer(blob);
          
          // Créer un nouveau segment
          const segment: AudioSegment = {
            id: `segment-${Date.now()}`,
            startTime: this.currentTime,
            duration: audioBuffer.duration,
            buffer: audioBuffer,
            offset: 0,
            selected: false
          };

          // Ajouter le segment à la piste active
          if (this.recordingTrack) {
            this.recordingTrack.segments.push(segment);
          } else {
            // Si aucune piste n'est sélectionnée, créer une nouvelle piste
            this.addTrack();
            this.tracks[this.tracks.length - 1].segments.push(segment);
          }
        };

        this.recorder.start();
        this.isRecording = true;
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    } else {
      // Arrêter l'enregistrement
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
      this.isRecording = false;
    }
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.transport.pause();
    } else {
      this.transport.start();
    }
    this.isPlaying = !this.isPlaying;
  }

  private async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await Tone.context.decodeAudioData(arrayBuffer);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  toggleMute(track: AudioTrack) {
    track.muted = !track.muted;
  }

  toggleSolo(track: AudioTrack) {
    track.soloed = !track.soloed;
  }

  selectSegment(segment: AudioSegment) {
    // Désélectionner tous les autres segments
    this.tracks.forEach(track => {
      track.segments.forEach(seg => {
        if (seg !== segment) {
          seg.selected = false;
        }
      });
    });
    segment.selected = !segment.selected;
  }

  dropSegment(event: any) {
    // Gérer le déplacement des segments entre les pistes
    if (event.previousContainer === event.container) {
      // Réorganiser dans la même piste
      const segments = event.container.data;
      const [removed] = segments.splice(event.previousIndex, 1);
      segments.splice(event.currentIndex, 0, removed);
    } else {
      // Déplacer vers une autre piste
      const [removed] = event.previousContainer.data.splice(event.previousIndex, 1);
      event.container.data.splice(event.currentIndex, 0, removed);
    }
  }
} 