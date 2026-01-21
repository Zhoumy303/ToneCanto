import { Injectable, signal } from '@angular/core';
import { ToneData, ExampleGroup, ConfusionHint } from '../interfaces/tone.interfaces';

/**
 * 声调数据服务
 * 管理声调相关的静态数据和配置
 */
@Injectable({
  providedIn: 'root'
})
export class ToneDataService {
  
  // 缓存从服务器加载的示例组数据
  private cachedExampleGroups = signal<ExampleGroup[] | null>(null);
  
  // 声调数据（包含 pitch_pattern 用于波形绘制）
  readonly tonesData: ToneData[] = [
    {
      number: 1,
      name: '1 / 阴平 mi',
      pattern: '55',
      pitch_pattern: '55',
      color: '#ef4444',
      description: '高平调'
    },
    {
      number: 2,
      name: '2 / 阴上',
      pattern: '35',
      pitch_pattern: '35',
      color: '#f59e0b',
      description: '高升调'
    },
    {
      number: 3,
      name: '3 / 阴去 re',
      pattern: '33',
      pitch_pattern: '33',
      color: '#10b981',
      description: '中平调'
    },
    {
      number: 4,
      name: '4 / 阳平',
      pattern: '21',
      pitch_pattern: '21',
      color: '#3b82f6',
      description: '低降调'
    },
    {
      number: 5,
      name: '5 / 阳上',
      pattern: '13',
      pitch_pattern: '13',
      color: '#8b5cf6',
      description: '低升调'
    },
    {
      number: 6,
      name: '6 / 阳去 do',
      pattern: '22',
      pitch_pattern: '22',
      color: '#ec4899',
      description: '低平调'
    }
  ];

  // 默认示例组数据
  readonly defaultExampleGroups: ExampleGroup[] = [
    {
      baseJyutping: 'si',
      examples: [
        { char: '詩', jyutping: 'si1', meaning: '诗歌' },
        { char: '史', jyutping: 'si2', meaning: '历史' },
        { char: '試', jyutping: 'si3', meaning: '尝试' },
        { char: '時', jyutping: 'si4', meaning: '时间' },
        { char: '市', jyutping: 'si5', meaning: '市场' },
        { char: '事', jyutping: 'si6', meaning: '事情' }
      ]
    },
    {
      baseJyutping: 'fan',
      examples: [
        { char: '分', jyutping: 'fan1', meaning: '分开' },
        { char: '粉', jyutping: 'fan2', meaning: '粉末' },
        { char: '訓', jyutping: 'fan3', meaning: '训练' },
        { char: '焚', jyutping: 'fan4', meaning: '焚烧' },
        { char: '奮', jyutping: 'fan5', meaning: '奋斗' },
        { char: '份', jyutping: 'fan6', meaning: '份量' }
      ]
    },
    {
      baseJyutping: 'fu',
      examples: [
        { char: '夫', jyutping: 'fu1', meaning: '丈夫' },
        { char: '苦', jyutping: 'fu2', meaning: '苦涩' },
        { char: '副', jyutping: 'fu3', meaning: '副手' },
        { char: '扶', jyutping: 'fu4', meaning: '扶持' },
        { char: '婦', jyutping: 'fu5', meaning: '妇女' },
        { char: '父', jyutping: 'fu6', meaning: '父亲' }
      ]
    },
    {
      baseJyutping: 'ji',
      examples: [
        { char: '衣', jyutping: 'ji1', meaning: '衣服' },
        { char: '椅', jyutping: 'ji2', meaning: '椅子' },
        { char: '意', jyutping: 'ji3', meaning: '意思' },
        { char: '兒', jyutping: 'ji4', meaning: '儿子' },
        { char: '耳', jyutping: 'ji5', meaning: '耳朵' },
        { char: '二', jyutping: 'ji6', meaning: '数字二' }
      ]
    }
  ];

  // 颜色 RGB 映射（用于透明背景）
  readonly toneColorRgb: { [key: number]: string } = {
    1: '239, 68, 68',
    2: '245, 158, 11',
    3: '16, 185, 129',
    4: '59, 130, 246',
    5: '139, 92, 246',
    6: '236, 72, 153'
  };

  // 入声调数据
  readonly rushingTones: { [key: number]: { name: string; color: string; pitch_pattern: string } } = {
    7: { name: '1 / 阴入', color: '#ef4444', pitch_pattern: '5' },
    8: { name: '3 / 中入', color: '#10b981', pitch_pattern: '3' },
    9: { name: '6 / 阳入', color: '#ec4899', pitch_pattern: '2' }
  };

  // 调值映射
  readonly toneValues: { [key: number]: string } = {
    1: '55/53',
    2: '35/25',
    3: '33',
    4: '11/21',
    5: '13/23',
    6: '22'
  };

  // 混淆提示数据库
  readonly confusionHints: { [key: string]: ConfusionHint } = {
    '1_2': { 
      type: 'contour_direction', 
      hint: '平 vs 升', 
      detail: '第1声是高平调，保持在高位不变；第2声是高升调，从中间升到高位。注意听结尾是否有上扬。',
      diagnosis: '您容易混淆【高平调】和【高升调】',
      advice: ['调型辨别法：高平调像拉长的"嗯——"，高升调像疑问的"嗯？"', '听结尾：平调结尾稳定，升调结尾上扬']
    },
    '1_3': { 
      type: 'pitch_height', 
      hint: '高平 vs 中平', 
      detail: '两个都是平调，但第1声在高位(5)，第3声在中位(3)。感受音高的层级差异。',
      diagnosis: '您容易混淆【高平调】和【中平调】',
      advice: ['调域锁定法：先判断是"高高在上"还是"中间位置"', '手势辅助法：高平调手举高，中平调手放中间', '参考锚点法：用"詩(55)"作为高音锚，和它比较']
    },
    '1_4': { 
      type: 'pitch_height', 
      hint: '高 vs 低', 
      detail: '第1声在高位平稳，第4声从低位下降。音高差异明显，注意起点高度。',
      diagnosis: '您倾向于将高音调听成低音调',
      advice: ['音域拓展训练：读高音调时想象叫远处的人，读低音调时想象说悄悄话', '参考锚点法：用"詩(55)"作为高音锚']
    },
    '1_5': { 
      type: 'contour_direction', 
      hint: '平 vs 升', 
      detail: '第1声高平不动，第5声从低位上升。注意听是否有明显的上升趋势。',
      diagnosis: '您容易混淆【平调】和【升调】',
      advice: ['调型辨别法：平调像拉长的音，升调有明显爬升感', '听起点：高平调起点就高，低升调起点低然后往上走']
    },
    '1_6': { 
      type: 'pitch_height', 
      hint: '高平 vs 低平', 
      detail: '都是平调，但第1声在高位(5)，第6声在低位(2)。感受音高层级的差异。',
      diagnosis: '您容易混淆【高平调】和【低平调】',
      advice: ['调域锁定法：先判断是"高高在上"还是"低沉下去"', '手势辅助法：高平调手举平，低平调手放低', '参考锚点法：用"詩(55)"作为高音锚，所有音都和它比']
    },
    '2_3': { 
      type: 'contour_direction', 
      hint: '升 vs 平', 
      detail: '第2声从中升到高，第3声保持中平。注意听结尾是否有上扬。',
      diagnosis: '您容易混淆【升调】和【平调】',
      advice: ['听结尾：升调结尾上扬，平调结尾稳定', '调型辨别法：升调像疑问语气，平调像陈述语气']
    },
    '2_4': { 
      type: 'contour_direction', 
      hint: '升 vs 降', 
      detail: '第2声上升，第4声下降。走向完全相反，注意听音调的方向。',
      diagnosis: '您容易混淆【升调】和【降调】',
      advice: ['方向判断法：升调像问号？降调像句号。', '手势辅助法：跟着声音画方向，上升还是下降']
    },
    '2_5': { 
      type: 'similar_contour', 
      hint: '高升 vs 低升', 
      detail: '都是升调，但起点不同。第2声从中位(3)升起，第5声从低位(1)升起。注意起点音高。',
      diagnosis: '您容易混淆两个【升调】的起点',
      advice: ['起点判断法：高升调起点在中间，低升调起点很低', '对比练习：连续听两个升调，感受起点差异']
    },
    '2_6': { 
      type: 'contour_direction', 
      hint: '升 vs 平', 
      detail: '第2声有明显上升，第6声保持低平。注意听是否有上扬趋势。',
      diagnosis: '您容易混淆【升调】和【平调】',
      advice: ['听结尾：升调结尾上扬，平调结尾稳定', '音高判断：升调会越来越高，平调保持不变']
    },
    '3_4': { 
      type: 'pitch_height', 
      hint: '中 vs 低', 
      detail: '第3声在中位平稳，第4声从低位下降。注意音高层级和走向。',
      diagnosis: '您容易混淆【中音】和【低音】',
      advice: ['调域锁定法：中平调不高不低，低降调明显偏低', '走向判断：中平调稳定，低降调有下降感']
    },
    '3_5': { 
      type: 'contour_direction', 
      hint: '平 vs 升', 
      detail: '第3声中平不动，第5声从低升到中。注意听是否有上升趋势。',
      diagnosis: '您容易混淆【平调】和【升调】',
      advice: ['调型辨别法：平调稳定不变，升调有爬升感', '听结尾：平调结尾和开头一样，升调结尾比开头高']
    },
    '3_6': { 
      type: 'pitch_height', 
      hint: '中平 vs 低平', 
      detail: '都是平调，第3声在中位(3)，第6声在低位(2)。感受音高层级差异。',
      diagnosis: '您容易混淆【中平调】和【低平调】',
      advice: ['调域锁定法：中平调不高不低，低平调明显偏低', '手势辅助法：中平调手放中间，低平调手放低']
    },
    '4_5': { 
      type: 'contour_direction', 
      hint: '降 vs 升', 
      detail: '第4声下降，第5声上升。走向完全相反，注意听音调方向。',
      diagnosis: '您容易混淆【降调】和【升调】',
      advice: ['方向判断法：降调往下走，升调往上走', '手势辅助法：跟着声音画方向']
    },
    '4_6': { 
      type: 'contour_direction', 
      hint: '降 vs 平', 
      detail: '第4声从低位下降，第6声保持低平。注意听是否有下降趋势。',
      diagnosis: '您容易混淆【降调】和【平调】',
      advice: ['走向判断：降调有下沉感，平调保持稳定', '听结尾：降调结尾比开头低，平调结尾和开头一样']
    },
    '5_6': { 
      type: 'contour_direction', 
      hint: '升 vs 平', 
      detail: '第5声从低升到中，第6声保持低平。注意听是否有上升趋势。',
      diagnosis: '您容易混淆【升调】和【平调】',
      advice: ['调型辨别法：升调有爬升感，平调稳定不变', '听结尾：升调结尾比开头高，平调结尾和开头一样']
    }
  };

  /**
   * 获取声调数据
   */
  getToneDataByNumber(toneNumber: number): ToneData | { name: string; color: string; pitch_pattern: string } | null {
    // 入声调
    if (toneNumber >= 7 && toneNumber <= 9) {
      return this.rushingTones[toneNumber] || null;
    }
    // 普通声调
    return this.tonesData.find(t => t.number === toneNumber) || null;
  }

  /**
   * 获取调值
   */
  getToneValue(toneNumber: number): string {
    return this.toneValues[toneNumber] || '';
  }

  /**
   * 从粤拼获取声调数字
   */
  getToneNumberFromJyutping(jyutping: string): number {
    const match = jyutping.match(/(\d)$/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * 检测是否为入声韵母结尾
   */
  isRushingTone(jyutping: string): boolean {
    if (!jyutping) return false;
    
    const pureJyutping = jyutping.replace(/\d+$/, '');
    const rushingFinals = [
      'aap', 'ap', 'ip',
      'aat', 'at', 'ot', 'ut', 'it', 'yut', 'eot',
      'aak', 'ak', 'ok', 'uk', 'ik', 'oek', 'ek'
    ];
    
    return rushingFinals.some(final => pureJyutping.endsWith(final));
  }

  /**
   * 获取实际使用的声调数字（考虑入声韵母）
   */
  getEffectiveToneNumber(jyutping: string): number {
    const baseTone = this.getToneNumberFromJyutping(jyutping);
    if (!baseTone) return 1;
    
    if (this.isRushingTone(jyutping)) {
      switch (baseTone) {
        case 1: return 7;
        case 3: return 8;
        case 6: return 9;
        default: return baseTone;
      }
    }
    
    return baseTone;
  }

  /**
   * 检查音高是否激活（用于声调表格显示）
   */
  isPitchActive(toneNumber: number, pitch: number): boolean {
    const tone = this.tonesData.find(t => t.number === toneNumber);
    if (!tone) return false;
    
    const pattern = tone.pitch_pattern;
    
    switch (pattern) {
      case '55': return pitch === 5;
      case '35': return pitch === 3 || pitch === 4 || pitch === 5;
      case '33': return pitch === 3;
      case '21': return pitch === 1 || pitch === 2;
      case '13': return pitch === 1 || pitch === 2 || pitch === 3;
      case '22': return pitch === 2;
      default: return false;
    }
  }

  /**
   * 获取混淆提示
   */
  getConfusionHint(pair: string): ConfusionHint | null {
    return this.confusionHints[pair] || null;
  }

  /**
   * 获取混淆诊断和建议
   */
  getConfusionDiagnosis(pair: string): { diagnosis: string; advice: string[] } {
    const hintData = this.confusionHints[pair];
    if (hintData) {
      return { diagnosis: hintData.diagnosis, advice: hintData.advice };
    }
    return { diagnosis: '继续练习，加强辨别能力', advice: ['多听多练，熟能生巧'] };
  }

  /**
   * 设置缓存的示例组数据
   */
  setCachedExampleGroups(groups: ExampleGroup[]): void {
    this.cachedExampleGroups.set(groups);
  }

  /**
   * 获取缓存的示例组数据
   * 如果没有缓存，返回默认数据
   */
  getCachedExampleGroups(): ExampleGroup[] {
    return this.cachedExampleGroups() || this.defaultExampleGroups;
  }

  /**
   * 清除缓存的示例组数据
   */
  clearCachedExampleGroups(): void {
    this.cachedExampleGroups.set(null);
  }
}
