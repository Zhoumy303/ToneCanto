import { Injectable, signal, computed } from '@angular/core';
import { Theme } from '../interfaces/tone.interfaces';

/**
 * 主题服务
 * 管理应用主题切换、样式和本地存储
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // 本地存储键名
  private readonly THEME_KEY = 'app-theme';
  private readonly RANDOM_THEME_KEY = 'random-theme';

  // 主题状态
  private readonly _currentTheme = signal<string>('ocean');
  private readonly _randomTheme = signal<boolean>(true);
  private readonly _showThemeSelector = signal<boolean>(false);

  // 公开只读信号
  readonly currentTheme = this._currentTheme.asReadonly();
  readonly randomTheme = this._randomTheme.asReadonly();
  readonly showThemeSelector = this._showThemeSelector.asReadonly();

  // 主题列表
  readonly themes: Theme[] = [
    // 蓝色系
    { id: 'ocean', name: '海洋', gradient: 'linear-gradient(135deg, #023e8a 0%, #0077b6 100%)' },
    { id: 'arctic', name: '冰川', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #67e8f9 100%)' },
    { id: 'night', name: '深夜', gradient: 'linear-gradient(135deg, #0c1222 0%, #2d4a6f 100%)' },
    { id: 'midnight', name: '午夜', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
    { id: 'teal', name: '青碧', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' },
    // 绿色系
    { id: 'forest', name: '森林', gradient: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' },
    { id: 'moss', name: '苔藓', gradient: 'linear-gradient(135deg, #365314 0%, #84cc16 100%)' },
    { id: 'aurora', name: '极光', gradient: 'linear-gradient(135deg, #00d4aa 0%, #7c3aed 100%)' },
    // 紫色系
    { id: 'purple', name: '紫罗兰', gradient: 'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)' },
    { id: 'lavender', name: '薰衣草', gradient: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)' },
    // 粉红色系
    { id: 'rose', name: '玫瑰', gradient: 'linear-gradient(135deg, #be185d 0%, #f472b6 100%)' },
    { id: 'cherry', name: '樱花', gradient: 'linear-gradient(135deg, #fda4af 0%, #f472b6 100%)' },
    // 红橙色系
    { id: 'wine', name: '酒红', gradient: 'linear-gradient(135deg, #881337 0%, #be123c 100%)' },
    { id: 'sunset', name: '日落', gradient: 'linear-gradient(135deg, #d62828 0%, #f77f00 100%)' },
    { id: 'ember', name: '余烬', gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)' },
    { id: 'coral', name: '珊瑚', gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)' },
    // 中性色系
    { id: 'slate', name: '石板灰', gradient: 'linear-gradient(135deg, #475569 0%, #64748b 100%)' },
    { id: 'ivory', name: '象牙白', gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }
  ];

  constructor() {
    this.loadSavedTheme();
  }

  /**
   * 打开主题选择器
   */
  openThemeSelector(): void {
    this._showThemeSelector.set(true);
  }

  /**
   * 关闭主题选择器
   */
  closeThemeSelector(): void {
    this._showThemeSelector.set(false);
  }

  /**
   * 切换随机主题模式
   */
  toggleRandomTheme(): void {
    const newValue = !this._randomTheme();
    this._randomTheme.set(newValue);
    localStorage.setItem(this.RANDOM_THEME_KEY, newValue ? 'true' : 'false');
    
    if (newValue) {
      this.applyRandomTheme();
    }
  }

  /**
   * 选择主题
   */
  selectTheme(themeId: string): void {
    if (this._randomTheme()) return;
    
    this._currentTheme.set(themeId);
    this._showThemeSelector.set(false);
    
    // 保存到本地存储
    localStorage.setItem(this.THEME_KEY, themeId);
    
    // 应用主题
    this.applyTheme(themeId);
  }

  /**
   * 应用随机主题
   */
  applyRandomTheme(): void {
    const randomIndex = Math.floor(Math.random() * this.themes.length);
    const randomThemeId = this.themes[randomIndex].id;
    this._currentTheme.set(randomThemeId);
    this.applyTheme(randomThemeId);
  }

  /**
   * 应用主题到 DOM
   */
  private applyTheme(themeId: string): void {
    document.body.setAttribute('data-theme', themeId);
  }

  /**
   * 加载保存的主题设置
   */
  private loadSavedTheme(): void {
    // 加载随机主题设置
    const savedRandomTheme = localStorage.getItem(this.RANDOM_THEME_KEY);
    const isRandom = savedRandomTheme !== 'false'; // 默认为 true
    this._randomTheme.set(isRandom);
    
    if (isRandom) {
      this.applyRandomTheme();
    } else {
      const savedTheme = localStorage.getItem(this.THEME_KEY);
      if (savedTheme) {
        this._currentTheme.set(savedTheme);
        this.applyTheme(savedTheme);
      }
    }
  }

  /**
   * 获取主题渐变样式
   */
  getThemeGradient(themeId: string): string {
    const theme = this.themes.find(t => t.id === themeId);
    return theme?.gradient || this.themes[0].gradient;
  }

  /**
   * 获取当前主题的渐变样式
   */
  getCurrentThemeGradient(): string {
    return this.getThemeGradient(this._currentTheme());
  }
}
