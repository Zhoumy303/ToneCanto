import { Injectable } from '@angular/core';

/**
 * 单次练习会话记录
 */
export interface PracticeSession {
  id: string;
  date: string;           // ISO 日期字符串
  timestamp: number;      // 时间戳
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  duration: number;       // 练习时长（秒）
  toneAccuracy: number[]; // 各声调正确率 [tone1, tone2, ..., tone6]
  confusionPairs: { pair: string; count: number }[];
}

/**
 * 声调历史数据点（用于图表）
 */
export interface ToneHistoryPoint {
  date: string;
  accuracy: number;
}

const STORAGE_KEY = 'tone_practice_history';
const MAX_SESSIONS = 100; // 最多保存100次练习记录

@Injectable({
  providedIn: 'root'
})
export class PracticeHistoryService {
  
  private toneNames = ['阴平', '阴上', '阴去', '阳平', '阳上', '阳去'];
  private toneColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

  constructor() {}

  /**
   * 保存练习会话
   */
  saveSession(session: Omit<PracticeSession, 'id' | 'date' | 'timestamp'>): void {
    const sessions = this.getAllSessions();
    
    const newSession: PracticeSession = {
      ...session,
      id: this.generateId(),
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };
    
    sessions.unshift(newSession);
    
    // 限制保存数量
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(MAX_SESSIONS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  /**
   * 获取所有练习会话
   */
  getAllSessions(): PracticeSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * 获取最近N天的练习数据
   */
  getRecentSessions(days: number = 30): PracticeSession[] {
    const sessions = this.getAllSessions();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return sessions.filter(s => s.timestamp >= cutoff);
  }

  /**
   * 获取总体统计
   */
  getOverallStats(): {
    totalSessions: number;
    totalQuestions: number;
    overallAccuracy: number;
    totalPracticeTime: number;
    streakDays: number;
  } {
    const sessions = this.getAllSessions();
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalQuestions: 0,
        overallAccuracy: 0,
        totalPracticeTime: 0,
        streakDays: 0
      };
    }
    
    const totalQuestions = sessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    return {
      totalSessions: sessions.length,
      totalQuestions,
      overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      totalPracticeTime: totalTime,
      streakDays: this.calculateStreakDays(sessions)
    };
  }

  /**
   * 计算连续练习天数
   */
  private calculateStreakDays(sessions: PracticeSession[]): number {
    if (sessions.length === 0) return 0;
    
    const dates = new Set(sessions.map(s => s.date));
    const sortedDates = Array.from(dates).sort().reverse();
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 检查今天或昨天是否有练习
    if (!dates.has(today) && !dates.has(yesterday)) {
      return 0;
    }
    
    let streak = 0;
    let checkDate = dates.has(today) ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dates.has(dateStr)) {
        streak++;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }
    
    return streak;
  }

  /**
   * 获取薄弱声调（正确率最低的）
   */
  getWeakTones(limit: number = 3): { tone: number; name: string; accuracy: number }[] {
    const sessions = this.getRecentSessions(30);
    
    // 计算每个声调的正确率
    const toneStats = this.toneNames.map((name, index) => {
      let total = 0;
      let count = 0;
      
      // 计算最近练习中该声调的正确率
      sessions.slice(0, 10).forEach(session => {
        if (session.toneAccuracy && session.toneAccuracy[index] !== undefined) {
          total += session.toneAccuracy[index];
          count++;
        }
      });
      
      const accuracy = count > 0 ? Math.round(total / count) : 0;
      
      return {
        tone: index + 1,
        name,
        accuracy
      };
    });
    
    return toneStats
      .filter(t => t.accuracy > 0) // 排除没有数据的
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
  }

  /**
   * 清除所有历史数据
   */
  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
