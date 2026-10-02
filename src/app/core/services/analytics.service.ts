import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * 友盟插件接口定义
 */
interface UmengPlugin {
  trackEvent(options: { eventId: string; params?: Record<string, any> }): Promise<void>;
  pageStart(options: { pageName: string }): Promise<void>;
  pageEnd(options: { pageName: string }): Promise<void>;
  setUserId(options: { userId: string }): Promise<void>;
  clearUserId(): Promise<void>;
}

// 注册友盟插件
const Umeng = registerPlugin<UmengPlugin>('Umeng');

/**
 * 统计分析服务
 * 封装友盟统计 SDK，提供事件追踪、页面统计等功能
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  
  private isNative = Capacitor.isNativePlatform();
  private currentPage: string | null = null;

  constructor() {}

  /**
   * 记录自定义事件
   * @param eventId 事件ID（在友盟后台配置）
   * @param params 可选的事件参数
   */
  async trackEvent(eventId: string, params?: Record<string, any>): Promise<void> {
    if (!this.isNative) {
      console.log('[Analytics] trackEvent:', eventId, params);
      return;
    }
    
    try {
      await Umeng.trackEvent({ eventId, params });
    } catch (error) {
      console.error('[Analytics] trackEvent error:', error);
    }
  }

  /**
   * 记录页面开始访问
   * @param pageName 页面名称
   */
  async pageStart(pageName: string): Promise<void> {
    // 如果有上一个页面未结束，先结束它
    if (this.currentPage && this.currentPage !== pageName) {
      await this.pageEnd(this.currentPage);
    }
    
    this.currentPage = pageName;
    
    if (!this.isNative) {
      console.log('[Analytics] pageStart:', pageName);
      return;
    }
    
    try {
      await Umeng.pageStart({ pageName });
    } catch (error) {
      console.error('[Analytics] pageStart error:', error);
    }
  }

  /**
   * 记录页面结束访问
   * @param pageName 页面名称
   */
  async pageEnd(pageName: string): Promise<void> {
    if (this.currentPage === pageName) {
      this.currentPage = null;
    }
    
    if (!this.isNative) {
      console.log('[Analytics] pageEnd:', pageName);
      return;
    }
    
    try {
      await Umeng.pageEnd({ pageName });
    } catch (error) {
      console.error('[Analytics] pageEnd error:', error);
    }
  }

  /**
   * 设置用户ID（用户登录后调用）
   * @param userId 用户唯一标识
   */
  async setUserId(userId: string): Promise<void> {
    if (!this.isNative) {
      console.log('[Analytics] setUserId:', userId);
      return;
    }
    
    try {
      await Umeng.setUserId({ userId });
    } catch (error) {
      console.error('[Analytics] setUserId error:', error);
    }
  }

  /**
   * 清除用户ID（用户登出后调用）
   */
  async clearUserId(): Promise<void> {
    if (!this.isNative) {
      console.log('[Analytics] clearUserId');
      return;
    }
    
    try {
      await Umeng.clearUserId();
    } catch (error) {
      console.error('[Analytics] clearUserId error:', error);
    }
  }

  // ============ 预定义的业务事件 ============

  /**
   * 记录练习开始事件
   */
  async trackPracticeStart(toneType: string): Promise<void> {
    await this.trackEvent('practice_start', { tone_type: toneType });
  }

  /**
   * 记录练习完成事件
   */
  async trackPracticeComplete(toneType: string, score: number, duration: number): Promise<void> {
    await this.trackEvent('practice_complete', {
      tone_type: toneType,
      score: score,
      duration_seconds: duration
    });
  }

  /**
   * 记录 TTS 播放事件
   */
  async trackTtsPlay(text: string): Promise<void> {
    await this.trackEvent('tts_play', { text_length: text.length });
  }
}
