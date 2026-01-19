/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * 日志分类枚举（与后端对齐）
 */
export enum LogCategory {
  SYSTEM = 'SYSTEM',      // 系统级别
  API = 'API',            // API 请求
  BUSINESS = 'BUSINESS',  // 业务逻辑
  UI = 'UI',              // 用户交互
  NETWORK = 'NETWORK',    // 网络请求
  PERFORMANCE = 'PERFORMANCE', // 性能监控
  GENERAL = 'GENERAL'     // 通用
}

/**
 * 日志配置接口
 */
interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  enableTimestamp: boolean;
  enableStackTrace: boolean;
  enableReport: boolean;
  enablePerformance: boolean;
}

/**
 * 日志工具类
 * 提供统一的日志记录功能，支持不同级别和分类的日志输出
 */
class LoggerClass {
  private config: LoggerConfig;
  private readonly levelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3
  };

  constructor() {
    // 根据环境变量配置
    const isDev = import.meta.env.DEV;
    const logLevel = (import.meta.env.VITE_LOG_LEVEL || (isDev ? 'DEBUG' : 'WARN')) as LogLevel;
    
    this.config = {
      enabled: true,
      minLevel: logLevel,
      enableTimestamp: true,
      enableStackTrace: isDev,
      enableReport: import.meta.env.VITE_ENABLE_LOG_REPORT === 'true',
      enablePerformance: import.meta.env.VITE_ENABLE_PERFORMANCE === 'true'
    };

    // 启动时输出环境信息
    if (isDev) {
      this.logStartupBanner();
    }
  }

  /**
   * 输出启动横幅
   */
  private logStartupBanner(): void {
    const appName = import.meta.env.VITE_APP_NAME || 'VRM Chat Assistant';
    const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
    const env = import.meta.env.MODE;
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    console.log(
      `%c╭─────────────────────────────────────────────╮\n` +
      `│  ${appName.padEnd(42)} │\n` +
      `│  Version: ${appVersion.padEnd(34)} │\n` +
      `├─────────────────────────────────────────────┤\n` +
      `│  Environment: ${env.padEnd(28)} │\n` +
      `│  Log Level:   ${this.config.minLevel.padEnd(28)} │\n` +
      `├─────────────────────────────────────────────┤\n` +
      `│  API Server:  ${apiUrl.padEnd(28)} │\n` +
      `╰─────────────────────────────────────────────╯`,
      'color: #00d4aa; font-weight: bold;'
    );
  }

  /**
   * 配置日志工具
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否应该输出该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }
    return this.levelPriority[level] >= this.levelPriority[this.config.minLevel];
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, category: LogCategory, message: string): string {
    const parts: string[] = [];
    
    if (this.config.enableTimestamp) {
      const now = new Date();
      const time = now.toTimeString().split(' ')[0]; // HH:mm:ss
      parts.push(`[${time}]`);
    }
    
    parts.push(`[${level}]`);
    parts.push(`[${category}]`);
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * 输出日志
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, category, message);

    // 根据级别选择控制台方法
    const consoleMethod = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error
    }[level];

    if (data !== undefined) {
      consoleMethod(formattedMessage, data);
    } else {
      consoleMethod(formattedMessage);
    }

    // 上报错误日志到后端
    if (this.config.enableReport && level === LogLevel.ERROR) {
      this.reportLog(level, category, message, data);
    }
  }

  /**
   * 上报日志到后端
   */
  private async reportLog(level: LogLevel, category: LogCategory, message: string, data?: any): Promise<void> {
    try {
      // TODO: 实现日志上报接口
      // await fetch('/api/v1/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ level, category, message, data, timestamp: new Date().toISOString() })
      // });
    } catch (error) {
      // 上报失败不影响主流程
      console.error('Failed to report log:', error);
    }
  }

  /**
   * 输出 DEBUG 级别日志
   */
  debug(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * 输出 INFO 级别日志
   */
  info(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * 输出 WARN 级别日志
   */
  warn(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * 输出 ERROR 级别日志
   */
  error(message: string, error?: Error, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    if (error) {
      const errorData = {
        name: error.name,
        message: error.message,
        stack: this.config.enableStackTrace ? error.stack : undefined,
        ...data
      };
      this.log(LogLevel.ERROR, category, message, errorData);
    } else {
      this.log(LogLevel.ERROR, category, message, data);
    }
  }

  /**
   * 性能监控 - 测量函数执行时间
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    category: LogCategory = LogCategory.PERFORMANCE
  ): Promise<T> {
    if (!this.config.enablePerformance) {
      return fn();
    }

    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - startTime);
      this.info(`${operation} completed in ${duration}ms`, { duration }, category);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.error(`${operation} failed after ${duration}ms`, error as Error, { duration }, category);
      throw error;
    }
  }

  /**
   * 性能监控 - 测量同步函数执行时间
   */
  measure<T>(
    operation: string,
    fn: () => T,
    category: LogCategory = LogCategory.PERFORMANCE
  ): T {
    if (!this.config.enablePerformance) {
      return fn();
    }

    const startTime = performance.now();
    try {
      const result = fn();
      const duration = Math.round(performance.now() - startTime);
      this.info(`${operation} completed in ${duration}ms`, { duration }, category);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.error(`${operation} failed after ${duration}ms`, error as Error, { duration }, category);
      throw error;
    }
  }
}

// 导出单例实例
export const Logger = new LoggerClass();
