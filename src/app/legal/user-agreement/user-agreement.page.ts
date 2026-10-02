import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-agreement',
  templateUrl: './user-agreement.page.html',
  styleUrls: ['./user-agreement.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons, CommonModule, FormsModule]
})
export class UserAgreementPage {
  private router = inject(Router);

  // 返回登录页面
  goBack() {
    this.router.navigate(['/login']);
  }
}
