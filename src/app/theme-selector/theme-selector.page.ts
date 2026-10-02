import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.page.html',
  styleUrls: ['./theme-selector.page.scss'],
  imports: [CommonModule, IonicModule]
})
export class ThemeSelectorPage {
  private readonly navCtrl = inject(NavController);
  private readonly sanitizer = inject(DomSanitizer);
  readonly themeService = inject(ThemeService);

  /**
   * 返回上一页
   */
  goBack(): void {
    this.navCtrl.back();
  }

  /**
   * 切换随机主题模式
   */
  toggleRandomTheme(): void {
    this.themeService.toggleRandomTheme();
  }

  /**
   * 选择主题
   * @param themeId 主题ID
   */
  selectTheme(themeId: string): void {
    this.themeService.selectTheme(themeId);
  }

  /**
   * 获取安全的渐变样式
   * @param gradient 渐变CSS字符串
   * @returns 安全的样式对象
   */
  getSafeGradient(gradient: string): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(gradient);
  }
}
