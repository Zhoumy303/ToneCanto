# ToneCanto v2.0 - 粤调通

> 一眼看透九声六调 - 专业的粤语声调学习应用

## 📱 项目简介

ToneCanto（粤调通）是一款专注于粤语声调学习的移动应用，通过可视化波形图和智能练习系统，帮助用户快速掌握粤语的九声六调。

### ✨ 核心特性

- 🎵 **可视化波形图** - 直观展示声调变化曲线
- 🎧 **听音练习** - 播放标准粤语发音
- 🎯 **辨音挑战** - 智能声调识别训练
- 📊 **智能错题本** - 自动记录易错声调
- 🔄 **AB对比学习** - 多字符声调对比
- 📧 **版本更新订阅** - 第一时间获取新版本通知

## 🛠️ 技术栈

- **前端框架**: Angular 20.0
- **移动端**: Ionic 8.0 + Capacitor 8.0
- **UI组件**: Ionic Components
- **数据可视化**: D3.js 7.9
- **音频处理**: Web Audio API
- **语言**: TypeScript 5.9
- **构建工具**: Vite
- **包管理**: npm

## 📦 项目结构

```
src/
├── app/
│   ├── core/                    # 核心模块
│   │   ├── interfaces/          # TypeScript 接口定义
│   │   └── services/            # 核心服务
│   │       ├── api.service.ts           # API 服务
│   │       ├── auth.service.ts          # 认证服务
│   │       ├── challenge.service.ts     # 挑战模式服务
│   │       ├── tone-data.service.ts     # 声调数据服务
│   │       ├── tts.service.ts           # 语音合成服务
│   │       ├── waveform.service.ts      # 波形绘制服务
│   │       └── ...
│   ├── shared/                  # 共享组件
│   │   └── components/          # 可复用组件
│   ├── tones/                   # 主要学习页面
│   ├── tone-table/              # 声调表页面
│   ├── legal/                   # 法律条款页面
│   └── ...
├── assets/                      # 静态资源
│   ├── audio/                   # 音频文件
│   └── icon/                    # 图标资源
├── environments/                # 环境配置
└── theme/                       # 主题样式
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Angular CLI >= 20.0.0
- Ionic CLI >= 8.0.0

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd tonecanto-v2

# 安装依赖
npm install

# 安装 Ionic CLI（如果未安装）
npm install -g @ionic/cli
```

### 开发环境

```bash
# 启动开发服务器
npm start
# 或
ionic serve

# 在浏览器中访问 http://localhost:8100
```

### 构建项目

```bash
# 构建生产版本
npm run build

# 构建并预览
npm run build && ionic serve --prod
```

### 移动端开发

```bash
# 添加平台
ionic capacitor add ios
ionic capacitor add android

# 构建并同步到移动端
ionic capacitor build ios
ionic capacitor build android

# 在 IDE 中打开
ionic capacitor open ios
ionic capacitor open android
```

## 🎯 主要功能

### 1. 声调学习
- **波形可视化**: 实时显示声调变化曲线
- **例字练习**: 150+ 组精选粤语例字
- **真人发音**: 标准粤语音频资源

### 2. 听音辨调
- **智能挑战**: 随机声调识别测试
- **难度递进**: 从简单到复杂的学习路径
- **实时反馈**: 即时显示答题结果

### 3. 对比学习
- **AB对比**: 选择多个字符进行声调对比
- **可视化差异**: 直观展示不同声调的区别
- **循环播放**: 支持重复播放加深印象

### 4. 个性化设置
- **语音选择**: 支持多种粤语语音
- **播放速度**: 可调节音频播放速度
- **主题切换**: 多种界面主题选择

## 🔧 配置说明

### 环境配置

项目使用环境变量进行配置，主要配置文件：

- `src/environments/environment.ts` - 开发环境
- `src/environments/environment.prod.ts` - 生产环境

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8888'  // 后端 API 地址
};
```

### API 接口

应用需要后端 API 支持以下功能：

- `GET /api/tones/getToneGroups` - 获取声调组数据
- `POST /api/subscription/subscribe` - 邮箱订阅
- `GET /api/tones/audio-url/:jyutping` - 获取音频 URL
- 更多接口详见 `src/app/core/services/api.service.ts`

## 📱 支持平台

- ✅ **Web 浏览器** (Chrome, Safari, Firefox, Edge)
- ✅ **iOS** (iOS 13+)
- ✅ **Android** (Android 7.0+)

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 Angular 官方代码风格
- 使用 ESLint 进行代码检查
- 组件和服务需要添加适当的注释

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👥 作者

- **周金根** - 项目创建者和主要开发者
- **周墨逸** - 项目贡献者

## 🔗 相关链接

- [官方网站](https://neihou.cn/app/tonecanto)
- [用户协议](src/app/legal/user-agreement/)
- [隐私政策](src/app/legal/privacy-policy/)

## 📞 联系我们

如有问题或建议，请通过以下方式联系：

- 📧 邮箱订阅: 在应用内 VIP 窗口订阅更新通知
- 🌐 官网: https://neihou.cn/tonecanto

---

**ToneCanto v2.0** - 让粤语学习更简单、更有趣！ 🎉