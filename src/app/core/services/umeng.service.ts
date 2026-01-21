import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * 友盟插件接口定义
 */
export interface UmengPlugin {
  /**
   * 记录自定义事件
   * @param options eventId: 事件ID, params: 可选的事件参数
   */
  trackEvent(options: { eventId: string; params?: Record<string, any> }): Promise<void>;
  
  /**
   * 页面开始统计
   * @param options pageName: 页面名称
   */
  pageStart(options: { pageName: string }): Promise<void>;
  
  /**
   * 页面结束统计
   * @param options pageName: 页面名称
   */
  pageEnd(options: { pageName: string }): Promise<void>;
  
  /**
   * 设置用户ID（用户登录时调用）
   * @param options userId: 用户ID
   */
  setUserId(options: { userId: string }): Promise<void>;
  
  /**
   * 用户登出
   */
  signOff(): Promise<void>;
}

// 注册友盟插件
const Umeng = registerPlugin<UmengPlugin>('Umeng');

/**
 * 友盟统计服务
 * 封装友盟 SDK 的常用功能，提供统一的统计接口
 */
@Injectable({
  providedIn: 'root'
})
export class UmengService {
  
  private isNative = Capacitor.isNativePlatform();

  constructor() {}

  /**
   * 记录自定义事件
   * @param eventId 事件ID（在友盟后台定义）
   * @param params 可选的事件参数
   * 
   * @example
   * // 简单事件
   * umengService.trackEvent('button_click');
   * 
   * // 带参数的事件
   * umengService.trackEvent('tone_practice', { tone: '1', result: 'correct' });
   */
  async trackEvent(eventId: string, params?: Record<string, any>): Promise<void> {
    if (!this.isNative) {
      console.log('[Umeng] trackEvent (web mock):', eventId, params);
      return;
    }
    
    try {
      await Umeng.trackEvent({ eventId, params });
    } catch (error) {
      console.error('[Umeng] trackEvent error:', error);
    }
  }

  /**
   * 页面开始统计（进入页面时调用）
   * @param pageName 页面名称
   */
  async pageStart(pageName: string): Promise<void> {
    if (!this.isNative) {
      console.log('[Umeng] pageStart (web mock):', pageName);
      return;
    }
    
    try {
      await Umeng.pageStart({ pageName });
    } catch (error) {
      console.error('[Umeng] pageStart error:', error);
    }
  }

  /**
   * 页面结束统计（离开页面时调用）
   * @param pageName 页面名称
   */
  async pageEnd(pageName: string): Promise<void> {
    if (!this.isNative) {
      console.log('[Umeng] pageEnd (web mock):', pageName);
      return;
    }
    
    try {
      await Umeng.pageEnd({ pageName });
    } catch (error) {
      console.error('[Umeng] pageEnd error:', error);
    }
  }

  /**
   * 设置用户ID（用户登录后调用）
   * @param userId 用户唯一标识
   */
  async setUserId(userId: string): Promise<void> {
    if (!this.isNative) {
      console.log('[Umeng] setUserId (web mock):', userId);
      return;
    }
    
    try {
      await Umeng.setUserId({ userId });
    } catch (error) {
      console.error('[Umeng] setUserId error:', error);
    }
  }

  /**
   * 用户登出
   */
  async signOff(): Promise<void> {
    if (!this.isNative) {
      console.log('[Umeng] signOff (web mock)');
      return;
    }
    
    try {
      await Umeng.signOff();
    } catch (error) {
      console.error('[Umeng] signOff error:', error);
    }
  }

  // ============ 业务相关的便捷方法 ============

  /**
   * 记录声调练习事件
   * @param tone 声调编号
   * @param isCorrect 是否正确
   */
  async trackTonePractice(tone: number, isCorrect: boolean): Promise<void> {
    await this.trackEvent('tone_practice', {
      tone: tone.toString(),
      result: isCorrect ? 'correct' : 'wrong'
    });
  }

  /**
   * 记录练习完成事件
   * @param totalCount 总题数
   * @param correctCount 正确数
   */
  async trackPracticeComplete(totalCount: number, correctCount: number): Promise<void> {
    await this.trackEvent('practice_complete', {
      total: totalCount.toString(),
      correct: correctCount.toString(),
      accuracy: ((correctCount / totalCount) * 100).toFixed(1)
    });
  }

  /**
   * 记录 TTS 播放事件
   * @param text 播放的文本
   */
  async trackTtsPlay(text: string): Promise<void> {
    await this.trackEvent('tts_play', { text });
  }
}
