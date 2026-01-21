import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VersionInfo {
  version: string;
  versionCode: number;
  forceUpdate: boolean;
  downloadUrl: string;
  releaseNotes: string;
  minVersion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private baseUrl = environment.apiUrl;
  private readonly appId = 'ToneCanto';
  
  // 是否使用 Google Play 应用内更新（上架后设为 true）
  private readonly usePlayStore = false;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {}

  /**
   * 检查更新
   */
  async checkForUpdate(showNoUpdateAlert = false): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[AppUpdate] 非原生平台，跳过更新检查');
      return;
    }

    try {
      if (this.usePlayStore && Capacitor.getPlatform() === 'android') {
        await this.checkPlayStoreUpdate(showNoUpdateAlert);
      } else {
        await this.checkSelfHostedUpdate(showNoUpdateAlert);
      }
    } catch (error: any) {
      console.error('[AppUpdate] 检查更新失败:', JSON.stringify(error));
      if (showNoUpdateAlert) {
        await this.showErrorAlert();
      }
    }
  }

  /**
   * Google Play 应用内更新
   */
  private async checkPlayStoreUpdate(showNoUpdateAlert: boolean): Promise<void> {
    const info = await AppUpdate.getAppUpdateInfo();
    console.log('[AppUpdate] Play Store 更新信息:', JSON.stringify(info));

    if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
      if (info.immediateUpdateAllowed) {
        await AppUpdate.performImmediateUpdate();
      } else if (info.flexibleUpdateAllowed) {
        await AppUpdate.startFlexibleUpdate();
      }
    } else if (showNoUpdateAlert) {
      await this.showNoUpdateAlert(info.currentVersionName);
    }
  }

  /**
   * 自托管更新
   */
  private async checkSelfHostedUpdate(showNoUpdateAlert: boolean): Promise<void> {
    // 使用 @capacitor/app 获取版本信息（不依赖 Google Play）
    const appInfo = await App.getInfo();
    const currentVersionCode = parseInt(appInfo.build, 10);
    const currentVersionName = appInfo.version;
    
    console.log(`[AppUpdate] 当前版本: ${currentVersionName} (${currentVersionCode})`);

    const serverVersion = await this.getServerVersion();
    console.log('[AppUpdate] 服务器版本:', JSON.stringify(serverVersion));

    if (serverVersion.versionCode > currentVersionCode) {
      console.log('[AppUpdate] 发现新版本');
      await this.showUpdateDialog(serverVersion, currentVersionName);
    } else if (showNoUpdateAlert) {
      await this.showNoUpdateAlert(currentVersionName);
    }
  }

  private async getServerVersion(): Promise<VersionInfo> {
    const platform = Capacitor.getPlatform();
    const url = `${this.baseUrl}/app/version?platform=${platform}&appId=${this.appId}`;
    console.log('[AppUpdate] 请求URL:', url);
    return firstValueFrom(this.http.get<VersionInfo>(url));
  }

  private async showUpdateDialog(versionInfo: VersionInfo, currentVersion: string): Promise<void> {
    const buttons: any[] = [];

    if (!versionInfo.forceUpdate) {
      buttons.push({
        text: '稍后再说',
        role: 'cancel',
        cssClass: 'secondary'
      });
    }

    buttons.push({
      text: '立即更新',
      handler: () => {
        this.downloadAndInstall(versionInfo.downloadUrl, versionInfo.version);
      }
    });

    const alert = await this.alertController.create({
      header: '发现新版本',
      subHeader: `v${versionInfo.version}`,
      message: versionInfo.releaseNotes || '修复已知问题，提升用户体验',
      buttons,
      backdropDismiss: !versionInfo.forceUpdate
    });

    await alert.present();
  }

  /**
   * 下载 APK 并安装
   */
  private async downloadAndInstall(downloadUrl: string, version: string): Promise<void> {
    const loading = await this.loadingController.create({
      message: '正在下载更新...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const fileName = `app-update-${version}.apk`;
      
      // 下载 APK 文件
      const downloadResult = await Filesystem.downloadFile({
        url: downloadUrl,
        path: fileName,
        directory: Directory.Cache,
        progress: true
      });

      await loading.dismiss();

      if (downloadResult.path) {
        console.log('[AppUpdate] 下载完成:', downloadResult.path);
        
        // 打开 APK 进行安装
        await FileOpener.open({
          filePath: downloadResult.path,
          contentType: 'application/vnd.android.package-archive'
        });
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('[AppUpdate] 下载失败:', JSON.stringify(error));
      
      const alert = await this.alertController.create({
        header: '下载失败',
        message: '无法下载更新，请稍后重试',
        buttons: ['确定']
      });
      await alert.present();
    }
  }

  private async showNoUpdateAlert(currentVersion: string): Promise<void> {
    const alert = await this.alertController.create({
      header: '检查更新',
      message: `当前已是最新版本 v${currentVersion}`,
      buttons: ['确定']
    });
    await alert.present();
  }

  private async showErrorAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: '检查更新',
      message: '检查更新失败，请稍后重试',
      buttons: ['确定']
    });
    await alert.present();
  }

  async getCurrentVersion(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const appInfo = await App.getInfo();
      return appInfo.version;
    }
    return '开发版本';
  }
}
