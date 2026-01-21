import { Injectable } from '@angular/core';
import { AudioBufferService } from './audio-buffer.service';

/**
 * 音高分析数据
 */
export interface AudioAnalysisData {
  pitch: number;      // Hz
  volume: number;     // RMS
  time: number;       // 秒
}

/**
 * 音高偏差
 */
export interface PitchDeviation {
  type: 'overall_high' | 'overall_low' | 'start_high' | 'start_low' | 'end_high' | 'end_low' | 'oscillation';
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
}

/**
 * 对比结果
 */
export interface ComparisonResult {
  similarityScore: number;      // 0-100
  deviations: PitchDeviation[];
  advice: string[];
}

/**
 * 音高分析服务
 * 提取和对比音高数据，生成矫正建议
 */
@Injectable({
  providedIn: 'root'
})
export class PitchAnalysisService {
  // Yin 算法参数
  private readonly FRAME_SIZE = 2048;
  private readonly HOP_SIZE = 512;
  private readonly YIN_THRESHOLD = 0.15;
  private readonly MIN_FREQUENCY = 50;
  private readonly MAX_FREQUENCY = 800;

  constructor(private audioBufferService: AudioBufferService) {}

  /**
   * 从 AudioBuffer 提取音高数据
   * @param audioBuffer 音频缓冲区
   * @returns 音高数据数组
   */
  extractPitchData(audioBuffer: AudioBuffer): AudioAnalysisData[] {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    return this.extractAudioFeatures(audioData, sampleRate);
  }

  /**
   * 从 Blob 提取音高数据
   * @param blob 音频 Blob
   * @returns Promise<音高数据数组>
   */
  async extractPitchDataFromBlob(blob: Blob): Promise<AudioAnalysisData[]> {
    const audioBuffer = await this.audioBufferService.blobToAudioBuffer(blob);
    return this.extractPitchData(audioBuffer);
  }

  /**
   * 从 URL 提取音高数据
   * @param url 音频 URL
   * @returns Promise<音高数据数组>
   */
  async extractPitchDataFromUrl(url: string): Promise<AudioAnalysisData[]> {
    const audioBuffer = await this.audioBufferService.urlToAudioBuffer(url);
    return this.extractPitchData(audioBuffer);
  }

  /**
   * 对比两条音高曲线（使用相对音高对比，适应不同性别和个人差异）
   * @param userPitch 用户录音的音高数据
   * @param standardPitch 标准音的音高数据
   * @returns 对比结果
   */
  comparePitchCurves(userPitch: AudioAnalysisData[], standardPitch: AudioAnalysisData[]): ComparisonResult {
    // 对齐两条曲线
    const aligned = this.alignPitchCurves(userPitch, standardPitch);
    
    // 使用相对音高对比（归一化到相同的音高范围）
    const normalizedUser = this.normalizePitchCurve(aligned.user);
    const normalizedStandard = this.normalizePitchCurve(aligned.standard);
    
    // 计算相似度评分（基于相对音高变化趋势）
    const similarityScore = this.calculateRelativeSimilarityScore(normalizedUser, normalizedStandard);
    
    // 识别偏差（基于相对音高变化）
    const deviations = this.identifyRelativeDeviations(normalizedUser, normalizedStandard);
    
    // 生成建议
    const advice = this.generateCorrectionAdvice(deviations, similarityScore);
    
    return {
      similarityScore,
      deviations,
      advice
    };
  }

  /**
   * 归一化音高曲线（将音高映射到 0-1 范围，保留相对变化）
   * 这样可以消除绝对音高差异，只关注音高变化趋势
   */
  private normalizePitchCurve(data: AudioAnalysisData[]): AudioAnalysisData[] {
    const validPitches = data.filter(d => d.pitch > 0).map(d => d.pitch);
    if (validPitches.length === 0) return data;

    const minPitch = Math.min(...validPitches);
    const maxPitch = Math.max(...validPitches);
    const range = maxPitch - minPitch;

    if (range === 0) {
      // 如果音高没有变化，返回中间值
      return data.map(d => ({
        ...d,
        pitch: d.pitch > 0 ? 0.5 : 0
      }));
    }

    // 归一化到 0-1 范围
    return data.map(d => ({
      ...d,
      pitch: d.pitch > 0 ? (d.pitch - minPitch) / range : 0
    }));
  }

  /**
   * 计算相对相似度评分（基于归一化后的音高变化趋势）
   */
  private calculateRelativeSimilarityScore(userPitch: AudioAnalysisData[], standardPitch: AudioAnalysisData[]): number {
    if (userPitch.length === 0 || standardPitch.length === 0) {
      return 0;
    }

    // 收集有效音高点
    const userValidPitches = userPitch.filter(d => d.pitch > 0);
    const standardValidPitches = standardPitch.filter(d => d.pitch > 0);

    if (userValidPitches.length === 0 || standardValidPitches.length === 0) {
      return 0;
    }

    // 计算音高变化趋势的相似度
    let totalDifference = 0;
    let count = 0;

    const minLength = Math.min(userValidPitches.length, standardValidPitches.length);
    
    // 比较归一化后的音高值（0-1 范围）
    for (let i = 0; i < minLength; i++) {
      const userPitchVal = userValidPitches[i].pitch;
      const standardPitchVal = standardValidPitches[i].pitch;
      
      // 计算归一化音高的差异（0-1 范围）
      const difference = Math.abs(userPitchVal - standardPitchVal);
      totalDifference += difference;
      count++;
    }

    const averageDifference = count > 0 ? totalDifference / count : 0;
    
    // 将差异转换为相似度评分（0-100）
    // 差异 0 = 100 分，差异 0.5 = 0 分
    const score = Math.max(0, 100 - (averageDifference / 0.5) * 100);
    
    return Math.round(score);
  }

  /**
   * 识别相对偏差类型（基于归一化后的音高变化）
   */
  private identifyRelativeDeviations(userPitch: AudioAnalysisData[], standardPitch: AudioAnalysisData[]): PitchDeviation[] {
    const deviations: PitchDeviation[] = [];

    if (userPitch.length === 0 || standardPitch.length === 0) {
      return deviations;
    }

    // 收集有效音高
    const userValidPitches = userPitch.filter(d => d.pitch > 0).map(d => d.pitch);
    const standardValidPitches = standardPitch.filter(d => d.pitch > 0).map(d => d.pitch);

    if (userValidPitches.length === 0 || standardValidPitches.length === 0) {
      return deviations;
    }

    // 1. 检测起始音高偏差（相对位置）
    const userStartPitch = userValidPitches[0];
    const standardStartPitch = standardValidPitches[0];
    const startDifference = Math.abs(userStartPitch - standardStartPitch);

    if (startDifference > 0.15) {
      if (userStartPitch > standardStartPitch) {
        deviations.push({
          type: 'start_high',
          severity: startDifference > 0.3 ? 'severe' : 'moderate',
          description: `起始音高相对偏高`
        });
      } else {
        deviations.push({
          type: 'start_low',
          severity: startDifference > 0.3 ? 'severe' : 'moderate',
          description: `起始音高相对偏低`
        });
      }
    }

    // 2. 检测结束音高偏差
    const userEndPitch = userValidPitches[userValidPitches.length - 1];
    const standardEndPitch = standardValidPitches[standardValidPitches.length - 1];
    const endDifference = Math.abs(userEndPitch - standardEndPitch);

    if (endDifference > 0.15) {
      if (userEndPitch > standardEndPitch) {
        deviations.push({
          type: 'end_high',
          severity: endDifference > 0.3 ? 'severe' : 'moderate',
          description: `结束音高相对偏高`
        });
      } else {
        deviations.push({
          type: 'end_low',
          severity: endDifference > 0.3 ? 'severe' : 'moderate',
          description: `结束音高相对偏低`
        });
      }
    }

    // 3. 检测音高变化趋势（上升/下降/平稳）
    const userTrend = this.calculatePitchTrend(userValidPitches);
    const standardTrend = this.calculatePitchTrend(standardValidPitches);

    if (Math.abs(userTrend - standardTrend) > 0.2) {
      if (userTrend > standardTrend) {
        deviations.push({
          type: 'overall_high',
          severity: 'moderate',
          description: '音高变化趋势偏向上升，应该更平稳或下降'
        });
      } else {
        deviations.push({
          type: 'overall_low',
          severity: 'moderate',
          description: '音高变化趋势偏向下降，应该更平稳或上升'
        });
      }
    }

    // 4. 检测音高震荡
    const userOscillation = this.calculateOscillation(userValidPitches);
    const standardOscillation = this.calculateOscillation(standardValidPitches);

    if (userOscillation > standardOscillation * 1.5) {
      deviations.push({
        type: 'oscillation',
        severity: userOscillation > standardOscillation * 2.5 ? 'severe' : 'moderate',
        description: '音高波动较大，发音不够稳定'
      });
    }

    return deviations;
  }

  /**
   * 计算音高变化趋势（正值表示上升，负值表示下降，0 表示平稳）
   */
  private calculatePitchTrend(pitches: number[]): number {
    if (pitches.length < 2) return 0;

    // 使用线性回归计算趋势
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = pitches.length;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += pitches[i];
      sumXY += i * pitches[i];
      sumX2 += i * i;
    }

    // 斜率 = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return slope;
  }

  /**
   * 计算音高震荡程度
   * @param pitches 音高数组
   * @returns 震荡程度（标准差）
   */
  private calculateOscillation(pitches: number[]): number {
    if (pitches.length < 2) return 0;

    const mean = pitches.reduce((a, b) => a + b) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitches.length;
    return Math.sqrt(variance);
  }

  /**
   * 生成矫正建议
   * @param deviations 偏差数组
   * @param similarityScore 相似度评分
   * @returns 建议文案数组
   */
  private generateCorrectionAdvice(deviations: PitchDeviation[], similarityScore: number): string[] {
    const advice: string[] = [];

    if (similarityScore >= 90) {
      advice.push('很好！你的声调与标准音非常接近。');
      return advice;
    }

    if (similarityScore >= 75) {
      advice.push('不错！你的声调基本正确，继续保持。');
    } else if (similarityScore >= 60) {
      advice.push('还需要继续练习，注意以下几点：');
    } else {
      advice.push('需要加强练习，重点关注以下问题：');
    }

    // 根据偏差类型生成具体建议
    for (const deviation of deviations) {
      switch (deviation.type) {
        case 'overall_high':
          advice.push('• 音高变化趋势偏向上升，注意保持平稳或适当下降');
          break;
        case 'overall_low':
          advice.push('• 音高变化趋势偏向下降，注意保持平稳或适当上升');
          break;
        case 'start_high':
          advice.push('• 起始音高相对偏高，开口时音高应该更低一些');
          break;
        case 'start_low':
          advice.push('• 起始音高相对偏低，需要更高的起始点');
          break;
        case 'end_high':
          advice.push('• 结束音高相对偏高，收尾时应该降低音高');
          break;
        case 'end_low':
          advice.push('• 结束音高相对偏低，收尾时应该保持或提高音高');
          break;
        case 'oscillation':
          advice.push('• 音高波动较大，需要稳定发音，保持气流均匀');
          break;
      }
    }

    if (advice.length === 1) {
      advice.push('• 多听标准音，注意音高的相对变化');
      advice.push('• 在词语和短句中练习，感受声调的自然节奏');
    }

    return advice;
  }

  /**
   * 对齐两条音高曲线
   * 使用简单的线性对齐方法
   * @param userPitch 用户音高数据
   * @param standardPitch 标准音高数据
   * @returns 对齐后的数据
   */
  private alignPitchCurves(
    userPitch: AudioAnalysisData[],
    standardPitch: AudioAnalysisData[]
  ): { user: AudioAnalysisData[]; standard: AudioAnalysisData[] } {
    // 获取有效数据的时间范围
    const userValidData = userPitch.filter(d => d.pitch > 0);
    const standardValidData = standardPitch.filter(d => d.pitch > 0);

    if (userValidData.length === 0 || standardValidData.length === 0) {
      return { user: userPitch, standard: standardPitch };
    }

    // 获取时间范围
    const userStartTime = userValidData[0].time;
    const userEndTime = userValidData[userValidData.length - 1].time;
    const standardStartTime = standardValidData[0].time;
    const standardEndTime = standardValidData[standardValidData.length - 1].time;

    const userDuration = userEndTime - userStartTime;
    const standardDuration = standardEndTime - standardStartTime;

    if (userDuration === 0 || standardDuration === 0) {
      return { user: userPitch, standard: standardPitch };
    }

    // 对齐：将两条曲线的有效部分映射到相同的时间范围
    const alignedUser = userPitch.map(d => {
      if (d.pitch === 0) return d;
      
      const normalizedTime = (d.time - userStartTime) / userDuration;
      const alignedTime = standardStartTime + normalizedTime * standardDuration;
      
      return { ...d, time: alignedTime };
    });

    return { user: alignedUser, standard: standardPitch };
  }

  /**
   * 提取音频特征（音高和音量）
   * @param audioData 音频数据
   * @param sampleRate 采样率
   * @returns 音高数据数组
   */
  private extractAudioFeatures(audioData: Float32Array, sampleRate: number): AudioAnalysisData[] {
    const results: AudioAnalysisData[] = [];

    for (let i = 0; i < audioData.length - this.FRAME_SIZE; i += this.HOP_SIZE) {
      const frame = audioData.slice(i, i + this.FRAME_SIZE);
      const pitch = this.yinPitchDetection(frame, sampleRate);
      const volume = this.calculateRMS(frame);
      const time = (i + this.FRAME_SIZE / 2) / sampleRate;
      
      results.push({ pitch, volume, time });
    }

    const smoothed = this.smoothData(results);
    return this.removeInitialTransient(smoothed);
  }

  /**
   * 计算 RMS（均方根）音量
   * @param buffer 音频帧
   * @returns RMS 值
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Yin 音高检测算法
   * @param buffer 音频帧
   * @param sampleRate 采样率
   * @returns 检测到的频率（Hz），如果无法检测则返回 0
   */
  private yinPitchDetection(buffer: Float32Array, sampleRate: number): number {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(halfBufferSize);
    
    // 计算差分函数
    for (let tau = 0; tau < halfBufferSize; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // 累积均一化差分函数
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // 寻找最小值
    let tauEstimate = -1;
    for (let tau = 2; tau < halfBufferSize; tau++) {
      if (yinBuffer[tau] < this.YIN_THRESHOLD) {
        while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) return 0;

    // 抛物线插值以获得更精确的估计
    const betterTau = this.parabolicInterpolation(yinBuffer, tauEstimate);
    const frequency = sampleRate / betterTau;
    
    // 检查频率范围
    if (frequency < this.MIN_FREQUENCY || frequency > this.MAX_FREQUENCY) {
      return 0;
    }
    
    return frequency;
  }

  /**
   * 抛物线插值
   * @param array 数据数组
   * @param x 插值点
   * @returns 插值结果
   */
  private parabolicInterpolation(array: Float32Array, x: number): number {
    if (x < 1 || x >= array.length - 1) return x;
    
    const s0 = array[x - 1];
    const s1 = array[x];
    const s2 = array[x + 1];
    const a = (s0 + s2 - 2 * s1) / 2;
    const b = (s2 - s0) / 2;
    
    if (a === 0) return x;
    return x - b / (2 * a);
  }

  /**
   * 平滑数据
   * @param data 原始数据
   * @returns 平滑后的数据
   */
  private smoothData(data: AudioAnalysisData[]): AudioAnalysisData[] {
    const windowSize = 3;
    const smoothed = data.map((item, i) => {
      let pitchSum = 0, pitchCount = 0;
      let volumeSum = 0, volumeCount = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(data.length - 1, i + windowSize); j++) {
        if (data[j].pitch > 0) {
          pitchSum += data[j].pitch;
          pitchCount++;
        }
        volumeSum += data[j].volume;
        volumeCount++;
      }
      
      return {
        pitch: pitchCount > 0 ? pitchSum / pitchCount : 0,
        volume: volumeCount > 0 ? volumeSum / volumeCount : 0,
        time: item.time
      };
    });

    return this.trimAbnormalTail(smoothed);
  }

  /**
   * 过滤尾部异常数据
   * @param data 数据数组
   * @returns 过滤后的数据
   */
  private trimAbnormalTail(data: AudioAnalysisData[]): AudioAnalysisData[] {
    if (data.length < 10) return data;

    const validPitches = data.filter(d => d.pitch > 0).map(d => d.pitch);
    if (validPitches.length < 5) return data;

    validPitches.sort((a, b) => a - b);
    const medianPitch = validPitches[Math.floor(validPitches.length / 2)];
    const lowerThreshold = medianPitch * 0.6;

    const result = [...data];

    // 找到主要数据段的结束位置
    let mainEndIndex = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].pitch >= lowerThreshold) {
        mainEndIndex = i;
        break;
      }
    }

    if (mainEndIndex < 0) return result;

    // 将主数据段之后的低音高数据置为无效
    for (let i = mainEndIndex + 1; i < result.length; i++) {
      if (result[i].pitch > 0 && result[i].pitch < lowerThreshold) {
        result[i] = { ...result[i], pitch: 0 };
      }
    }

    return result;
  }

  /**
   * 移除初始瞬态
   * @param data 数据数组
   * @returns 处理后的数据
   */
  private removeInitialTransient(data: AudioAnalysisData[]): AudioAnalysisData[] {
    if (data.length < 10) return data;

    const stableStartIndex = Math.floor(data.length * 0.4);
    const stableData = data.slice(stableStartIndex).filter(d => d.pitch > 0);
    
    if (stableData.length === 0) return data;

    const stableFrequency = stableData.reduce((sum, d) => sum + d.pitch, 0) / stableData.length;
    const maxAllowedFrequency = stableFrequency * 1.10;
    
    const filtered = data.filter(d => d.pitch === 0 || d.pitch <= maxAllowedFrequency);

    if (filtered.length === 0) return data;

    // 调整时间轴
    const timeOffset = filtered[0].time;
    return filtered.map(d => ({
      ...d,
      time: d.time - timeOffset
    }));
  }
}
