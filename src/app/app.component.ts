import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { DawComponent } from './components/daw/daw.component';
import { MetronomeComponent } from './components/metronome/metronome.component';
import { TunerComponent } from './components/tuner/tuner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    DawComponent,
    MetronomeComponent,
    TunerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  isAudioStarted = false;
  isTunerVisible = false;

  startAudio() {
    this.isAudioStarted = !this.isAudioStarted;
  }

  refreshDevices() {
    // Implement device refresh logic
  }

  showTuner() {
    this.isTunerVisible = true;
  }

  hideTuner() {
    this.isTunerVisible = false;
  }
}
