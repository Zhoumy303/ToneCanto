import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PitchCompareComponent } from '../shared/components';
import { ApiService } from '../core/services/api.service';

interface AudioItem {
  jyutping: string;
  format: string;
  file_size: number;
  url: string;
}

@Component({
  selector: 'app-waveform-demo',
  templateUrl: './waveform-demo.page.html',
  styleUrls: ['./waveform-demo.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonicModule, PitchCompareComponent]
})
export class WaveformDemoPage {
  @ViewChild('pitchCompare') pitchCompareComponent!: PitchCompareComponent;

  private readonly apiService = inject(ApiService);

  readonly jyutpingInput = signal<string>('');
  readonly selectedAudios = signal<AudioItem[]>([]);
  readonly isLoadingAudios = signal(false);
  readonly errorMessage = signal<string>('');
  readonly isAutoLoading = signal(false);

  readonly hasAudios = computed(() => this.selectedAudios().length > 0);

  loadAudiosByJyutpings(): void {
    const input = this.jyutpingInput().trim();
    if (!input) {
      this.errorMessage.set('请输入粤拼');
      return;
    }

    // 解析粤拼列表（支持逗号、空格、换行分隔）
    const jyutpings = input
      .split(/[,\s\n]+/)
      .map(j => j.trim())
      .filter(j => j.length > 0);

    if (jyutpings.length === 0) {
      this.errorMessage.set('请输入有效的粤拼');
      return;
    }

    this.isLoadingAudios.set(true);
    this.errorMessage.set('');

    this.apiService.getAudiosByJyutpings(jyutpings).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          // 收集所有音频文件
          const audios: AudioItem[] = [];
          
          Object.entries(response.data).forEach(([key, item]: any) => {
            if (item.success) {
              if (item.tones) {
                // 不带调值的粤拼，返回了多个调值
                Object.values(item.tones).forEach((tone: any) => {
                  if (tone.success) {
                    audios.push({
                      jyutping: tone.jyutping,
                      format: tone.format,
                      file_size: tone.file_size,
                      url: tone.url
                    });
                  }
                });
              } else {
                // 带调值的粤拼，直接返回
                audios.push({
                  jyutping: item.jyutping,
                  format: item.format,
                  file_size: item.file_size,
                  url: item.url
                });
              }
            }
          });

          if (audios.length === 0) {
            this.errorMessage.set('没有找到对应的音频文件');
            this.isLoadingAudios.set(false);
          } else {
            this.selectedAudios.set(audios);
            // 自动加载所有音频到 pitch-compare 组件
            this.autoLoadAudios(audios);
          }
        } else {
          this.errorMessage.set(response.message || '获取音频失败');
          this.isLoadingAudios.set(false);
        }
      },
      error: (error) => {
        console.error('获取音频失败:', error);
        this.errorMessage.set('网络连接失败，请重试');
        this.isLoadingAudios.set(false);
      }
    });
  }

  private autoLoadAudios(audios: AudioItem[]): void {
    this.isAutoLoading.set(true);
    
    // 延迟加载，确保 pitch-compare 组件已初始化
    setTimeout(() => {
      audios.forEach((audio, index) => {
        // 延迟加载每个音频，避免同时加载导致的问题
        setTimeout(() => {
          if (this.pitchCompareComponent) {
            this.pitchCompareComponent.addTrack(audio.url, audio.jyutping);
          }
        }, index * 200); // 每个音频延迟 200ms
      });

      // 所有音频加载完成后
      setTimeout(() => {
        this.isAutoLoading.set(false);
        this.isLoadingAudios.set(false);
      }, audios.length * 200 + 500);
    }, 100);
  }

  clearAudios(): void {
    this.selectedAudios.set([]);
    this.jyutpingInput.set('');
    this.errorMessage.set('');
    
    // 清空 pitch-compare 组件中的所有音轨
    if (this.pitchCompareComponent) {
      this.pitchCompareComponent.clearAll();
    }
  }

  removeAudio(jyutping: string): void {
    this.selectedAudios.update(audios =>
      audios.filter(a => a.jyutping !== jyutping)
    );
  }

  onTrackAdded(track: unknown): void {
    console.log('音轨已添加:', track);
  }

  onTrackRemoved(trackId: string): void {
    console.log('音轨已移除:', trackId);
  }

  onError(message: string): void {
    console.error('错误:', message);
  }
}
