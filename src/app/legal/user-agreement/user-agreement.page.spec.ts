import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserAgreementPage } from './user-agreement.page';

describe('UserAgreementPage', () => {
  let component: UserAgreementPage;
  let fixture: ComponentFixture<UserAgreementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UserAgreementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
