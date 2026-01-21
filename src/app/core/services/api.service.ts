import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    console.log('[ApiService] 初始化');
    console.log('[ApiService] baseUrl:', this.baseUrl);
    console.log('[ApiService] production:', environment.production);
  }

  /**
   * 获取声调组数据
   */
  getToneGroups(): Observable<any> {
    const url = `${this.baseUrl}/tones/getToneGroups`;
    console.log('[ApiService] getToneGroups 请求:', url);
    
    return this.http.get(url).pipe(
      tap(response => {
        console.log('[ApiService] getToneGroups 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getToneGroups 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 获取粤拼转换
   */
  convertToJyutping(text: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/pronunciation/convert`, { text });
  }

  /**
   * 获取文本的粤拼
   */
  getJyutping(text: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/follow-reading/getJyutping`, { text });
  }

  /**
   * 获取粤拼音频文件的 URL
   * @param jyutping 粤拼（如 'ou1', 'maa1' 等）
   */
  getAudioUrl(jyutping: string): Observable<any> {
    const url = `${this.baseUrl}/tones/audio-url/${jyutping}`;
    console.log('[ApiService] getAudioUrl 请求:', url);
    
    return this.http.get(url).pipe(
      tap(response => {
        console.log('[ApiService] getAudioUrl 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getAudioUrl 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 获取多个粤拼的音频 URL
   * @param jyutpings 粤拼数组
   */
  getAudioUrls(jyutpings: string[]): Observable<any> {
    const url = `${this.baseUrl}/tones/audio-urls`;
    console.log('[ApiService] getAudioUrls 请求:', url);
    
    return this.http.post(url, { jyutpings }).pipe(
      tap(response => {
        console.log('[ApiService] getAudioUrls 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getAudioUrls 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 获取所有可用的标准粤拼音频列表
   */
  getAvailableAudios(): Observable<any> {
    const url = `${this.baseUrl}/tones/available-audios`;
    console.log('[ApiService] getAvailableAudios 请求:', url);
    
    return this.http.get(url).pipe(
      tap(response => {
        console.log('[ApiService] getAvailableAudios 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getAvailableAudios 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 根据粤拼列表获取对应的音频 URL
   * @param jyutpings 粤拼数组
   */
  getAudiosByJyutpings(jyutpings: string[]): Observable<any> {
    const url = `${this.baseUrl}/tones/audios-by-jyutpings`;
    console.log('[ApiService] getAudiosByJyutpings 请求:', url, jyutpings);
    
    return this.http.post(url, { jyutpings }).pipe(
      tap(response => {
        console.log('[ApiService] getAudiosByJyutpings 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getAudiosByJyutpings 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 获取指定粤拼的相关例词
   * @param jyutping 粤拼（如 'si1', 'fan2' 等）
   */
  getRelatedWords(jyutping: string): Observable<any> {
    const url = `${this.baseUrl}/tones/related-words/${jyutping}`;
    console.log('[ApiService] getRelatedWords 请求:', url);
    
    return this.http.get(url).pipe(
      tap(response => {
        console.log('[ApiService] getRelatedWords 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getRelatedWords 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 批量获取多个粤拼的相关例词
   * @param jyutpings 粤拼数组
   */
  getRelatedWordsBatch(jyutpings: string[]): Observable<any> {
    const url = `${this.baseUrl}/tones/related-words-batch`;
    console.log('[ApiService] getRelatedWordsBatch 请求:', url, jyutpings);
    
    return this.http.post(url, { jyutpings }).pipe(
      tap(response => {
        console.log('[ApiService] getRelatedWordsBatch 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] getRelatedWordsBatch 错误:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 订阅更新通知
   * @param email 邮箱地址
   */
  subscribeToUpdates(email: string): Observable<any> {
    const url = `${this.baseUrl}/api/subscription/subscribe`;
    console.log('[ApiService] subscribeToUpdates 请求:', url, email);
    
    return this.http.post(url, { email }).pipe(
      tap(response => {
        console.log('[ApiService] subscribeToUpdates 响应:', response);
      }),
      catchError(error => {
        console.error('[ApiService] subscribeToUpdates 错误:', error);
        return throwError(() => error);
      })
    );
  }
}
