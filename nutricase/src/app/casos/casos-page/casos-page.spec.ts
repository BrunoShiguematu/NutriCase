import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasosPage } from './casos-page';

describe('CasosPage', () => {
  let component: CasosPage;
  let fixture: ComponentFixture<CasosPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CasosPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CasosPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
