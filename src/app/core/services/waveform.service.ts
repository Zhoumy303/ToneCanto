import { Injectable, inject, signal } from '@angular/core';
import { ToneDataService } from './tone-data.service';
import { ToneExample, CharacterPosition, CharacterMarker } from '../interfaces/tone.interfaces';

/**
 * 波形服务
 * 管理波形绘制、路径计算和动画逻辑
 */
@Injectable({
  providedIn: 'root'
})
export class WaveformService {
  private readonly toneDataService = inject(ToneDataService);

  // 波形状态
  private readonly _characterMarkers = signal<CharacterMarker[]>([]);
  private readonly _waveformPath = signal<string>('');
  private readonly _hasWaveformData = signal<boolean>(false);

  // 公开只读信号
  readonly characterMarkers = this._characterMarkers.asReadonly();
  readonly waveformPath = this._waveformPath.asReadonly();
  readonly hasWaveformData = this._hasWaveformData.asReadonly();

  /**
   * 准备波形画布（清空数据）
   */
  prepareCanvas(): void {
    this._waveformPath.set('');
    this._characterMarkers.set([]);
  }

  /**
   * 绘制所有字符的波形
   */
  drawAllWaveforms(examples: ToneExample[]): void {
    this.prepareCanvas();
    
    for (let i = 0; i < examples.length; i++) {
      this.drawCharacterWaveformSegment(i, examples);
    }
  }

  /**
   * 绘制单个字符的波形段
   */
  drawCharacterWaveformSegment(characterIndex: number, examples: ToneExample[]): CharacterMarker | null {
    if (characterIndex >= examples.length) return null;

    const example = examples[characterIndex];
    const toneNumber = this.toneDataService.getEffectiveToneNumber(example.jyutping);
    const toneData = this.toneDataService.getToneDataByNumber(toneNumber);

    if (!toneData) return null;

    const positions = this.calculateCharacterPositions(examples);
    const pos = positions[characterIndex];

    // 获取该字声调的详细路径点
    const tonePoints = this.getToneDetailPoints(toneData.pitch_pattern, pos.startX, pos.endX, 16);

    // 生成路径
    const segmentPath = this.generateSmoothPath(tonePoints);

    // 计算路径长度用于动画
    const pathLength = this.calculatePathLength(tonePoints);

    // 添加到标记数组
    const centerY = this.getPitchY(toneData.pitch_pattern, 0.5);
    const marker: CharacterMarker = {
      index: characterIndex,
      char: example.char,
      jyutping: example.jyutping,
      meaning: example.meaning,
      color: toneData.color,
      toneName: toneData.name.split(' / ')[1],
      centerX: pos.centerX,
      centerY: centerY,
      path: segmentPath,
      pathLength: pathLength,
      animationDelay: characterIndex * 0.1,
      isAnimating: true
    };

    // 更新标记数组
    this._characterMarkers.update((markers: CharacterMarker[]) => [...markers, marker]);
    this._hasWaveformData.set(true);

    return marker;
  }

  /**
   * 计算所有字符的波形位置
   */
  calculateCharacterPositions(rowExamples: ToneExample[]): CharacterPosition[] {
    const totalWidth = 600;
    
    let totalWeight = 0;
    rowExamples.forEach(example => {
      totalWeight += this.toneDataService.isRushingTone(example.jyutping) ? 0.5 : 1;
    });
    
    const unitWidth = totalWidth / totalWeight;
    const padding = unitWidth * 0.05;
    
    const positions: CharacterPosition[] = [];
    let currentX = 75;
    
    rowExamples.forEach((example, index) => {
      const isRushing = this.toneDataService.isRushingTone(example.jyutping);
      const weight = isRushing ? 0.5 : 1;
      const charWidth = unitWidth * weight - padding;
      
      const startX = currentX + (padding / 2);
      const endX = startX + charWidth;
      const centerX = startX + (charWidth / 2);
      
      positions.push({
        index,
        startX,
        endX,
        centerX,
        charWidth,
        isRushing
      });
      
      currentX += unitWidth * weight;
    });
    
    return positions;
  }

  /**
   * 获取声调的详细路径点
   */
  getToneDetailPoints(pitchPattern: string, startX: number, endX: number, steps: number = 12): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    
    // Y坐标映射：5=70, 4=102, 3=134, 2=166, 1=198
    const pitchMaps: { [key: string]: { start: number; end: number; curve: string } } = {
      '55': { start: 70, end: 70, curve: 'flat' },      // 高平调 - 第5线
      '35': { start: 134, end: 70, curve: 'rising' },   // 高升调 - 从3升到5
      '33': { start: 134, end: 134, curve: 'flat' },    // 中平调 - 第3线
      '21': { start: 166, end: 198, curve: 'falling' }, // 低降调 - 从2降到1
      '13': { start: 198, end: 134, curve: 'rising' },  // 低升调 - 从1升到3
      '22': { start: 166, end: 166, curve: 'flat' },    // 低平调 - 第2线
      '5': { start: 70, end: 70, curve: 'flat' },       // 阴入 - 第5线
      '3': { start: 134, end: 134, curve: 'flat' },     // 中入 - 第3线
      '2': { start: 166, end: 166, curve: 'flat' }      // 阳入 - 第2线
    };
    
    const pitch = pitchMaps[pitchPattern] || { start: 114, end: 114, curve: 'flat' };
    
    for (let i = 0; i <= steps; i++) {
      const position = i / steps;
      const x = startX + (endX - startX) * position;
      let y: number;
      
      switch (pitch.curve) {
        case 'flat':
          y = pitch.start;
          break;
        case 'rising':
        case 'falling':
          const progress = this.easeInOutCubic(position);
          y = pitch.start + (pitch.end - pitch.start) * progress;
          break;
        default:
          y = pitch.start + (pitch.end - pitch.start) * position;
      }
      
      // 添加自然变化（非平调）
      if (pitch.curve !== 'flat' && i > 0 && i < steps) {
        const naturalVariation = Math.sin(position * Math.PI * 3) * 2;
        y += naturalVariation;
      }
      
      points.push({ x, y });
    }
    
    return points;
  }

  /**
   * 缓入缓出三次贝塞尔曲线函数
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * 生成平滑路径
   */
  generateSmoothPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      if (i === 1) {
        const cpx = prev.x + (curr.x - prev.x) * 0.5;
        const cpy = prev.y + (curr.y - prev.y) * 0.5;
        path += ` Q ${cpx} ${cpy}, ${curr.x} ${curr.y}`;
      } else if (i === points.length - 1) {
        path += ` L ${curr.x} ${curr.y}`;
      } else if (next) {
        const cp1x = prev.x + (curr.x - prev.x) * 0.3;
        const cp1y = prev.y + (curr.y - prev.y) * 0.3;
        const cp2x = curr.x - (next.x - prev.x) * 0.1;
        const cp2y = curr.y - (next.y - prev.y) * 0.1;
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }
    
    return path;
  }

  /**
   * 计算路径长度
   */
  calculatePathLength(points: { x: number; y: number }[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * 根据音高模式获取Y坐标
   */
  getPitchY(pitchPattern: string, position: number = 0.5): number {
    // Y坐标映射：5=70, 4=102, 3=134, 2=166, 1=198
    const pitchMaps: { [key: string]: { start: number; end: number } } = {
      '55': { start: 70, end: 70 },      // 高平调 - 第5线
      '35': { start: 134, end: 70 },     // 高升调 - 从3升到5
      '33': { start: 134, end: 134 },    // 中平调 - 第3线
      '21': { start: 166, end: 198 },    // 低降调 - 从2降到1
      '13': { start: 198, end: 134 },    // 低升调 - 从1升到3
      '22': { start: 166, end: 166 },    // 低平调 - 第2线
      '5': { start: 70, end: 70 },       // 阴入 - 第5线
      '3': { start: 134, end: 134 },     // 中入 - 第3线
      '2': { start: 166, end: 166 }      // 阳入 - 第2线
    };
    
    const pitch = pitchMaps[pitchPattern] || { start: 114, end: 114 };
    return pitch.start + (pitch.end - pitch.start) * position;
  }

  /**
   * 重播波形线条动画（通过 DOM 操作）
   */
  replayWaveformLineAnimation(index: number): void {
    const paths = document.querySelectorAll('#characterMarkers .character-waveform-path');
    const pathEl = paths[index] as SVGPathElement;
    if (pathEl) {
      pathEl.classList.remove('animating');
      // 强制重绘 SVG 元素
      pathEl.getBoundingClientRect();
      pathEl.classList.add('animating');
    }
  }

  /**
   * 设置字符标记的循环动画状态
   */
  setLoopAnimating(indices: number[], isLoopAnimating: boolean): void {
    this._characterMarkers.update((markers: CharacterMarker[]) => 
      markers.map((marker: CharacterMarker, i: number) => ({
        ...marker,
        isLoopAnimating: indices.includes(i) ? isLoopAnimating : marker.isLoopAnimating
      }))
    );
  }

  /**
   * 清除所有循环动画状态
   */
  clearAllLoopAnimating(): void {
    this._characterMarkers.update((markers: CharacterMarker[]) => 
      markers.map((marker: CharacterMarker) => ({
        ...marker,
        isLoopAnimating: false
      }))
    );
  }

  /**
   * 获取标记数据（用于兼容旧代码）
   */
  getMarkers(): CharacterMarker[] {
    return this._characterMarkers();
  }

  /**
   * 重置波形数据
   */
  reset(): void {
    this._characterMarkers.set([]);
    this._waveformPath.set('');
    this._hasWaveformData.set(false);
  }
}
