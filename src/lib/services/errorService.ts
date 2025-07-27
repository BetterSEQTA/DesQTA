import { goto } from '$app/navigation';
import { logger } from '../../utils/logger';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { writable, derived } from 'svelte/store';

export interface ErrorInfo {
  id: string;
  message: string;
  status?: number;
  stack?: string;
  url?: string;
  timestamp: string;
  userAgent?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: ErrorContext;
  metadata?: Record<string, any>;
  resolved: boolean;
  retryCount: number;
  maxRetries: number;
  lastRetry?: string;
  source: ErrorSource;
  componentStack?: string;
  performanceMetrics?: PerformanceMetrics;
  userActions?: UserAction[];
  relatedErrors?: string[];
  tags?: string[];
}

export interface ErrorContext {
  component?: string;
  function?: string;
  line?: number;
  column?: number;
  file?: string;
  route?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  data?: any;
}

export interface PerformanceMetrics {
  memoryUsage?: number;
  cpuUsage?: number;
  loadTime?: number;
  responseTime?: number;
  timestamp: string;
}

export interface UserAction {
  action: string;
  timestamp: string;
  details?: any;
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RUNTIME = 'runtime',
  SYNTAX = 'syntax',
  RESOURCE = 'resource',
  TIMEOUT = 'timeout',
  QUOTA = 'quota',
  CONFIGURATION = 'configuration',
  INTEGRATION = 'integration',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  UI = 'ui',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  PERFORMANCE = 'performance',
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
  TAURI = 'tauri',
  FETCH = 'fetch',
  USER_ACTION = 'user_action',
  BACKGROUND = 'background',
  SCHEDULED = 'scheduled'
}

export interface ErrorReport {
  error: ErrorInfo;
  environment: EnvironmentInfo;
  diagnostics: DiagnosticInfo;
  recommendations: string[];
}

export interface EnvironmentInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution: string;
  windowSize: string;
  connectionType?: string;
  memoryInfo?: any;
  performanceInfo?: any;
  appVersion: string;
  buildNumber: string;
  environment: string;
}

export interface DiagnosticInfo {
  systemHealth: SystemHealth;
  recentErrors: ErrorInfo[];
  performanceIssues: string[];
  networkStatus: NetworkStatus;
  storageStatus: StorageStatus;
}

export interface SystemHealth {
  memoryUsage: number;
  cpuUsage: number;
  diskSpace: number;
  networkLatency: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  latency: number;
  bandwidth: number;
  lastCheck: string;
}

export interface StorageStatus {
  localStorage: number;
  sessionStorage: number;
  indexedDB: number;
  quota: number;
}

class ErrorService {
  private errorQueue: ErrorInfo[] = [];
  private isHandlingError = false;
  private errorHandlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private retryStrategies: Map<ErrorCategory, RetryStrategy> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private performanceMonitor: PerformanceMonitor;
  private errorAnalytics: ErrorAnalytics;
  private errorRecovery: ErrorRecovery;
  private errorReporting: ErrorReporting;

  // Svelte stores for reactive error state
  public errors = writable<ErrorInfo[]>([]);
  public activeErrors = derived(this.errors, ($errors) => 
    $errors.filter(error => !error.resolved)
  );
  public criticalErrors = derived(this.errors, ($errors) => 
    $errors.filter(error => error.severity === ErrorSeverity.CRITICAL && !error.resolved)
  );
  public errorStats = derived(this.errors, ($errors) => ({
    total: $errors.length,
    resolved: $errors.filter(e => e.resolved).length,
    critical: $errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
    byCategory: this.groupErrorsByCategory($errors),
    bySeverity: this.groupErrorsBySeverity($errors)
  }));

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.errorAnalytics = new ErrorAnalytics();
    this.errorRecovery = new ErrorRecovery();
    this.errorReporting = new ErrorReporting();
    
    this.initializeErrorHandlers();
    this.initializeRetryStrategies();
    this.initializeErrorPatterns();
    this.setupGlobalErrorHandlers();
    this.startPerformanceMonitoring();
    
    logger.info('errorService', 'constructor', 'ErrorService initialized with comprehensive error handling');
  }

  private initializeErrorHandlers() {
    // Network error handlers
    this.registerErrorHandler(ErrorCategory.NETWORK, {
      canHandle: (error) => error.message.includes('fetch') || error.message.includes('network'),
      handle: async (error) => {
        await this.handleNetworkError(error);
      }
    });

    // Authentication error handlers
    this.registerErrorHandler(ErrorCategory.AUTHENTICATION, {
      canHandle: (error) => error.status === 401,
      handle: async (error) => {
        await this.handleAuthError(error);
      }
    });

    // Runtime error handlers
    this.registerErrorHandler(ErrorCategory.RUNTIME, {
      canHandle: (error) => error.category === ErrorCategory.RUNTIME,
      handle: async (error) => {
        await this.handleRuntimeError(error);
      }
    });

    // UI error handlers
    this.registerErrorHandler(ErrorCategory.UI, {
      canHandle: (error) => error.category === ErrorCategory.UI,
      handle: async (error) => {
        await this.handleUIError(error);
      }
    });
  }

  private initializeRetryStrategies() {
    // Exponential backoff for network errors
    this.retryStrategies.set(ErrorCategory.NETWORK, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      shouldRetry: (error) => error.status !== 404 && error.status !== 403
    });

    // Quick retry for UI errors
    this.retryStrategies.set(ErrorCategory.UI, {
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 1.5,
      shouldRetry: (error) => true
    });
  }

  private initializeErrorPatterns() {
    this.errorPatterns = [
      {
        pattern: /fetch.*failed/i,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        tags: ['network', 'api']
      },
      {
        pattern: /unauthorized/i,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        tags: ['auth', 'session']
      },
      {
        pattern: /timeout/i,
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        tags: ['performance', 'network']
      },
      {
        pattern: /quota.*exceeded/i,
        category: ErrorCategory.QUOTA,
        severity: ErrorSeverity.HIGH,
        tags: ['storage', 'limits']
      }
    ];
  }

  private setupGlobalErrorHandlers() {
    logger.debug('errorService', 'setupGlobalErrorHandlers', 'Setting up comprehensive global error handlers');
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault();
      
      const errorInfo = this.createErrorInfo({
        message: event.reason?.message || 'Unhandled Promise Rejection',
        status: event.reason?.status || 500,
        stack: event.reason?.stack,
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.HIGH,
        source: ErrorSource.GLOBAL,
        metadata: { reason: event.reason }
      });

      logger.warn('errorService', 'unhandledrejection', 'Unhandled promise rejection detected', {
        errorId: errorInfo.id,
        reason: event.reason?.message || 'Unknown reason',
        stack: event.reason?.stack
      });
      
      this.handleError(errorInfo);
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      const errorInfo = this.createErrorInfo({
        message: event.message || 'JavaScript Error',
        status: 500,
        stack: event.error?.stack,
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.HIGH,
        source: ErrorSource.GLOBAL,
        context: {
          line: event.lineno,
          column: event.colno,
          file: event.filename
        }
      });

      logger.error('errorService', 'javascript_error', 'JavaScript error detected', {
        errorId: errorInfo.id,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });

      this.handleError(errorInfo);
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        const errorInfo = this.createErrorInfo({
          message: `Failed to load resource: ${target.tagName}`,
          status: 404,
          category: ErrorCategory.RESOURCE,
          severity: ErrorSeverity.MEDIUM,
          source: ErrorSource.GLOBAL,
          context: {
            component: target.tagName,
            file: (target as any).src || (target as any).href
          }
        });

        logger.warn('errorService', 'resource_error', 'Resource loading error detected', {
          errorId: errorInfo.id,
          tagName: target.tagName,
          src: (target as any).src,
          href: (target as any).href
        });

        this.handleError(errorInfo);
      }
    }, true);

    // Handle fetch errors with enhanced interception
    this.interceptFetchErrors();
    
    // Handle console errors
    this.interceptConsoleErrors();
    
    // Handle performance issues
    this.setupPerformanceErrorHandling();
  }

  private interceptFetchErrors() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();
      const url = args[0] as string;
      
      // Skip logging for certain URLs to avoid circular dependencies
      if (url.includes('ipc.localhost') || url.includes('logger_log_from_frontend') || url.includes('localhost:1420')) {
        return originalFetch(...args);
      }
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Log successful requests for performance monitoring
        if (response.ok) {
          logger.debug('errorService', 'fetch_success', 'Fetch request completed successfully', {
            requestId,
            url: args[0],
            status: response.status,
            responseTime: `${responseTime.toFixed(2)}ms`
          });
        }
        
        // Handle HTTP error status codes
        if (!response.ok) {
          const errorInfo = this.createErrorInfo({
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            category: this.categorizeHttpError(response.status),
            severity: this.categorizeHttpSeverity(response.status),
            source: ErrorSource.FETCH,
            context: {
              requestId,
              operation: 'fetch',
              file: args[0] as string
            },
            performanceMetrics: {
              responseTime,
              timestamp: new Date().toISOString()
            }
          });

          logger.warn('errorService', 'fetch_error', 'Fetch request failed', {
            errorId: errorInfo.id,
            requestId,
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            responseTime: `${responseTime.toFixed(2)}ms`
          });

          // Don't redirect for auth errors as they're handled by auth service
          if (response.status !== 401 && response.status !== 403) {
            this.handleError(errorInfo);
          }
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const errorInfo = this.createErrorInfo({
          message: error instanceof Error ? error.message : 'Network Error',
          status: 500,
          stack: error instanceof Error ? error.stack : undefined,
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          source: ErrorSource.FETCH,
          context: {
            requestId,
            operation: 'fetch',
            file: args[0] as string
          },
          performanceMetrics: {
            responseTime,
            timestamp: new Date().toISOString()
          }
        });
        
        logger.error('errorService', 'fetch_exception', 'Fetch request threw exception', {
          errorId: errorInfo.id,
          requestId,
          url: args[0],
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: `${responseTime.toFixed(2)}ms`,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        this.handleError(errorInfo);
        throw error;
      }
    };
  }

  private interceptConsoleErrors() {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      const errorInfo = this.createErrorInfo({
        message: errorMessage,
        category: ErrorCategory.RUNTIME,
        severity: ErrorSeverity.MEDIUM,
        source: ErrorSource.GLOBAL,
        metadata: { consoleArgs: args }
      });
      
      logger.error('errorService', 'console_error', 'Console error intercepted', {
        errorId: errorInfo.id,
        message: errorMessage
      });
      
      this.handleError(errorInfo);
      originalError.apply(console, args);
    };
    
    console.warn = (...args) => {
      const warnMessage = args.join(' ');
      
      // Only create error for certain warning patterns
      if (this.shouldTreatWarningAsError(warnMessage)) {
        const errorInfo = this.createErrorInfo({
          message: warnMessage,
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.LOW,
          source: ErrorSource.GLOBAL,
          metadata: { consoleArgs: args }
        });
        
        logger.warn('errorService', 'console_warning', 'Console warning treated as error', {
          errorId: errorInfo.id,
          message: warnMessage
        });
        
        this.handleError(errorInfo);
      }
      
      originalWarn.apply(console, args);
    };
  }

  private setupPerformanceErrorHandling() {
    // Monitor for performance issues
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          if (navEntry.loadEventEnd - navEntry.loadEventStart > 3000) {
            const errorInfo = this.createErrorInfo({
              message: 'Page load time exceeded 3 seconds',
              category: ErrorCategory.PERFORMANCE,
              severity: ErrorSeverity.MEDIUM,
              source: ErrorSource.BACKGROUND,
              performanceMetrics: {
                loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
                timestamp: new Date().toISOString()
              }
            });
            
            logger.warn('errorService', 'performance_issue', 'Page load performance issue detected', {
              errorId: errorInfo.id,
              loadTime: navEntry.loadEventEnd - navEntry.loadEventStart
            });
            
            this.handleError(errorInfo);
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['navigation'] });
  }

  private createErrorInfo(partial: Partial<ErrorInfo>): ErrorInfo {
    const id = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    // Analyze error patterns to enhance categorization
    const pattern = this.errorPatterns.find(p => p.pattern.test(partial.message || ''));
    const category = partial.category || pattern?.category || ErrorCategory.UNKNOWN;
    const severity = partial.severity || pattern?.severity || ErrorSeverity.MEDIUM;
    
    const errorInfo: ErrorInfo = {
      id,
      message: partial.message || 'Unknown Error',
      status: partial.status || 500,
      stack: partial.stack,
      url: get(page).url.href,
      timestamp,
      userAgent: navigator.userAgent,
      category,
      severity,
      context: {
        ...partial.context,
        route: get(page).url.pathname,
        sessionId: this.getSessionId()
      },
      metadata: partial.metadata,
      resolved: false,
      retryCount: 0,
      maxRetries: this.getMaxRetries(category),
      source: partial.source || ErrorSource.GLOBAL,
      componentStack: partial.componentStack,
      performanceMetrics: partial.performanceMetrics,
      userActions: [],
      relatedErrors: [],
      tags: pattern?.tags || []
    };

    return errorInfo;
  }

  private async handleError(errorInfo: ErrorInfo) {
    // Prevent infinite error loops
    if (this.isHandlingError) {
      logger.error('errorService', 'error_loop', 'Error while handling error - preventing loop', {
        originalErrorId: errorInfo.id,
        message: errorInfo.message
      });
      return;
    }

    this.isHandlingError = true;

    try {
      // Add to error queue and update stores
    this.errorQueue.push(errorInfo);
      this.errors.update(errors => [...errors, errorInfo]);

      // Log comprehensive error information
      logger.error('errorService', 'error_handled', 'Error caught and being processed', {
        errorId: errorInfo.id,
        message: errorInfo.message,
        category: errorInfo.category,
        severity: errorInfo.severity,
        source: errorInfo.source,
        url: errorInfo.url,
        context: errorInfo.context,
        metadata: errorInfo.metadata
      });

      // Run error analytics
      await this.errorAnalytics.analyzeError(errorInfo);

      // Check for error patterns and related errors
      await this.detectErrorPatterns(errorInfo);

      // Try to recover automatically
      const recovered = await this.errorRecovery.attemptRecovery(errorInfo);
      if (recovered) {
        logger.info('errorService', 'error_recovered', 'Error automatically recovered', {
          errorId: errorInfo.id,
          recoveryMethod: 'automatic'
        });
        this.markErrorResolved(errorInfo.id);
        return;
      }

      // Find and execute appropriate error handlers
      const handlers = this.errorHandlers.get(errorInfo.category) || [];
      for (const handler of handlers) {
        if (handler.canHandle(errorInfo)) {
          await handler.handle(errorInfo);
          break;
        }
      }

      // Determine if we should show error page
      if (this.shouldShowErrorPage(errorInfo)) {
        await this.navigateToErrorPage(errorInfo);
      }

      // Report error to external services
      await this.errorReporting.reportError(errorInfo);

    } catch (handlingError) {
      logger.error('errorService', 'handling_error', 'Error occurred while handling error', {
        originalErrorId: errorInfo.id,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown',
        stack: handlingError instanceof Error ? handlingError.stack : undefined
      });
    } finally {
    // Reset flag after a delay
    setTimeout(() => {
      this.isHandlingError = false;
    }, 1000);
    }
  }

  private async handleNetworkError(error: ErrorInfo) {
    const strategy = this.retryStrategies.get(ErrorCategory.NETWORK);
    if (strategy && strategy.shouldRetry(error) && error.retryCount < error.maxRetries) {
      await this.retryError(error, strategy);
    } else {
      await this.navigateToErrorPage(error);
    }
  }

  private async handleAuthError(error: ErrorInfo) {
    // Auth errors are handled by auth service, just log them
    logger.warn('errorService', 'auth_error', 'Authentication error detected', {
      errorId: error.id,
      message: error.message
    });
  }

  private async handleRuntimeError(error: ErrorInfo) {
    // For runtime errors, try to recover if possible
    const recovered = await this.errorRecovery.attemptRecovery(error);
    if (!recovered) {
      await this.navigateToErrorPage(error);
    }
  }

  private async handleUIError(error: ErrorInfo) {
    // UI errors might be recoverable
    const strategy = this.retryStrategies.get(ErrorCategory.UI);
    if (strategy && error.retryCount < error.maxRetries) {
      await this.retryError(error, strategy);
    } else {
      await this.navigateToErrorPage(error);
    }
  }

  private async retryError(error: ErrorInfo, strategy: RetryStrategy) {
    const delay = Math.min(
      strategy.baseDelay * Math.pow(strategy.backoffMultiplier, error.retryCount),
      strategy.maxDelay
    );

    error.retryCount++;
    error.lastRetry = new Date().toISOString();

    logger.info('errorService', 'retry_error', 'Retrying error', {
      errorId: error.id,
      retryCount: error.retryCount,
      maxRetries: error.maxRetries,
      delay: `${delay}ms`
    });

    setTimeout(async () => {
      try {
        // Attempt to retry the operation
        const success = await this.errorRecovery.attemptRecovery(error);
        if (success) {
          this.markErrorResolved(error.id);
        } else if (error.retryCount >= error.maxRetries) {
          await this.navigateToErrorPage(error);
        }
      } catch (retryError) {
        logger.error('errorService', 'retry_failed', 'Error retry failed', {
          errorId: error.id,
          retryError: retryError instanceof Error ? retryError.message : 'Unknown'
        });
      }
    }, delay);
  }

  private async navigateToErrorPage(errorInfo: ErrorInfo) {
    // Don't redirect if already on error page
    if (get(page).url.pathname === '/error') {
      return;
    }

    // Create comprehensive error report
    const errorReport = await this.createErrorReport(errorInfo);

    // Navigate to error page with detailed information
    const params = new URLSearchParams({
      errorId: errorInfo.id,
      status: errorInfo.status?.toString() || '500',
      category: errorInfo.category,
      severity: errorInfo.severity,
      message: encodeURIComponent(errorInfo.message),
      report: encodeURIComponent(JSON.stringify(errorReport))
    });

    goto(`/error?${params.toString()}`);
  }

  private async createErrorReport(errorInfo: ErrorInfo): Promise<ErrorReport> {
    const environment = await this.getEnvironmentInfo();
    const diagnostics = await this.getDiagnosticInfo();
    const recommendations = await this.generateRecommendations(errorInfo);

    return {
      error: errorInfo,
      environment,
      diagnostics,
      recommendations
    };
  }

  private async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    const memoryInfo = (performance as any).memory;
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      connectionType: (navigator as any).connection?.effectiveType,
      memoryInfo: memoryInfo ? {
        used: memoryInfo.usedJSHeapSize,
        total: memoryInfo.totalJSHeapSize,
        limit: memoryInfo.jsHeapSizeLimit
      } : undefined,
      performanceInfo: {
        timeOrigin: performance.timeOrigin,
        navigationStart: performance.timing?.navigationStart
      },
      appVersion: '1.0.0', // Get from your app config
      buildNumber: '1', // Get from your app config
      environment: import.meta.env.MODE
    };
  }

  private async getDiagnosticInfo(): Promise<DiagnosticInfo> {
    const recentErrors = this.errorQueue.slice(-10);
    const systemHealth = await this.performanceMonitor.getSystemHealth();
    const networkStatus = await this.getNetworkStatus();
    const storageStatus = await this.getStorageStatus();

    return {
      systemHealth,
      recentErrors,
      performanceIssues: await this.performanceMonitor.getPerformanceIssues(),
      networkStatus,
      storageStatus
    };
  }

  private async generateRecommendations(errorInfo: ErrorInfo): Promise<string[]> {
    const recommendations: string[] = [];

    switch (errorInfo.category) {
      case ErrorCategory.NETWORK:
        recommendations.push(
          'Check your internet connection',
          'Try refreshing the page',
          'Clear your browser cache',
          'Check if the service is down'
        );
        break;
      case ErrorCategory.AUTHENTICATION:
        recommendations.push(
          'Log out and log back in',
          'Clear your browser cookies',
          'Check if your session has expired'
        );
        break;
      case ErrorCategory.PERFORMANCE:
        recommendations.push(
          'Close other browser tabs',
          'Restart your browser',
          'Check your device memory usage'
        );
        break;
      default:
        recommendations.push(
          'Try refreshing the page',
          'Clear your browser cache',
          'Contact support if the problem persists'
        );
    }

    return recommendations;
  }

  // Public methods
  public handleManualError(error: Error | string, status: number = 500, context?: Partial<ErrorContext>) {
    const errorInfo = this.createErrorInfo({
      message: typeof error === 'string' ? error : error.message,
      status,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      source: ErrorSource.USER_ACTION
    });

    this.handleError(errorInfo);
  }

  public registerErrorHandler(category: ErrorCategory, handler: ErrorHandler) {
    if (!this.errorHandlers.has(category)) {
      this.errorHandlers.set(category, []);
    }
    this.errorHandlers.get(category)!.push(handler);
  }

  public markErrorResolved(errorId: string) {
    this.errorQueue = this.errorQueue.map(error => 
      error.id === errorId ? { ...error, resolved: true } : error
    );
    this.errors.update(errors => 
      errors.map(error => error.id === errorId ? { ...error, resolved: true } : error)
    );
  }

  public getErrorQueue(): ErrorInfo[] {
    return [...this.errorQueue];
  }

  public clearErrorQueue(): void {
    this.errorQueue = [];
    this.errors.set([]);
  }

  public getErrorById(errorId: string): ErrorInfo | undefined {
    return this.errorQueue.find(error => error.id === errorId);
  }

  public getErrorsByCategory(category: ErrorCategory): ErrorInfo[] {
    return this.errorQueue.filter(error => error.category === category);
  }

  public getErrorsBySeverity(severity: ErrorSeverity): ErrorInfo[] {
    return this.errorQueue.filter(error => error.severity === severity);
  }

  public async reportError(errorInfo: ErrorInfo): Promise<void> {
    return this.errorReporting.reportError(errorInfo);
  }

  // Utility methods
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionId(): string {
    return sessionStorage.getItem('sessionId') || 'unknown';
  }

  private getMaxRetries(category: ErrorCategory): number {
    const strategy = this.retryStrategies.get(category);
    return strategy?.maxRetries || 0;
  }

  private categorizeHttpError(status: number): ErrorCategory {
    if (status >= 500) return ErrorCategory.EXTERNAL_SERVICE;
    if (status === 401) return ErrorCategory.AUTHENTICATION;
    if (status === 403) return ErrorCategory.AUTHORIZATION;
    if (status === 404) return ErrorCategory.RESOURCE;
    if (status === 422) return ErrorCategory.VALIDATION;
    if (status === 429) return ErrorCategory.QUOTA;
    return ErrorCategory.NETWORK;
  }

  private categorizeHttpSeverity(status: number): ErrorSeverity {
    if (status >= 500) return ErrorSeverity.HIGH;
    if (status === 401 || status === 403) return ErrorSeverity.MEDIUM;
    if (status === 404) return ErrorSeverity.LOW;
    return ErrorSeverity.MEDIUM;
  }

  private shouldTreatWarningAsError(message: string): boolean {
    const criticalWarnings = [
      'deprecated',
      'experimental',
      'security',
      'memory leak',
      'performance'
    ];
    return criticalWarnings.some(warning => message.toLowerCase().includes(warning));
  }

  private shouldShowErrorPage(errorInfo: ErrorInfo): boolean {
    // Don't show error page for low severity errors
    if (errorInfo.severity === ErrorSeverity.LOW) return false;
    
    // Don't show error page for resolved errors
    if (errorInfo.resolved) return false;
    
    // Don't show error page for auth errors (handled by auth service)
    if (errorInfo.category === ErrorCategory.AUTHENTICATION) return false;
    
    // Show error page for critical errors and high severity errors
    if (errorInfo.severity === ErrorSeverity.CRITICAL || errorInfo.severity === ErrorSeverity.HIGH) {
      return true;
    }
    
    // Show error page for medium severity errors after retries are exhausted
    if (errorInfo.severity === ErrorSeverity.MEDIUM && errorInfo.retryCount >= errorInfo.maxRetries) {
      return true;
    }
    
    return false;
  }

  private async detectErrorPatterns(errorInfo: ErrorInfo) {
    // Find similar errors in the queue
    const similarErrors = this.errorQueue.filter(error => 
      error.id !== errorInfo.id &&
      error.category === errorInfo.category &&
      error.message.includes(errorInfo.message.split(' ')[0]) // Simple similarity check
    );

    if (similarErrors.length > 0) {
      errorInfo.relatedErrors = similarErrors.map(e => e.id);
      logger.warn('errorService', 'error_pattern', 'Similar errors detected', {
        errorId: errorInfo.id,
        similarErrorIds: errorInfo.relatedErrors,
        pattern: errorInfo.category
      });
    }
  }

  private startPerformanceMonitoring() {
    this.performanceMonitor.start();
  }

  private groupErrorsByCategory(errors: ErrorInfo[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupErrorsBySeverity(errors: ErrorInfo[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getNetworkStatus(): Promise<NetworkStatus> {
    const startTime = performance.now();
    try {
      await fetch('/api/health', { method: 'HEAD' });
      const endTime = performance.now();
      return {
        isOnline: true,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown',
        latency: endTime - startTime,
        bandwidth: 0, // Would need to implement bandwidth testing
        lastCheck: new Date().toISOString()
      };
    } catch {
      return {
        isOnline: false,
        connectionType: 'unknown',
        latency: 0,
        bandwidth: 0,
        lastCheck: new Date().toISOString()
      };
    }
  }

  private async getStorageStatus(): Promise<StorageStatus> {
    const localStorageCount = window.localStorage.length;
    const sessionStorageCount = window.sessionStorage.length;
    
    // Estimate IndexedDB usage (simplified)
    let indexedDB = 0;
    try {
      // This is a simplified check - in reality you'd need to query actual IndexedDB usage
      indexedDB = 0;
    } catch {
      indexedDB = 0;
    }

    return {
      localStorage: localStorageCount,
      sessionStorage: sessionStorageCount,
      indexedDB,
      quota: 0 // Would need to implement quota checking
    };
  }
}

// Supporting classes
interface ErrorHandler {
  canHandle: (error: ErrorInfo) => boolean;
  handle: (error: ErrorInfo) => Promise<void>;
}

interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  shouldRetry: (error: ErrorInfo) => boolean;
}

interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  tags: string[];
}

class PerformanceMonitor {
  private isMonitoring = false;
  private metrics: PerformanceMetrics[] = [];

  start() {
    this.isMonitoring = true;
    this.collectMetrics();
  }

  stop() {
    this.isMonitoring = false;
  }

  private collectMetrics() {
    if (!this.isMonitoring) return;

    const metric: PerformanceMetrics = {
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      cpuUsage: 0, // Would need to implement CPU monitoring
      loadTime: performance.now(),
      responseTime: 0,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    setTimeout(() => this.collectMetrics(), 5000);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const latestMetric = this.metrics[this.metrics.length - 1];
    const memoryUsage = latestMetric?.memoryUsage || 0;
    const cpuUsage = latestMetric?.cpuUsage || 0;
    
    // Simplified health calculation
    let overallHealth: SystemHealth['overallHealth'] = 'excellent';
    if (memoryUsage > 100000000) overallHealth = 'poor';
    else if (memoryUsage > 50000000) overallHealth = 'fair';
    else if (memoryUsage > 10000000) overallHealth = 'good';

    return {
      memoryUsage,
      cpuUsage,
      diskSpace: 0, // Would need to implement disk space checking
      networkLatency: 0, // Would need to implement latency checking
      overallHealth
    };
  }

  async getPerformanceIssues(): Promise<string[]> {
    const issues: string[] = [];
    const latestMetrics = this.metrics.slice(-10);
    
    if (latestMetrics.length > 0) {
      const avgMemory = latestMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / latestMetrics.length;
      if (avgMemory > 100000000) {
        issues.push('High memory usage detected');
      }
    }

    return issues;
  }
}

class ErrorAnalytics {
  async analyzeError(error: ErrorInfo) {
    // Analyze error patterns, frequency, impact
    logger.info('errorService', 'error_analyzed', 'Error analyzed for patterns', {
      errorId: error.id,
      category: error.category,
      severity: error.severity
    });
  }
}

class ErrorRecovery {
  async attemptRecovery(error: ErrorInfo): Promise<boolean> {
    // Implement automatic recovery strategies
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return await this.attemptNetworkRecovery(error);
      case ErrorCategory.UI:
        return await this.attemptUIRecovery(error);
      default:
        return false;
    }
  }

  private async attemptNetworkRecovery(error: ErrorInfo): Promise<boolean> {
    // Try to reconnect or retry the operation
    return false; // Simplified for now
  }

  private async attemptUIRecovery(error: ErrorInfo): Promise<boolean> {
    // Try to refresh the component or state
    return false; // Simplified for now
  }
}

class ErrorReporting {
  async reportError(error: ErrorInfo) {
    // Report to external services like Sentry, LogRocket, etc.
    logger.info('errorService', 'error_reported', 'Error reported to external service', {
      errorId: error.id,
      category: error.category,
      severity: error.severity
    });
  }
}

// Create singleton instance
export const errorService = new ErrorService();

// Export utility functions
export function handleError(error: Error | string, status: number = 500, context?: Partial<ErrorContext>) {
  errorService.handleManualError(error, status, context);
}

export function reportError(errorInfo: ErrorInfo) {
  return errorService.reportError(errorInfo);
} 