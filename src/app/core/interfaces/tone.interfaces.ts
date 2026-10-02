/**
 * 声调训练相关接口定义
 */

// 声调例字
export interface ToneExample {
  char: string;
  jyutping: string;
  meaning: string;
  meaningJyutping?: string;  // 词语的粤拼（可选）
}

// 相关例词（用于跟读练习）
export interface RelatedWord {
  char: string;
  jyutping: string;
  meaning: string;
  meaningJyutping?: string;  // 词语的粤拼
  difficulty?: number;
}

// 相关例词分类
export interface RelatedWordsByType {
  same: RelatedWord[];      // 同音调
  similar: RelatedWord[];   // 音调相近
  different: RelatedWord[]; // 音调差异大
  contrast: RelatedWord[];  // 对比练习
}

// 示例组：同一拼音不同声调的6个字
export interface ExampleGroup {
  id?: number;
  groupIndex?: number;
  baseJyutping: string;  // 基础拼音（不含声调）
  examples: ToneExample[];  // 6个声调的例字，索引0-5对应声调1-6
}

// 声调数据
export interface ToneData {
  number: number;
  name: string;
  pattern: string;
  pitch_pattern: string;
  color: string;
  description: string;
}

// 游戏状态
export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  totalQuestions: number;
  currentQuestion: number;
  correctAnswers: number;
  timeLeft: number;
  currentAnswer: number | null;
  questionChar: string;
  questionJyutping: string;
}

// 字符位置（波形绘制用）
export interface CharacterPosition {
  index: number;
  startX: number;
  endX: number;
  centerX: number;
  charWidth: number;
  isRushing: boolean;
}

// 字符标记（波形显示用）
export interface CharacterMarker {
  index: number;
  char: string;
  jyutping: string;
  meaning: string;
  color: string;
  toneName: string;
  centerX: number;
  centerY: number;
  path: string;
  pathLength: number;
  animationDelay: number;
  isAnimating?: boolean;
  isLoopAnimating?: boolean;
}

// 混淆诊断结果
export interface ConfusionDiagnosis {
  userChoice: number;
  correctAnswer: number;
  confusionPair: string;
  confusionType: 'contour_direction' | 'pitch_height' | 'flat_vs_contour' | 'similar_contour';
  hint: string;
  detailHint: string;
  diagnosis: string;
  advice: string[];
}

// 练习统计
export interface PracticeStats {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  confusionMatrix: number[][]; // 6x6 矩阵
  confusionPairs: { pair: string; count: number; chars: string[] }[];
  startTime: number;
  endTime: number;
}

// 混淆提示数据
export interface ConfusionHint {
  type: string;
  hint: string;
  detail: string;
  diagnosis: string;
  advice: string[];
}

// 主题配置
export interface Theme {
  id: string;
  name: string;
  gradient: string;
}
