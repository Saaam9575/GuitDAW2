import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { IconDefinition } from '@ant-design/icons-angular';
import {
  ClockCircleOutline,
  SoundOutline,
  ThunderboltOutline,
  LineChartOutline,
  DragOutline,
  PlayCircleOutline,
  PauseCircleOutline,
  ReloadOutline,
  CloseOutline,
  SettingOutline,
} from '@ant-design/icons-angular/icons';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DawComponent } from './components/daw/daw.component';

const icons: IconDefinition[] = [
  ClockCircleOutline,
  SoundOutline,
  ThunderboltOutline,
  LineChartOutline,
  DragOutline,
  PlayCircleOutline,
  PauseCircleOutline,
  ReloadOutline,
  CloseOutline,
  SettingOutline,
];

@NgModule({
  declarations: [AppComponent, DawComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    DragDropModule,
    NzLayoutModule,
    NzButtonModule,
    NzIconModule.forRoot(icons),
    NzTabsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
