import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabSearchComponent } from './tab-search.component';

describe('TabSearchComponent', () => {
  let component: TabSearchComponent;
  let fixture: ComponentFixture<TabSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabSearchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TabSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
