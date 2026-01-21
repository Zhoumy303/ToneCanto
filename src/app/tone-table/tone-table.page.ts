import { Component, OnInit, OnDestroy, inject, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { TtsService } from '../core/services/tts.service';
import { ToneDataService } from '../core/services/tone-data.service';
import { ApiService } from '../core/services/api.service';
import { ExampleGroup } from '../core/interfaces/tone.interfaces';
import { driver, Driver } from 'driver.js';

@Component({
  selector: 'app-tone-table',
  templateUrl: './tone-table.page.html',
  styleUrls: ['./tone-table.page.scss'],
  imports: [CommonModule, IonicModule]
})
export class ToneTablePage implements OnInit, OnDestroy, AfterViewInit {
  private readonly ttsService = inject(TtsService);
  private readonly apiService = inject(ApiService);
  private readonly navCtrl = inject(NavController);
  readonly toneDataService = inject(ToneDataService);

  // Driver.js 实例
  private driverInstance: Driver | null = null;

  // 例字组数据
  readonly exampleGroups = signal<ExampleGroup[]>(this.toneDataService.defaultExampleGroups);

  // 选中的声调
  readonly selectedTone = signal<number | null>(null);

  // 高亮显示的字（改为记录声调编号和字符信息）
  readonly highlightToneNumber = signal<number | null>(null);
  readonly highlightChar = signal<string | null>(null);
  readonly highlightJyutping = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // 五度说明弹窗
  readonly showFiveScaleModal = signal(false);

  // 声调分类说明弹窗
  readonly showToneClassificationModal = signal(false);

  // 是否正在播放所有例字
  readonly isPlayingAllExamples = signal(false);
  private stopPlayback = false;

  // 计算属性
  readonly tonesData = computed(() => this.toneDataService.tonesData);
  readonly toneColorRgb = computed(() => this.toneDataService.toneColorRgb);
  
  // 获取第一组例字用于表格显示
  readonly firstExampleGroup = computed(() => {
    const groups = this.exampleGroups();
    return groups.length > 0 ? groups[0] : null;
  });

  /**
   * 获取指定声调的前四个例字
   * @param toneNumber 声调编号
   */
  getExamplesForTone(toneNumber: number): { char: string; jyutping: string }[] {
    const toneIndex = toneNumber - 1;
    return this.exampleGroups()
      .slice(0, 4)
      .map(group => group.examples[toneIndex])
      .filter(e => e);
  }

  ngOnInit(): void {
    this.loadToneGroupsFromServer();
  }

  ngAfterViewInit(): void {
    // 初始化 Driver.js
    this.initDriver();
  }

  ngOnDestroy(): void {
    this.ttsService.stop();
    this.stopPlayback = true;
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }
    if (this.driverInstance) {
      this.driverInstance.destroy();
    }
  }

  /**
   * 从服务器加载声调组数据
   */
  private loadToneGroupsFromServer(): void {
    this.apiService.getToneGroups().subscribe({
      next: (response: { success: boolean; data: ExampleGroup[] }) => {
        if (response.success && response.data?.length > 0) {
          this.exampleGroups.set(response.data);
        }
      },
      error: () => {
        // 使用默认数据
      }
    });
  }

  /**
   * 返回上一页
   */
  goBack(): void {
    this.navCtrl.back();
  }

  /**
   * 选择声调并播放示例
   * @param toneNumber 声调编号（1-6）
   */
  selectTone(toneNumber: number): void {
    this.selectedTone.set(toneNumber);
    this.playToneDemoWithHighlight(toneNumber);
  }

  /**
   * 播放指定声调的示例字并高亮显示
   * @param toneNumber 声调编号
   */
  async playToneDemoWithHighlight(toneNumber: number): Promise<void> {
    const tone = this.toneDataService.tonesData.find(t => t.number === toneNumber);
    if (!tone) return;

    const toneIndex = toneNumber - 1;
    const maxGroups = 4;
    const examples = this.exampleGroups()
      .slice(0, maxGroups)
      .map(group => group.examples[toneIndex])
      .filter(e => e);

    if (examples.length === 0) return;

    this.ttsService.reset(); // 重置取消状态，确保可以播放

    for (const example of examples) {
      this.showHighlightChar(toneNumber, example.char, example.jyutping);
      await this.ttsService.speak(example.char);
      await this.delay(300);
    }

    this.hideHighlightChar();
  }

  /**
   * 显示高亮字符（在对应声调列内）
   */
  showHighlightChar(toneNumber: number, char: string, jyutping: string): void {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }

    this.highlightToneNumber.set(toneNumber);
    this.highlightChar.set(char);
    this.highlightJyutping.set(jyutping);
  }

  /**
   * 隐藏高亮字符
   */
  hideHighlightChar(): void {
    this.highlightToneNumber.set(null);
    this.highlightChar.set(null);
    this.highlightJyutping.set(null);

    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
  }

  /**
   * 获取声调的调值字符串
   */
  getToneValue(toneNumber: number): string {
    return this.toneDataService.getToneValue(toneNumber);
  }

  /**
   * 判断指定声调在指定音高位置是否激活
   */
  isPitchActive(toneNumber: number, pitch: number): boolean {
    return this.toneDataService.isPitchActive(toneNumber, pitch);
  }

  /**
   * 延迟指定毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 点击五度标尺数字，显示说明弹窗
   */
  onPitchScaleClick(event: Event): void {
    event.stopPropagation();
    this.showFiveScaleModal.set(true);
  }

  /**
   * 关闭五度说明弹窗
   */
  closeFiveScaleModal(): void {
    this.showFiveScaleModal.set(false);
  }

  /**
   * 点击调名/调序/调值行的表头，显示声调分类说明弹窗
   */
  onToneHeaderClick(event: Event): void {
    event.stopPropagation();
    this.showToneClassificationModal.set(true);
  }

  /**
   * 关闭声调分类说明弹窗
   */
  closeToneClassificationModal(): void {
    this.showToneClassificationModal.set(false);
  }

  /**
   * 播放指定声调类型的例字
   * @param toneType 声调类型: 'flat' (1,3,6), 'rising' (2,5), 'falling' (4)
   */
  async playToneCategory(toneType: 'flat' | 'rising' | 'falling', event: Event): Promise<void> {
    event.stopPropagation();
    
    let toneNumbers: number[];
    switch (toneType) {
      case 'flat':
        toneNumbers = [1, 3, 6]; // 平调：第1、3、6声
        break;
      case 'rising':
        toneNumbers = [2, 5]; // 升调：第2、5声
        break;
      case 'falling':
        toneNumbers = [4]; // 降调：第4声
        break;
    }

    const groups = this.exampleGroups();
    if (groups.length === 0) return;

    // 使用第一组例字
    const group = groups[0];

    for (const toneNumber of toneNumbers) {
      const toneIndex = toneNumber - 1;
      const example = group.examples[toneIndex];
      if (example) {
        await this.ttsService.speak(example.char);
        await this.delay(400);
      }
    }
  }

  /**
   * 初始化 Driver.js
   */
  private initDriver(): void {
    this.driverInstance = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'tone-table-popover',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '完成',
      progressText: '{{current}} / {{total}}',
      steps: [
        {
          element: '.tone-introduction',
          popover: {
            title: '📖 声调介绍',
            description: '这里简要介绍了粤语"九声六调"体系的基础知识，帮助你建立声调学习的正确认知。',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '.table-header.clickable:first-of-type',
          popover: {
            title: '🏷️ 调名/调序/调值',
            description: '点击左侧的"调名"、"调序"或"调值"，可以查看声调分类说明，了解平调、升调、降调的区分方法。',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '.pitch-scale.clickable',
          popover: {
            title: '📊 五度标记法',
            description: '点击左侧的数字 1-5，可以查看五度标记法说明，理解声调的相对音高概念。',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '.example-cell:first-of-type',
          popover: {
            title: '🔊 播放例字',
            description: '点击任意一个例字，会播放该例字所在组的全部6个声调（1-6声），让你感受同组字的声调对比。',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '.example-header',
          popover: {
            title: '🔄 循环播放',
            description: '点击"例字"表头，可以循环播放所有例字组。播放过程中再次点击可停止播放。',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '.help-btn',
          popover: {
            title: '❓ 帮助按钮',
            description: '随时点击这个按钮，可以再次查看操作引导。',
            side: 'bottom',
            align: 'end'
          }
        }
      ]
    });
  }

  /**
   * 显示操作引导
   */
  openGuideModal(): void {
    if (this.driverInstance) {
      this.driverInstance.drive();
    }
  }

  /**
   * 播放某个例字所在组的所有6个声调
   * @param _toneNumber 点击的声调编号（未使用，保留用于未来扩展）
   * @param exampleIndex 例字索引（对应第几组，0-3）
   */
  async playExample(_toneNumber: number, exampleIndex: number = 0): Promise<void> {
    const groups = this.exampleGroups().slice(0, 4);
    if (exampleIndex >= groups.length) return;

    const group = groups[exampleIndex];
    if (!group) return;

    // 如果正在播放，先停止
    if (this.isPlayingAllExamples()) {
      this.stopAllExamplesPlayback();
      return;
    }

    this.isPlayingAllExamples.set(true);
    this.stopPlayback = false;
    this.ttsService.reset(); // 重置取消状态，确保可以播放

    const tones = this.toneDataService.tonesData;

    // 播放该组的6个声调（1-6）
    for (let toneIdx = 0; toneIdx < tones.length; toneIdx++) {
      if (this.stopPlayback) break;

      const tone = tones[toneIdx];
      const example = group.examples[toneIdx];

      // 如果该声调没有对应例字，跳过
      if (!example) continue;

      this.selectedTone.set(tone.number);
      this.showHighlightChar(tone.number, example.char, example.jyutping);
      await this.ttsService.speak(example.char);
      await this.delay(250);
    }

    this.hideHighlightChar();
    this.isPlayingAllExamples.set(false);
  }

  /**
   * 点击"例字"表头，循环播放所有例字
   * 按组播放：第一组6个声调 -> 第二组6个声调 -> ...
   */
  async playAllExamples(event: Event): Promise<void> {
    event.stopPropagation();
    
    // 如果正在播放，则停止
    if (this.isPlayingAllExamples()) {
      this.stopAllExamplesPlayback();
      return;
    }

    this.isPlayingAllExamples.set(true);
    this.stopPlayback = false;
    this.ttsService.reset(); // 重置取消状态，确保可以播放

    const groups = this.exampleGroups().slice(0, 4);
    const tones = this.toneDataService.tonesData;

    // 按组循环播放
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      if (this.stopPlayback) break;
      
      const group = groups[groupIndex];
      
      // 播放该组的6个声调
      for (let toneIndex = 0; toneIndex < tones.length; toneIndex++) {
        if (this.stopPlayback) break;
        
        const tone = tones[toneIndex];
        const example = group.examples[toneIndex];
        
        if (example) {
          this.selectedTone.set(tone.number);
          this.showHighlightChar(tone.number, example.char, example.jyutping);
          await this.ttsService.speak(example.char);
          await this.delay(200);
        }
      }
      
      // 组间稍作停顿
      if (groupIndex < groups.length - 1 && !this.stopPlayback) {
        await this.delay(400);
      }
    }

    this.hideHighlightChar();
    this.isPlayingAllExamples.set(false);
  }

  /**
   * 停止播放所有例字
   */
  stopAllExamplesPlayback(): void {
    this.stopPlayback = true;
    this.ttsService.stop();
    this.hideHighlightChar();
    this.isPlayingAllExamples.set(false);
  }
}
