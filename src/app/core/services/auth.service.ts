import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

export interface UserInfo {
  id: string;
  nickname: string;
  avatar: string;
  openid?: string;
  createdAt?: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: UserInfo | null;
  token: string | null;
}

// 微信SDK响应类型
interface WechatAuthResponse {
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl;
  private readonly STORAGE_KEY = 'auth_state';
  
  private authState = new BehaviorSubject<AuthState>({
    isLoggedIn: false,
    user: null,
    token: null
  });

  authState$ = this.authState.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }

  /**
   * 从本地存储加载认证状态
   */
  private loadStoredAuth() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as AuthState;
        if (state.token && state.user) {
          this.authState.next(state);
        }
      }
    } catch (e) {
      console.error('Failed to load auth state:', e);
    }
  }

  /**
   * 保存认证状态到本地存储
   */
  private saveAuthState(state: AuthState) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save auth state:', e);
    }
  }

  get currentUser(): UserInfo | null {
    return this.authState.value.user;
  }

  get isLoggedIn(): boolean {
    return this.authState.value.isLoggedIn;
  }

  get token(): string | null {
    return this.authState.value.token;
  }

  /**
   * 微信登录（移动应用）
   * 调用原生微信SDK获取code，然后发送到后端换取用户信息
   */
  wechatLogin(): Observable<AuthState> {
    if (Capacitor.isNativePlatform()) {
      // 原生平台：调用微信SDK
      return from(this.callWechatSDK()).pipe(
        switchMap(code => this.loginWithCode(code))
      );
    } else {
      // Web平台：提示用户在App中登录
      throw new Error('请在App中使用微信登录');
    }
  }

  /**
   * 调用微信原生SDK
   */
  private async callWechatSDK(): Promise<string> {
    // 使用 cordova-plugin-wechat 或自定义 Capacitor 插件
    return new Promise((resolve, reject) => {
      if (typeof (window as any).Wechat !== 'undefined') {
        const Wechat = (window as any).Wechat;
        
        // 检查微信是否安装
        Wechat.isInstalled((installed: boolean) => {
          if (!installed) {
            reject(new Error('请先安装微信'));
            return;
          }
          
          // 发起微信授权
          Wechat.auth('snsapi_userinfo', 'neihou_login', (response: WechatAuthResponse) => {
            resolve(response.code);
          }, (error: any) => {
            reject(new Error(error.message || '微信授权失败'));
          });
        }, () => {
          reject(new Error('检查微信安装状态失败'));
        });
      } else {
        reject(new Error('微信SDK未初始化'));
      }
    });
  }

  /**
   * 通过code换取用户信息
   */
  private loginWithCode(code: string): Observable<AuthState> {
    return this.http.post<{ token: string; user: UserInfo }>(`${this.baseUrl}/auth/wechat/login`, { code })
      .pipe(
        map(response => {
          const state: AuthState = {
            isLoggedIn: true,
            user: response.user,
            token: response.token
          };
          this.authState.next(state);
          this.saveAuthState(state);
          return state;
        }),
        catchError((error: any) => {
          console.error('Wechat login failed:', error);
          throw error;
        })
      );
  }

  /**
   * 退出登录
   */
  logout(): void {
    const state: AuthState = {
      isLoggedIn: false,
      user: null,
      token: null
    };
    this.authState.next(state);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * 刷新用户信息
   */
  refreshUserInfo(): Observable<UserInfo | null> {
    if (!this.token) {
      return of(null);
    }
    
    return this.http.get<UserInfo>(`${this.baseUrl}/auth/userinfo`).pipe(
      tap((user: UserInfo) => {
        const state = { ...this.authState.value, user };
        this.authState.next(state);
        this.saveAuthState(state);
      }),
      catchError(() => of(null))
    );
  }

  /**
   * 检查是否为VIP用户
   * TODO: 后续从服务器获取VIP状态
   */
  async isVip(): Promise<boolean> {
    // 暂时从本地存储读取VIP状态
    // 后续可以改为从服务器验证
    try {
      const vipStatus = localStorage.getItem('user_vip_status');
      return vipStatus === 'true';
    } catch {
      return false;
    }
  }

  /**
   * 设置VIP状态（测试用）
   */
  setVipStatus(isVip: boolean): void {
    localStorage.setItem('user_vip_status', isVip ? 'true' : 'false');
  }

  /**
   * 设置测试用户状态（开发测试用）
   */
  setTestUser(user: UserInfo | null): void {
    if (user) {
      const state: AuthState = {
        isLoggedIn: true,
        user,
        token: 'test_token_' + Date.now()
      };
      this.authState.next(state);
      this.saveAuthState(state);
    } else {
      this.logout();
    }
  }
}
