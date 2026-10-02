import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.neihou.tonecanto',
  appName: '粤调通',
  webDir: 'www',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000'
    }
  },
  android: {
    // 全屏模式，隐藏状态栏
    backgroundColor: '#000000'
  },
  ios: {
    // 全屏模式
    backgroundColor: '#000000'
  }
  // server: {
  //   // 开发模式：Android 模拟器使用 10.0.2.2 访问宿主机
  //   // 如果是真机调试，改为电脑的局域网 IP（如 192.168.0.103）
  //   url: 'http://192.168.0.103:8100',
  //   cleartext: true
  // }
};

export default config;
