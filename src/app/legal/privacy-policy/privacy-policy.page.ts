import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons } from '@ionic/angular/standalone';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonBackButton, IonButtons, CommonModule, FormsModule]
})
export class PrivacyPolicyPage {
  private router = inject(Router);

  // 返回登录页面
  goBack() {
    this.router.navigate(['/login']);
  }
}