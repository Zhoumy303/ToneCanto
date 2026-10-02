import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { arrowBack, musicalNotes, informationCircle, play, pause } from 'ionicons/icons';

// 服务
import { ApiService } from '../core/services/api.service';
import { ToneDataService } from '../core/services/tone-data.service';
import { ThemeService } from '../core/services/theme.service';
import { HumanAudioCacheService } from '../core/services/human-audio-cache.service';

// 组件
import { PitchCompareComponent } from '../shared/components';

// 接口
import { ToneExample, ExampleGroup } from '../core/interfaces/tone.interfaces';

// 注册需要使用的图标
addIcons({ 'arrow-back': arrowBack, 'musical-notes': musicalNotes, 'information-circle': informationCircle, play, pause });

interface AudioItem {
  jyutping: string;
  url: string;
  char?: string; // 添加字符字段
}

@Component({
  selector: 'app-pitch-curve-compare',
  templateUrl: './pitch-curve-compare.page.html',
  styleUrls: ['./pitch-curve-compare.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, IonicModule, PitchCompareComponent]
})
export class PitchCurveComparePage implements OnInit, OnDestroy {
  @ViewChild('pitchCompare') pitchCompareComponent!: PitchCompareComponent;

  // 依赖注入
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly humanAudioCache = inject(HumanAudioCacheService);

  // 公开服务（模板中使用）
  readonly toneDataService = inject(ToneDataService);
  readonly themeService = inject(ThemeService);

  // 组件销毁信号
  private readonly destroy$ = new Subject<void>();

  // ========== 状态信号 ==========

  // 示例组数据 - 从 tone-data.service 获取缓存数据
  readonly exampleGroups = signal<ExampleGroup[]>([]);
  readonly currentRowExamples = signal<ToneExample[]>([]);
  readonly currentRowIndex = signal<number>(0);

  // 音频数据
  readonly selectedAudios = signal<AudioItem[]>([]);
  readonly isLoadingAudios = signal(false);
  readonly errorMessage = signal<string>('');
  readonly isAutoLoading = signal(false);
  
  // 依次播放状态
  readonly isPlayingSequence = signal<boolean>(false);
  private sequencePlayTimer: ReturnType<typeof setTimeout> | null = null;

  // ========== 计算属性 ==========

  // 从主题服务获取主题数据
  readonly currentTheme = computed(() => this.themeService.currentTheme());
  readonly hasAudios = computed(() => this.selectedAudios().length > 0);

  constructor() {}

  ngOnInit(): void {
    // 重置所有状态
    this.selectedAudios.set([]);
    this.isLoadingAudios.set(false);
    this.errorMessage.set('');
    this.isAutoLoading.set(false);
    this.isPlayingSequence.set(false);
    
    this.initPitchCurvePage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopSequencePlay();
    
    // 不要清理 pitch-compare 组件，让 blob URL 保持有效以便缓存重用
    // pitch-compare 组件会在自己的 ngOnDestroy 中清理
  }

  // ========== 初始化方法 ==========

  /**
   * 初始化音高曲线对比页面
   * 从 tone-data.service 获取缓存的示例组数据
   */
  private initPitchCurvePage(): void {
    // 从 tone-data.service 获取缓存的示例组数据
    const cachedGroups = this.toneDataService.getCachedExampleGroups();
    this.exampleGroups.set(cachedGroups);
    // 从路由参数获取组索引
    const groupIndexParam = this.route.snapshot.queryParamMap.get('groupIndex');
    const groupIndex = groupIndexParam ? parseInt(groupIndexParam, 10) : 0;
    
    // 获取示例组
    const groups = this.exampleGroups();
    if (groups.length > 0) {
      // 确保索引有效
      const validIndex = Math.max(0, Math.min(groupIndex, groups.length - 1));
      this.currentRowIndex.set(validIndex);
      this.currentRowExamples.set([...groups[validIndex].examples]);
      
      // 加载当前示例组的音频
      this.loadCurrentGroupAudios();
    }
  }

  /**
   * 加载当前示例组的所有音频
   * 逐个请求音频，避免某个音频不存在导致全部失败
   */
  private loadCurrentGroupAudios(): void {
    const examples = this.currentRowExamples();
    if (examples.length === 0) return;

    // 提取所有粤拼
    const jyutpings = examples
      .map(e => e.jyutping)
      .filter(j => j && j.trim().length > 0);

    if (jyutpings.length === 0) {
      this.errorMessage.set('当前示例组没有粤拼信息');
      return;
    }

    this.isLoadingAudios.set(true);
    this.errorMessage.set('');

    // 逐个请求音频文件
    this.loadAudiosOneByOne(jyutpings, examples);
  }

  /**
   * 逐个加载音频文件
   * 优先从缓存获取，缓存未命中才从服务器获取
   */
  private async loadAudiosOneByOne(jyutpings: string[], examples: ToneExample[]): Promise<void> {
    const audios: AudioItem[] = [];
    const missingAudios: string[] = [];
    let loadedCount = 0;

    for (const jyutping of jyutpings) {
      try {
        // 优先从缓存获取音频 URL
        const cachedUrl = await this.humanAudioCache.getAudioUrl(jyutping);
        
        if (cachedUrl) {
          // 缓存命中，直接使用
          const matchedExample = examples.find(e => e.jyutping === jyutping);
          audios.push({
            jyutping: jyutping,
            url: cachedUrl,
            char: matchedExample?.char
          });
          loadedCount++;
          console.log(`[PitchCurveCompare] 使用缓存音频: ${jyutping}`);
        } else {
          // 缓存未命中，音频不存在，静默跳过
          const matchedExample = examples.find(e => e.jyutping === jyutping);
          if (matchedExample) {
            missingAudios.push(`${matchedExample.char} (${jyutping})`);
          } else {
            missingAudios.push(jyutping);
          }
          // 静默跳过，不输出警告
        }
      } catch (error) {
        // 加载失败，静默跳过
        const matchedExample = examples.find(e => e.jyutping === jyutping);
        if (matchedExample) {
          missingAudios.push(`${matchedExample.char} (${jyutping})`);
        } else {
          missingAudios.push(jyutping);
        }
      }
    }

    // 所有请求完成后处理结果
    if (audios.length === 0) {
      if (missingAudios.length > 0) {
        this.errorMessage.set(`所有音频文件都不存在: ${missingAudios.join(', ')}`);
      } else {
        this.errorMessage.set('没有找到对应的音频文件');
      }
      this.isLoadingAudios.set(false);
    } else {
      // 有可用的音频，加载它们
      this.selectedAudios.set(audios);
      
      // 静默处理，只在全部成功时输出日志
      if (missingAudios.length === 0) {
        console.log(`[PitchCurveCompare] 成功加载 ${loadedCount} 个音频`);
      }
      
      // 自动加载所有可用音频到 pitch-compare 组件
      this.autoLoadAudios(audios);
    }
  }

  /**
   * 自动加载所有音频到 PitchCompareComponent
   */
  private autoLoadAudios(audios: AudioItem[]): void {
    this.isAutoLoading.set(true);
    
    // 延迟加载，确保 pitch-compare 组件已初始化
    setTimeout(() => {
      // 先清空现有音轨，避免重复加载
      if (this.pitchCompareComponent) {
        this.pitchCompareComponent.clearAll();
      }
      
      // 再次延迟，确保清空操作完成
      setTimeout(() => {
        audios.forEach((audio, index) => {
          // 延迟加载每个音频，避免同时加载导致的问题
          setTimeout(() => {
            if (this.pitchCompareComponent) {
              // 组合名称：字符 (粤拼)，例如 "诗 (si1)"
              const trackName = audio.char 
                ? `${audio.char} (${audio.jyutping})`
                : audio.jyutping;
              this.pitchCompareComponent.addTrack(audio.url, trackName);
            }
          }, index * 200); // 每个音频延迟 200ms
        });

        // 所有音频加载完成后
        setTimeout(() => {
          this.isAutoLoading.set(false);
          this.isLoadingAudios.set(false);
        }, audios.length * 200 + 500);
      }, 100);
    }, 100);
  }

  // ========== 事件处理 ==========

  /**
   * 音轨添加事件
   */
  onTrackAdded(track: unknown): void {
    console.log('音轨已添加:', track);
  }

  /**
   * 音轨移除事件
   */
  onTrackRemoved(trackId: string): void {
    console.log('音轨已移除:', trackId);
  }

  /**
   * 错误事件
   */
  onError(message: string): void {
    console.error('错误:', message);
    this.errorMessage.set(message);
  }

  /**
   * 依次播放完成事件
   */
  onSequencePlayCompleted(): void {
    console.log('依次播放完成');
    this.isPlayingSequence.set(false);
  }

  // ========== 依次播放功能 ==========

  /**
   * 切换依次播放状态
   */
  toggleSequencePlay(): void {
    console.log('[PitchCurveCompare] toggleSequencePlay, 当前状态:', this.isPlayingSequence());
    if (this.isPlayingSequence()) {
      this.stopSequencePlay();
    } else {
      this.startSequencePlay();
    }
  }

  /**
   * 开始依次播放所有音轨
   */
  private startSequencePlay(): void {
    console.log('[PitchCurveCompare] startSequencePlay');
    if (!this.pitchCompareComponent) {
      console.error('[PitchCurveCompare] pitchCompareComponent 未初始化');
      return;
    }
    
    this.isPlayingSequence.set(true);
    
    // 调用 PitchCompareComponent 的依次播放方法
    try {
      console.log('[PitchCurveCompare] 调用 playSequence');
      this.pitchCompareComponent.playSequence();
    } catch (error) {
      console.error('依次播放失败:', error);
      this.isPlayingSequence.set(false);
    }
  }

  /**
   * 停止依次播放
   */
  private stopSequencePlay(): void {
    console.log('[PitchCurveCompare] stopSequencePlay');
    this.isPlayingSequence.set(false);
    
    if (this.sequencePlayTimer) {
      clearTimeout(this.sequencePlayTimer);
      this.sequencePlayTimer = null;
    }
    
    // 停止 PitchCompareComponent 的播放
    if (this.pitchCompareComponent) {
      this.pitchCompareComponent.stopAll();
    }
  }

  // ========== 导航 ==========

  /**
   * 返回到 tones 页面
   */
  goBack(): void {
    this.router.navigate(['/tones']);
  }
}
