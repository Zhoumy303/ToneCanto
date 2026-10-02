import { Injectable, signal, computed } from '@angular/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

/**
 * 语音类型
 */
export type VoiceType = 'tts' | 'human';

/**
 * 语音信息接口
 */
export interface VoiceInfo {
  id: string;           // 唯一标识
  name: string;         // 显示名称
  lang: string;         // 标准语言代码 (如 zh-HK)
  voiceURI: string;     // 语音 URI
  voiceIndex: number;   // 语音在系统列表中的索引（原生平台用于选择具体语音）
  isDefault?: boolean;  // 是否默认
  type: VoiceType;      // 语音类型：tts（合成语音）或 human（真人发音）
}

/**
 * 真人发音语音常量
 */
export const HUMAN_VOICE: VoiceInfo = {
  id: 'human-voice',
  name: '真人发音',
  lang: 'zh-HK',
  voiceURI: 'human-voice',
  voiceIndex: -1,
  isDefault: false,
  type: 'human'
};

/**
 * 语音选择服务
 * 管理可用的粤语语音列表和当前选中的语音
 * 支持原生平台 (Capacitor TTS) 和 Web 平台 (Web Speech API)
 */
@Injectable({
  providedIn: 'root'
})
export class VoiceSelectionService {
  private readonly STORAGE_KEY = 'selected_voice_id';
  private readonly isNative = Capacitor.isNativePlatform();
  
  // 可用的粤语语音列表
  private readonly availableVoices = signal<VoiceInfo[]>([]);
  
  // 当前选中的语音 ID
  private readonly selectedVoiceId = signal<string | null>(null);
  
  // 语音是否已加载
  private readonly voicesLoaded = signal(false);
  
  // 计算属性：当前选中的语音
  readonly currentVoice = computed<VoiceInfo | null>(() => {
    const voices = this.availableVoices();
    const selectedId = this.selectedVoiceId();
    if (selectedId) {
      return voices.find(v => v.id === selectedId) || voices[0] || null;
    }
    return voices[0] || null;
  });
  
  // 暴露只读信号
  readonly voices = this.availableVoices.asReadonly();
  readonly isLoaded = this.voicesLoaded.asReadonly();

  constructor() {
    this.initVoices();
  }

  /**
   * 初始化语音列表
   */
  private async initVoices(): Promise<void> {
    console.log('[VoiceSelectionService] 初始化, isNative:', this.isNative);
    
    let voices: VoiceInfo[] = [];
    
    // 首先添加真人发音选项
    voices.push(HUMAN_VOICE);
    
    if (this.isNative) {
      // 原生平台使用 Capacitor TTS 获取语音列表
      const nativeVoices = await this.loadNativeVoices();
      voices = [...voices, ...nativeVoices];
    } else {
      // Web 平台使用 Web Speech API
      if ('speechSynthesis' in window) {
        const webVoices = await this.loadWebVoices();
        const filteredVoices = this.filterCantoneseWebVoices(webVoices);
        voices = [...voices, ...filteredVoices];
      } else {
        console.warn('[VoiceSelectionService] 浏览器不支持语音合成');
      }
    }
    
    this.availableVoices.set(voices);
    this.voicesLoaded.set(true);
    
    // 恢复之前选择的语音
    this.restoreSelectedVoice();
    
    console.log('[VoiceSelectionService] 语音列表:', voices);
  }
  
  /**
   * 判断当前是否使用真人发音
   */
  isHumanVoice(): boolean {
    const current = this.currentVoice();
    return current?.type === 'human';
  }

  /**
   * 加载原生平台语音列表 (Capacitor TTS)
   */
  private async loadNativeVoices(): Promise<VoiceInfo[]> {
    try {
      const result = await TextToSpeech.getSupportedVoices();
      console.log('[VoiceSelectionService] ========== 原生语音调试 ==========');
      console.log('[VoiceSelectionService] 原生语音总数:', result.voices.length);
      
      // 打印所有语音的详细信息
      console.log('[VoiceSelectionService] 所有语音列表:');
      result.voices.forEach((voice, index) => {
        console.log(`[VoiceSelectionService] [${index}] name: "${voice.name}", lang: "${voice.lang}", voiceURI: "${voice.voiceURI}", default: ${voice.default}`);
      });
      
      const cantoneseVoices: VoiceInfo[] = [];
      
      for (let index = 0; index < result.voices.length; index++) {
        const voice = result.voices[index];
        
        // 跳过 default 语音（通常和其他语音重复）
        if (voice.voiceURI.endsWith('-default')) {
          console.log(`[VoiceSelectionService] 跳过 default 语音: name="${voice.name}", voiceURI="${voice.voiceURI}"`);
          continue;
        }
        
        // 从 voiceURI 中提取标准语言代码 (如 zh-HK-SMTf00 -> zh-HK)
        const standardLang = this.extractStandardLang(voice.voiceURI, voice.lang, voice.name);
        
        // 匹配粤语相关语音 - 使用 voiceURI 和 name 来判断
        const isCantonese = this.isCantoneseVoiceByURI(voice.voiceURI, voice.name);
        
        if (isCantonese) {
          console.log(`[VoiceSelectionService] ✓ 匹配粤语: index=${index}, name="${voice.name}", lang="${voice.lang}", voiceURI="${voice.voiceURI}", standardLang="${standardLang}"`);
          cantoneseVoices.push({
            id: voice.voiceURI || `${voice.lang}-${voice.name}`,
            name: this.formatNativeVoiceName(voice.name, standardLang, voice.voiceURI),
            lang: standardLang,  // 使用标准语言代码
            voiceURI: voice.voiceURI || voice.name,
            voiceIndex: index,   // 保存索引，用于选择具体语音
            isDefault: voice.default,
            type: 'tts'
          });
        }
      }
      
      console.log('[VoiceSelectionService] 筛选出的粤语语音数量:', cantoneseVoices.length);
      
      // 如果没有找到粤语语音，添加所有中文语音作为备选
      if (cantoneseVoices.length === 0) {
        console.log('[VoiceSelectionService] 未找到粤语语音，添加中文语音作为备选');
        for (let index = 0; index < result.voices.length; index++) {
          const voice = result.voices[index];
          const standardLang = this.extractStandardLang(voice.voiceURI, voice.lang, voice.name);
          if (standardLang.startsWith('zh')) {
            console.log(`[VoiceSelectionService] + 添加中文备选: index=${index}, name="${voice.name}", standardLang="${standardLang}"`);
            cantoneseVoices.push({
              id: voice.voiceURI || `${voice.lang}-${voice.name}`,
              name: this.formatNativeVoiceName(voice.name, standardLang, voice.voiceURI),
              lang: standardLang,
              voiceURI: voice.voiceURI || voice.name,
              voiceIndex: index,
              isDefault: voice.default,
              type: 'tts'
            });
          }
        }
      }
      
      console.log('[VoiceSelectionService] 最终语音列表:');
      cantoneseVoices.forEach((v, i) => {
        console.log(`[VoiceSelectionService] [${i}] id="${v.id}", name="${v.name}", lang="${v.lang}", voiceIndex=${v.voiceIndex}, voiceURI="${v.voiceURI}"`);
      });
      console.log('[VoiceSelectionService] ========== 调试结束 ==========');
      
      return cantoneseVoices;
    } catch (error) {
      console.error('[VoiceSelectionService] 获取原生语音列表失败:', error);
      return [];
    }
  }
  
  /**
   * 从 voiceURI 中提取标准语言代码
   * 例如: zh-HK-SMTf00 -> zh-HK, zh-CN-default -> zh-CN
   */
  private extractStandardLang(voiceURI: string, originalLang: string, name: string): string {
    // 尝试从 voiceURI 提取 (格式通常是 zh-HK-xxx)
    const uriMatch = voiceURI.match(/^(zh-[A-Z]{2})/i);
    if (uriMatch) {
      return uriMatch[1];
    }
    
    // 尝试从 name 提取 (如 "中文 HKG" -> zh-HK)
    if (name.includes('HKG') || name.includes('香港')) {
      return 'zh-HK';
    }
    if (name.includes('TWN') || name.includes('台湾') || name.includes('臺灣')) {
      return 'zh-TW';
    }
    if (name.includes('CHN') || name.includes('中国') || name.includes('普通话')) {
      return 'zh-CN';
    }
    
    // 如果原始 lang 是标准格式，直接使用
    if (/^zh-[A-Z]{2}$/i.test(originalLang)) {
      return originalLang;
    }
    
    // 默认返回 zh-CN
    return 'zh-CN';
  }
  
  /**
   * 通过 voiceURI 和 name 判断是否为粤语语音
   */
  private isCantoneseVoiceByURI(voiceURI: string, name: string): boolean {
    const uriLower = voiceURI.toLowerCase();
    const nameLower = name.toLowerCase();
    
    return (
      uriLower.startsWith('zh-hk') ||
      uriLower.includes('yue') ||
      /cantonese/i.test(nameLower) ||
      name.includes('HKG') ||
      name.includes('香港')
    );
  }

  /**
   * 加载 Web 平台语音列表
   */
  private loadWebVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      // 等待 voiceschanged 事件
      const onVoicesChanged = () => {
        const loadedVoices = speechSynthesis.getVoices();
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(loadedVoices);
      };

      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

      // 超时处理
      setTimeout(() => {
        const fallbackVoices = speechSynthesis.getVoices();
        resolve(fallbackVoices);
      }, 1000);
    });
  }

  /**
   * 判断是否为粤语相关语音
   */
  private isCantoneseVoice(lang: string, name: string): boolean {
    const langLower = lang.toLowerCase();
    const nameLower = name.toLowerCase();
    
    return (
      langLower === 'zh-hk' || 
      langLower === 'zh_hk' ||
      langLower.includes('yue') || 
      /cantonese/i.test(nameLower) ||
      (langLower.startsWith('zh') && /hong\s*kong|hk|粤|廣|广/i.test(name))
    );
  }

  /**
   * 筛选粤语相关语音 (Web 平台)
   */
  private filterCantoneseWebVoices(voices: SpeechSynthesisVoice[]): VoiceInfo[] {
    const cantoneseVoices: VoiceInfo[] = [];
    
    for (let index = 0; index < voices.length; index++) {
      const voice = voices[index];
      if (this.isCantoneseVoice(voice.lang, voice.name)) {
        cantoneseVoices.push({
          id: voice.voiceURI,
          name: this.formatWebVoiceName(voice),
          lang: voice.lang,
          voiceURI: voice.voiceURI,
          voiceIndex: index,
          isDefault: voice.default,
          type: 'tts'
        });
      }
    }
    
    // 如果没有找到粤语语音，添加所有中文语音作为备选
    if (cantoneseVoices.length === 0) {
      for (let index = 0; index < voices.length; index++) {
        const voice = voices[index];
        if (voice.lang.startsWith('zh')) {
          cantoneseVoices.push({
            id: voice.voiceURI,
            name: this.formatWebVoiceName(voice),
            lang: voice.lang,
            voiceURI: voice.voiceURI,
            voiceIndex: index,
            isDefault: voice.default,
            type: 'tts'
          });
        }
      }
    }
    
    return cantoneseVoices;
  }

  /**
   * 格式化原生语音名称
   */
  private formatNativeVoiceName(name: string, lang: string, voiceURI: string): string {
    // 直接使用原始名称，不再添加类型标识
    return name;
  }

  /**
   * 格式化 Web 语音名称
   */
  private formatWebVoiceName(voice: SpeechSynthesisVoice): string {
    let name = voice.name;
    
    // 移除常见前缀
    name = name.replace(/^(Microsoft|Google|Apple)\s*/i, '');
    
    // 添加语言标识
    const langLabel = this.getLangLabel(voice.lang);
    if (langLabel && !name.includes(langLabel)) {
      name = `${name} (${langLabel})`;
    }
    
    return name;
  }

  /**
   * 获取语言标签
   */
  private getLangLabel(lang: string): string {
    const langLower = lang.toLowerCase().replace('_', '-');
    const labels: Record<string, string> = {
      'zh-hk': '粤语',
      'zh-tw': '台湾',
      'zh-cn': '普通话',
      'cmn-cn': '普通话',
      'yue': '粤语',
      'yue-hant-hk': '粤语'
    };
    return labels[langLower] || '';
  }

  /**
   * 恢复之前选择的语音
   */
  private restoreSelectedVoice(): void {
    try {
      const savedId = localStorage.getItem(this.STORAGE_KEY);
      if (savedId) {
        const voices = this.availableVoices();
        const exists = voices.some(v => v.id === savedId);
        if (exists) {
          this.selectedVoiceId.set(savedId);
        }
      }
    } catch (e) {
      console.warn('[VoiceSelectionService] 无法读取保存的语音设置');
    }
  }

  /**
   * 选择语音
   */
  selectVoice(voiceId: string): void {
    const voices = this.availableVoices();
    const voice = voices.find(v => v.id === voiceId);
    
    if (voice) {
      this.selectedVoiceId.set(voiceId);
      
      // 保存到本地存储
      try {
        localStorage.setItem(this.STORAGE_KEY, voiceId);
      } catch (e) {
        console.warn('[VoiceSelectionService] 无法保存语音设置');
      }
      
      console.log('[VoiceSelectionService] 已选择语音:', voice.name);
    }
  }

  /**
   * 获取当前选中的 SpeechSynthesisVoice 对象 (仅 Web 平台)
   */
  async getSelectedSpeechVoice(): Promise<SpeechSynthesisVoice | null> {
    if (this.isNative) return null;
    
    const currentVoice = this.currentVoice();
    if (!currentVoice) return null;
    
    const voices = speechSynthesis.getVoices();
    return voices.find(v => v.voiceURI === currentVoice.voiceURI) || null;
  }
}
