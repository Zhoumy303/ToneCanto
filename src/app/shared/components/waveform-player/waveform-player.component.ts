import {
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
  effect,
  OnDestroy,
  ChangeDetectionStrategy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import WaveSurfer from 'wavesurfer.js';

interface AudioAnalysisData {
  pitch: number;    // 音高 (Hz)
  volume: number;   // 音量 (0-1)
  time: number;     // 时间点 (秒)
}

@Component({
  selector: 'app-waveform-player',
  templateUrl: './waveform-player.component.html',
  styleUrls: ['./waveform-player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule]
})
export class WaveformPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('analysisCanvas') analysisCanvas!: ElementRef<HTMLCanvasElement>;

  // 输入属性
  readonly audioUrl = input.required<string>();
  readonly height = input<number>(200);
  readonly pitchColor = input<string>('#ff9800');
  readonly volumeColor = input<string>('#4fc3f7');
  readonly cursorColor = input<string>('#ff5722');
  readonly showLegend = input<boolean>(true);

  // 输出事件
  readonly ready = output<number>();
  readonly play = output<void>();
  readonly pause = output<void>();
  readonly finish = output<void>();
  readonly timeUpdate = output<number>();

  // 状态信号
  readonly isPlaying = signal(false);
  readonly isLoading = signal(true);
  readonly duration = signal(0);
  readonly currentTime = signal(0);
  readonly error = signal<string | null>(null);
  readonly isAnalyzing = signal(false);
  readonly analysisProgress = signal(0);

  private wavesurfer: WaveSurfer | null = null;
  private analysisData: AudioAnalysisData[] = [];
  private animationFrameId: number | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    effect(() => {
      const url = this.audioUrl();
      if (url && this.wavesurfer) {
        this.loadAudio(url);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initWaveSurfer();
    this.setupCanvas();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private setupCanvas(): void {
    if (!this.analysisCanvas?.nativeElement) return;
    
    const canvas = this.analysisCanvas.nativeElement;
    this.canvasCtx = canvas.getContext('2d');
    this.resizeCanvas();
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    if (!this.analysisCanvas?.nativeElement) return;
    
    const canvas = this.analysisCanvas.nativeElement;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = this.height();
    }
  }

  private initWaveSurfer(): void {
    // 创建隐藏的容器用于 WaveSurfer
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.display = 'none';
    document.body.appendChild(hiddenContainer);

    this.wavesurfer = WaveSurfer.create({
      container: hiddenContainer,
      height: 0,
      normalize: true,
      backend: 'WebAudio'
    });

    this.setupEventListeners();
    this.loadAudio(this.audioUrl());
  }

  private setupEventListeners(): void {
    if (!this.wavesurfer) return;

    this.wavesurfer.on('ready', (duration) => {
      this.isLoading.set(false);
      this.duration.set(duration);
      this.ready.emit(duration);
      this.analyzeAudio();
    });

    this.wavesurfer.on('play', () => {
      this.isPlaying.set(true);
      this.play.emit();
      this.startAnimation();
    });

    this.wavesurfer.on('pause', () => {
      this.isPlaying.set(false);
      this.pause.emit();
      this.stopAnimation();
    });

    this.wavesurfer.on('finish', () => {
      this.isPlaying.set(false);
      this.finish.emit();
      this.stopAnimation();
      this.drawChart(1);
    });

    this.wavesurfer.on('timeupdate', (currentTime) => {
      this.currentTime.set(currentTime);
      this.timeUpdate.emit(currentTime);
    });

    this.wavesurfer.on('error', (err) => {
      this.isLoading.set(false);
      this.error.set(err.message || '加载音频失败');
    });
  }

  private loadAudio(url: string): void {
    if (!this.wavesurfer || !url) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.analysisData = [];
    this.clearCanvas();
    this.wavesurfer.load(url);
  }

  /**
   * 分析音频数据（音高 + 音量）
   */
  private async analyzeAudio(): Promise<void> {
    if (!this.wavesurfer) return;

    this.isAnalyzing.set(true);
    this.analysisProgress.set(0);

    try {
      const decodedData = this.wavesurfer.getDecodedData();
      if (!decodedData) {
        this.isAnalyzing.set(false);
        return;
      }

      const audioData = decodedData.getChannelData(0);
      const sampleRate = decodedData.sampleRate;
      const duration = decodedData.duration;
      
      this.analysisData = this.extractAudioFeatures(audioData, sampleRate, duration);
      this.drawChart(0);
    } catch (err) {
      console.error('音频分析失败:', err);
    } finally {
      this.isAnalyzing.set(false);
      this.analysisProgress.set(100);
    }
  }

  /**
   * 提取音频特征（音高和音量）
   */
  private extractAudioFeatures(audioData: Float32Array, sampleRate: number, duration: number): AudioAnalysisData[] {
    const results: AudioAnalysisData[] = [];
    const frameSize = 2048;
    const hopSize = 512;
    const threshold = 0.15;
    
    const totalFrames = Math.floor((audioData.length - frameSize) / hopSize);

    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      
      // 计算音高
      const pitch = this.yinPitchDetection(frame, sampleRate, threshold);
      
      // 计算音量 (RMS)
      const volume = this.calculateRMS(frame);
      
      // 计算时间点
      const time = (i + frameSize / 2) / sampleRate;
      
      results.push({ pitch, volume, time });
      
      // 更新进度
      const progress = Math.floor((results.length / totalFrames) * 100);
      this.analysisProgress.set(Math.min(progress, 99));
    }

    return this.smoothData(results);
  }

  /**
   * 计算 RMS 音量
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * YIN 音高检测算法
   */
  private yinPitchDetection(buffer: Float32Array, sampleRate: number, threshold: number): number {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(halfBufferSize);
    
    // 差分函数
    for (let tau = 0; tau < halfBufferSize; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // 累积均值归一化
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // 寻找最小值
    let tauEstimate = -1;
    for (let tau = 2; tau < halfBufferSize; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) return 0;

    // 抛物线插值
    const betterTau = this.parabolicInterpolation(yinBuffer, tauEstimate);
    const frequency = sampleRate / betterTau;
    
    // 过滤不合理频率
    if (frequency < 50 || frequency > 800) return 0;
    return frequency;
  }

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
   */
  private smoothData(data: AudioAnalysisData[]): AudioAnalysisData[] {
    const windowSize = 3;
    return data.map((item, i) => {
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
  }

  /**
   * 绘制合并图表
   */
  private drawChart(progress: number): void {
    if (!this.canvasCtx || !this.analysisCanvas?.nativeElement) return;

    const canvas = this.analysisCanvas.nativeElement;
    const ctx = this.canvasCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (this.analysisData.length === 0) return;

    const duration = this.duration();
    const padding = { top: 20, bottom: 30, left: 50, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 计算数据范围
    const validPitches = this.analysisData.filter(d => d.pitch > 0).map(d => d.pitch);
    const minPitch = validPitches.length > 0 ? Math.min(...validPitches) * 0.9 : 80;
    const maxPitch = validPitches.length > 0 ? Math.max(...validPitches) * 1.1 : 400;
    const maxVolume = Math.max(...this.analysisData.map(d => d.volume)) * 1.1 || 1;

    // 绘制背景和网格
    this.drawBackground(ctx, width, height, padding, chartWidth, chartHeight, minPitch, maxPitch, duration);

    // 绘制音量曲线（填充区域）
    this.drawVolumeCurve(ctx, padding, chartWidth, chartHeight, maxVolume, duration);

    // 绘制音高曲线
    this.drawPitchCurve(ctx, padding, chartWidth, chartHeight, minPitch, maxPitch, duration);

    // 绘制播放进度线
    if (progress > 0) {
      const progressX = padding.left + progress * chartWidth;
      ctx.beginPath();
      ctx.strokeStyle = this.cursorColor();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.moveTo(progressX, padding.top);
      ctx.lineTo(progressX, height - padding.bottom);
      ctx.stroke();
    }

    // 绘制图例
    if (this.showLegend()) {
      this.drawLegend(ctx, width, padding);
    }
  }

  /**
   * 绘制背景和网格
   */
  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    minPitch: number,
    maxPitch: number,
    duration: number
  ): void {
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';

    // 音高参考线（左侧 Y 轴）
    const pitchLines = [100, 150, 200, 250, 300, 400, 500];
    const pitchRange = maxPitch - minPitch;

    for (const pitch of pitchLines) {
      if (pitch >= minPitch && pitch <= maxPitch) {
        const y = padding.top + chartHeight - ((pitch - minPitch) / pitchRange) * chartHeight;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        ctx.fillStyle = this.pitchColor();
        ctx.textAlign = 'right';
        ctx.fillText(`${pitch}`, padding.left - 5, y + 3);
      }
    }

    // 时间轴（底部 X 轴）
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
    ctx.textAlign = 'center';
    const timeStep = duration > 10 ? 2 : (duration > 5 ? 1 : 0.5);
    
    for (let t = 0; t <= duration; t += timeStep) {
      const x = padding.left + (t / duration) * chartWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      
      ctx.fillText(`${t.toFixed(1)}s`, x, height - padding.bottom + 15);
    }

    ctx.setLineDash([]);
  }

  /**
   * 绘制音量曲线（填充区域）
   */
  private drawVolumeCurve(
    ctx: CanvasRenderingContext2D,
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    maxVolume: number,
    duration: number
  ): void {
    if (this.analysisData.length === 0) return;

    ctx.beginPath();
    ctx.fillStyle = `${this.volumeColor()}40`; // 40% 透明度
    
    const baseY = padding.top + chartHeight;
    ctx.moveTo(padding.left, baseY);

    for (const data of this.analysisData) {
      const x = padding.left + (data.time / duration) * chartWidth;
      const volumeHeight = (data.volume / maxVolume) * chartHeight * 0.8;
      const y = baseY - volumeHeight;
      ctx.lineTo(x, y);
    }

    // 闭合路径
    const lastData = this.analysisData[this.analysisData.length - 1];
    ctx.lineTo(padding.left + (lastData.time / duration) * chartWidth, baseY);
    ctx.closePath();
    ctx.fill();

    // 绘制音量曲线边缘
    ctx.beginPath();
    ctx.strokeStyle = this.volumeColor();
    ctx.lineWidth = 1.5;

    let started = false;
    for (const data of this.analysisData) {
      const x = padding.left + (data.time / duration) * chartWidth;
      const volumeHeight = (data.volume / maxVolume) * chartHeight * 0.8;
      const y = baseY - volumeHeight;
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /**
   * 绘制音高曲线
   */
  private drawPitchCurve(
    ctx: CanvasRenderingContext2D,
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    minPitch: number,
    maxPitch: number,
    duration: number
  ): void {
    if (this.analysisData.length === 0) return;

    const pitchRange = maxPitch - minPitch;

    ctx.beginPath();
    ctx.strokeStyle = this.pitchColor();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawing = false;

    for (const data of this.analysisData) {
      if (data.pitch > 0) {
        const x = padding.left + (data.time / duration) * chartWidth;
        const y = padding.top + chartHeight - ((data.pitch - minPitch) / pitchRange) * chartHeight;
        
        if (!isDrawing) {
          ctx.moveTo(x, y);
          isDrawing = true;
        } else {
          ctx.lineTo(x, y);
        }
      } else {
        if (isDrawing) {
          ctx.stroke();
          ctx.beginPath();
          isDrawing = false;
        }
      }
    }
    
    if (isDrawing) {
      ctx.stroke();
    }
  }

  /**
   * 绘制图例
   */
  private drawLegend(
    ctx: CanvasRenderingContext2D,
    width: number,
    padding: { top: number; bottom: number; left: number; right: number }
  ): void {
    const legendY = 10;
    const legendX = width - padding.right - 150;

    ctx.font = '11px sans-serif';

    // 音高图例
    ctx.fillStyle = this.pitchColor();
    ctx.fillRect(legendX, legendY, 16, 3);
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.fillText('音高 (Hz)', legendX + 22, legendY + 5);

    // 音量图例
    ctx.fillStyle = `${this.volumeColor()}60`;
    ctx.fillRect(legendX + 85, legendY - 3, 16, 10);
    ctx.fillStyle = '#666';
    ctx.fillText('音量', legendX + 107, legendY + 5);
  }

  private clearCanvas(): void {
    if (!this.canvasCtx || !this.analysisCanvas?.nativeElement) return;
    const canvas = this.analysisCanvas.nativeElement;
    this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private startAnimation(): void {
    const animate = () => {
      if (!this.isPlaying()) return;
      
      const progress = this.currentTime() / this.duration();
      this.drawChart(progress);
      
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private cleanup(): void {
    this.stopAnimation();
    window.removeEventListener('resize', () => this.resizeCanvas());
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
  }

  /**
   * 点击图表跳转播放位置
   */
  onCanvasClick(event: MouseEvent): void {
    if (!this.analysisCanvas?.nativeElement || this.duration() === 0) return;

    const canvas = this.analysisCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    const padding = { left: 50, right: 20 };
    const chartWidth = canvas.width - padding.left - padding.right;
    
    if (x >= padding.left && x <= canvas.width - padding.right) {
      const progress = (x - padding.left) / chartWidth;
      this.seekTo(progress * this.duration());
      this.drawChart(progress);
    }
  }

  togglePlayPause(): void {
    if (!this.wavesurfer) return;
    this.wavesurfer.playPause();
  }

  playAudio(): void {
    this.wavesurfer?.play();
  }

  pauseAudio(): void {
    this.wavesurfer?.pause();
  }

  stopAudio(): void {
    this.wavesurfer?.stop();
  }

  seekTo(seconds: number): void {
    if (!this.wavesurfer || this.duration() === 0) return;
    const progress = seconds / this.duration();
    this.wavesurfer.seekTo(Math.min(1, Math.max(0, progress)));
  }

  setPlaybackRate(rate: number): void {
    this.wavesurfer?.setPlaybackRate(rate);
  }

  setVolume(volume: number): void {
    this.wavesurfer?.setVolume(Math.min(1, Math.max(0, volume)));
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
