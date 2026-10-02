import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ViewChild, 
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { play, pause, barChartOutline } from 'ionicons/icons';

// 服务
import { TtsService } from '../core/services/tts.service';
import { PracticeHistoryService } from '../core/services/practice-history.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { VoiceSelectionService, VoiceInfo } from '../core/services/voice-selection.service';
import { ToneDataService } from '../core/services/tone-data.service';
import { WaveformService } from '../core/services/waveform.service';
import { ThemeService } from '../core/services/theme.service';
import { ChallengeService } from '../core/services/challenge.service';
import { PlaybackSpeedService } from '../core/services/playback-speed.service';

// 接口
import { ToneExample, ExampleGroup, CharacterMarker } from '../core/interfaces/tone.interfaces';

// 注册需要使用的图标
addIcons({ play, pause, 'bar-chart-outline': barChartOutline });

@Component({
  selector: 'app-tones',
  templateUrl: './tones.page.html',
  styleUrls: ['./tones.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class TonesPage implements OnInit, OnDestroy {
  @ViewChild('waveformSvg') waveformSvgRef!: ElementRef<SVGSVGElement>;
  
  // 注意：由于 pitch-compare 组件在 ion-modal 的 ng-template 中，
  // 无法直接通过 @ViewChild 访问，需要使用其他方法

  // 依赖注入
  private readonly ttsService = inject(TtsService);
  private readonly historyService = inject(PracticeHistoryService);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  
  // 公开服务（模板中使用）
  readonly voiceSelectionService = inject(VoiceSelectionService);
  readonly toneDataService = inject(ToneDataService);
  readonly waveformService = inject(WaveformService);
  readonly themeService = inject(ThemeService);
  readonly challengeService = inject(ChallengeService);
  readonly playbackSpeedService = inject(PlaybackSpeedService);

  // 组件销毁信号
  private readonly destroy$ = new Subject<void>();

  // ========== 状态信号 ==========
  
  // 示例组数据
  readonly exampleGroups = signal<ExampleGroup[]>(this.toneDataService.defaultExampleGroups);
  readonly currentRowExamples = signal<ToneExample[]>([]);
  readonly currentRowIndex = signal<number>(0);
  
  // 播放状态
  readonly playingChar = signal<string | null>(null);
  readonly loopingCharIndex = signal<number | null>(null);
  
  // UI 状态
  readonly showVoiceSelector = signal<boolean>(false);
  readonly showSpeedSelector = signal<boolean>(false);
  readonly showVipModal = signal<boolean>(false);
  readonly showAdviceModal = signal<boolean>(false);
  readonly showPitchCurveGuideModal = signal<boolean>(false);
  
  // 邮箱订阅
  subscribeEmail = '';
  
  // 滑动选择器
  readonly sliderTranslateY = signal<number>(0);
  private sliderTouchStartY = 0;
  private sliderTouchStartTranslateY = 0;
  private readonly sliderItemHeight = 58;
  private isSliderDragging = false;
  
  // AB 对比功能
  readonly comparePoints = signal<number[]>([]);
  readonly isComparePlaying = signal<boolean>(false);
  readonly comparePlayWithMeaning = signal<boolean>(true);
  readonly compareLoopPlay = signal<boolean>(true);
  private compareLoopTimer: ReturnType<typeof setTimeout> | null = null;
  
  // 指导建议
  readonly selectedConfusionPair = signal<{ pair: string; tones: number[] } | null>(null);
  
  // VIP 和用户状态
  readonly isVip = signal<boolean>(false);
  readonly isLoadingGroups = signal<boolean>(false);
  readonly currentUser = signal<{ id: string; nickname: string; avatar: string; phone?: string } | null>(null);
  
  // 横屏模式
  readonly isLandscapeMode = signal<boolean>(false);
  private isMobile = false;
  private originalOrientation = 'portrait';
  
  // 播放控制
  private playbackCancelled = false;
  private playSessionId = 0;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private loopCount = 0;
  private readonly maxLoopCount = 3;
  
  // 长按和双击检测
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly longPressThreshold = 500;
  private isLongPress = false;
  private lastClickTime = 0;
  private lastClickIndex: number | null = null;
  private readonly doubleClickThreshold = 300;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  
  // 3D 手势
  private gesture3DStartY = 0;
  private gesture3DStartTime = 0;
  private isGesture3DActive = false;

  // ========== 计算属性 ==========
  
  // 从波形服务获取标记数据
  readonly characterMarkers = computed(() => this.waveformService.characterMarkers());
  readonly hasWaveformData = computed(() => this.waveformService.hasWaveformData());
  
  // 从主题服务获取主题数据
  readonly currentTheme = computed(() => this.themeService.currentTheme());
  
  // 从挑战服务获取挑战数据
  readonly isChallengeMode = computed(() => this.challengeService.isChallengeMode());
  readonly challengeCorrectIndex = computed(() => this.challengeService.challengeCorrectIndex());
  readonly challengeUserChoice = computed(() => this.challengeService.challengeUserChoice());
  readonly challengeFeedback = computed(() => this.challengeService.challengeFeedback());
  readonly currentDiagnosis = computed(() => this.challengeService.currentDiagnosis());
  readonly showPracticeReport = computed(() => this.challengeService.showPracticeReport());
  readonly practiceStats = computed(() => this.challengeService.practiceStats());
  readonly practiceAccuracy = computed(() => this.challengeService.practiceAccuracy());
  readonly practiceTime = computed(() => this.challengeService.practiceTime());
  readonly topConfusionPairs = computed(() => this.challengeService.topConfusionPairs());
  readonly masteredTones = computed(() => this.challengeService.masteredTones());
  
  // 是否可以开始对比
  readonly canCompare = computed(() => this.comparePoints().length >= 2);

  constructor() {
    // 检测是否为移动设备
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  ngOnInit(): void {
    this.checkVipAndLoadGroups();
    this.initWaveformPage();
    
    // 订阅用户状态变化
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentUser.set(state.user);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopCharLoop();
    this.stopCompareLoop();
    this.ttsService.stop();
    this.challengeService.stopChallengeLoop();
  }


  // ========== 初始化方法 ==========

  /**
   * 检查VIP状态并加载声调组数据
   */
  private async checkVipAndLoadGroups(): Promise<void> {
    this.isVip.set(await this.authService.isVip());
    this.loadToneGroupsFromServer();
  }

  /**
   * 从服务器加载声调组数据
   */
  private loadToneGroupsFromServer(): void {
    this.isLoadingGroups.set(true);
    
    this.apiService.getToneGroups().subscribe({
      next: (response: { success: boolean; data: ExampleGroup[] }) => {
        if (response.success && response.data?.length > 0) {
          this.exampleGroups.set(response.data);
          // 缓存到 tone-data.service
          this.toneDataService.setCachedExampleGroups(response.data);
          this.currentRowIndex.set(0);
          this.updateSliderPosition();
          
          if (response.data.length > 0) {
            this.currentRowExamples.set([...response.data[0].examples]);
            this.waveformService.prepareCanvas();
            this.drawAllWaveforms();
          }
        }
        this.isLoadingGroups.set(false);
      },
      error: () => {
        this.isLoadingGroups.set(false);
      }
    });
  }

  /**
   * 初始化波形页面
   */
  private async initWaveformPage(): Promise<void> {
    await this.hideStatusBar();
    
    const groups = this.exampleGroups();
    if (groups.length > 0) {
      this.currentRowExamples.set([...groups[0].examples]);
    }
    
    await this.lockToLandscape();
    this.waveformService.prepareCanvas();
    await this.delay(100);
    this.drawAllWaveforms();
  }

  /**
   * 绘制所有波形
   */
  private drawAllWaveforms(): void {
    const examples = this.currentRowExamples();
    for (let i = 0; i < examples.length; i++) {
      this.waveformService.drawCharacterWaveformSegment(i, examples);
    }
  }

  // ========== 语音选择 ==========

  /**
   * 切换语音选择器的显示/隐藏状态
   */
  toggleVoiceSelector(): void {
    this.showVoiceSelector.update(v => !v);
    // 关闭其他选择器
    if (this.showVoiceSelector()) {
      this.showSpeedSelector.set(false);
    }
  }

  /**
   * 关闭语音选择器
   */
  closeVoiceSelector(): void {
    this.showVoiceSelector.set(false);
  }

  /**
   * 选择指定的语音
   * @param voiceId 语音ID
   */
  selectVoice(voiceId: string): void {
    this.voiceSelectionService.selectVoice(voiceId);
    this.showVoiceSelector.set(false);
  }

  /**
   * 预览试听指定语音
   * @param voice 语音信息对象
   * @param event 点击事件（用于阻止冒泡）
   */
  async previewVoice(voice: VoiceInfo, event: Event): Promise<void> {
    event.stopPropagation();
    const utterance = new SpeechSynthesisUtterance('你好');
    const voices = speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.voiceURI === voice.voiceURI);
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
    utterance.lang = 'zh-HK';
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  // ========== 播放速度选择 ==========

  /**
   * 切换播放速度选择器的显示/隐藏状态
   */
  toggleSpeedSelector(): void {
    this.showSpeedSelector.update(v => !v);
    // 关闭其他选择器
    if (this.showSpeedSelector()) {
      this.showVoiceSelector.set(false);
    }
  }

  /**
   * 关闭播放速度选择器
   */
  closeSpeedSelector(): void {
    this.showSpeedSelector.set(false);
  }

  /**
   * 选择指定的播放速度
   * @param speed 播放速度
   */
  selectSpeed(speed: number): void {
    this.playbackSpeedService.setPlaybackSpeed(speed);
    this.showSpeedSelector.set(false);
  }

  // ========== 例字组切换 ==========

  /**
   * 检查用户是否可以切换到指定的例字组
   * VIP用户可以访问所有组，非VIP用户只能访问前4组
   * @param index 例字组索引
   * @returns 是否可以切换
   */
  canSwitchToGroup(index: number): boolean {
    return this.isVip() || index < 4;
  }

  /**
   * 尝试切换到指定的例字组
   * 如果用户没有权限，则显示VIP弹窗
   * @param rowIndex 目标例字组索引
   */
  trySwitch(rowIndex: number): void {
    if (this.isSliderDragging) return;
    
    if (this.canSwitchToGroup(rowIndex)) {
      this.switchRowExamples(rowIndex);
    } else {
      this.showVipModal.set(true);
    }
  }

  /**
   * 切换到指定的例字组并自动播放
   * 会停止当前播放、重置波形画布、清除对比点
   * @param rowIndex 目标例字组索引
   */
  async switchRowExamples(rowIndex: number): Promise<void> {
    this.playbackCancelled = true;
    this.stopCharLoop();
    await this.ttsService.stop();
    this.playingChar.set(null);
    
    await this.delay(150);
    
    const groups = this.exampleGroups();
    if (rowIndex >= groups.length) return;
    
    this.currentRowExamples.set([...groups[rowIndex].examples]);
    this.currentRowIndex.set(rowIndex);
    this.updateSliderPosition();
    
    this.waveformService.prepareCanvas();
    this.closeChallenge();
    this.clearComparePoints();
    
    const sessionId = ++this.playSessionId;
    this.playbackCancelled = false;
    this.ttsService.reset();
    
    await this.delay(100);
    await this.playRowWithAnimation(sessionId);
  }

  /**
   * 获取例字组按钮显示的文本
   * 优先显示粤拼，如果没有则显示第一个例字
   * @param group 例字组对象
   * @returns 按钮显示文本
   */
  getGroupButtonText(group: ExampleGroup): string {
    if (group.baseJyutping?.trim()) {
      return group.baseJyutping;
    }
    return group.examples?.[0]?.char || '?';
  }

  /**
   * 判断例字组按钮是否显示汉字（而非粤拼）
   * @param group 例字组对象
   * @returns 是否为汉字按钮
   */
  isCharButton(group: ExampleGroup): boolean {
    return !group.baseJyutping?.trim();
  }

  // ========== 滑动选择器 ==========

  /**
   * 处理滑动选择器触摸开始事件
   * 记录起始位置和当前偏移量
   * @param event 触摸事件
   */
  onSliderTouchStart(event: TouchEvent): void {
    this.sliderTouchStartY = event.touches[0].clientY;
    this.sliderTouchStartTranslateY = this.sliderTranslateY();
    this.isSliderDragging = false;
  }

  /**
   * 处理滑动选择器触摸移动事件
   * 实现弹性滑动效果，超出边界时有阻尼
   * @param event 触摸事件
   */
  onSliderTouchMove(event: TouchEvent): void {
    const deltaY = event.touches[0].clientY - this.sliderTouchStartY;
    
    if (Math.abs(deltaY) > 5) {
      this.isSliderDragging = true;
      event.preventDefault();
      
      let newTranslateY = this.sliderTouchStartTranslateY + deltaY;
      const maxTranslate = 0;
      const minTranslate = -((this.exampleGroups().length - 1) * this.sliderItemHeight);
      
      if (newTranslateY > maxTranslate) {
        newTranslateY = maxTranslate + (newTranslateY - maxTranslate) * 0.3;
      } else if (newTranslateY < minTranslate) {
        newTranslateY = minTranslate + (newTranslateY - minTranslate) * 0.3;
      }
      
      this.sliderTranslateY.set(newTranslateY);
    }
  }

  /**
   * 处理滑动选择器触摸结束事件
   * 根据滑动位置自动吸附到最近的例字组
   */
  onSliderTouchEnd(): void {
    if (!this.isSliderDragging) return;
    
    const targetIndex = Math.round(-this.sliderTranslateY() / this.sliderItemHeight);
    const clampedIndex = Math.max(0, Math.min(targetIndex, this.exampleGroups().length - 1));
    
    if (this.canSwitchToGroup(clampedIndex)) {
      this.switchRowExamples(clampedIndex);
    } else {
      this.updateSliderPosition();
      this.showVipModal.set(true);
    }
    
    setTimeout(() => {
      this.isSliderDragging = false;
    }, 50);
  }

  /**
   * 更新滑动选择器位置
   * 根据当前选中的例字组索引计算偏移量
   */
  private updateSliderPosition(): void {
    this.sliderTranslateY.set(-this.currentRowIndex() * this.sliderItemHeight);
  }

  // ========== VIP 弹窗 ==========

  /**
   * 关闭VIP引导弹窗
   */
  closeVipModal(): void {
    this.showVipModal.set(false);
  }

  /**
   * 验证邮箱格式
   */
  isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 订阅更新通知
   */
  async subscribeToUpdates(): Promise<void> {
    if (!this.isValidEmail(this.subscribeEmail)) {
      return;
    }

    try {
      // 发送订阅请求到后台API
      const response = await this.apiService.subscribeToUpdates(this.subscribeEmail).toPromise();
      
      console.log('订阅成功:', this.subscribeEmail, response);
      
      // 显示成功提示
      const alert = await this.alertController.create({
        header: '订阅成功',
        message: response?.message || '感谢订阅！我们会在新版本发布时第一时间通知您。',
        buttons: ['确定']
      });
      await alert.present();
      
      // 清空输入框
      this.subscribeEmail = '';
    } catch (error: any) {
      console.error('订阅失败:', error);
      
      let errorMessage = '网络错误，请稍后重试。';
      
      // 根据错误类型显示不同的提示
      if (error.status === 409) {
        errorMessage = error.error?.message || '该邮箱已经订阅过了！';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || '邮箱格式不正确，请检查后重试。';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }
      
      // 显示错误提示
      const alert = await this.alertController.create({
        header: '订阅失败',
        message: errorMessage,
        buttons: ['确定']
      });
      await alert.present();
    }
  }

  /**
   * 移除当前焦点元素的焦点
   * 用于在页面跳转前清除输入焦点
   */
  private blurActiveElement(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  // ========== 播放功能 ==========

  /**
   * 带动画效果播放当前行的所有例字
   * 依次绘制波形并播放语音，前3个字和后3个字之间停顿1秒
   * @param sessionId 播放会话ID，用于检测播放是否被取消
   */
  private async playRowWithAnimation(sessionId: number): Promise<void> {
    const examples = this.currentRowExamples();
    if (examples.length === 0) return;

    this.stopCharLoop();
    this.closeChallenge();

    for (let i = 0; i < examples.length; i++) {
      if (this.playbackCancelled || sessionId !== this.playSessionId) {
        this.playingChar.set(null);
        return;
      }
      
      const example = examples[i];
      this.waveformService.drawCharacterWaveformSegment(i, examples);
      
      // 如果只有拼音但没有字，则跳过不读
      if (!example.char || example.char.trim() === '') {
        continue;
      }
      
      this.playingChar.set(example.char);
      try {
        // 使用全局播放速度设置
        const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
        await this.ttsService.speak(example.char, { rate: globalSpeed }, example.jyutping);
      } catch (error) {
        console.error('TTS 播放失败:', error);
      }
      
      if (this.playbackCancelled || sessionId !== this.playSessionId) {
        this.playingChar.set(null);
        return;
      }
      
      // 读完前3个字后停顿1秒，再读后3个字
      if (i === 2 && examples.length > 3) {
        await this.delay(1000);
      } 
    }
    this.playingChar.set(null);
  }

  /**
   * 播放当前行的所有例字（不重绘波形）
   * 仅播放波形线条动画和语音
   */
  async playCurrentRow(): Promise<void> {
    const examples = this.currentRowExamples();
    if (examples.length === 0) return;

    this.stopCharLoop();
    this.closeChallenge();
    await this.ttsService.stop();
    
    const sessionId = ++this.playSessionId;
    this.playbackCancelled = false;
    this.ttsService.reset();

    for (let i = 0; i < examples.length; i++) {
      if (this.playbackCancelled || sessionId !== this.playSessionId) {
        this.playingChar.set(null);
        return;
      }
      
      const example = examples[i];
      
      // 如果只有拼音但没有字，则跳过不读
      if (!example.char || example.char.trim() === '') {
        continue;
      }
      
      this.playingChar.set(example.char);
      this.waveformService.replayWaveformLineAnimation(i);
      // 使用全局播放速度设置
      const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
      await this.ttsService.speak(example.char, { rate: globalSpeed }, example.jyutping);
      
      if (this.playbackCancelled || sessionId !== this.playSessionId) {
        this.playingChar.set(null);
        return;
      }
      
      await this.delay(300);
    }
    this.playingChar.set(null);
  }

  /**
   * 重新播放波形动画和语音（【听】按钮点击）
   * 会重置波形画布并重新绘制动画
   */
  async replayWaveform(): Promise<void> {
    const examples = this.currentRowExamples();
    if (examples.length === 0) return;

    this.stopCharLoop();
    this.closeChallenge();
    await this.ttsService.stop();
    this.waveformService.prepareCanvas();
    
    const sessionId = ++this.playSessionId;
    this.playbackCancelled = false;
    this.ttsService.reset();

    await this.delay(200);
    await this.playRowWithAnimation(sessionId);
  }

  /**
   * 播放单个字符（点击字符圆圈触发）
   * 会循环播放最多3次
   * @param marker 字符标记对象
   * @param index 字符索引
   */
  async playCharacter(marker: CharacterMarker, index: number): Promise<void> {
    this.stopCharLoop();
    this.loopingCharIndex.set(index);
    this.loopCount = 0;
    
    await this.playCharLoop(marker, index);
  }

  /**
   * 单个字符的循环播放逻辑
   * @param marker 字符标记对象
   * @param index 字符索引
   */
  private async playCharLoop(marker: CharacterMarker, index: number): Promise<void> {
    if (this.loopingCharIndex() === null) return;
    
    if (this.loopCount >= this.maxLoopCount) {
      this.stopCharLoop();
      return;
    }

    this.loopCount++;
    this.playingChar.set(marker.char);
    this.waveformService.replayWaveformLineAnimation(index);
    // 使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    await this.ttsService.speak(marker.char, { rate: globalSpeed }, marker.jyutping);
    
    if (this.loopingCharIndex() !== null) {
      this.loopTimer = setTimeout(() => {
        this.playCharLoop(marker, index);
      }, 600);
    }
  }

  /**
   * 停止单个字符的循环播放
   */
  private stopCharLoop(): void {
    this.loopingCharIndex.set(null);
    this.loopCount = 0;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /**
   * 播放字符的含义/词语
   * @param meaning 含义文本
   * @param char 对应的汉字
   */
  async playMeaning(meaning: string, char: string): Promise<void> {
    // 使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    await this.ttsService.speak(meaning, { 
      rate: globalSpeed,
      volume: 1.0 
    });
  }


  // ========== 声调表页面 ==========

  /**
   * 打开声调表页面
   */
  openToneTableModal(): void {
    this.router.navigate(['/tone-table']);
  }

  /**
   * 打开音高曲线对比页面
   * 只有选择真人发音时才能打开
   */
  openPitchCurveComparison(): void {
    const currentVoice = this.voiceSelectionService.currentVoice();
    
    // 检查是否为真人发音
    if (currentVoice?.type !== 'human') {
      // 显示引导弹窗
      this.showPitchCurveGuideModal.set(true);
      return;
    }
    
    // 跳转到音高曲线对比页面，传递当前组索引
    this.blurActiveElement();
    this.router.navigate(['/pitch-curve-compare'], {
      queryParams: {
        groupIndex: this.currentRowIndex()
      }
    });
  }

  /**
   * 关闭音高曲线引导弹窗
   */
  closePitchCurveGuideModal(): void {
    this.showPitchCurveGuideModal.set(false);
  }

  /**
   * 打开语音选择器并关闭引导弹窗
   */
  goToSelectHumanVoice(): void {
    this.showPitchCurveGuideModal.set(false);
    this.showVoiceSelector.set(true);
  }

  // ========== 挑战模式 ==========

  /**
   * 开始听音辨调挑战模式
   * 清除对比点，停止循环播放，初始化挑战
   */
  startChallenge(): void {
    const examples = this.currentRowExamples();
    if (examples.length === 0) return;
    
    this.clearComparePoints();
    this.stopCharLoop();
    
    this.challengeService.startChallenge(examples.length);
    this.nextChallengeQuestion();
  }

  /**
   * 生成并显示下一道挑战题目
   * 随机选择一个字作为正确答案并播放
   */
  private async nextChallengeQuestion(): Promise<void> {
    const examples = this.currentRowExamples();
    const correctIndex = this.challengeService.generateNextQuestion(examples.length);
    
    await this.delay(300);
    await this.playChallengeAudioOnce();
    
    this.challengeService.startChallengeLoop(
      () => this.playChallengeAudioOnce(),
      2500
    );
  }

  /**
   * 播放一次挑战题目的音频
   */
  private async playChallengeAudioOnce(): Promise<void> {
    const correctIndex = this.challengeCorrectIndex();
    if (correctIndex === null || !this.isChallengeMode()) return;
    
    const examples = this.currentRowExamples();
    const example = examples[correctIndex];
    if (example) {
      // 使用全局播放速度设置
      const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
      await this.ttsService.speak(example.char, { rate: globalSpeed }, example.jyutping);
    }
  }

  /**
   * 处理挑战模式中用户点击字符
   * @param charIndex 用户点击的字符索引
   */
  onChallengeCharClick(charIndex: number): void {
    const examples = this.currentRowExamples();
    
    this.challengeService.handleUserChoice(
      charIndex,
      examples,
      () => this.nextChallengeQuestion(),
      () => this.nextChallengeQuestion()
    );
  }

  /**
   * 重新播放挑战题目音频
   */
  async replayChallengeAudio(): Promise<void> {
    await this.playChallengeAudioOnce();
  }

  /**
   * 继续下一道挑战题目
   */
  continueChallenge(): void {
    this.challengeService.stopChallengeLoop();
    this.nextChallengeQuestion();
  }

  /**
   * 结束挑战模式
   * 如果答题数量>=3，保存练习历史
   */
  endChallenge(): void {
    this.challengeService.endChallenge();
    
    // 如果有答题记录，保存历史
    const stats = this.practiceStats();
    if (stats.totalQuestions >= 3) {
      this.savePracticeHistory();
    }
  }

  /**
   * 关闭挑战模式（不显示报告）
   */
  closeChallenge(): void {
    this.challengeService.stopChallengeLoop();
    this.challengeService.endChallenge();
  }

  /**
   * 关闭练习报告面板
   */
  closePracticeReport(): void {
    this.challengeService.closePracticeReport();
  }

  /**
   * 重新开始练习
   */
  restartPractice(): void {
    this.challengeService.restartPractice();
    this.startChallenge();
  }

  /**
   * 保存练习历史记录
   */
  private savePracticeHistory(): void {
    const historyData = this.challengeService.getPracticeStatsForHistory();
    if (historyData.totalQuestions === 0) return;
    this.historyService.saveSession(historyData);
  }

  /**
   * 获取混淆声调对的诊断和建议
   * @param pair 混淆对标识（如"1-2"）
   * @returns 诊断信息和建议列表
   */
  getConfusionDiagnosis(pair: string): { diagnosis: string; advice: string[] } {
    return this.challengeService.getConfusionDiagnosis(pair);
  }

  /**
   * 打开指导建议弹窗
   * @param pair 混淆对标识
   * @param tones 混淆的声调编号数组
   */
  openAdviceModal(pair: string, tones: number[]): void {
    this.selectedConfusionPair.set({ pair, tones });
    this.showAdviceModal.set(true);
  }

  /**
   * 关闭指导建议弹窗
   */
  closeAdviceModal(): void {
    this.showAdviceModal.set(false);
    this.selectedConfusionPair.set(null);
  }

  /**
   * 跳转到对比训练
   * 根据选中的混淆对设置对比点并开始播放
   */
  goToCompareTraining(): void {
    const pair = this.selectedConfusionPair();
    if (!pair) return;
    
    this.closeAdviceModal();
    this.closePracticeReport();
    
    this.comparePoints.set([pair.tones[0] - 1, pair.tones[1] - 1]);
    
    setTimeout(() => {
      this.startCompare();
    }, 300);
  }

  // ========== AB 对比功能 ==========

  /**
   * 处理字符长按开始事件
   * 用于标记AB对比点
   * @param index 字符索引
   * @param event 事件对象
   */
  onCharLongPressStart(index: number, event: Event): void {
    this.isLongPress = false;
    
    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.setComparePoint(index);
    }, this.longPressThreshold);
  }

  /**
   * 处理字符长按结束事件
   * @param event 事件对象
   */
  onCharLongPressEnd(event: Event): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * 处理字符点击事件
   * 支持单击播放、双击打开纠错页、长按标记对比点
   * @param marker 字符标记对象
   * @param index 字符索引
   * @param event 点击事件
   */
  onCharClick(marker: CharacterMarker, index: number, event: Event): void {
    event.stopPropagation();
    
    if (this.isLongPress) {
      this.isLongPress = false;
      return;
    }
    
    // 挑战模式下，直接作为答案选择
    if (this.isChallengeMode() && this.challengeFeedback() === null) {
      this.onChallengeCharClick(index);
      return;
    }
    
    const currentTime = Date.now();
    
    // 检测双击
    if (this.lastClickIndex === index && (currentTime - this.lastClickTime) < this.doubleClickThreshold) {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }
      this.lastClickTime = 0;
      this.lastClickIndex = null;
      this.openToneCorrection(index);
    } else {
      this.lastClickTime = currentTime;
      this.lastClickIndex = index;
      
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }
      
      this.clickTimer = setTimeout(() => {
        this.clickTimer = null;
        this.playCharacter(marker, index);
      }, this.doubleClickThreshold);
    }
  }

  /**
   * 打开声调纠错页面
   * @param charIndex 字符索引
   */
  private openToneCorrection(charIndex: number): void {
    const markers = this.characterMarkers();
    const marker = markers[charIndex];
    if (!marker) return;
    
    this.blurActiveElement();
    const toneNumber = this.toneDataService.getToneNumberFromJyutping(marker.jyutping);
    
    this.router.navigate(['/tone-correction'], {
      queryParams: {
        char: marker.char,
        tone: toneNumber,
        jyutping: marker.jyutping
      }
    });
  }

  /**
   * 设置或取消对比点
   * 最多支持3个对比点（A、B、C）
   * @param index 字符索引
   */
  private setComparePoint(index: number): void {
    this.comparePoints.update(points => {
      const existingIndex = points.indexOf(index);
      
      if (existingIndex !== -1) {
        return points.filter((_, i) => i !== existingIndex);
      } else if (points.length < 3) {
        return [...points, index];
      } else {
        return [...points.slice(1), index];
      }
    });
  }

  /**
   * 清除所有对比点
   */
  clearComparePoints(): void {
    this.comparePoints.set([]);
    this.stopCompareLoop();
  }

  /**
   * 获取对比点的标签（A、B、C）
   * @param index 字符索引
   * @returns 对比标签，如果不是对比点则返回空字符串
   */
  getCompareLabel(index: number): string {
    const labels = ['A', 'B', 'C'];
    const pos = this.comparePoints().indexOf(index);
    return pos !== -1 ? labels[pos] : '';
  }

  /**
   * 开始AB对比播放
   */
  async startCompare(): Promise<void> {
    if (!this.canCompare()) return;
    
    this.isComparePlaying.set(true);
    this.closeChallenge();
    this.stopCharLoop();
    this.ttsService.reset();
    
    await this.playCompareOnce();
    
    if (this.compareLoopPlay() && this.isComparePlaying()) {
      this.startCompareLoop();
    } else {
      this.isComparePlaying.set(false);
    }
  }

  /**
   * 播放一次对比（字符+可选的含义）
   */
  private async playCompareOnce(): Promise<void> {
    if (!this.isComparePlaying()) return;
    
    await this.playCompareChars();
    
    if (!this.isComparePlaying()) return;
    
    if (this.comparePlayWithMeaning()) {
      await this.delay(600);
      await this.playCompareMeanings();
    }
  }

  /**
   * 开始对比循环播放
   */
  private startCompareLoop(): void {
    if (this.compareLoopTimer) {
      clearTimeout(this.compareLoopTimer);
    }
    
    this.compareLoopTimer = setTimeout(async () => {
      if (this.isComparePlaying() && this.compareLoopPlay()) {
        await this.playCompareOnce();
        if (this.isComparePlaying() && this.compareLoopPlay()) {
          this.startCompareLoop();
        }
      }
    }, 1000);
  }

  /**
   * 停止对比循环播放
   */
  stopCompareLoop(): void {
    this.isComparePlaying.set(false);
    if (this.compareLoopTimer) {
      clearTimeout(this.compareLoopTimer);
      this.compareLoopTimer = null;
    }
    this.playingChar.set(null);
  }

  /**
   * 播放对比点的字符
   */
  private async playCompareChars(): Promise<void> {
    const markers = this.characterMarkers();
    const points = this.comparePoints();
    // 使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    
    for (const pointIndex of points) {
      if (!this.isComparePlaying()) return;
      
      const marker = markers[pointIndex];
      if (!marker) continue;
      
      this.playingChar.set(marker.char);
      this.waveformService.replayWaveformLineAnimation(pointIndex);
      await this.ttsService.speak(marker.char, { rate: globalSpeed }, marker.jyutping);
    }
    this.playingChar.set(null);
  }

  /**
   * 播放对比点的含义/词语
   */
  private async playCompareMeanings(): Promise<void> {
    const markers = this.characterMarkers();
    const points = this.comparePoints();
    // 使用全局播放速度设置
    const globalSpeed = this.playbackSpeedService.getCurrentSpeed();
    
    for (const pointIndex of points) {
      if (!this.isComparePlaying()) return;
      
      const marker = markers[pointIndex];
      if (!marker) continue;
      
      this.playingChar.set(marker.char);
      this.waveformService.replayWaveformLineAnimation(pointIndex);
      await this.ttsService.speak(marker.meaning, { 
        rate: globalSpeed,
        volume: 1.0
      });
    }
    this.playingChar.set(null);
  }

  /**
   * 处理对比播放按钮点击
   * 切换播放/停止状态
   */
  onCompareButtonClick(): void {
    if (this.isComparePlaying()) {
      this.stopCompareLoop();
    } else if (this.canCompare()) {
      this.startCompare();
    }
  }

  /**
   * 切换是否播放含义
   */
  toggleComparePlayWithMeaning(): void {
    this.comparePlayWithMeaning.update(v => !v);
  }

  /**
   * 切换是否循环播放
   */
  toggleCompareLoopPlay(): void {
    this.compareLoopPlay.update(v => !v);
    if (!this.compareLoopPlay()) {
      this.stopCompareLoop();
    }
  }


  // ========== 主题相关 ==========

  /**
   * 打开主题选择页面
   */
  openThemeSelector(): void {
    this.router.navigate(['/theme-selector']);
  }

  // ========== 导航 ==========

  /**
   * 跳转到个人中心页面
   * 未登录时跳转到登录页
   */
  goToProfile(): void {
    this.blurActiveElement();
    
    if (this.currentUser()) {
      this.router.navigate(['/profile']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * 跳转到3D声调山页面
   * 携带当前例字数据
   */
  goToMountain(): void {
    this.blurActiveElement();
    
    const examples = this.currentRowExamples().map(e => ({
      char: e.char,
      jyutping: e.jyutping,
      meaning: e.meaning
    }));
    
    this.router.navigate(['/tone-mountain'], {
      queryParams: { examples: JSON.stringify(examples) }
    });
  }

  // ========== 3D 手势 ==========

  /**
   * 处理3D手势开始
   * 记录起始位置和时间
   * @param event 触摸事件
   */
  on3DGestureStart(event: TouchEvent): void {
    this.gesture3DStartY = event.touches[0].clientY;
    this.gesture3DStartTime = Date.now();
    this.isGesture3DActive = true;
  }

  /**
   * 处理3D手势移动
   * 长按3秒并向上滑动100px触发跳转到3D页面
   * @param event 触摸事件
   */
  on3DGestureMove(event: TouchEvent): void {
    if (!this.isGesture3DActive) return;
    
    const currentY = event.touches[0].clientY;
    const deltaY = this.gesture3DStartY - currentY;
    const duration = Date.now() - this.gesture3DStartTime;
    
    if (duration > 3000 && deltaY > 100) {
      this.isGesture3DActive = false;
      this.goToMountain();
    }
  }

  /**
   * 处理3D手势结束
   */
  on3DGestureEnd(): void {
    this.isGesture3DActive = false;
  }

  // ========== 屏幕方向 ==========

  /**
   * 隐藏状态栏
   * 仅在支持的平台上生效
   */
  private async hideStatusBar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    
    try {
      await StatusBar.hide();
    } catch (error) {
      console.log('StatusBar hide not supported:', error);
    }
  }

  /**
   * 锁定屏幕为横屏模式
   * 仅在移动设备上生效
   */
  private async lockToLandscape(): Promise<void> {
    if (!this.isMobile || !Capacitor.isNativePlatform()) {
      this.isLandscapeMode.set(true);
      return;
    }
    
    try {
      const currentOrientation = await ScreenOrientation.orientation();
      this.originalOrientation = currentOrientation.type;
      await ScreenOrientation.lock({ orientation: 'landscape' });
      this.isLandscapeMode.set(true);
    } catch (error) {
      // Screen orientation lock not available - this is expected in browser
      this.isLandscapeMode.set(true);
    }
  }

  // ========== 工具方法 ==========

  /**
   * 延迟指定毫秒数
   * @param ms 延迟毫秒数
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 开发测试：切换用户登录状态
   * 用于开发调试，切换测试用户的登录/登出
   */
  toggleTestUser(): void {
    if (this.currentUser()) {
      this.authService.logout();
    } else {
      this.authService.setTestUser({
        id: 'test_user_001',
        nickname: '测试用户',
        avatar: 'https://via.placeholder.com/64/3b82f6/ffffff?text=测'
      });
    }
  }
}
