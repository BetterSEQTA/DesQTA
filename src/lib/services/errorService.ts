import { logger } from '../../utils/logger';

// Simple interfaces for logging purposes only
export interface ErrorContext {
  component?: string;
  function?: string;
  operation?: string;
  data?: any;
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RUNTIME = 'runtime',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorSource {
  GLOBAL = 'global',
  COMPONENT = 'component',
  SERVICE = 'service',
  API = 'api',
  USER_ACTION = 'user_action'
}

// Minimal ErrorService for logging only - no page redirects or complex handling
class ErrorService {
  constructor() {
    logger.info('errorService', 'constructor', 'Minimal ErrorService initialized for logging only');
  }

  // Simple error logging method
  public logError(
    error: Error | string, 
    status: number = 500, 
    context?: ErrorContext,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) {
    const message = typeof error === 'string' ? error : error.message;
    const stack = error instanceof Error ? error.stack : undefined;
    
    logger.error('errorService', 'logError', 'Error logged', {
      message,
      status,
      stack,
      category,
      severity,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    });
  }

  // Legacy method for backward compatibility - just logs, no navigation
  public handleManualError(error: Error | string, status: number = 500, context?: ErrorContext) {
    this.logError(error, status, context);
  }

  // Legacy methods for backward compatibility - do nothing
  public registerErrorHandler() {}
  public markErrorResolved() {}
  public getErrorQueue() { return []; }
  public clearErrorQueue() {}
  public getErrorById() { return undefined; }
  public getErrorsByCategory() { return []; }
  public getErrorsBySeverity() { return []; }
  public async reportError() {}
}

// Create singleton instance
export const errorService = new ErrorService();

// Export utility functions for backward compatibility
export function handleError(error: Error | string, status: number = 500, context?: ErrorContext) {
  errorService.logError(error, status, context);
}

export function reportError() {
  // No-op for backward compatibility
  return Promise.resolve();
}
