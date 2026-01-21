import { Injectable, inject } from '@angular/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';
import { VoiceSelectionService } from './voice-selection.service';
import { HumanAudioCacheService } from './human-audio-cache.service';
import { PlaybackSpeedService } from './playback-speed.service';

/**
 * TTS 语音合成服务
 * 
 * 支持两种语音模式：
 * 1. TTS 合成语音 - 使用系统 TTS 引擎
 * 2. 真人发音 - 从服务器获取预录音频
 */
@Injectable({
  providedIn: 'root'
})
export class TtsService {
  private isNative = Capacitor.isNativePlatform();
  private voicesLoaded = false;
  private voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  private isCancelled = false;
  private speakingId = 0; // 用于追踪当前播放的 ID
  
  // 真人发音音频播放器
  private humanAudioPlayer: HTMLAudioElement | null = null;
  
  private voiceSelectionService = inject(VoiceSelectionService);
  private humanAudioCacheService = inject(HumanAudioCacheService);
  private playbackSpeedService = inject(PlaybackSpeedService);

  constructor() {
    console.log('[TtsService] 初始化, isNative:', this.isNative);
    
    // 预加载语音列表
    if (!this.isNative && 'speechSynthesis' in window) {
      this.loadVoices();
    }
  }

  /**
   * 预加载语音列表（解决首次调用 getVoices() 返回空数组的问题）
   */
  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (this.voicesPromise) {
      return this.voicesPromise;
    }

    this.voicesPromise = new Promise((resolve) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        this.voicesLoaded = true;
        console.log('[TtsService] 语音列表已加载:', voices.length);
        resolve(voices);
        return;
      }

      // 等待 voiceschanged 事件
      const onVoicesChanged = () => {
        const loadedVoices = speechSynthesis.getVoices();
        this.voicesLoaded = true;
        console.log('[TtsService] 语音列表加载完成:', loadedVoices.length);
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(loadedVoices);
      };

      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

      // 超时处理，防止永远等待
      setTimeout(() => {
        if (!this.voicesLoaded) {
          const fallbackVoices = speechSynthesis.getVoices();
          console.log('[TtsService] 语音加载超时，使用当前列表:', fallbackVoices.length);
          resolve(fallbackVoices);
        }
      }, 1000);
    });

    return this.voicesPromise;
  }

  /**
   * 朗读文本
   * @param text 要朗读的文本（汉字）
   * @param options 播放选项
   * @param jyutping 可选的粤拼（用于真人发音模式）
   */
  async speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }, jyutping?: string): Promise<void> {
    // 如果已取消，直接返回
    if (this.isCancelled) {
      return;
    }
    
    const currentId = ++this.speakingId;
    console.log('[TtsService] speak 调用, text:', text, 'jyutping:', jyutping, 'isNative:', this.isNative, 'id:', currentId);
    
    // 检查是否使用真人发音
    if (this.voiceSelectionService.isHumanVoice() && jyutping) {
      console.log('[TtsService] 使用真人发音模式');
      await this.speakHuman(jyutping, currentId, options?.rate, options?.volume);
      return;
    }
    
    // 如果没有指定 rate，使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    const rate = options?.rate ?? globalSpeed;
    const pitch = options?.pitch ?? 1.0;
    // 应用音量设置
    const baseVolume = options?.volume ?? 1.0;
    const volume = baseVolume;

    if (this.isNative) {
      // 原生平台使用 Capacitor TTS
      // 获取用户选择的语音
      const selectedVoice = this.voiceSelectionService.currentVoice();
      const lang = selectedVoice?.lang || 'zh-HK';
      const voiceIndex = selectedVoice?.voiceIndex;
      
      console.log('[TtsService] ========== 原生 TTS 播放调试 ==========');
      console.log('[TtsService] 要播放的文本:', text);
      console.log('[TtsService] 选中的语音:', JSON.stringify(selectedVoice));
      console.log('[TtsService] 使用的 lang 参数:', lang);
      console.log('[TtsService] 使用的 voice 索引:', voiceIndex);
      console.log('[TtsService] rate:', rate, 'pitch:', pitch, 'volume:', volume);
      
      try {
        // 构建播放参数
        const speakOptions: {
          text: string;
          lang: string;
          rate: number;
          pitch: number;
          volume: number;
          voice?: number;
        } = {
          text,
          lang,
          rate,
          pitch,
          volume
        };
        
        // 如果有选中的语音索引，使用 voice 参数指定具体语音
        if (voiceIndex !== undefined && voiceIndex >= 0) {
          speakOptions.voice = voiceIndex;
          console.log('[TtsService] 使用 voice 参数指定语音索引:', voiceIndex);
        }
        
        await TextToSpeech.speak(speakOptions);
        console.log('[TtsService] 原生 TTS 播放完成');
        console.log('[TtsService] ========== 播放结束 ==========');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('[TtsService] 原生 TTS 失败，降级到 Web Speech:', errorMessage);
        console.log('[TtsService] ========== 播放失败 ==========');
        // 降级到 Web Speech API
        if (currentId === this.speakingId && !this.isCancelled) {
          await this.speakWeb(text, rate, pitch, volume, currentId);
        }
      }
    } else {
      // Web 平台使用 Web Speech API
      console.log('[TtsService] 使用 Web Speech API');
      await this.speakWeb(text, rate, pitch, volume, currentId);
    }
  }

  /**
   * Web 平台语音合成
   */
  private async speakWeb(text: string, rate: number, pitch: number, volume: number, speakId: number): Promise<void> {
    if (!('speechSynthesis' in window)) {
      throw new Error('浏览器不支持语音合成');
    }

    // 确保语音列表已加载
    const voices = await this.loadVoices();
    
    // 检查是否已被取消
    if (this.isCancelled || speakId !== this.speakingId) {
      return;
    }
    
    // 取消之前的语音
    speechSynthesis.cancel();

    return new Promise((resolve, reject) => {
      // 再次检查
      if (this.isCancelled || speakId !== this.speakingId) {
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      console.log('[TtsService] 可用语音数量:', voices.length);
      
      // 优先使用用户选择的语音
      const selectedVoice = this.voiceSelectionService.currentVoice();
      let voiceToUse: SpeechSynthesisVoice | undefined;
      
      if (selectedVoice) {
        voiceToUse = voices.find(v => v.voiceURI === selectedVoice.voiceURI);
        if (voiceToUse) {
          console.log('[TtsService] 使用用户选择的语音:', voiceToUse.name);
        }
      }
      
      // 如果没有用户选择的语音，使用默认逻辑
      if (!voiceToUse) {
        // 查找粤语或中文语音
        const cantoneseVoice = voices.find(v => 
          v.lang === 'zh-HK' || v.lang.includes('yue') || /cantonese/i.test(v.name)
        );
        const chineseVoice = voices.find(v => v.lang.startsWith('zh'));
        
        if (cantoneseVoice) {
          voiceToUse = cantoneseVoice;
          console.log('[TtsService] 使用粤语语音:', cantoneseVoice.name);
        } else if (chineseVoice) {
          voiceToUse = chineseVoice;
          console.log('[TtsService] 使用中文语音:', chineseVoice.name);
        } else {
          console.log('[TtsService] 未找到中文语音，使用默认');
        }
      }
      
      if (voiceToUse) {
        utterance.voice = voiceToUse;
      }
      
      utterance.lang = 'zh-HK';
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onend = () => {
        console.log('[TtsService] Web TTS 播放完成');
        resolve();
      };
      utterance.onerror = (e) => {
        console.error('[TtsService] Web TTS 错误:', e);
        // 不要直接 reject，尝试重新播放
        if (e.error === 'interrupted' || e.error === 'canceled') {
          resolve(); // 被中断不算错误
        } else {
          reject(e);
        }
      };

      console.log('[TtsService] 开始播放:', text);
      
      // Chrome 有时需要用户交互后才能播放，添加一个小延迟
      setTimeout(() => {
        if (!this.isCancelled && speakId === this.speakingId) {
          speechSynthesis.speak(utterance);
        } else {
          resolve();
        }
      }, 10);
    });
  }

  /**
   * 停止朗读
   */
  async stop(): Promise<void> {
    this.isCancelled = true;
    this.speakingId++; // 使所有正在进行的播放失效
    
    // 停止真人发音播放
    if (this.humanAudioPlayer) {
      this.humanAudioPlayer.pause();
      this.humanAudioPlayer.currentTime = 0;
    }
    
    if (this.isNative) {
      await TextToSpeech.stop();
    } else {
      speechSynthesis.cancel();
    }
  }
  
  /**
   * 重置取消状态（在开始新的播放序列前调用）
   */
  reset(): void {
    this.isCancelled = false;
  }
  
  /**
   * 使用真人发音播放
   */
  private async speakHuman(jyutping: string, speakId: number, rate?: number, volume?: number): Promise<void> {
    try {
      // 获取音频 URL（从缓存或服务器）
      const audioUrl = await this.humanAudioCacheService.getAudioUrl(jyutping);
      
      if (!audioUrl) {
        console.warn('[TtsService] 真人发音音频不可用，降级到 TTS:', jyutping);
        // 降级到 TTS
        if (speakId === this.speakingId && !this.isCancelled) {
          await this.speakWithTts(jyutping, speakId, rate);
        }
        return;
      }
      
      // 检查是否已被取消
      if (this.isCancelled || speakId !== this.speakingId) {
        return;
      }
      
      // 播放音频，传递播放速度和音量
      await this.playAudio(audioUrl, speakId, rate, volume);
      
    } catch (error) {
      console.error('[TtsService] 真人发音播放失败:', error);
      // 降级到 TTS
      if (speakId === this.speakingId && !this.isCancelled) {
        await this.speakWithTts(jyutping, speakId, rate);
      }
    }
  }
  
  /**
   * 播放音频文件
   */
  private playAudio(url: string, speakId: number, rate?: number, volume?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isCancelled || speakId !== this.speakingId) {
        resolve();
        return;
      }
      
      // 停止之前的播放
      if (this.humanAudioPlayer) {
        this.humanAudioPlayer.pause();
      }
      
      this.humanAudioPlayer = new Audio(url);
      
      // 设置音量
      this.humanAudioPlayer.volume = volume ?? 1.0;
      
      // 设置播放速度（如果指定了）
      if (rate !== undefined) {
        this.humanAudioPlayer.playbackRate = rate;
      } else {
        // 使用全局播放速度设置
        const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
        this.humanAudioPlayer.playbackRate = globalSpeed;
      }
      
      this.humanAudioPlayer.onended = () => {
        console.log('[TtsService] 真人发音播放完成');
        resolve();
      };
      
      this.humanAudioPlayer.onerror = (e) => {
        console.error('[TtsService] 真人发音播放错误:', e);
        reject(e);
      };
      
      this.humanAudioPlayer.play().catch(reject);
    });
  }
  
  /**
   * 使用 TTS 播放（作为真人发音的降级方案）
   */
  private async speakWithTts(text: string, speakId: number, rate?: number): Promise<void> {
    // 如果没有指定 rate，使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    const finalRate = rate ?? globalSpeed;
    const pitch = 1.0;
    const volume = 1.0;
    
    if (this.isNative) {
      const selectedVoice = this.voiceSelectionService.currentVoice();
      // 使用默认的粤语设置
      const lang = 'zh-HK';
      
      try {
        await TextToSpeech.speak({
          text,
          lang,
          rate: finalRate,
          pitch,
          volume
        });
      } catch (error) {
        console.warn('[TtsService] 原生 TTS 降级失败:', error);
        if (speakId === this.speakingId && !this.isCancelled) {
          await this.speakWeb(text, finalRate, pitch, volume, speakId);
        }
      }
    } else {
      await this.speakWeb(text, finalRate, pitch, volume, speakId);
    }
  }
}
