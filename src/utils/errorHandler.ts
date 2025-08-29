import { errorService, ErrorCategory, ErrorSeverity, ErrorSource } from '../lib/services/errorService';
import { logger } from './logger';

/**
 * Enhanced error handling wrapper for async functions
 * Now uses the new minimal error service for logging only
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
    
    // Use the new minimal error service for logging only
    errorService.logError(
      error instanceof Error ? error : message, 
      status, 
      {
        component: context?.component,
        function: context?.function,
        operation: context?.operation
      },
      context?.category,
      context?.severity
    );
    
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
 * Now uses the new minimal error service for logging only
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
    
    // Use the new minimal error service for logging only
    errorService.logError(
      error instanceof Error ? error : message, 
      status, 
      {
        component: context?.component,
        function: context?.function,
        operation: context?.operation
      },
      context?.category,
      context?.severity
    );
    
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
 * Simple error boundary function that just logs errors
 * Components should use the new ErrorBoundary component instead
 */
export function logError(
  error: Error | string,
  context?: {
    component?: string;
    operation?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  }
) {
  errorService.logError(
    error,
    500,
    context,
    context?.category,
    context?.severity
  );
}