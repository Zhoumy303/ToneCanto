import { bootstrapApplication } from '@angular/platform-browser';
import { 
  RouteReuseStrategy, 
  provideRouter, 
  withPreloading, 
  PreloadAllModules 
} from '@angular/router';
import { 
  IonicRouteStrategy, 
  provideIonicAngular,
  iosTransitionAnimation  // 直接从Ionic导入
} from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // 路由策略
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    
    // 动画支持（必须提供）
    provideAnimations(),
    
    // Ionic 配置（standalone模式下的正确配置）
    provideIonicAngular({
      // 基础配置
      mode: 'ios',
      animated: true,
      
      // ✅ 正确：使用直接导入的动画函数
      navAnimation: iosTransitionAnimation,
      
      // ✅ 硬件相关配置
      hardwareBackButton: true,
      swipeBackEnabled: true,
      
      // ✅ 状态栏点击行为
      statusTap: false,
      
      // ✅ 正确的弹窗动画配置（使用函数或undefined）
      modalEnter: undefined,  // 使用默认
      modalLeave: undefined,  // 使用默认
      
      // ✅ 加载指示器
      spinner: 'crescent' as any,  // 需要类型断言
      
      // ✅ 实验性功能
      experimentalCloseWatcher: false,
      _forceStatusbarPadding: false,
      
      // ✅ 输入处理
      inputBlurring: true,
      scrollAssist: true,
      scrollPadding: false,
      
      // ❌ 移除无效配置
      // platform: {...},  // standalone模式不支持
      // keyboardHeight: 290,  // 需要特殊处理
    }),
    
    // HTTP客户端
    provideHttpClient(),
    
    // 路由配置
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});