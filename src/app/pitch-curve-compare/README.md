# 音高曲线对比页面 (Pitch Curve Compare Page)

## 概述

这是一个专门用于展示和对比音高曲线的页面。用户可以通过 tones 页面左下角的音高曲线图按钮打开此页面，查看当前示例组所有字的发音音高轨迹。

## 组件结构

### PitchCurveComparePage

主要组件，负责：
- 页面初始化和数据加载
- 波形绘制和管理
- 音频播放控制
- 用户交互处理

## 主要功能

### 1. 波形展示
- 显示当前示例组所有字符的音高曲线
- 使用 SVG 绘制，支持动画效果
- 显示音高刻度（1-5 声调）
- 显示粤拼和含义信息

### 2. 音频播放
- 依次播放所有字符
- 支持播放速度调整
- 支持循环播放
- 实时显示当前播放的字符

### 3. 播放控制
- 播放/停止按钮
- 循环播放开关
- 播放速度选择器
- 返回按钮

## 音频获取逻辑

### 与 tones 页面相同的实现

```typescript
// 获取全局播放速度
const globalSpeed = this.playbackSpeedService.getCurrentSpeed();

// 播放字符音频
await this.ttsService.speak(
  example.char,           // 要播放的字符
  { rate: globalSpeed },  // 播放选项（速度）
  example.jyutping        // 粤拼（用于真人发音模式）
);
```

### TtsService 的处理流程

1. **检查语音类型**
   - 如果是真人发音 + 有粤拼 → 调用 `speakHuman()`
   - 否则 → 调用 `speakWeb()` 或原生 TTS

2. **真人发音流程**
   - 通过 `HumanAudioCacheService` 获取音频 URL
   - 创建 Audio 元素播放
   - 应用音量增益
   - 设置播放速度

3. **TTS 合成流程**
   - 获取系统语音列表
   - 创建 SpeechSynthesisUtterance
   - 设置语言、速度、音量等参数
   - 调用 speechSynthesis.speak()

## 状态管理

### 信号 (Signals)

```typescript
// 示例组数据
exampleGroups: Signal<ExampleGroup[]>
currentRowExamples: Signal<ToneExample[]>
currentRowIndex: Signal<number>

// 播放状态
playingChar: Signal<string | null>
isPlaying: Signal<boolean>
loopPlay: Signal<boolean>

// UI 状态
showSpeedSelector: Signal<boolean>
```

### 计算属性 (Computed)

```typescript
// 从波形服务获取标记数据
characterMarkers: Computed<CharacterMarker[]>
hasWaveformData: Computed<boolean>

// 从主题服务获取主题数据
currentTheme: Computed<string>
```

## 播放流程详解

### 开始播放

```
startPlayback()
  ↓
playAllCharactersOnce(sessionId)
  ↓
for each character:
  - 设置 playingChar
  - 重放波形动画
  - 调用 ttsService.speak()
  - 等待 300ms
  ↓
if (loopPlay && isPlaying):
  startPlaybackLoop(sessionId)
```

### 循环播放

```
startPlaybackLoop(sessionId)
  ↓
setTimeout(1000ms)
  ↓
playAllCharactersOnce(sessionId)
  ↓
if (loopPlay && isPlaying):
  startPlaybackLoop(sessionId)
```

### 停止播放

```
stopPlayback()
  ↓
- 设置 playbackCancelled = true
- 设置 isPlaying = false
- 清除 loopTimer
- 调用 ttsService.stop()
```

## 样式设计

### 主题支持
- 亮色主题：白色背景，深色文字
- 暗色主题：深色背景，浅色文字

### 响应式设计
- 桌面版：完整的工具栏和控制栏
- 移动版：紧凑的布局，优化的按钮大小

### 动画效果
- 波形绘制动画：1.5s 的 drawPath 动画
- 字符圆圈：scaleIn 动画
- 文字：fadeIn 动画
- 播放时的发光效果：drop-shadow 滤镜

## 关键方法

### 初始化
- `initPitchCurvePage()` - 初始化页面
- `drawAllWaveforms()` - 绘制所有波形

### 播放控制
- `startPlayback()` - 开始播放
- `stopPlayback()` - 停止播放
- `togglePlayback()` - 切换播放/停止
- `playAllCharactersOnce()` - 播放一次所有字符
- `startPlaybackLoop()` - 开始循环播放

### 速度控制
- `toggleSpeedSelector()` - 切换速度选择器
- `selectSpeed()` - 选择播放速度

### 其他
- `toggleLoopPlay()` - 切换循环播放
- `goBack()` - 返回到 tones 页面

## 集成点

### 与 tones 页面的关系
- 通过 `openPitchCurveComparison()` 方法打开
- 共享相同的音频播放逻辑
- 使用相同的波形绘制服务
- 使用相同的播放速度设置

### 与其他服务的关系
- `TtsService` - 音频播放
- `WaveformService` - 波形绘制
- `PlaybackSpeedService` - 播放速度管理
- `ThemeService` - 主题管理
- `VoiceSelectionService` - 语音选择

## 性能考虑

1. **内存管理**
   - 页面销毁时清理所有定时器
   - 停止音频播放
   - 取消未完成的播放会话

2. **动画优化**
   - 使用 CSS 动画而非 JavaScript 动画
   - 使用 `ChangeDetectionStrategy.OnPush` 优化变更检测

3. **播放优化**
   - 使用 sessionId 追踪播放会话
   - 支持中断和取消播放
   - 避免重复播放

## 测试建议

1. **功能测试**
   - 验证播放/停止功能
   - 验证循环播放
   - 验证播放速度调整
   - 验证返回导航

2. **集成测试**
   - 验证与 tones 页面的集成
   - 验证音频播放的正确性
   - 验证波形动画的流畅性

3. **兼容性测试**
   - 测试不同浏览器
   - 测试移动设备
   - 测试不同主题

## 已知限制

1. 页面只能在选择真人发音时打开
2. 播放速度受系统 Audio 元素支持的限制
3. 波形绘制依赖于 WaveformService 的实现
