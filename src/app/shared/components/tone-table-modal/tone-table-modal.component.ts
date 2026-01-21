import { Component, ChangeDetectionStrategy, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ToneDataService } from '../../../core/services/tone-data.service';
import { ToneData } from '../../../core/interfaces/tone.interfaces';

/**
 * 声调表格弹窗组件
 * 显示六声调表格，支持点击播放
 */
@Component({
  selector: 'app-tone-table-modal',
  templateUrl: './tone-table-modal.component.html',
  styleUrls: ['./tone-table-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule]
})
export class ToneTableModalComponent {
  private readonly toneDataService = inject(ToneDataService);

  // 输入属性
  isOpen = input<boolean>(false);

  // 输出事件
  closed = output<void>();
  toneSelected = output<number>();

  // 内部状态
  protected readonly selectedTone = signal<number | null>(2);
  
  // 高亮显示的字
  protected readonly highlightChar = signal<string | null>(null);
  protected readonly highlightJyutping = signal<string | null>(null);
  protected readonly highlightToneName = signal<string | null>(null);
  protected readonly highlightCharColor = signal<string | null>(null);

  // 数据
  protected readonly tonesData: ToneData[] = this.toneDataService.tonesData;
  protected readonly toneColorRgb = this.toneDataService.toneColorRgb;
  protected readonly pitchLevels = [5, 4, 3, 2, 1];

  /**
   * 关闭弹窗
   */
  close(): void {
    this.hideHighlightChar();
    this.closed.emit();
  }

  /**
   * 选择声调
   */
  selectTone(toneNumber: number): void {
    this.selectedTone.set(toneNumber);
    this.toneSelected.emit(toneNumber);
  }

  /**
   * 获取调值
   */
  getToneValue(toneNumber: number): string {
    return this.toneDataService.getToneValue(toneNumber);
  }

  /**
   * 检查音高是否激活
   */
  isPitchActive(toneNumber: number, pitch: number): boolean {
    return this.toneDataService.isPitchActive(toneNumber, pitch);
  }

  /**
   * 显示高亮字
   */
  showHighlightChar(char: string, jyutping: string, toneName: string, color: string): void {
    this.highlightChar.set(char);
    this.highlightJyutping.set(jyutping);
    this.highlightToneName.set(toneName);
    this.highlightCharColor.set(color);
  }

  /**
   * 隐藏高亮字
   */
  hideHighlightChar(): void {
    this.highlightChar.set(null);
    this.highlightJyutping.set(null);
    this.highlightToneName.set(null);
    this.highlightCharColor.set(null);
  }
}
