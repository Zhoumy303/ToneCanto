import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

interface ToneData {
  number: string;
  example: string;
  name: string;
  maleRange: string;
  femaleRange: string;
  malePercent: number;
  femalePercent: number;
  desc: string;
  isShort: boolean;
}

@Component({
  selector: 'app-tone-frequency-modal',
  templateUrl: './tone-frequency-modal.component.html',
  styleUrls: ['./tone-frequency-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule]
})
export class ToneFrequencyModalComponent {
  readonly isOpen = signal(false);
  readonly selectedGender = signal<'male' | 'female'>('male');  // 默认选中男声

  readonly tonesData: ToneData[] = [
    { number: '1', example: '诗 si1', name: '高平/降 (阴平)', maleRange: '140-150 Hz', femaleRange: '180-270 Hz', malePercent: 85, femalePercent: 85, desc: '像说普通话的"妈"一样高', isShort: false },
    { number: '2', example: '史 si2', name: '中高升 (阴上)', maleRange: '100→140 Hz', femaleRange: '180→250 Hz', malePercent: 65, femalePercent: 65, desc: '像疑问的语气"嗯？"', isShort: false },
    { number: '3', example: '试 si3', name: '中平 (阴去)', maleRange: '110-120 Hz', femaleRange: '200-210 Hz', malePercent: 70, femalePercent: 70, desc: '平稳的中音', isShort: false },
    { number: '4', example: '时 si4', name: '低降 (阳平)', maleRange: '100→80 Hz', femaleRange: '180→150 Hz', malePercent: 30, femalePercent: 30, desc: '像叹气"哎"', isShort: false },
    { number: '5', example: '市 si5', name: '低升 (阳上)', maleRange: '80→110 Hz', femaleRange: '150→190 Hz', malePercent: 35, femalePercent: 35, desc: '从低处疑问"啊？"', isShort: false },
    { number: '6', example: '是 si6', name: '低平 (阳去)', maleRange: '90-100 Hz', femaleRange: '160-170 Hz', malePercent: 45, femalePercent: 45, desc: '沉稳的低音', isShort: false },
    { number: '7/8/9', example: '入声', name: '短促音', maleRange: '同1/3/6调高', femaleRange: '同1/3/6调高', malePercent: 50, femalePercent: 50, desc: '发音短急，带p/t/k尾', isShort: true }
  ];

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectGender(gender: 'male' | 'female'): void {
    this.selectedGender.set(gender);
  }
}
