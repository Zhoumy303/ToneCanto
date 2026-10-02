import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径，避免绝对路径问题
  base: './',
  
  // 开发服务器配置
  server: {
    port: 4200,
    host: 'localhost',
    // 启用 CORS
    cors: true,
    // 添加必要的 headers
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // 构建配置
  build: {
    // 目标为现代浏览器
    target: 'esnext',
    // 启用 source map
    sourcemap: true,
    // 构建输出配置
    rollupOptions: {
      output: {
        // 简化的 chunk 分割策略
        manualChunks: (id) => {
          // 将所有 node_modules 放入 vendor chunk
          if (id.includes('node_modules')) {
            // Ionic 单独分包
            if (id.includes('@ionic')) {
              return 'ionic';
            }
            // Angular 单独分包
            if (id.includes('@angular')) {
              return 'angular';
            }
            // 其他第三方库
            return 'vendor';
          }
          // 页面组件分包
          if (id.includes('/src/app/') && id.includes('.page.')) {
            return 'pages';
          }
        }
      }
    }
  },
  
  // 依赖优化
  optimizeDeps: {
    // 预构建关键依赖
    include: [
      '@ionic/angular',
      '@ionic/angular/standalone',
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/platform-browser'
    ],
    // 强制重新构建
    force: true
  },
  
  // 解析配置
  resolve: {
    // 确保扩展名解析
    extensions: ['.ts', '.js', '.json']
  }
});