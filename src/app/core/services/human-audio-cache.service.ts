import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

/**
 * 音频缓存条目
 */
interface AudioCacheEntry {
  url: string;           // 服务器返回的音频 URL
  blob?: Blob;           // 下载后的音频数据
  objectUrl?: string;    // 本地 Object URL
  timestamp: number;     // 缓存时间戳
}

/**
 * 真人发音音频缓存服务
 * 
 * 负责从后端获取真人发音音频并缓存到本地
 * 支持 IndexedDB 持久化存储
 */
@Injectable({
  providedIn: 'root'
})
export class HumanAudioCacheService {
  private readonly apiService = inject(ApiService);
  
  // 内存缓存
  private memoryCache = new Map<string, AudioCacheEntry>();
  
  // IndexedDB 数据库名和存储名
  private readonly DB_NAME = 'ToneCantoAudioCache';
  private readonly STORE_NAME = 'audios';
  private readonly DB_VERSION = 1;
  
  // 缓存过期时间（30天）
  private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000;
  
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = this.initDB();
  }

  /**
   * 初始化 IndexedDB
   */
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('[HumanAudioCacheService] IndexedDB 不可用，仅使用内存缓存');
        resolve();
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[HumanAudioCacheService] IndexedDB 打开失败:', request.error);
        resolve(); // 不阻塞，降级到内存缓存
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[HumanAudioCacheService] IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'jyutping' });
          console.log('[HumanAudioCacheService] 创建存储对象成功');
        }
      };
    });
  }

  /**
   * 获取单个粤拼的音频 URL
   * 优先从缓存获取，缓存未命中则从服务器获取并缓存
   */
  async getAudioUrl(jyutping: string): Promise<string | null> {
    await this.dbReady;
    
    // 1. 检查内存缓存
    const memCached = this.memoryCache.get(jyutping);
    if (memCached?.objectUrl && !this.isExpired(memCached.timestamp)) {
      console.log('[HumanAudioCacheService] 内存缓存命中:', jyutping);
      return memCached.objectUrl;
    }

    // 2. 检查 IndexedDB 缓存
    const dbCached = await this.getFromDB(jyutping);
    if (dbCached && !this.isExpired(dbCached.timestamp)) {
      console.log('[HumanAudioCacheService] IndexedDB 缓存命中:', jyutping);
      // 恢复到内存缓存
      const objectUrl = URL.createObjectURL(dbCached.blob!);
      this.memoryCache.set(jyutping, { ...dbCached, objectUrl });
      return objectUrl;
    }

    // 3. 从服务器获取
    console.log('[HumanAudioCacheService] 从服务器获取:', jyutping);
    return this.fetchAndCache(jyutping);
  }

  /**
   * 批量获取多个粤拼的音频 URL
   */
  async getAudioUrls(jyutpings: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const toFetch: string[] = [];

    await this.dbReady;

    // 检查缓存
    for (const jyutping of jyutpings) {
      const memCached = this.memoryCache.get(jyutping);
      if (memCached?.objectUrl && !this.isExpired(memCached.timestamp)) {
        results.set(jyutping, memCached.objectUrl);
        continue;
      }

      const dbCached = await this.getFromDB(jyutping);
      if (dbCached && !this.isExpired(dbCached.timestamp)) {
        const objectUrl = URL.createObjectURL(dbCached.blob!);
        this.memoryCache.set(jyutping, { ...dbCached, objectUrl });
        results.set(jyutping, objectUrl);
        continue;
      }

      toFetch.push(jyutping);
    }

    // 批量从服务器获取
    if (toFetch.length > 0) {
      await this.batchFetchAndCache(toFetch, results);
    }

    return results;
  }

  /**
   * 从服务器获取音频并缓存
   */
  private async fetchAndCache(jyutping: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.apiService.getAudiosByJyutpings([jyutping])
      );

      if (!response.success || !response.data?.[jyutping]) {
        // 音频不存在，静默返回 null
        return null;
      }

      const audioData = response.data[jyutping];
      
      // 处理带调值和不带调值的情况
      let audioUrl: string | null = null;
      
      if (audioData.success && audioData.url) {
        // 带调值的情况，直接有 url
        audioUrl = audioData.url;
      } else if (audioData.tones) {
        // 不带调值的情况，取第一个可用的调值
        const firstTone = Object.values(audioData.tones)[0] as { url?: string };
        audioUrl = firstTone?.url || null;
      }

      if (!audioUrl) {
        // 无法获取音频 URL，静默返回 null
        return null;
      }

      // 下载音频文件
      const blob = await this.downloadAudio(audioUrl);
      if (!blob) {
        return null;
      }

      // 创建 Object URL
      const objectUrl = URL.createObjectURL(blob);

      // 缓存到内存和 IndexedDB
      const entry: AudioCacheEntry = {
        url: audioUrl,
        blob,
        objectUrl,
        timestamp: Date.now()
      };
      
      this.memoryCache.set(jyutping, entry);
      await this.saveToDB(jyutping, entry);

      return objectUrl;
    } catch (error) {
      console.error('[HumanAudioCacheService] 获取音频失败:', jyutping, error);
      return null;
    }
  }

  /**
   * 批量从服务器获取音频并缓存
   */
  private async batchFetchAndCache(
    jyutpings: string[], 
    results: Map<string, string | null>
  ): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.apiService.getAudiosByJyutpings(jyutpings)
      );

      if (!response.success || !response.data) {
        jyutpings.forEach(jp => results.set(jp, null));
        return;
      }

      for (const jyutping of jyutpings) {
        const audioData = response.data[jyutping];
        
        if (!audioData) {
          results.set(jyutping, null);
          continue;
        }

        let audioUrl: string | null = null;
        
        if (audioData.success && audioData.url) {
          audioUrl = audioData.url;
        } else if (audioData.tones) {
          const firstTone = Object.values(audioData.tones)[0] as { url?: string };
          audioUrl = firstTone?.url || null;
        }

        if (!audioUrl) {
          results.set(jyutping, null);
          continue;
        }

        // 下载并缓存
        const blob = await this.downloadAudio(audioUrl);
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          const entry: AudioCacheEntry = {
            url: audioUrl,
            blob,
            objectUrl,
            timestamp: Date.now()
          };
          
          this.memoryCache.set(jyutping, entry);
          await this.saveToDB(jyutping, entry);
          results.set(jyutping, objectUrl);
        } else {
          results.set(jyutping, null);
        }
      }
    } catch (error) {
      console.error('[HumanAudioCacheService] 批量获取音频失败:', error);
      jyutpings.forEach(jp => {
        if (!results.has(jp)) {
          results.set(jp, null);
        }
      });
    }
  }

  /**
   * 下载音频文件
   */
  private async downloadAudio(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('[HumanAudioCacheService] 下载音频失败:', url, error);
      return null;
    }
  }

  /**
   * 从 IndexedDB 获取缓存
   */
  private getFromDB(jyutping: string): Promise<AudioCacheEntry | null> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(jyutping);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({
              url: result.url,
              blob: result.blob,
              timestamp: result.timestamp
            });
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('[HumanAudioCacheService] IndexedDB 读取失败:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.error('[HumanAudioCacheService] IndexedDB 操作失败:', error);
        resolve(null);
      }
    });
  }

  /**
   * 保存到 IndexedDB
   */
  private saveToDB(jyutping: string, entry: AudioCacheEntry): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        store.put({
          jyutping,
          url: entry.url,
          blob: entry.blob,
          timestamp: entry.timestamp
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('[HumanAudioCacheService] IndexedDB 写入失败');
          resolve();
        };
      } catch (error) {
        console.error('[HumanAudioCacheService] IndexedDB 操作失败:', error);
        resolve();
      }
    });
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_EXPIRY;
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    // 清除内存缓存中的 Object URLs
    this.memoryCache.forEach(entry => {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
    });
    this.memoryCache.clear();

    // 清除 IndexedDB
    if (this.db) {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.clear();
        transaction.oncomplete = () => {
          console.log('[HumanAudioCacheService] 缓存已清除');
          resolve();
        };
        transaction.onerror = () => resolve();
      });
    }
  }

  /**
   * 预加载一组粤拼的音频
   */
  async preloadAudios(jyutpings: string[]): Promise<void> {
    console.log('[HumanAudioCacheService] 预加载音频:', jyutpings);
    await this.getAudioUrls(jyutpings);
  }
}
