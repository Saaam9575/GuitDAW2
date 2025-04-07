import { TestBed } from '@angular/core/testing';

import { GuitarAudioService } from './guitar-audio.service';

describe('GuitarAudioService', () => {
  let service: GuitarAudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GuitarAudioService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
