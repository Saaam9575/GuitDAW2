import { Routes } from '@angular/router';
import { DawComponent } from './components/daw/daw.component';

export const routes: Routes = [
  { path: '', redirectTo: '/daw', pathMatch: 'full' },
  { path: 'daw', component: DawComponent },
];
