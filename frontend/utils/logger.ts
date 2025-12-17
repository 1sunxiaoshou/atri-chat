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
 * 日志配置接口
 */
interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  enableTimestamp: boolean;
  enableStackTrace: boolean;
}

/**
 * 日志工具类
 * 提供统一的日志记录功能，支持不同级别的日志输出
 * 在生产环境中可以控制日志输出级别
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
    // 根据环境变量判断是否为生产环境
    const isProduction = import.meta.env.PROD;
    
    this.config = {
      enabled: true,
      minLevel: isProduction ? LogLevel.WARN : LogLevel.DEBUG,
      enableTimestamp: true,
      enableStackTrace: !isProduction
    };
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
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];
    
    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }
    
    parts.push(`[${level}]`);
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * 输出日志
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);

    switch (level) {
      case LogLevel.DEBUG:
        if (data !== undefined) {
          console.debug(formattedMessage, data);
        } else {
          console.debug(formattedMessage);
        }
        break;
      
      case LogLevel.INFO:
        if (data !== undefined) {
          console.info(formattedMessage, data);
        } else {
          console.info(formattedMessage);
        }
        break;
      
      case LogLevel.WARN:
        if (data !== undefined) {
          console.warn(formattedMessage, data);
        } else {
          console.warn(formattedMessage);
        }
        break;
      
      case LogLevel.ERROR:
        if (data !== undefined) {
          console.error(formattedMessage, data);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }

  /**
   * 输出 DEBUG 级别日志
   * 用于详细的调试信息
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 输出 INFO 级别日志
   * 用于一般信息
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 输出 WARN 级别日志
   * 用于警告信息
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 输出 ERROR 级别日志
   * 用于错误信息
   */
  error(message: string, error?: Error, data?: any): void {
    if (error) {
      const errorData = {
        name: error.name,
        message: error.message,
        stack: this.config.enableStackTrace ? error.stack : undefined,
        ...data
      };
      this.log(LogLevel.ERROR, message, errorData);
    } else {
      this.log(LogLevel.ERROR, message, data);
    }
  }
}

// 导出单例实例
export const Logger = new LoggerClass();
