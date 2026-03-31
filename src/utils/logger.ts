import { format } from 'util';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel;
  private readonly levelNames: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
  };

  constructor() {
    // Determine log level from environment
    // AORP recommends DEBUG for operational monitoring, but LOG_LEVEL can override
    const logLevelEnv = process.env.LOG_LEVEL?.toLowerCase();
    const debugEnv = process.env.DEBUG?.toLowerCase();

    const parsedLogLevel = this.parseLogLevel(logLevelEnv ?? '');

    if (parsedLogLevel !== null) {
      // Map LOG_LEVEL environment variable to LogLevel
      this.level = parsedLogLevel;
    } else if (debugEnv === 'true') {
      // Legacy DEBUG environment variable (falls back if LOG_LEVEL is invalid)
      this.level = LogLevel.DEBUG;
    } else {
      // Default to INFO for production, can be overridden
      this.level = LogLevel.INFO;
    }
  }

  private parseLogLevel(levelStr: string): LogLevel | null {
    const levelMap: Record<string, LogLevel> = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      warning: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
    };
    return levelMap[levelStr] ?? null;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const levelStr = this.levelNames[level];
      const formattedMessage = format(message, ...args);

      // Always use console.error for MCP servers as stdout is reserved for protocol
      console.error(`[${timestamp}] [${levelStr}] ${formattedMessage}`);
    }
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }
}

export const logger = new Logger();
