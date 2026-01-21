import { Injectable, signal } from '@angular/core';

/**
 * 播放速度全局设置服务
 * 管理整个应用的统一播放速度设置
 */
@Injectable({
  providedIn: 'root'
})
export class PlaybackSpeedService {
  // 播放速度信号（默认 1.0）
  private readonly _playbackSpeed = signal<number>(1.0);
  
  // 可用的速度选项
  readonly speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5] as const;
  
  // 本地存储键名
  private readonly STORAGE_KEY = 'app_playback_speed';

  constructor() {
    this.loadSpeedFromStorage();
  }

  /**
   * 获取当前播放速度（只读信号）
   */
  get playbackSpeed() {
    return this._playbackSpeed.asReadonly();
  }

  /**
   * 设置播放速度
   * @param speed 播放速度（0.5 - 1.5）
   */
  setPlaybackSpeed(speed: number): void {
    // 限制速度范围
    const clampedSpeed = Math.max(0.5, Math.min(1.5, speed));
    this._playbackSpeed.set(clampedSpeed);
    this.saveSpeedToStorage(clampedSpeed);
  }

  /**
   * 获取当前播放速度值
   */
  getCurrentSpeed(): number {
    return this._playbackSpeed();
  }

  /**
   * 从本地存储加载播放速度
   */
  private loadSpeedFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const speed = parseFloat(stored);
        if (!isNaN(speed) && speed >= 0.5 && speed <= 1.5) {
          this._playbackSpeed.set(speed);
        }
      }
    } catch (error) {
      console.error('[PlaybackSpeedService] 加载播放速度失败:', error);
    }
  }

  /**
   * 保存播放速度到本地存储
   */
  private saveSpeedToStorage(speed: number): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, speed.toString());
    } catch (error) {
      console.error('[PlaybackSpeedService] 保存播放速度失败:', error);
    }
  }

  /**
   * 重置为默认速度
   */
  resetToDefault(): void {
    this.setPlaybackSpeed(1.0);
  }
}
