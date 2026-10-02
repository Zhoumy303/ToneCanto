import { Injectable, inject, signal, computed } from '@angular/core';
import { ToneDataService } from './tone-data.service';
import { ToneExample, PracticeStats, ConfusionDiagnosis } from '../interfaces/tone.interfaces';

/**
 * 挑战服务
 * 管理听音辨调挑战模式、练习统计和混淆诊断
 */
@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private readonly toneDataService = inject(ToneDataService);

  // 挑战模式状态
  private readonly _isChallengeMode = signal<boolean>(false);
  private readonly _challengeCorrectIndex = signal<number | null>(null);
  private readonly _challengeUserChoice = signal<number | null>(null);
  private readonly _challengeFeedback = signal<'correct' | 'incorrect' | null>(null);
  private readonly _currentDiagnosis = signal<ConfusionDiagnosis | null>(null);
  private readonly _showPracticeReport = signal<boolean>(false);

  // 练习统计
  private readonly _practiceStats = signal<PracticeStats>({
    totalQuestions: 0,
    correctCount: 0,
    wrongCount: 0,
    confusionMatrix: Array(6).fill(null).map(() => Array(6).fill(0)),
    confusionPairs: [],
    startTime: 0,
    endTime: 0
  });

  // 公开只读信号
  readonly isChallengeMode = this._isChallengeMode.asReadonly();
  readonly challengeCorrectIndex = this._challengeCorrectIndex.asReadonly();
  readonly challengeUserChoice = this._challengeUserChoice.asReadonly();
  readonly challengeFeedback = this._challengeFeedback.asReadonly();
  readonly currentDiagnosis = this._currentDiagnosis.asReadonly();
  readonly showPracticeReport = this._showPracticeReport.asReadonly();
  readonly practiceStats = this._practiceStats.asReadonly();

  // 计算属性
  readonly practiceAccuracy = computed(() => {
    const stats = this._practiceStats();
    if (stats.totalQuestions === 0) return 0;
    return Math.round((stats.correctCount / stats.totalQuestions) * 100);
  });

  readonly practiceTime = computed(() => {
    const stats = this._practiceStats();
    if (stats.startTime === 0) return 0;
    const endTime = stats.endTime || Date.now();
    return Math.round((endTime - stats.startTime) / 1000);
  });

  readonly topConfusionPairs = computed(() => {
    const stats = this._practiceStats();
    return stats.confusionPairs
      .slice(0, 3)
      .map(p => ({
        ...p,
        tones: p.pair.split('_').map(Number)
      }));
  });

  readonly masteredTones = computed(() => {
    const stats = this._practiceStats();
    const mastered: number[] = [];
    
    // 简单判断：如果某声调在混淆矩阵中错误次数为0，认为已掌握
    for (let i = 0; i < 6; i++) {
      const wrongCount = stats.confusionMatrix[i].reduce((sum, val) => sum + val, 0);
      if (wrongCount === 0 && stats.totalQuestions > 0) {
        mastered.push(i + 1);
      }
    }
    
    return mastered;
  });

  // 定时器
  private challengeLoopTimer: ReturnType<typeof setInterval> | null = null;
  private autoNextTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 开始挑战模式
   */
  startChallenge(examplesCount: number): void {
    if (examplesCount === 0) return;
    
    this._isChallengeMode.set(true);
    this._challengeFeedback.set(null);
    this._challengeUserChoice.set(null);
    this.stopChallengeLoop();
    
    // 重置统计（如果是新开始）
    const stats = this._practiceStats();
    if (stats.totalQuestions === 0) {
      this.resetPracticeStats();
    }
  }

  /**
   * 生成下一题
   */
  generateNextQuestion(examplesCount: number): number {
    this._challengeFeedback.set(null);
    this._challengeUserChoice.set(null);
    this.stopChallengeLoop();
    
    // 随机选择一个字作为正确答案
    const correctIndex = Math.floor(Math.random() * examplesCount);
    this._challengeCorrectIndex.set(correctIndex);
    
    return correctIndex;
  }

  /**
   * 开始循环播放定时器
   */
  startChallengeLoop(playCallback: () => Promise<void>, intervalMs: number = 2500): void {
    this.challengeLoopTimer = setInterval(async () => {
      if (this._challengeFeedback() !== null || !this._isChallengeMode()) {
        this.stopChallengeLoop();
        return;
      }
      await playCallback();
    }, intervalMs);
  }

  /**
   * 停止挑战循环播放
   */
  stopChallengeLoop(): void {
    if (this.challengeLoopTimer) {
      clearInterval(this.challengeLoopTimer);
      this.challengeLoopTimer = null;
    }
    if (this.autoNextTimer) {
      clearTimeout(this.autoNextTimer);
      this.autoNextTimer = null;
    }
  }

  /**
   * 处理用户选择答案
   */
  handleUserChoice(
    charIndex: number, 
    examples: ToneExample[],
    onCorrect: () => void,
    onWrong: () => void
  ): void {
    if (!this._isChallengeMode() || this._challengeFeedback() !== null) return;
    
    this.stopChallengeLoop();
    this._challengeUserChoice.set(charIndex);
    
    const correctIndex = this._challengeCorrectIndex();
    
    this._practiceStats.update(stats => ({
      ...stats,
      totalQuestions: stats.totalQuestions + 1
    }));
    
    if (charIndex === correctIndex) {
      // 答对了
      this._challengeFeedback.set('correct');
      this._practiceStats.update(stats => ({
        ...stats,
        correctCount: stats.correctCount + 1
      }));
      
      // 答对等待1秒后自动下一题
      this.autoNextTimer = setTimeout(() => {
        if (this._isChallengeMode()) {
          onCorrect();
        }
      }, 1000);
    } else {
      // 答错了
      this._challengeFeedback.set('incorrect');
      
      const correctTone = correctIndex! + 1;
      const userTone = charIndex + 1;
      
      this._practiceStats.update(stats => {
        const newMatrix = stats.confusionMatrix.map(row => [...row]);
        newMatrix[correctTone - 1][userTone - 1]++;
        
        return {
          ...stats,
          wrongCount: stats.wrongCount + 1,
          confusionMatrix: newMatrix
        };
      });
      
      // 生成混淆诊断
      const diagnosis = this.diagnoseConfusion(userTone, correctTone);
      this._currentDiagnosis.set(diagnosis);
      
      // 更新混淆对统计
      const char = examples[correctIndex!]?.char || '';
      this.updateConfusionPairs(correctTone, userTone, char);
      
      // 答错等待2秒后自动下一题
      this.autoNextTimer = setTimeout(() => {
        if (this._isChallengeMode()) {
          onWrong();
        }
      }, 2000);
    }
  }

  /**
   * 结束挑战
   */
  endChallenge(): void {
    this.stopChallengeLoop();
    this._isChallengeMode.set(false);
    this._challengeFeedback.set(null);
    this._challengeUserChoice.set(null);
    this._challengeCorrectIndex.set(null);
    this._currentDiagnosis.set(null);
    
    // 如果有答题记录，显示报告
    const stats = this._practiceStats();
    if (stats.totalQuestions >= 3) {
      this._practiceStats.update(s => ({
        ...s,
        endTime: Date.now()
      }));
      this._showPracticeReport.set(true);
    }
  }

  /**
   * 关闭练习报告
   */
  closePracticeReport(): void {
    this._showPracticeReport.set(false);
  }

  /**
   * 重置练习统计
   */
  resetPracticeStats(): void {
    this._practiceStats.set({
      totalQuestions: 0,
      correctCount: 0,
      wrongCount: 0,
      confusionMatrix: Array(6).fill(null).map(() => Array(6).fill(0)),
      confusionPairs: [],
      startTime: Date.now(),
      endTime: 0
    });
    this._showPracticeReport.set(false);
  }

  /**
   * 重新开始练习
   */
  restartPractice(): void {
    this.resetPracticeStats();
    this._showPracticeReport.set(false);
  }

  /**
   * 诊断混淆类型
   */
  private diagnoseConfusion(userChoice: number, correctAnswer: number): ConfusionDiagnosis {
    const key = userChoice < correctAnswer 
      ? `${userChoice}_${correctAnswer}` 
      : `${correctAnswer}_${userChoice}`;
    
    const hintData = this.toneDataService.getConfusionHint(key);
    
    if (hintData) {
      return {
        userChoice,
        correctAnswer,
        confusionPair: `${userChoice}_vs_${correctAnswer}`,
        confusionType: hintData.type as ConfusionDiagnosis['confusionType'],
        hint: hintData.hint,
        detailHint: hintData.detail,
        diagnosis: hintData.diagnosis,
        advice: hintData.advice
      };
    }
    
    return {
      userChoice,
      correctAnswer,
      confusionPair: `${userChoice}_vs_${correctAnswer}`,
      confusionType: 'pitch_height',
      hint: '音高差异',
      detailHint: '注意两个声调的音高和走向差异。',
      diagnosis: '您容易混淆这两个声调',
      advice: ['多听多练，感受差异']
    };
  }

  /**
   * 更新混淆对统计
   */
  private updateConfusionPairs(correct: number, wrong: number, char: string): void {
    const pairKey = correct < wrong ? `${correct}_${wrong}` : `${wrong}_${correct}`;
    
    this._practiceStats.update(stats => {
      const pairs = [...stats.confusionPairs];
      const existingIndex = pairs.findIndex(p => p.pair === pairKey);
      
      if (existingIndex >= 0) {
        pairs[existingIndex] = {
          ...pairs[existingIndex],
          count: pairs[existingIndex].count + 1,
          chars: char && !pairs[existingIndex].chars.includes(char)
            ? [...pairs[existingIndex].chars, char]
            : pairs[existingIndex].chars
        };
      } else {
        pairs.push({ 
          pair: pairKey, 
          count: 1,
          chars: char ? [char] : []
        });
      }
      
      // 按次数排序
      pairs.sort((a, b) => b.count - a.count);
      
      return {
        ...stats,
        confusionPairs: pairs
      };
    });
  }

  /**
   * 计算各声调正确率
   */
  calculateToneAccuracy(): number[] {
    const stats = this._practiceStats();
    const accuracy: number[] = [];
    
    for (let i = 0; i < 6; i++) {
      const totalAsCorrect = stats.confusionMatrix[i].reduce((sum, val) => sum + val, 0);
      const estimatedTotal = Math.ceil(stats.totalQuestions / 6);
      const correctForTone = Math.max(0, estimatedTotal - totalAsCorrect);
      
      if (estimatedTotal > 0) {
        accuracy.push(Math.round((correctForTone / estimatedTotal) * 100));
      } else {
        accuracy.push(0);
      }
    }
    
    return accuracy;
  }

  /**
   * 获取混淆诊断和建议
   */
  getConfusionDiagnosis(pair: string): { diagnosis: string; advice: string[] } {
    return this.toneDataService.getConfusionDiagnosis(pair);
  }

  /**
   * 获取当前练习统计数据（用于保存历史）
   */
  getPracticeStatsForHistory(): {
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    duration: number;
    toneAccuracy: number[];
    confusionPairs: { pair: string; count: number }[];
  } {
    const stats = this._practiceStats();
    return {
      totalQuestions: stats.totalQuestions,
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      duration: this.practiceTime(),
      toneAccuracy: this.calculateToneAccuracy(),
      confusionPairs: stats.confusionPairs.map(p => ({
        pair: p.pair,
        count: p.count
      }))
    };
  }
}
