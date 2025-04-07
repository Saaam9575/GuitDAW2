import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, NZ_ICONS } from 'ng-zorro-antd/icon';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzCardModule } from 'ng-zorro-antd/card';

import {
  PlayCircleOutline,
  PauseCircleOutline,
  ReloadOutline,
  AudioOutline,
  ClockCircleOutline,
  SoundOutline,
  ThunderboltOutline,
  LineChartOutline,
  DragOutline,
  CloseOutline,
  SettingOutline,
  RightOutline,
  SearchOutline,
  StopOutline,
  PrinterOutline,
  InfoCircleOutline,
  CheckCircleOutline,
  CloseCircleTwoTone,
} from '@ant-design/icons-angular/icons';

import { routes } from './app.routes';
// import { provideClientHydration } from '@angular/platform-browser'; // Désactivé

const icons = [
  PlayCircleOutline,
  PauseCircleOutline,
  ReloadOutline,
  AudioOutline,
  ClockCircleOutline,
  SoundOutline,
  ThunderboltOutline,
  LineChartOutline,
  DragOutline,
  CloseOutline,
  SettingOutline,
  RightOutline,
  SearchOutline,
  StopOutline,
  PrinterOutline,
  InfoCircleOutline,
  CheckCircleOutline,
  CloseCircleTwoTone,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // provideClientHydration(), // Désactivé
    provideHttpClient(),
    importProvidersFrom([
      BrowserModule,
      BrowserAnimationsModule,
      DragDropModule,
      NzLayoutModule,
      NzButtonModule,
      NzTabsModule,
      NzSelectModule,
      NzDrawerModule,
      NzInputModule,
      NzListModule,
      NzSkeletonModule,
      NzSpinModule,
      NzMessageModule,
      NzCardModule,
    ]),
    { provide: NZ_ICONS, useValue: icons },
  ],
};
