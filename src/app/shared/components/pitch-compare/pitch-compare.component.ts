import {
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
  computed,
  OnDestroy,
  ChangeDetectionStrategy,
  AfterViewInit,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronUpOutline, chevronDownOutline, add, trash, play, pause, close, checkmark, 
  stopOutline, listOutline, trashOutline, playCircleOutline, pauseCircleOutline, volumeHigh} from 'ionicons/icons';

// 注册需要使用的图标
addIcons({ 'chevron-up-outline': chevronUpOutline, 'chevron-down-outline': chevronDownOutline, add, trash, play, pause, close, checkmark, 
  'stop-outline': stopOutline, 'list-outline': listOutline, 'trash-outline': trashOutline, 'play-circle-outline': playCircleOutline, 'pause-circle-outline': pauseCircleOutline, 'volume-high': volumeHigh});

interface AudioAnalysisData {
  pitch: number;
  volume: number;
  time: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  color: string;
  url: string;
  duration: number;
  currentTime: number;
  isReady: boolean;
  isPlaying: boolean;
  isAnalyzing: boolean;
  isVisible: boolean;  // 是否在图表中显示
  toneNumber: number;  // 粤语声调号（1-6），0 表示未知
}

/**
 * 粤语六声调的调值定义
 * 调值用五度标记法表示：1=低, 2=次低, 3=中, 4=次高, 5=高
 * 
 * 声调1: 阴平 55/53 - 高平/高降，起点高
 * 声调2: 阴上 35 - 中升，起点中等偏低
 * 声调3: 阴去 33 - 中平，起点中等
 * 声调4: 阳平 11/21 - 低平/低降，起点低
 * 声调5: 阳上 23 - 低升，起点低
 * 声调6: 阳去 22 - 低平，起点低
 */
const TONE_PATTERNS: Record<number, { startLevel: 'high' | 'mid' | 'low'; pattern: string }> = {
  1: { startLevel: 'high', pattern: '55/53' },  // 阴平：高平/高降
  2: { startLevel: 'mid', pattern: '35' },      // 阴上：中升
  3: { startLevel: 'mid', pattern: '33' },      // 阴去：中平
  4: { startLevel: 'low', pattern: '11/21' },   // 阳平：低平/低降
  5: { startLevel: 'low', pattern: '23' },      // 阳上：低升
  6: { startLevel: 'low', pattern: '22' },      // 阳去：低平
};

// 声调颜色（与 tone-data.service 保持一致）
const TONE_COLORS = [
  '#ef4444', // 声调1: 阴平 - 红色
  '#f59e0b', // 声调2: 阴上 - 橙色
  '#10b981', // 声调3: 阴去 - 绿色
  '#3b82f6', // 声调4: 阳平 - 蓝色
  '#8b5cf6', // 声调5: 阳上 - 紫色
  '#ec4899'  // 声调6: 阳去 - 粉色
];

// 预设颜色（用于未识别声调的音轨）
const TRACK_COLORS = TONE_COLORS;

@Component({
  selector: 'app-pitch-compare',
  templateUrl: './pitch-compare.component.html',
  styleUrls: ['./pitch-compare.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule]
})
export class PitchCompareComponent implements AfterViewInit, OnDestroy {
  @ViewChild('compareCanvas') compareCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // 输入属性
  readonly height = input<number>(280);
  readonly maxTracks = input<number>(8);
  readonly initialAudioUrl = input<string>('');  // 初始音频 URL
  readonly showAddButton = input<boolean>(true);  // 是否显示添加音频按钮
  readonly audioTracks = input<Array<{ url: string; name: string }>>([]);  // 要加载的音频列表
  readonly simpleMode = input<boolean>(false);  // 简化模式：只显示图表，隐藏音轨列表和控制按钮
  readonly showSequencePlayButton = input<boolean>(false);  // 是否显示依次播放按钮
  readonly isSequencePlaying = input<boolean>(false);  // 依次播放状态
  readonly sequencePlayDisabled = input<boolean>(false);  // 依次播放按钮是否禁用

  // 输出事件
  readonly trackAdded = output<AudioTrack>();
  readonly trackRemoved = output<string>();
  readonly error = output<string>();
  readonly sequencePlayClicked = output<void>();  // 依次播放按钮点击事件
  readonly sequencePlayCompleted = output<void>();  // 依次播放完成事件

  // 音轨列表
  readonly tracks = signal<AudioTrack[]>([]);
  readonly isLoading = signal(false);

  // 计算属性
  readonly hasAnyTrack = computed(() => this.tracks().some(t => t.isReady));
  readonly isAnyPlaying = computed(() => this.tracks().some(t => t.isPlaying));
  readonly canAddMore = computed(() => this.tracks().length < this.maxTracks());
  readonly visibleTracks = computed(() => this.tracks().filter(t => t.isVisible && t.isReady));

  // 私有存储
  private audioContext: AudioContext | null = null;
  private audioBufferMap = new Map<string, AudioBuffer>();
  private audioSourceMap = new Map<string, AudioBufferSourceNode>();
  private analysisDataMap = new Map<string, AudioAnalysisData[]>();
  private timeOffsetMap = new Map<string, number>();
  private playStartTimeMap = new Map<string, number>(); // 记录播放开始时间
  
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private trackIdCounter = 0;
  private legendBounds: Array<{ trackId: string; x: number; y: number; width: number; height: number }> = [];
  
  // 播放时显示字符
  private playingTrackChar = new Map<string, string>(); // trackId -> 字符
  private charDisplayTimers = new Map<string, ReturnType<typeof setTimeout>>(); // trackId -> timer

  constructor() {
    // 监听初始音频 URL 变化，自动加载
    effect(() => {
      const url = this.initialAudioUrl();
      if (url && this.compareCanvas?.nativeElement) {
        // 清空现有音轨
        this.clearAll();
        // 从 URL 提取文件名作为 track 名称
        const fileName = url.split('/').pop() || 'audio';
        setTimeout(() => {
          this.addTrack(url, fileName);
        }, 50);
      }
    });

    // 监听音频轨道列表变化，自动加载
    effect(() => {
      const audioList = this.audioTracks();
      if (audioList && audioList.length > 0 && this.compareCanvas?.nativeElement) {
        // 清空现有音轨
        this.clearAll();
        
        // 延迟加载每个音轨
        audioList.forEach((audio, index) => {
          setTimeout(() => {
            this.addTrack(audio.url, audio.name);
          }, index * 200 + 100);
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupCanvas();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private setupCanvas(): void {
    if (!this.compareCanvas?.nativeElement) return;
    
    const canvas = this.compareCanvas.nativeElement;
    this.canvasCtx = canvas.getContext('2d');
    
    setTimeout(() => {
      this.resizeCanvas();
      this.drawChart();
    }, 100);
    
    window.addEventListener('resize', this.handleResize);
    
    // 在简化模式下，添加点击和鼠标移动事件监听器
    if (this.simpleMode()) {
      canvas.addEventListener('click', this.handleCanvasClick);
      canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
      canvas.style.cursor = 'pointer';
    }
  }

  private handleCanvasMouseMove = (event: MouseEvent): void => {
    // 移除 canvas 鼠标移动检测，因为图例已改为 HTML 形式
    // 保留此方法以便将来需要时可以添加其他鼠标移动逻辑
  };

  private handleCanvasClick = (event: MouseEvent): void => {
    // 移除 canvas 点击检测，因为图例已改为 HTML 形式
    // 保留此方法以便将来需要时可以添加其他点击逻辑
  };

  /**
   * 检测点击位置是否在图例上
   * @param x 点击的 x 坐标
   * @param y 点击的 y 坐标
   * @returns 音轨 ID，如果没有点击到图例则返回 null
   */
  private detectClickedLegend(x: number, y: number): string | null {
    if (!this.legendBounds || this.legendBounds.length === 0) return null;
    
    for (const bound of this.legendBounds) {
      if (x >= bound.x && x <= bound.x + bound.width &&
          y >= bound.y && y <= bound.y + bound.height) {
        return bound.trackId;
      }
    }
    
    return null;
  }

  /**
   * 检测点击位置是否在某个标签上
   * @param x 点击的 x 坐标
   * @param y 点击的 y 坐标
   * @returns 音轨 ID，如果没有点击到标签则返回 null
   */
  private detectClickedLabel(x: number, y: number): string | null {
    const readyTracks = this.tracks().filter(t => {
      const data = this.analysisDataMap.get(t.id);
      return t.isReady && t.isVisible && data && data.length > 0;
    });
    
    if (readyTracks.length === 0) return null;
    
    const canvas = this.compareCanvas?.nativeElement;
    if (!canvas) return null;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 35, bottom: 35, left: 55, right: 25 };
    
    // 收集所有对齐后的数据
    const alignedDataMap = new Map<string, AudioAnalysisData[]>();
    const allAlignedData: AudioAnalysisData[] = [];
    
    for (const track of readyTracks) {
      const alignedData = this.getAlignedData(track.id);
      alignedDataMap.set(track.id, alignedData);
      allAlignedData.push(...alignedData);
    }
    
    const validPitches = allAlignedData.filter(d => d.pitch > 0).map(d => d.pitch);
    if (validPitches.length === 0) return null;
    
    const minPitch = Math.min(...validPitches) * 0.85;
    const maxPitch = Math.max(...validPitches) * 1.15;
    const maxDuration = this.getAlignedMaxDuration();
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const pitchRange = maxPitch - minPitch;
    
    // 标签点击区域（矩形）
    const clickAreaWidth = 30;
    const clickAreaHeight = 30;
    
    // 检查点击是否在某个标签的矩形区域内
    for (const track of readyTracks) {
      const alignedData = alignedDataMap.get(track.id);
      if (!alignedData) continue;
      
      // 找到曲线的中间位置（与绘制标签时相同的逻辑）
      const validPoints = alignedData.filter(d => d.pitch > 0);
      if (validPoints.length === 0) continue;
      
      const midIndex = Math.floor(validPoints.length / 2);
      const midPoint = validPoints[midIndex];
      
      let labelX = padding.left + (midPoint.time / maxDuration) * chartWidth;
      let labelY = padding.top + chartHeight - ((midPoint.pitch - minPitch) / pitchRange) * chartHeight;
      
      // 标签向上偏移（与绘制时相同）
      labelY -= 25;
      
      // 检查点击是否在矩形区域内
      if (x >= labelX - clickAreaWidth / 2 && x <= labelX + clickAreaWidth / 2 &&
          y >= labelY - clickAreaHeight / 2 && y <= labelY + clickAreaHeight / 2) {
        return track.id;
      }
    }
    
    return null;
  }

  private handleResize = (): void => {
    this.resizeCanvas();
    this.drawChart();
  };

  private resizeCanvas(): void {
    if (!this.compareCanvas?.nativeElement) return;
    
    const canvas = this.compareCanvas.nativeElement;
    const rect = canvas.parentElement?.getBoundingClientRect();
    
    if (rect && rect.width > 0) {
      canvas.width = rect.width;
      canvas.height = this.height();
    } else {
      canvas.width = 800;
      canvas.height = this.height();
    }
  }

  selectFiles(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) {
        this.error.emit(`${file.name} 不是音频文件`);
        return;
      }

      if (!this.canAddMore()) {
        this.error.emit(`最多支持 ${this.maxTracks()} 个音频`);
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      this.addTrack(blobUrl, file.name);
    });

    // 添加完后按文件名数字排序
    this.sortTracksByName();
    input.value = '';
  }

  addTrack(url: string, name: string): void {
    const id = `track-${++this.trackIdCounter}`;
    
    // 从文件名中提取粤语声调号（最后一个数字，1-6）
    const toneNumber = this.extractToneNumber(name);
    
    // 根据声调号选择颜色，如果无法识别声调则按顺序分配
    let color: string;
    if (toneNumber >= 1 && toneNumber <= 6) {
      color = TONE_COLORS[toneNumber - 1]; // 声调1对应索引0
    } else {
      const colorIndex = this.tracks().length % TRACK_COLORS.length;
      color = TRACK_COLORS[colorIndex];
    }
    
    const track: AudioTrack = {
      id,
      name,
      color,
      url,
      duration: 0,
      currentTime: 0,
      isReady: false,
      isPlaying: false,
      isAnalyzing: false,
      isVisible: true,
      toneNumber
    };

    this.tracks.update(tracks => [...tracks, track]);
    this.loadTrack(id, url);
  }

  /** 从文件名中提取数字用于排序 */
  private extractNumber(name: string): number {
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : Infinity;
  }

  /**
   * 从粤拼文件名中提取声调号
   * 粤拼格式：声母+韵母+声调号，如 maa1, gong2, si3
   * 声调号是文件名中最后一个数字（1-6）
   * @param name 文件名
   * @returns 声调号（1-6），如果无法识别则返回 0
   */
  private extractToneNumber(name: string): number {
    // 移除文件扩展名
    const baseName = name.replace(/\.[^.]+$/, '');
    // 匹配最后一个数字
    const match = baseName.match(/(\d)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      // 粤语只有 1-6 声调
      if (num >= 1 && num <= 6) {
        return num;
      }
    }
    return 0; // 未知声调
  }

  /** 按文件名中的数字排序 */
  sortTracksByName(): void {
    this.tracks.update(tracks => 
      [...tracks].sort((a, b) => this.extractNumber(a.name) - this.extractNumber(b.name))
    );
  }

  /** 移动音轨位置 */
  moveTrack(trackId: string, direction: 'up' | 'down'): void {
    const tracks = this.tracks();
    const index = tracks.findIndex(t => t.id === trackId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;

    const newTracks = [...tracks];
    [newTracks[index], newTracks[newIndex]] = [newTracks[newIndex], newTracks[index]];
    this.tracks.set(newTracks);
  }

  removeTrack(trackId: string): void {
    const track = this.tracks().find(t => t.id === trackId);
    if (!track) return;

    // 停止播放
    this.stopTrack(trackId);
    
    // 清理资源
    this.audioBufferMap.delete(trackId);
    this.analysisDataMap.delete(trackId);
    this.timeOffsetMap.delete(trackId);
    this.playStartTimeMap.delete(trackId);
    
    // 不要 revoke blob URL，因为它可能是由外部缓存服务管理的
    // 只有在这是本地创建的 blob URL 时才 revoke（通过文件上传创建的）
    // 由于我们无法区分，所以统一不 revoke，让缓存服务管理

    this.tracks.update(tracks => tracks.filter(t => t.id !== trackId));
    this.trackRemoved.emit(trackId);
    this.drawChart();
  }

  private async loadTrack(trackId: string, url: string): Promise<void> {
    this.isLoading.set(true);

    try {
      const ctx = this.getAudioContext();
      
      // 获取音频数据
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      this.audioBufferMap.set(trackId, audioBuffer);
      
      // 更新状态为分析中
      this.tracks.update(tracks => 
        tracks.map(t => t.id === trackId ? { ...t, duration: audioBuffer.duration, isAnalyzing: true } : t)
      );

      // 获取当前 track 的声调号
      const track = this.tracks().find(t => t.id === trackId);
      const toneNumber = track?.toneNumber || 0;

      // 分析音频
      let data = this.analyzeAudioBuffer(audioBuffer);
      
      // 根据声调智能过滤异常数据
      if (toneNumber >= 1 && toneNumber <= 6) {
        data = this.filterByTonePattern(data, toneNumber);
      }
      
      this.analysisDataMap.set(trackId, data);
      
      // 计算有效数据的起始时间偏移
      const startOffset = this.findDataStartTime(data);
      this.timeOffsetMap.set(trackId, startOffset);
      
      // 更新状态为就绪
      this.tracks.update(tracks => 
        tracks.map(t => t.id === trackId ? { ...t, isAnalyzing: false, isReady: true } : t)
      );
      
      this.isLoading.set(false);
      this.resizeCanvas();
      this.drawChart();
      
      const updatedTrack = this.tracks().find(t => t.id === trackId);
      if (updatedTrack) this.trackAdded.emit(updatedTrack);
      
    } catch (err) {
      this.isLoading.set(false);
      this.error.emit(`加载失败`);
      this.removeTrack(trackId);
    }
  }

  /**
   * 根据粤语声调模式智能过滤异常数据
   * 
   * 原理：根据声调的调值特征，判断起始音高应该是高、中还是低，
   * 然后过滤掉不符合该特征的起始数据段。
   * 
   * 例如：声调1（阴平55/53）起点应该是高的，如果检测到起始有一段
   * 从低频上升到高频的数据，那很可能是噪声或检测错误，应该过滤掉。
   * 
   * @param data 原始音高数据
   * @param toneNumber 声调号（1-6）
   * @returns 过滤后的数据
   */
  private filterByTonePattern(data: AudioAnalysisData[], toneNumber: number): AudioAnalysisData[] {
    const pattern = TONE_PATTERNS[toneNumber];
    if (!pattern) return data;

    // 收集所有有效音高，计算统计信息
    const validPitches = data.filter(d => d.pitch > 0).map(d => d.pitch);
    if (validPitches.length < 10) return data;

    // 计算音高的统计值
    validPitches.sort((a, b) => a - b);
    const minPitch = validPitches[0];
    const maxPitch = validPitches[validPitches.length - 1];
    const medianPitch = validPitches[Math.floor(validPitches.length / 2)];
    const pitchRange = maxPitch - minPitch;

    // 定义高、中、低的阈值
    // 高：高于中位数 + 范围的 20%
    // 低：低于中位数 - 范围的 20%
    // 中：介于两者之间
    const highThreshold = medianPitch + pitchRange * 0.1;
    const lowThreshold = medianPitch - pitchRange * 0.2;

    // 根据声调的起始音高特征，过滤不符合的起始数据
    const result = [...data];
    const startLevel = pattern.startLevel;

    // 找到第一个"稳定"的音高点（连续几个点都在预期范围内）
    let stableStartIndex = -1;
    const stabilityWindow = 5; // 需要连续 5 个点都稳定

    for (let i = 0; i < result.length - stabilityWindow; i++) {
      let isStable = true;
      
      for (let j = 0; j < stabilityWindow; j++) {
        const pitch = result[i + j].pitch;
        if (pitch === 0) {
          isStable = false;
          break;
        }

        // 检查是否符合预期的起始音高
        const isInExpectedRange = this.isPitchInExpectedRange(
          pitch, startLevel, highThreshold, lowThreshold
        );
        
        if (!isInExpectedRange) {
          isStable = false;
          break;
        }
      }

      if (isStable) {
        stableStartIndex = i;
        break;
      }
    }

    // 如果找到了稳定起始点，将之前的数据置为无效
    if (stableStartIndex > 0) {
      for (let i = 0; i < stableStartIndex; i++) {
        result[i] = { ...result[i], pitch: 0 };
      }
    }

    return result;
  }

  /**
   * 判断音高是否在预期范围内
   * @param pitch 当前音高
   * @param expectedLevel 预期的音高级别（high/mid/low）
   * @param highThreshold 高音阈值
   * @param lowThreshold 低音阈值
   */
  private isPitchInExpectedRange(
    pitch: number,
    expectedLevel: 'high' | 'mid' | 'low',
    highThreshold: number,
    lowThreshold: number
  ): boolean {
    switch (expectedLevel) {
      case 'high':
        // 高起点：音高应该高于高阈值，或至少不低于低阈值太多
        return pitch >= lowThreshold;
      case 'mid':
        // 中起点：音高应该在中间范围
        return pitch >= lowThreshold * 0.8;
      case 'low':
        // 低起点：任何音高都可以接受（低声调本来就可能从低开始）
        return true;
      default:
        return true;
    }
  }

  private analyzeAudioBuffer(audioBuffer: AudioBuffer): AudioAnalysisData[] {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    return this.extractAudioFeatures(audioData, sampleRate);
  }

  private extractAudioFeatures(audioData: Float32Array, sampleRate: number): AudioAnalysisData[] {
    const results: AudioAnalysisData[] = [];
    const frameSize = 2048;
    const hopSize = 512;
    const threshold = 0.15;

    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      const pitch = this.yinPitchDetection(frame, sampleRate, threshold);
      const volume = this.calculateRMS(frame);
      const time = (i + frameSize / 2) / sampleRate;
      
      results.push({ pitch, volume, time });
    }

    const smoothed = this.smoothData(results);
    return this.removeInitialTransient(smoothed);
  }

  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private yinPitchDetection(buffer: Float32Array, sampleRate: number, threshold: number): number {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(halfBufferSize);
    
    for (let tau = 0; tau < halfBufferSize; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

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

    const betterTau = this.parabolicInterpolation(yinBuffer, tauEstimate);
    const frequency = sampleRate / betterTau;
    
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

  private smoothData(data: AudioAnalysisData[]): AudioAnalysisData[] {
    // 先进行插值填补小间隙
    const interpolated = this.interpolateGaps(data);
    
    // 再进行平滑处理
    const windowSize = 3;
    const smoothed = interpolated.map((item, i) => {
      let pitchSum = 0, pitchCount = 0;
      let volumeSum = 0, volumeCount = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(interpolated.length - 1, i + windowSize); j++) {
        if (interpolated[j].pitch > 0) {
          pitchSum += interpolated[j].pitch;
          pitchCount++;
        }
        volumeSum += interpolated[j].volume;
        volumeCount++;
      }
      
      return {
        pitch: pitchCount > 0 ? pitchSum / pitchCount : 0,
        volume: volumeCount > 0 ? volumeSum / volumeCount : 0,
        time: item.time
      };
    });

    // 过滤尾部异常数据
    return this.trimAbnormalTail(smoothed);
  }

  /**
   * 插值填补小间隙
   * 如果间隙两端的音高相近，则用线性插值填补
   */
  private interpolateGaps(data: AudioAnalysisData[]): AudioAnalysisData[] {
    const result = [...data];
    const maxGapSize = 150; // 最大填补的间隙帧数（约1.5秒）
    const maxPitchRatio = 2.0; // 两端音高比例阈值（最大2倍，即一个八度）

    let i = 0;
    while (i < result.length) {
      if (result[i].pitch > 0) {
        i++;
        continue;
      }

      // 找到间隙的起始和结束
      const gapStart = i;
      while (i < result.length && result[i].pitch === 0) {
        i++;
      }
      const gapEnd = i;
      const gapSize = gapEnd - gapStart;

      // 检查是否可以插值
      if (gapSize <= maxGapSize && gapStart > 0 && gapEnd < result.length) {
        const leftPitch = result[gapStart - 1].pitch;
        const rightPitch = result[gapEnd].pitch;

        // 两端都有有效音高
        if (leftPitch > 0 && rightPitch > 0) {
          // 计算音高比例（大/小）
          const pitchRatio = Math.max(leftPitch, rightPitch) / Math.min(leftPitch, rightPitch);
          
          // 只要不超过一个八度（2倍），就进行插值
          if (pitchRatio <= maxPitchRatio) {
            // 线性插值填补
            for (let j = gapStart; j < gapEnd; j++) {
              const t = (j - gapStart + 1) / (gapSize + 1);
              result[j] = {
                ...result[j],
                pitch: leftPitch + (rightPitch - leftPitch) * t
              };
            }
          }
        }
      }
    }

    return result;
  }

  /** 
   * 过滤尾部异常数据
   * 处理两种情况：
   * 1. 音高突然大幅下降（通常是音频结束时的噪声）
   * 2. 尾部震荡（音高剧烈波动）- 用线性插值平滑连接
   */
  private trimAbnormalTail(data: AudioAnalysisData[]): AudioAnalysisData[] {
    if (data.length < 10) return data;

    // 收集所有有效音高
    const validPitches = data.filter(d => d.pitch > 0).map(d => d.pitch);
    if (validPitches.length < 5) return data;

    // 计算中位数作为参考（比平均值更稳健）
    validPitches.sort((a, b) => a - b);
    const medianPitch = validPitches[Math.floor(validPitches.length / 2)];
    const lowerThreshold = medianPitch * 0.6; // 低于中位数 60% 视为异常

    const result = [...data];

    // 第一步：检测并平滑尾部震荡
    this.smoothOscillation(result, medianPitch);

    // 第二步：过滤尾部低于阈值的异常数据
    // 找到主要数据段的结束位置（最后一个正常音高）
    let mainEndIndex = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].pitch >= lowerThreshold) {
        mainEndIndex = i;
        break;
      }
    }

    if (mainEndIndex < 0) return result;

    // 将主数据段之后的所有低音高数据置为无效
    for (let i = mainEndIndex + 1; i < result.length; i++) {
      if (result[i].pitch > 0 && result[i].pitch < lowerThreshold) {
        result[i] = { ...result[i], pitch: 0 };
      }
    }

    return result;
  }

  /**
   * 检测并平滑尾部震荡
   * 震荡特征：短时间内音高剧烈变化
   * 处理方式：用线性插值从震荡起点平滑连接到震荡终点
   * 
   * @param data 音高数据（会被直接修改）
   * @param medianPitch 中位数音高，用于计算变化率阈值
   */
  private smoothOscillation(data: AudioAnalysisData[], medianPitch: number): void {
    // 从后往前扫描最后 50% 的数据（震荡可能发生在较早位置）
    const scanStartIndex = Math.floor(data.length * 0.5);
    
    // 震荡阈值：相邻两点音高变化超过中位数的 15%
    // 例如：中位数 180Hz，阈值 = 27Hz
    // 图中变化 95Hz 远超此阈值
    const oscillationThreshold = medianPitch * 0.15;
    
    // 找到震荡区间
    let oscillationStart = -1;
    let oscillationEnd = -1;
    let inOscillation = false;
    let consecutiveOscillations = 0;

    for (let i = scanStartIndex; i < data.length - 1; i++) {
      const currentPitch = data[i].pitch;
      const nextPitch = data[i + 1].pitch;
      
      // 跳过无效数据
      if (currentPitch === 0 || nextPitch === 0) continue;
      
      const pitchChange = Math.abs(nextPitch - currentPitch);
      
      if (pitchChange > oscillationThreshold) {
        consecutiveOscillations++;
        
        // 检测到第一次剧烈变化就标记为震荡开始
        if (!inOscillation) {
          inOscillation = true;
          oscillationStart = i;
        }
        
        // 更新震荡结束位置
        oscillationEnd = i + 1;
      } else if (inOscillation) {
        // 变化平稳，检查是否真的结束了震荡
        // 往后看几个点，如果都稳定则认为震荡结束
        let stableCount = 0;
        for (let j = i; j < Math.min(i + 8, data.length - 1); j++) {
          if (data[j].pitch > 0 && data[j + 1].pitch > 0) {
            const change = Math.abs(data[j + 1].pitch - data[j].pitch);
            if (change <= oscillationThreshold) {
              stableCount++;
            } else {
              // 又出现震荡，更新结束位置
              oscillationEnd = j + 1;
              stableCount = 0;
            }
          }
        }
        
        if (stableCount >= 5) {
          // 确认震荡结束
          break;
        }
      }
    }

    // 如果检测到震荡区间，用线性插值平滑
    if (oscillationStart >= 0 && oscillationEnd > oscillationStart && consecutiveOscillations >= 1) {
      const startPitch = data[oscillationStart].pitch;
      
      // 找到震荡结束后的第一个稳定点作为终点
      // 如果没有稳定点，就用起点音高延续到结尾
      let endPitch = startPitch;
      let actualEnd = oscillationEnd;
      
      // 向后查找稳定的终点
      for (let i = oscillationEnd; i < Math.min(oscillationEnd + 15, data.length); i++) {
        if (data[i].pitch > 0) {
          // 检查这个点是否稳定（与前后点变化不大）
          const prevPitch = i > 0 ? data[i - 1].pitch : 0;
          const nextPitchVal = i < data.length - 1 ? data[i + 1].pitch : 0;
          
          if (prevPitch > 0 && Math.abs(data[i].pitch - prevPitch) <= oscillationThreshold) {
            endPitch = data[i].pitch;
            actualEnd = i;
            break;
          } else if (nextPitchVal > 0 && Math.abs(data[i].pitch - nextPitchVal) <= oscillationThreshold) {
            endPitch = data[i].pitch;
            actualEnd = i;
            break;
          }
        }
      }

      // 如果找不到稳定终点，直接将震荡部分到结尾都用起点音高填充
      if (actualEnd === oscillationEnd) {
        // 用起点音高平滑到结尾
        for (let i = oscillationStart + 1; i < data.length; i++) {
          if (data[i].pitch > 0) {
            data[i] = { ...data[i], pitch: startPitch };
          }
        }
      } else {
        // 线性插值填充震荡区间
        const gapSize = actualEnd - oscillationStart;
        for (let i = oscillationStart + 1; i < actualEnd; i++) {
          const t = (i - oscillationStart) / gapSize;
          data[i] = {
            ...data[i],
            pitch: startPitch + (endPitch - startPitch) * t
          };
        }
      }
    }
  }

  private removeInitialTransient(data: AudioAnalysisData[]): AudioAnalysisData[] {
    if (data.length < 10) return data;

    // 找到稳定的频率水平（后半段的平均频率）
    const stableStartIndex = Math.floor(data.length * 0.4);
    const stableData = data.slice(stableStartIndex).filter(d => d.pitch > 0);
    
    if (stableData.length === 0) return data;

    const stableFrequency = stableData.reduce((sum, d) => sum + d.pitch, 0) / stableData.length;
    
    // 过滤掉所有超过稳定频率 10% 以上的异常值
    const maxAllowedFrequency = stableFrequency * 1.10;
    
    const filtered = data.filter(d => d.pitch === 0 || d.pitch <= maxAllowedFrequency);

    if (filtered.length === 0) return data;

    // 调整时间轴，使其从 0 开始
    const timeOffset = filtered[0].time;
    return filtered.map(d => ({
      ...d,
      time: d.time - timeOffset
    }));
  }

  private findDataStartTime(data: AudioAnalysisData[]): number {
    for (const d of data) {
      if (d.pitch > 0) {
        return d.time;
      }
    }
    return 0;
  }

  private getAlignedData(trackId: string): AudioAnalysisData[] {
    const data = this.analysisDataMap.get(trackId);
    const offset = this.timeOffsetMap.get(trackId) || 0;
    
    if (!data) return [];
    
    return data.map(d => ({
      ...d,
      time: d.time - offset
    }));
  }

  private getAlignedMaxDuration(): number {
    let maxDuration = 0;
    
    for (const track of this.tracks()) {
      if (!track.isReady) continue;
      
      const data = this.analysisDataMap.get(track.id);
      const offset = this.timeOffsetMap.get(track.id) || 0;
      
      if (data && data.length > 0) {
        const lastTime = data[data.length - 1].time;
        const alignedDuration = lastTime - offset;
        maxDuration = Math.max(maxDuration, alignedDuration);
      }
    }
    
    return maxDuration > 0 ? maxDuration : 1;
  }


  private drawChart(): void {
    if (!this.canvasCtx || !this.compareCanvas?.nativeElement) return;

    const canvas = this.compareCanvas.nativeElement;
    const ctx = this.canvasCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    
    // 清空图例边界信息
    this.legendBounds = [];

    // 只绘制可见且就绪的 track
    const readyTracks = this.tracks().filter(t => {
      const data = this.analysisDataMap.get(t.id);
      return t.isReady && t.isVisible && data && data.length > 0;
    });

    if (readyTracks.length === 0) {
      this.drawEmptyState(ctx, width, height);
      return;
    }

    // 收集所有对齐后的数据
    const alignedDataMap = new Map<string, AudioAnalysisData[]>();
    const allAlignedData: AudioAnalysisData[] = [];
    
    for (const track of readyTracks) {
      const alignedData = this.getAlignedData(track.id);
      alignedDataMap.set(track.id, alignedData);
      allAlignedData.push(...alignedData);
    }

    const padding = { top: 35, bottom: 35, left: 55, right: 25 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const validPitches = allAlignedData.filter(d => d.pitch > 0).map(d => d.pitch);
    const minPitch = validPitches.length > 0 ? Math.min(...validPitches) * 0.85 : 80;
    const maxPitch = validPitches.length > 0 ? Math.max(...validPitches) * 1.15 : 400;
    const maxDuration = this.getAlignedMaxDuration();

    this.drawBackground(ctx, width, height, padding, chartWidth, chartHeight, minPitch, maxPitch, maxDuration);

    // 先绘制非播放中的曲线（较淡）
    for (const track of readyTracks) {
      if (track.isPlaying) continue;
      const alignedData = alignedDataMap.get(track.id);
      if (alignedData) {
        this.drawPitchCurve(ctx, track.color, alignedData, padding, chartWidth, chartHeight, minPitch, maxPitch, maxDuration, false);
      }
    }

    // 再绘制播放中的曲线（高亮，在最上层）
    for (const track of readyTracks) {
      if (!track.isPlaying) continue;
      const alignedData = alignedDataMap.get(track.id);
      if (alignedData) {
        this.drawPitchCurve(ctx, track.color, alignedData, padding, chartWidth, chartHeight, minPitch, maxPitch, maxDuration, true);
      }
    }

    // 绘制曲线标签（声调号）
    this.drawCurveLabels(ctx, readyTracks, alignedDataMap, padding, chartWidth, chartHeight, minPitch, maxPitch, maxDuration);

    this.drawProgressLines(ctx, readyTracks, padding, chartWidth, chartHeight, maxDuration);
    this.drawLegend(ctx, readyTracks, width, padding);
  }

  /**
   * 绘制曲线标签（声调号）
   * 在每条曲线的中间位置显示声调号
   */
  private drawCurveLabels(
    ctx: CanvasRenderingContext2D,
    tracks: AudioTrack[],
    alignedDataMap: Map<string, AudioAnalysisData[]>,
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    minPitch: number,
    maxPitch: number,
    maxDuration: number
  ): void {
    // 不再在曲线上绘制标签，改为使用 HTML 图例
    // 此方法保留为空，以便将来需要时可以添加其他绘制逻辑
  }

  /**
   * 从音轨名称中提取声调号
   * @param name 音轨名称，格式：字 (jyutping)
   * @returns 声调号（1-6），如果无法提取则返回null
   */
  private extractToneNumberFromName(name: string): string | null {
    // 匹配括号中的粤拼，例如 "诗 (si1)" -> "si1"
    const match = name.match(/\(([^)]+)\)/);
    if (!match) return null;

    const jyutping = match[1];
    // 提取最后一个数字（声调号）
    const toneMatch = jyutping.match(/(\d)$/);
    if (!toneMatch) return null;

    const toneNumber = parseInt(toneMatch[1], 10);
    // 粤语只有1-6声调
    if (toneNumber >= 1 && toneNumber <= 6) {
      return toneNumber.toString();
    }

    return null;
  }

  /**
   * 从音轨名称中提取字符
   * @param name 音轨名称，格式：字 (jyutping) 或 jyutping
   * @returns 字符，如果无法提取则返回null
   */
  private extractCharFromName(name: string): string | null {
    // 如果名称包含括号，提取括号前的字符
    // 例如 "诗 (si1)" -> "诗"
    const match = name.match(/^(.+?)\s*\(/);
    if (match) {
      return match[1].trim();
    }
    
    // 如果没有括号，检查是否是纯粤拼（包含数字）
    // 如果是粤拼，返回null；如果是汉字，返回第一个字符
    if (/\d/.test(name)) {
      return null; // 包含数字，可能是粤拼
    }
    
    // 返回第一个字符
    return name.trim().charAt(0) || null;
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('添加音频文件后进行音高曲线识别', width / 2, height / 2);
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    minPitch: number,
    maxPitch: number,
    maxDuration: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.font = '10px sans-serif';

    const pitchLines = [100, 150, 200, 250, 300, 400, 500, 600];
    const pitchRange = maxPitch - minPitch;

    for (const pitch of pitchLines) {
      if (pitch >= minPitch && pitch <= maxPitch) {
        const y = padding.top + chartHeight - ((pitch - minPitch) / pitchRange) * chartHeight;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(`${pitch}Hz`, padding.left - 5, y + 3);
      }
    }

    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    ctx.textAlign = 'center';
    const timeStep = maxDuration > 10 ? 2 : (maxDuration > 5 ? 1 : 0.5);
    
    for (let t = 0; t <= maxDuration; t += timeStep) {
      const x = padding.left + (t / maxDuration) * chartWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      
      ctx.fillText(`${t.toFixed(1)}s`, x, height - padding.bottom + 15);
    }

    ctx.setLineDash([]);
  }

  private drawVolumeCurve(
    ctx: CanvasRenderingContext2D,
    color: string,
    data: AudioAnalysisData[],
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    maxVolume: number,
    maxDuration: number
  ): void {
    if (data.length === 0) return;

    const baseY = padding.top + chartHeight;
    
    ctx.beginPath();
    ctx.fillStyle = `${color}30`;
    ctx.moveTo(padding.left, baseY);

    for (const d of data) {
      const x = padding.left + (d.time / maxDuration) * chartWidth;
      const volumeHeight = (d.volume / maxVolume) * chartHeight * 0.5;
      ctx.lineTo(x, baseY - volumeHeight);
    }

    const lastData = data[data.length - 1];
    ctx.lineTo(padding.left + (lastData.time / maxDuration) * chartWidth, baseY);
    ctx.closePath();
    ctx.fill();
  }

  private drawPitchCurve(
    ctx: CanvasRenderingContext2D,
    color: string,
    data: AudioAnalysisData[],
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    minPitch: number,
    maxPitch: number,
    maxDuration: number,
    isHighlighted: boolean = false
  ): void {
    if (data.length === 0) return;

    const pitchRange = maxPitch - minPitch;

    // 转换数据点为坐标，过滤有效音高
    const toPoint = (d: AudioAnalysisData) => ({
      x: padding.left + (d.time / maxDuration) * chartWidth,
      y: padding.top + chartHeight - ((d.pitch - minPitch) / pitchRange) * chartHeight
    });

    // 将连续的有效音高点分组
    const segments: Array<{ x: number; y: number }[]> = [];
    let currentSegment: Array<{ x: number; y: number }> = [];

    for (const d of data) {
      if (d.pitch > 0) {
        currentSegment.push(toPoint(d));
      } else if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    // 高亮时绘制发光效果
    if (isHighlighted) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;

      for (const points of segments) {
        if (points.length < 2) continue;
        this.drawSmoothCurve(ctx, points);
      }
      ctx.restore();
    }

    // 绘制主曲线
    ctx.strokeStyle = color;
    ctx.lineWidth = isHighlighted ? 3.5 : 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = isHighlighted ? 1 : 0.6;

    for (const points of segments) {
      if (points.length < 2) continue;
      this.drawSmoothCurve(ctx, points);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 使用 Catmull-Rom 样条曲线绘制平滑曲线
   */
  private drawSmoothCurve(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    // 张力系数，0.5 是 Catmull-Rom 标准值
    const tension = 0.3;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // 计算控制点
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    ctx.stroke();
  }

  private drawProgressLines(
    ctx: CanvasRenderingContext2D,
    tracks: AudioTrack[],
    padding: { top: number; bottom: number; left: number; right: number },
    chartWidth: number,
    chartHeight: number,
    maxDuration: number
  ): void {
    const bottomY = padding.top + chartHeight;

    for (const track of tracks) {
      if (track.currentTime > 0) {
        const offset = this.timeOffsetMap.get(track.id) || 0;
        const alignedTime = track.currentTime - offset;
        
        if (alignedTime >= 0) {
          const x = padding.left + (alignedTime / maxDuration) * chartWidth;
          ctx.beginPath();
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, bottomY);
          ctx.stroke();
        }
      }
    }
  }

  private drawLegend(
    ctx: CanvasRenderingContext2D,
    tracks: AudioTrack[],
    width: number,
    padding: { top: number; bottom: number; left: number; right: number }
  ): void {
    // 不再在 canvas 上绘制图例，改为使用 HTML 图例
    // 清空图例边界信息
    this.legendBounds = [];
  }

  private startAnimation(): void {
    if (this.animationFrameId !== null) return;
    
    const animate = () => {
      if (!this.isAnyPlaying()) return;
      
      // 更新所有播放中音轨的当前时间
      const ctx = this.audioContext;
      if (ctx) {
        this.tracks.update(tracks => 
          tracks.map(t => {
            if (t.isPlaying) {
              const startTime = this.playStartTimeMap.get(t.id);
              if (startTime !== undefined) {
                const currentTime = ctx.currentTime - startTime;
                return { ...t, currentTime: Math.min(currentTime, t.duration) };
              }
            }
            return t;
          })
        );
      }
      
      this.drawChart();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private checkStopAnimation(): void {
    if (!this.isAnyPlaying()) {
      this.stopAnimation();
      this.drawChart();
    }
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private cleanup(): void {
    this.stopAnimation();
    window.removeEventListener('resize', this.handleResize);
    
    // 移除canvas事件监听器
    if (this.compareCanvas?.nativeElement) {
      this.compareCanvas.nativeElement.removeEventListener('click', this.handleCanvasClick);
      this.compareCanvas.nativeElement.removeEventListener('mousemove', this.handleCanvasMouseMove);
    }
    
    // 停止所有播放
    for (const [trackId] of this.audioSourceMap) {
      this.stopTrack(trackId);
    }
    
    // 清除所有字符显示定时器
    for (const [trackId, timer] of this.charDisplayTimers) {
      clearTimeout(timer);
    }
    this.charDisplayTimers.clear();
    this.playingTrackChar.clear();
    
    this.audioBufferMap.clear();
    this.analysisDataMap.clear();
    this.timeOffsetMap.clear();
    this.playStartTimeMap.clear();
    
    // 不要 revoke blob URL，因为它们可能是由外部缓存服务管理的
    // 让缓存服务负责管理 blob URL 的生命周期
    
    this.audioContext?.close();
  }

  // 公开方法
  playTrack(trackId: string): void {
    const buffer = this.audioBufferMap.get(trackId);
    if (!buffer) return;

    // 停止之前的播放
    this.stopTrack(trackId);

    const ctx = this.getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // 获取音轨信息
    const track = this.tracks().find(t => t.id === trackId);
    if (track) {
      // 提取字符并显示
      const char = this.extractCharFromName(track.name);
      if (char) {
        this.playingTrackChar.set(trackId, char);
      }
    }
    
    source.onended = () => {
      this.tracks.update(tracks => 
        tracks.map(t => t.id === trackId ? { ...t, isPlaying: false, currentTime: 0 } : t)
      );
      this.audioSourceMap.delete(trackId);
      this.playStartTimeMap.delete(trackId);
      
      // 延迟 800ms 后隐藏字符
      const timer = setTimeout(() => {
        this.playingTrackChar.delete(trackId);
        this.charDisplayTimers.delete(trackId);
      }, 800);
      this.charDisplayTimers.set(trackId, timer);
      
      this.checkStopAnimation();
    };

    this.audioSourceMap.set(trackId, source);
    this.playStartTimeMap.set(trackId, ctx.currentTime);
    
    source.start(0);
    
    this.tracks.update(tracks => 
      tracks.map(t => t.id === trackId ? { ...t, isPlaying: true } : t)
    );
    this.startAnimation();
  }

  private stopTrack(trackId: string): void {
    const source = this.audioSourceMap.get(trackId);
    if (source) {
      try {
        source.stop();
      } catch {
        // 忽略已停止的错误
      }
      this.audioSourceMap.delete(trackId);
    }
    this.playStartTimeMap.delete(trackId);
    
    // 清除字符显示
    this.playingTrackChar.delete(trackId);
    
    // 清除延迟隐藏的定时器
    const timer = this.charDisplayTimers.get(trackId);
    if (timer) {
      clearTimeout(timer);
      this.charDisplayTimers.delete(trackId);
    }
  }

  pauseTrack(trackId: string): void {
    // Web Audio API 的 AudioBufferSourceNode 不支持暂停，只能停止
    this.stopTrack(trackId);
    this.tracks.update(tracks => 
      tracks.map(t => t.id === trackId ? { ...t, isPlaying: false } : t)
    );
    this.checkStopAnimation();
  }

  toggleTrack(trackId: string): void {
    const track = this.tracks().find(t => t.id === trackId);
    if (track?.isPlaying) {
      this.pauseTrack(trackId);
    } else {
      this.playTrack(trackId);
    }
  }

  /**
   * 点击音轨区域时播放/暂停
   * @param trackId 音轨ID
   * @param event 点击事件
   */
  onTrackClick(trackId: string, event: Event): void {
    const track = this.tracks().find(t => t.id === trackId);
    if (!track?.isReady) return;
    
    // 如果点击的是按钮，不处理（按钮有自己的点击事件）
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
    // 切换播放状态
    this.toggleTrack(trackId);
  }

  /** 切换 track 在图表中的显示/隐藏 */
  toggleTrackVisibility(trackId: string): void {
    this.tracks.update(tracks => 
      tracks.map(t => t.id === trackId ? { ...t, isVisible: !t.isVisible } : t)
    );
    this.drawChart();
  }

  // 依次播放相关
  private sequenceIndex = 0;
  private internalSequencePlaying = false;  // 内部播放状态

  playAll(): void {
    for (const track of this.tracks()) {
      if (track.isReady && !track.isPlaying) {
        this.playTrack(track.id);
      }
    }
  }

  /** 依次播放所有音轨 */
  playSequence(): void {
    console.log('[PitchCompare] playSequence 被调用');
    const readyTracks = this.tracks().filter(t => t.isReady);
    console.log('[PitchCompare] 准备播放的音轨数量:', readyTracks.length);
    
    if (readyTracks.length === 0) {
      console.warn('[PitchCompare] 没有可播放的音轨');
      return;
    }

    // 重置所有音轨状态
    this.tracks.update(tracks => 
      tracks.map(t => ({ ...t, isPlaying: false, currentTime: 0 }))
    );
    
    this.sequenceIndex = 0;
    this.internalSequencePlaying = true;  // 设置内部状态
    console.log('[PitchCompare] 开始播放第一个音轨, internalSequencePlaying:', this.internalSequencePlaying);
    this.playNextInSequence(readyTracks);
  }

  private playNextInSequence(readyTracks: AudioTrack[]): void {
    console.log('[PitchCompare] playNextInSequence, index:', this.sequenceIndex, 'internalSequencePlaying:', this.internalSequencePlaying, 'isSequencePlaying:', this.isSequencePlaying());
    
    // 使用内部状态判断
    if (this.sequenceIndex >= readyTracks.length || !this.internalSequencePlaying) {
      console.log('[PitchCompare] 播放完成或被停止');
      this.internalSequencePlaying = false;
      // 播放完成后，确保所有音轨状态都被重置
      this.tracks.update(tracks => 
        tracks.map(t => ({ ...t, isPlaying: false, currentTime: 0 }))
      );
      this.stopAnimation();
      this.drawChart();
      
      // 通知父组件播放完成
      console.log('[PitchCompare] 发送 sequencePlayCompleted 事件');
      this.sequencePlayCompleted.emit();
      return;
    }

    const track = readyTracks[this.sequenceIndex];
    const buffer = this.audioBufferMap.get(track.id);
    if (!buffer) {
      this.sequenceIndex++;
      this.playNextInSequence(readyTracks);
      return;
    }

    // 停止之前的播放
    this.stopTrack(track.id);

    const ctx = this.getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // 提取字符并显示
    const char = this.extractCharFromName(track.name);
    if (char) {
      this.playingTrackChar.set(track.id, char);
    }
    
    source.onended = () => {
      this.tracks.update(tracks => 
        tracks.map(t => t.id === track.id ? { ...t, isPlaying: false, currentTime: 0 } : t)
      );
      this.audioSourceMap.delete(track.id);
      this.playStartTimeMap.delete(track.id);
      
      // 延迟 800ms 后隐藏字符
      const timer = setTimeout(() => {
        this.playingTrackChar.delete(track.id);
        this.charDisplayTimers.delete(track.id);
      }, 800);
      this.charDisplayTimers.set(track.id, timer);
      
      // 播放下一个
      this.sequenceIndex++;
      this.playNextInSequence(readyTracks);
    };

    this.audioSourceMap.set(track.id, source);
    this.playStartTimeMap.set(track.id, ctx.currentTime);
    
    source.start(0);
    
    this.tracks.update(tracks => 
      tracks.map(t => t.id === track.id ? { ...t, isPlaying: true } : t)
    );
    this.startAnimation();
  }

  pauseAll(): void {
    for (const track of this.tracks()) {
      if (track.isPlaying) {
        this.pauseTrack(track.id);
      }
    }
  }

  stopAll(): void {
    // 停止依次播放
    this.internalSequencePlaying = false;
    
    // 停止所有播放
    for (const track of this.tracks()) {
      this.stopTrack(track.id);
    }
    this.tracks.update(tracks => tracks.map(t => ({ ...t, isPlaying: false, currentTime: 0 })));
    this.checkStopAnimation();
    this.drawChart();
  }

  clearAll(): void {
    this.stopAll();
    
    // 不要 revoke blob URL，因为它们可能是由外部缓存服务管理的
    // 让缓存服务负责管理 blob URL 的生命周期
    
    this.audioBufferMap.clear();
    this.analysisDataMap.clear();
    this.timeOffsetMap.clear();
    this.playStartTimeMap.clear();
    
    this.tracks.set([]);
    this.drawChart();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
