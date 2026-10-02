import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/**
 * 右侧边栏按钮组件
 * 包含听、辨、说三个功能按钮
 */
@Component({
  selector: 'app-side-action-buttons',
  template: `
    <div class="side-action-buttons">
      <!-- 听按钮 -->
      <button class="side-action-btn" (click)="onReplayClick()">
        <svg class="side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
        </svg>
        <span>听</span>
      </button>
      
      <!-- 辨按钮 -->
      @if (hasExamples()) {
        <button class="side-action-btn" (click)="onChallengeClick()">
          <svg class="side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10.5"/>
            <path d="M12 19v3"/>
          </svg>
          <span>辨</span>
        </button>
      }
      
      <!-- 说按钮（录音矫正） -->
      @if (hasExamples()) {
        <button class="side-action-btn" (click)="onRecordingClick()">
          <svg class="side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <path d="M12 19v4"/>
            <path d="M8 23h8"/>
          </svg>
          <span>说</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .side-action-buttons {
      position: fixed;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .side-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      color: rgba(255, 255, 255, 0.9);
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
      }
      
      &:active {
        transform: scale(0.95);
      }
      
      .side-icon {
        width: 20px;
        height: 20px;
        margin-bottom: 2px;
      }
      
      span {
        font-size: 11px;
        font-weight: 600;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule]
})
export class SideActionButtonsComponent {
  // 输入属性
  hasExamples = input<boolean>(false);

  // 输出事件
  replayClicked = output<void>();
  challengeClicked = output<void>();
  recordingClicked = output<void>();

  onReplayClick(): void {
    this.replayClicked.emit();
  }

  onChallengeClick(): void {
    this.challengeClicked.emit();
  }

  onRecordingClick(): void {
    this.recordingClicked.emit();
  }
}
