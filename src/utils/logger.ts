import { invoke } from '@tauri-apps/api/core';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  function: string;
  message: string;
  file: string;
  line: number;
  metadata: Record<string, any>;
  url?: string;
  userAgent?: string;
  sessionId: string;
  stackTrace?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableBackend: boolean;
  bufferSize: number;
  flushInterval: number;
}

class FrontendLogger {
  private config: LoggerConfig = {
    level: LogLevel.INFO, // Changed from DEBUG to INFO to reduce verbosity
    enableConsole: true,
    enableBackend: true,
    bufferSize: 50, // Reduced buffer size
    flushInterval: 3000, // Reduced flush interval
  };

  private logBuffer: LogEntry[] = [];
  private sessionId: string;
  private flushTimer?: number;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor() {
    this.sessionId = this.generateSessionId();
    // Store original console methods first
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.setupGlobalErrorHandlers();
    this.startFlushTimer();
    
    // Log initialization
    this.info('logger', 'constructor', 'Frontend logger initialized', {
      sessionId: this.sessionId,
      config: this.config,
    });
  }

  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 0xFFFFFF).toString(16);
    return `frontend_${timestamp}_${random}`;
  }

  private setupGlobalErrorHandlers(): void {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('global', 'error_handler', `Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('global', 'promise_rejection', `Unhandled promise rejection: ${event.reason}`, {
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
      });
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    module: string,
    functionName: string,
    message: string,
    metadata: Record<string, any> = {},
    file?: string,
    line?: number
  ): LogEntry {
    const error = new Error();
    const stack = error.stack?.split('\n');
    const caller = stack?.[3] || '';
    
    // Simplified file and line extraction to prevent regex issues
    let extractedFile = file || 'unknown';
    let extractedLine = line || 0;
    
    try {
      const match = caller.match(/([^\/\\]+):(\d+):\d+/);
      if (match) {
        extractedFile = match[1] || extractedFile;
        extractedLine = parseInt(match[2]) || extractedLine;
      }
    } catch (e) {
      // Ignore regex errors and use defaults
    }

    return {
      timestamp: new Date().toISOString(),
      level,
      module,
      function: functionName,
      message,
      file: extractedFile,
      line: extractedLine,
      metadata: {
        ...metadata,
        timestamp_ms: Date.now(),
      },
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      stackTrace: level >= LogLevel.ERROR ? error.stack : undefined, // Only include stack trace for errors
    };
  }

  private async logEntry(entry: LogEntry): Promise<void> {
    // Add to buffer
    this.logBuffer.push(entry);

    // Console output if enabled
    if (this.config.enableConsole) {
      const consoleMessage = `[${entry.timestamp}] [${LogLevel[entry.level]}] [${entry.module}::${entry.function}] ${entry.message}`;
      
      switch (entry.level) {
        case LogLevel.TRACE:
        case LogLevel.DEBUG:
          console.debug(consoleMessage, entry.metadata);
          break;
        case LogLevel.INFO:
          console.info(consoleMessage, entry.metadata);
          break;
        case LogLevel.WARN:
          this.originalConsoleWarn(consoleMessage, entry.metadata);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          this.originalConsoleError(consoleMessage, entry.metadata);
          break;
      }
    }

    // Auto-flush on error/fatal or when buffer is full
    if (entry.level >= LogLevel.ERROR || this.logBuffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.enableBackend) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Send logs to Rust backend
      for (const entry of logsToFlush) {
        const metadata = {
          frontend_log: true,
          ...entry.metadata,
          stack_trace: entry.stackTrace,
        };

        await invoke('logger_log_from_frontend', {
          level: LogLevel[entry.level],
          module: entry.module,
          function: entry.function,
          message: entry.message,
          metadata: JSON.stringify(metadata),
        }).catch((error) => {
          // Fallback: log to console if backend logging fails
          console.error('Failed to send log to backend:', error);
        });
      }
    } catch (error) {
      // Re-add logs to buffer if flush failed
      this.logBuffer.unshift(...logsToFlush);
      console.error('Failed to flush logs to backend:', error);
    }
  }

  // Public logging methods
  public trace(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    const entry = this.createLogEntry(LogLevel.TRACE, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  public debug(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const entry = this.createLogEntry(LogLevel.DEBUG, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  public info(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const entry = this.createLogEntry(LogLevel.INFO, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  public warn(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const entry = this.createLogEntry(LogLevel.WARN, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  public error(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const entry = this.createLogEntry(LogLevel.ERROR, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  public fatal(module: string, functionName: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.FATAL)) return;
    const entry = this.createLogEntry(LogLevel.FATAL, module, functionName, message, metadata);
    this.logEntry(entry);
  }

  // Configuration methods
  public setLogLevel(level: LogLevel): void {
    this.config.level = level;
    this.info('logger', 'setLogLevel', `Log level changed to ${LogLevel[level]}`);
  }

  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.info('logger', 'setConfig', 'Logger configuration updated', { config: this.config });
  }

  // Utility methods for troubleshooting
  public async exportLogsForSupport(): Promise<string> {
    try {
      return await invoke<string>('export_logs_for_support');
    } catch (error) {
      this.error('logger', 'exportLogsForSupport', `Failed to export logs: ${error}`);
      throw error;
    }
  }

  public async getLogFilePath(): Promise<string> {
    try {
      return await invoke<string>('get_log_file_path_command');
    } catch (error) {
      this.error('logger', 'getLogFilePath', `Failed to get log file path: ${error}`);
      throw error;
    }
  }

  public async clearLogs(): Promise<void> {
    try {
      await invoke('clear_logs');
      this.info('logger', 'clearLogs', 'Logs cleared successfully');
    } catch (error) {
      this.error('logger', 'clearLogs', `Failed to clear logs: ${error}`);
      throw error;
    }
  }

  // Function entry/exit logging
  public logFunctionEntry(module: string, functionName: string, args?: Record<string, any>): void {
    this.trace(module, functionName, 'ENTRY', { args });
  }

  public logFunctionExit(module: string, functionName: string, result?: any): void {
    this.trace(module, functionName, 'EXIT', { result });
  }

  // Performance logging
  public startTimer(module: string, functionName: string, operation: string): () => void {
    const startTime = performance.now();
    this.debug(module, functionName, `Started ${operation}`, { startTime });

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.debug(module, functionName, `Completed ${operation}`, {
        startTime,
        endTime,
        duration: `${duration.toFixed(2)}ms`,
      });
    };
  }

  // HTTP request logging
  public logHttpRequest(module: string, functionName: string, method: string, url: string, options?: RequestInit): void {
    this.debug(module, functionName, `HTTP ${method} ${url}`, {
      method,
      url,
      headers: options?.headers,
      body: options?.body,
    });
  }

  public logHttpResponse(module: string, functionName: string, method: string, url: string, status: number, statusText: string): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    const entry = this.createLogEntry(
      level,
      module,
      functionName,
      `HTTP ${method} ${url} -> ${status} ${statusText}`,
      { method, url, status, statusText }
    );
    this.logEntry(entry);
  }

  // Component lifecycle logging
  public logComponentMount(component: string): void {
    this.debug('component', component, 'Component mounted');
  }

  public logComponentUnmount(component: string): void {
    this.debug('component', component, 'Component unmounted');
  }

  public logComponentUpdate(component: string, props?: Record<string, any>): void {
    this.debug('component', component, 'Component updated', { props });
  }

  // State change logging
  public logStateChange(module: string, stateName: string, oldValue: any, newValue: any): void {
    this.debug(module, 'state_change', `${stateName} changed`, {
      stateName,
      oldValue,
      newValue,
    });
  }

  // User interaction logging
  public logUserAction(action: string, target?: string, metadata?: Record<string, any>): void {
    this.info('user', 'action', `User ${action}${target ? ` on ${target}` : ''}`, {
      action,
      target,
      ...metadata,
    });
  }

  // Cleanup
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Global logger instance
export const logger = new FrontendLogger();

// Convenience functions for easier usage
export const trace = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.trace(module, fn, message, metadata);

export const debug = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.debug(module, fn, message, metadata);

export const info = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.info(module, fn, message, metadata);

export const warn = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.warn(module, fn, message, metadata);

export const error = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.error(module, fn, message, metadata);

export const fatal = (module: string, fn: string, message: string, metadata?: Record<string, any>) => 
  logger.fatal(module, fn, message, metadata);

// Function decorators for automatic logging
export function logFunction(module: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      logger.logFunctionEntry(module, propertyKey, { args });
      
      try {
        const result = originalMethod.apply(this, args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result
            .then((res) => {
              logger.logFunctionExit(module, propertyKey, res);
              return res;
            })
            .catch((err) => {
              logger.error(module, propertyKey, `Function threw error: ${err}`, { error: err });
              throw err;
            });
        } else {
          logger.logFunctionExit(module, propertyKey, result);
          return result;
        }
      } catch (err) {
        logger.error(module, propertyKey, `Function threw error: ${err}`, { error: err });
        throw err;
      }
    };

    return descriptor;
  };
}

// Performance timing decorator
export function logPerformance(module: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const stopTimer = logger.startTimer(module, propertyKey, 'function_execution');
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.finally(() => stopTimer());
        } else {
          stopTimer();
          return result;
        }
      } catch (err) {
        stopTimer();
        throw err;
      }
    };

    return descriptor;
  };
}

// HTTP request wrapper with logging
export async function loggedFetch(
  module: string,
  functionName: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method || 'GET';
  
  logger.logHttpRequest(module, functionName, method, url, init);
  
  try {
    const response = await fetch(input, init);
    logger.logHttpResponse(module, functionName, method, url, response.status, response.statusText);
    return response;
  } catch (error) {
    logger.error(module, functionName, `HTTP ${method} ${url} failed: ${error}`, { error });
    throw error;
  }
}

// Initialize logger when module is imported
if (typeof window !== 'undefined') {
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    logger.flush();
  });

  // Log page load
  window.addEventListener('load', () => {
    logger.info('page', 'load', 'Page loaded', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    });
  });
}

export default logger; 