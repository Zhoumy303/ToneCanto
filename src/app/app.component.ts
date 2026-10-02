import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { AppUpdateService } from './core/services/app-update.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);
  private appUpdateService = inject(AppUpdateService);

  ngOnInit() {
    this.initializeApp();
  }

  private async initializeApp() {
    await this.platform.ready();

    // 配置 Android 全屏模式，让内容延伸到底部导航栏区域
    if (Capacitor.isNativePlatform()) {
      try {
        // 设置状态栏样式
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#1a1a2e' });
        
        // 设置状态栏覆盖 WebView（Edge-to-Edge 模式）
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch (error) {
        console.warn('StatusBar 配置失败:', error);
      }
    }

    // 启动时静默检查更新（不显示"已是最新版本"提示）
    setTimeout(() => {
      this.appUpdateService.checkForUpdate(false);
    }, 2000);
  }
}
