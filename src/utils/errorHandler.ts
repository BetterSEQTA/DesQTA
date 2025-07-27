import { errorService, ErrorCategory, ErrorSeverity, ErrorSource } from '../lib/services/errorService';
import { logger } from './logger';

/**
 * Enhanced error handling wrapper for async functions
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage?: string,
  status: number = 500,
  context?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    source?: ErrorSource;
    component?: string;
    function?: string;
    operation?: string;
  }
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
    
    errorService.handleManualError(message, status, {
      component: context?.component,
      function: context?.function,
      operation: context?.operation
    });
    
    logger.error('errorHandler', 'withErrorHandling', 'Error caught in async function', {
      message,
      status,
      context,
      originalError: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return null;
  }
}

/**
 * Enhanced error handling wrapper for synchronous functions
 */
export function withErrorHandlingSync<T>(
  fn: () => T,
  errorMessage?: string,
  status: number = 500,
  context?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    source?: ErrorSource;
    component?: string;
    function?: string;
    operation?: string;
  }
): T | null {
  try {
    return fn();
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
    
    errorService.handleManualError(message, status, {
      component: context?.component,
      function: context?.function,
      operation: context?.operation
    });
    
    logger.error('errorHandler', 'withErrorHandlingSync', 'Error caught in sync function', {
      message,
      status,
      context,
      originalError: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return null;
  }
}

/**
 * Creates a safe async function that handles errors with context
 */
export function createSafeAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorMessage?: string,
  status: number = 500,
  context?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    source?: ErrorSource;
    component?: string;
    function?: string;
    operation?: string;
  }
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
      
      errorService.handleManualError(message, status, {
        component: context?.component,
        function: context?.function,
        operation: context?.operation
      });
      
      logger.error('errorHandler', 'createSafeAsyncFunction', 'Error caught in safe async function', {
        message,
        status,
        context,
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  };
}

/**
 * Creates a safe synchronous function that handles errors with context
 */
export function createSafeSyncFunction<T extends any[], R>(
  fn: (...args: T) => R,
  errorMessage?: string,
  status: number = 500,
  context?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    source?: ErrorSource;
    component?: string;
    function?: string;
    operation?: string;
  }
) {
  return (...args: T): R | null => {
    try {
      return fn(...args);
    } catch (error) {
      const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
      
      errorService.handleManualError(message, status, {
        component: context?.component,
        function: context?.function,
        operation: context?.operation
      });
      
      logger.error('errorHandler', 'createSafeSyncFunction', 'Error caught in safe sync function', {
        message,
        status,
        context,
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  };
}

/**
 * Enhanced fetch wrapper with comprehensive error handling
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  errorMessage?: string,
  context?: {
    component?: string;
    function?: string;
    operation?: string;
  }
): Promise<Response | null> {
  try {
    const response = await fetch(input, init);
    
    if (!response.ok) {
      const message = errorMessage || `HTTP ${response.status}: ${response.statusText}`;
      
      errorService.handleManualError(message, response.status, {
        component: context?.component,
        function: context?.function,
        operation: context?.operation || 'fetch'
      });
      
      logger.warn('errorHandler', 'safeFetch', 'Fetch request failed', {
        url: input.toString(),
        status: response.status,
        statusText: response.statusText,
        context
      });
      
      return null;
    }
    
    logger.debug('errorHandler', 'safeFetch', 'Fetch request successful', {
      url: input.toString(),
      status: response.status
    });
    
    return response;
  } catch (error) {
    const message = errorMessage || 'Network error occurred';
    
    errorService.handleManualError(message, 500, {
      component: context?.component,
      function: context?.function,
      operation: context?.operation || 'fetch'
    });
    
    logger.error('errorHandler', 'safeFetch', 'Fetch request threw exception', {
      url: input.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      context
    });
    
    return null;
  }
}

/**
 * Enhanced Tauri invoke wrapper with comprehensive error handling
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, any>,
  errorMessage?: string,
  context?: {
    component?: string;
    function?: string;
    operation?: string;
  }
): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<T>(command, args);
    
    logger.debug('errorHandler', 'safeInvoke', 'Tauri command successful', {
      command,
      args,
      context
    });
    
    return result;
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'Tauri command failed');
    
    errorService.handleManualError(message, 500, {
      component: context?.component,
      function: context?.function,
      operation: context?.operation || 'tauri_invoke'
    });
    
    logger.error('errorHandler', 'safeInvoke', 'Tauri command failed', {
      command,
      args,
      error: error instanceof Error ? error.message : 'Unknown error',
      context
    });
    
    return null;
  }
}

/**
 * Enhanced error logging without redirecting to error page
 */
export function logError(
  error: Error | string, 
  context?: {
    component?: string;
    function?: string;
    operation?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    source?: ErrorSource;
  }
) {
  const message = typeof error === 'string' ? error : error.message;
  
  logger.error('errorHandler', 'logError', 'Error logged without redirect', {
    message,
    context,
    stack: error instanceof Error ? error.stack : undefined
  });
  
  // Also log to console for immediate visibility
  console.error(`[${context?.component || 'App'}] Error:`, message);
  
  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Enhanced user-friendly error display
 */
export function showUserError(
  message: string, 
  title: string = 'Error',
  context?: {
    component?: string;
    function?: string;
    operation?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  }
) {
  logger.warn('errorHandler', 'showUserError', 'User error displayed', {
    title,
    message,
    context
  });
  
  // You can implement this to show toast notifications or modals
  console.error(`[${title}] ${message}`);
  
  // Example: Show a toast notification
  // toast.error(message, { title });
  
  // Example: Show a modal
  // showErrorModal({ title, message, context });
}

/**
 * Component-specific error boundary helper
 */
export function createComponentErrorBoundary(
  componentName: string,
  fallback?: (error: Error) => void
) {
  return {
    handleError: (error: Error, context?: { function?: string; operation?: string }) => {
      const errorContext = {
        component: componentName,
        function: context?.function,
        operation: context?.operation,
        source: ErrorSource.COMPONENT as ErrorSource
      };
      
      errorService.handleManualError(error, 500, errorContext);
      
      if (fallback) {
        fallback(error);
      }
      
      logger.error('errorHandler', 'componentErrorBoundary', 'Component error caught', {
        component: componentName,
        error: error.message,
        context: errorContext
      });
    },
    
    withErrorHandling: <T>(fn: () => T, errorMessage?: string) => {
      return withErrorHandlingSync(fn, errorMessage, 500, {
        component: componentName,
        source: ErrorSource.COMPONENT
      });
    },
    
    withAsyncErrorHandling: <T>(fn: () => Promise<T>, errorMessage?: string) => {
      return withErrorHandling(fn, errorMessage, 500, {
        component: componentName,
        source: ErrorSource.COMPONENT
      });
    }
  };
}

/**
 * Service-specific error handling helper
 */
export function createServiceErrorHandler(
  serviceName: string,
  defaultCategory: ErrorCategory = ErrorCategory.EXTERNAL_SERVICE
) {
  return {
    handleError: (error: Error | string, context?: { function?: string; operation?: string }) => {
      const message = typeof error === 'string' ? error : error.message;
      
      errorService.handleManualError(message, 500, {
        component: serviceName,
        function: context?.function,
        operation: context?.operation
      });
      
      logger.error('errorHandler', 'serviceErrorHandler', 'Service error caught', {
        service: serviceName,
        error: message,
        context
      });
    },
    
    safeInvoke: <T>(command: string, args?: Record<string, any>, errorMessage?: string) => {
      return safeInvoke<T>(command, args, errorMessage, {
        component: serviceName
      });
    },
    
    safeFetch: (input: RequestInfo | URL, init?: RequestInit, errorMessage?: string) => {
      return safeFetch(input, init, errorMessage, {
        component: serviceName
      });
    }
  };
}

/**
 * API-specific error handling helper
 */
export function createApiErrorHandler(
  apiName: string,
  baseUrl?: string
) {
  return {
    handleError: (error: Error | string, status: number = 500, context?: { function?: string; operation?: string }) => {
      const message = typeof error === 'string' ? error : error.message;
      
      errorService.handleManualError(message, status, {
        component: apiName,
        function: context?.function,
        operation: context?.operation
      });
      
      logger.error('errorHandler', 'apiErrorHandler', 'API error caught', {
        api: apiName,
        error: message,
        status,
        context
      });
    },
    
    safeFetch: (endpoint: string, init?: RequestInit, errorMessage?: string) => {
      const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
      return safeFetch(url, init, errorMessage, {
        component: apiName
      });
    },
    
    safeInvoke: <T>(command: string, args?: Record<string, any>, errorMessage?: string) => {
      return safeInvoke<T>(command, args, errorMessage, {
        component: apiName
      });
    }
  };
}

/**
 * Performance monitoring helper
 */
export function createPerformanceMonitor(
  componentName: string
) {
  return {
    measure: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await fn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        logger.debug('errorHandler', 'performanceMonitor', 'Operation completed', {
          component: componentName,
          operation,
          duration: `${duration.toFixed(2)}ms`
        });
        
        // Log slow operations as warnings
        if (duration > 1000) {
          logger.warn('errorHandler', 'performanceMonitor', 'Slow operation detected', {
            component: componentName,
            operation,
            duration: `${duration.toFixed(2)}ms`
          });
        }
        
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        logger.error('errorHandler', 'performanceMonitor', 'Operation failed', {
          component: componentName,
          operation,
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }
    },
    
    measureSync: <T>(operation: string, fn: () => T): T => {
      const startTime = performance.now();
      try {
        const result = fn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        logger.debug('errorHandler', 'performanceMonitor', 'Sync operation completed', {
          component: componentName,
          operation,
          duration: `${duration.toFixed(2)}ms`
        });
        
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        logger.error('errorHandler', 'performanceMonitor', 'Sync operation failed', {
          component: componentName,
          operation,
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }
    }
  };
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: {
    component?: string;
    function?: string;
    operation?: string;
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        // Final attempt failed, log and throw
        logger.error('errorHandler', 'withRetry', 'All retry attempts failed', {
          component: context?.component,
          function: context?.function,
          operation: context?.operation,
          maxRetries,
          finalError: lastError.message
        });
        
        errorService.handleManualError(lastError, 500, context);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      
      logger.warn('errorHandler', 'withRetry', 'Retry attempt failed, retrying', {
        component: context?.component,
        function: context?.function,
        operation: context?.operation,
        attempt: attempt + 1,
        maxRetries,
        delay: `${delay}ms`,
        error: lastError.message
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Debounced error reporting to prevent spam
 */
export function createDebouncedErrorReporter(
  delay: number = 5000
) {
  let timeoutId: number | null = null;
  let pendingErrors: Array<{ error: Error | string; context?: any }> = [];
  
  return {
    report: (error: Error | string, context?: any) => {
      pendingErrors.push({ error, context });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        if (pendingErrors.length > 0) {
          const groupedErrors = pendingErrors.reduce((acc, { error, context }) => {
            const key = typeof error === 'string' ? error : error.message;
            if (!acc[key]) {
              acc[key] = { count: 0, contexts: [], originalError: error };
            }
            acc[key].count++;
            if (context) acc[key].contexts.push(context);
            return acc;
          }, {} as Record<string, { count: number; contexts: any[]; originalError: Error | string }>);
          
          // Report grouped errors
          Object.entries(groupedErrors).forEach(([message, { count, contexts, originalError }]) => {
            const finalMessage = count > 1 ? `${message} (occurred ${count} times)` : message;
            errorService.handleManualError(finalMessage, 500, {
              operation: 'debounced_report',
              data: { count, contexts }
            });
          });
          
          pendingErrors = [];
        }
      }, delay);
    },
    
    flush: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      pendingErrors.forEach(({ error, context }) => {
        errorService.handleManualError(
          typeof error === 'string' ? error : error.message,
          500,
          context
        );
      });
      
      pendingErrors = [];
    }
  };
} 