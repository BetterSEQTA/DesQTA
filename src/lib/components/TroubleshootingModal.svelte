<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { 
    XMark, 
    ComputerDesktop, 
    Wifi, 
    CircleStack, 
    Clock, 
    ChartBar, 
    DocumentText, 
    ExclamationTriangle,
    LightBulb, 
    ShieldCheck, 
    ExclamationCircle, 
    CheckCircle, 
    XCircle,
    Cog,
    InformationCircle,
    ArrowPath,
    ClipboardDocument,
    CommandLine,
    Beaker
  } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';
  import { errorService } from '../services/errorService';
  import { seqtaFetch } from '../../utils/netUtil';

  let { open, onclose, errorReport } = $props<{
    open: boolean;
    onclose: () => void;
    errorReport?: any;
  }>();

  let activeTab = $state('diagnostics');
  let copiedToClipboard = $state(false);
  let logs = $state<any[]>([]);
  let loadingLogs = $state(false);
  let apiTestResult = $state<{ success: boolean; message: string } | null>(null);

  // System information
  let systemInfo = $derived({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    connectionType: (navigator as any).connection?.effectiveType || 'unknown',
    memoryInfo: (performance as any).memory ? {
      used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
    } : null,
    performanceInfo: {
      timeOrigin: performance.timeOrigin,
      navigationStart: performance.timing?.navigationStart
    }
  });

  // Error statistics
  let errorStats = $derived(errorService.errorStats);

  // Auto-load logs when System Logs tab is opened
  $effect(() => {
    if (activeTab === 'logs' && logs.length === 0) {
      loadSystemLogs();
    }
  });

  function closeModal() {
    onclose();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      copiedToClipboard = true;
      setTimeout(() => {
        copiedToClipboard = false;
      }, 2000);
    });
  }

  function generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo,
      errorReport,
      errorStats: errorStats,
      recentErrors: errorService.getErrorQueue().slice(-10),
      performance: {
        memoryUsage: systemInfo.memoryInfo?.used || 0,
        loadTime: performance.now(),
        navigationTiming: performance.timing ? {
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.domContentLoadedEventStart,
          loadComplete: performance.timing.loadEventEnd - performance.timing.loadEventStart,
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        } : null
      }
    };

    const reportText = JSON.stringify(report, null, 2);
    copyToClipboard(reportText);
    
    logger.info('troubleshootingModal', 'generateDiagnosticReport', 'Diagnostic report generated and copied to clipboard', {
      reportSize: reportText.length
    });
  }

  function runSystemDiagnostics() {
    logger.info('troubleshootingModal', 'runSystemDiagnostics', 'Running system diagnostics');
    
    // Simulate running diagnostics
    setTimeout(() => {
      logger.info('troubleshootingModal', 'runSystemDiagnostics', 'System diagnostics completed');
    }, 2000);
  }

  function clearErrorLogs() {
    errorService.clearErrorQueue();
    logger.info('troubleshootingModal', 'clearErrorLogs', 'Error logs cleared');
  }

  async function loadSystemLogs() {
    loadingLogs = true;
    try {
      // Get logs from the Rust backend logger
      const { invoke } = await import('@tauri-apps/api/core');
      const logData = await invoke<string>('get_logs_for_troubleshooting');
      logs = logData ? logData.split('\n').filter(line => line.trim()) : [];
      logger.info('troubleshootingModal', 'loadSystemLogs', 'System logs loaded', { count: logs.length });
    } catch (error) {
      logger.error('troubleshootingModal', 'loadSystemLogs', 'Failed to load system logs', { error });
      logs = [];
    } finally {
      loadingLogs = false;
    }
  }

  async function exportLogs() {
    try {
      const logReport = {
        timestamp: new Date().toISOString(),
        systemInfo,
        errorReport,
        errorStats: $errorStats,
        systemLogs: logs,
        recentErrors: errorService.getErrorQueue().slice(-50)
      };

      const logText = JSON.stringify(logReport, null, 2);
      
      // Create and download file
      const blob = new Blob([logText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `desqta-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logger.info('troubleshootingModal', 'exportLogs', 'Logs exported successfully');
    } catch (error) {
      logger.error('troubleshootingModal', 'exportLogs', 'Failed to export logs', { error });
    }
  }

  function getHealthStatus(health: string) {
    switch (health) {
      case 'excellent': return { color: 'text-green-500', icon: CheckCircle };
      case 'good': return { color: 'text-blue-500', icon: CheckCircle };
      case 'fair': return { color: 'text-yellow-500', icon: ExclamationCircle };
      case 'poor': return { color: 'text-orange-500', icon: ExclamationCircle };
      case 'critical': return { color: 'text-red-500', icon: XCircle };
      default: return { color: 'text-gray-500', icon: InformationCircle };
    }
  }

  function getNetworkStatus() {
    return navigator.onLine ? 
      { status: 'Online', color: 'text-green-500', icon: CheckCircle } : 
      { status: 'Offline', color: 'text-red-500', icon: XCircle };
  }

  function getStorageStatus() {
    const localStorageCount = window.localStorage.length;
    const sessionStorageCount = window.sessionStorage.length;
    
    if (localStorageCount > 1000) {
      return { status: 'High Usage', color: 'text-orange-500', icon: ExclamationCircle };
    } else if (localStorageCount > 100) {
      return { status: 'Moderate Usage', color: 'text-yellow-500', icon: InformationCircle };
    } else {
      return { status: 'Normal Usage', color: 'text-green-500', icon: CheckCircle };
    }
  }

  async function testApiConnection() {
    try {
      const response = await seqtaFetch('/seqta/student/heartbeat');
      apiTestResult = { success: true, message: 'API connection successful' };
      logger.info('troubleshootingModal', 'testApiConnection', 'API connection test successful');
    } catch (error) {
      apiTestResult = { success: false, message: 'API connection failed' };
      logger.error('troubleshootingModal', 'testApiConnection', 'API connection test failed', { error });
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen p-4">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onclick={closeModal}></div>

      <!-- Modal panel -->
      <div class="relative bg-white dark:bg-slate-900 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all w-full max-w-6xl max-h-[90vh]">
    <!-- Header -->
        <div class="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Icon src={Cog} size="24" class="text-slate-600 dark:text-slate-400" />
              <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Advanced Troubleshooting</h2>
            </div>
            <button
              onclick={closeModal}
              class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
            >
              <Icon src={XMark} size="20" />
            </button>
      </div>
    </div>

        <!-- Tabs -->
        <div class="border-b border-slate-200 dark:border-slate-700">
          <nav class="flex space-x-8 px-6">
            {#each [
              { id: 'diagnostics', label: 'System Diagnostics', icon: ComputerDesktop },
              { id: 'errors', label: 'Error Logs', icon: ExclamationTriangle },
              { id: 'logs', label: 'System Logs', icon: DocumentText },
              { id: 'performance', label: 'Performance', icon: ChartBar },
              { id: 'network', label: 'Network', icon: Wifi },
              { id: 'storage', label: 'Storage', icon: CircleStack },
              { id: 'troubleshooting', label: 'Troubleshooting', icon: LightBulb }
            ] as tab}
        <button 
                onclick={() => activeTab = tab.id}
                class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 {activeTab === tab.id ? 'border-accent-500 text-accent-600 dark:text-accent-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
              >
                <Icon src={tab.icon} size="16" />
                {tab.label}
        </button>
            {/each}
          </nav>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 140px);">
          <!-- System Diagnostics Tab -->
          {#if activeTab === 'diagnostics'}
            <div class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- System Health -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icon src={ComputerDesktop} size="16" />
                    System Health
                  </h3>
                  <div class="space-y-2">
                    {#if errorReport?.diagnostics?.systemHealth}
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Overall Health:</span>
                        <div class="flex items-center gap-2">
                          <Icon src={getHealthStatus(errorReport.diagnostics.systemHealth.overallHealth).icon} size="16" class={getHealthStatus(errorReport.diagnostics.systemHealth.overallHealth).color} />
                          <span class="text-sm font-medium {getHealthStatus(errorReport.diagnostics.systemHealth.overallHealth).color}">{errorReport.diagnostics.systemHealth.overallHealth}</span>
                        </div>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Memory Usage:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {Math.round(errorReport.diagnostics.systemHealth.memoryUsage / 1024 / 1024)} MB
                        </span>
      </div>
                    {:else}
                      <div class="text-sm text-slate-500 dark:text-slate-400">No health data available</div>
    {/if}
                  </div>
                </div>

                <!-- Network Status -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icon src={Wifi} size="16" />
                    Network Status
                  </h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Connection:</span>
                      <div class="flex items-center gap-2">
                        <Icon src={getNetworkStatus().icon} size="16" class={getNetworkStatus().color} />
                        <span class="text-sm font-medium {getNetworkStatus().color}">{getNetworkStatus().status}</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Type:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{systemInfo.connectionType}</span>
                    </div>
                  </div>
                </div>

                <!-- Storage Status -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icon src={CircleStack} size="16" />
                    Storage Status
                  </h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Local Storage:</span>
                      <div class="flex items-center gap-2">
                        <Icon src={getStorageStatus().icon} size="16" class={getStorageStatus().color} />
                        <span class="text-sm font-medium {getStorageStatus().color}">{getStorageStatus().status}</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Items:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{window.localStorage.length}</span>
                    </div>
                  </div>
                </div>

                <!-- Error Statistics -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icon src={ExclamationTriangle} size="16" />
                    Error Statistics
                  </h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Total Errors:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{$errorStats.total}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Resolved:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{$errorStats.resolved}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Critical:</span>
                      <span class="text-sm font-medium text-red-500">{$errorStats.critical}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-3">
                <button
                  onclick={runSystemDiagnostics}
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-600"
                >
                  <Icon src={Beaker} size="16" class="inline mr-2" />
                  Run Diagnostics
                </button>
        <button 
                  onclick={generateDiagnosticReport}
                  class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 hover:bg-green-600"
                >
                  <Icon src={ClipboardDocument} size="16" class="inline mr-2" />
                  {copiedToClipboard ? 'Copied!' : 'Copy Report'}
        </button>
              </div>
      </div>
    {/if}

          <!-- Error Logs Tab -->
          {#if activeTab === 'errors'}
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Recent Error Logs</h3>
          <button
                  onclick={clearErrorLogs}
                  class="px-3 py-1 bg-red-500 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-red-600"
                >
            Clear Logs
          </button>
        </div>

              <div class="space-y-3 max-h-64 overflow-y-auto">
                {#each errorService.getErrorQueue().slice(-20).reverse() as error}
                  <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-slate-900 dark:text-white">{error.message}</span>
                        <span class="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {error.category}
                        </span>
                        <span class="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {error.severity}
                        </span>
                      </div>
                      <span class="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {#if error.context?.component}
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        Component: {error.context.component}
                        {#if error.context.function} | Function: {error.context.function}{/if}
                        {#if error.context.operation} | Operation: {error.context.operation}{/if}
                      </div>
                    {/if}
                    {#if error.resolved}
                      <div class="text-xs text-green-600 dark:text-green-400 mt-1">
                        ✓ Resolved
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- System Logs Tab -->
          {#if activeTab === 'logs'}
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">System Logs</h3>
                <div class="flex gap-2">
                  <button
                    onclick={loadSystemLogs}
                    disabled={loadingLogs}
                    class="px-3 py-1 bg-blue-500 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingLogs ? 'Loading...' : 'Load Logs'}
                  </button>
                  <button
                    onclick={exportLogs}
                    class="px-3 py-1 bg-green-500 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 hover:bg-green-600"
                  >
                    Export All
                  </button>
        </div>
      </div>

              <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div class="space-y-3 max-h-96 overflow-y-auto">
                  {#if logs.length > 0}
                    {#each logs as log, index}
                      <div class="text-sm font-mono text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2 last:border-b-0">
                        <div class="flex items-start gap-2">
                          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[60px]">[{index + 1}]</span>
                          <span class="flex-1 break-all">{log}</span>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <div class="text-center text-slate-500 dark:text-slate-400 py-8">
                      <Icon src={DocumentText} size="48" class="mx-auto mb-4 opacity-50" />
                      <p>No logs loaded</p>
                      <p class="text-xs mt-2">Click "Load Logs" to fetch recent system logs</p>
        </div>
      {/if}
    </div>
              </div>
            </div>
          {/if}

          <!-- Performance Tab -->
          {#if activeTab === 'performance'}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Performance Metrics</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Memory Usage -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Memory Usage</h4>
                  {#if systemInfo.memoryInfo}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Used:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{systemInfo.memoryInfo.used} MB</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Total:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{systemInfo.memoryInfo.total} MB</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Limit:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{systemInfo.memoryInfo.limit} MB</span>
                      </div>
                      <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div 
                          class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style="width: {(systemInfo.memoryInfo.used / systemInfo.memoryInfo.limit) * 100}%"
                        ></div>
                      </div>
                    </div>
                  {:else}
                    <div class="text-sm text-slate-500 dark:text-slate-400">Memory information not available</div>
                  {/if}
                </div>

                <!-- Load Times -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Load Times</h4>
                  {#if systemInfo.performanceInfo.navigationStart}
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">DOM Ready:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {Math.round((performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart) / 1000)}s
          </span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Page Load:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {Math.round((performance.timing.loadEventEnd - performance.timing.navigationStart) / 1000)}s
          </span>
                      </div>
                    </div>
                  {:else}
                    <div class="text-sm text-slate-500 dark:text-slate-400">Performance timing not available</div>
                  {/if}
                </div>
              </div>

              <!-- Performance Issues -->
              {#if errorReport?.diagnostics?.performanceIssues?.length > 0}
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <h4 class="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                    <Icon src={ExclamationCircle} size="16" />
                    Performance Issues
                  </h4>
                  <ul class="space-y-2">
                    {#each errorReport.diagnostics.performanceIssues as issue}
                      <li class="text-sm text-yellow-600 dark:text-yellow-300 flex items-start gap-2">
                        <Icon src={XCircle} size="14" class="mt-0.5 text-yellow-500" />
                        {issue}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Network Tab -->
          {#if activeTab === 'network'}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Network Information</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Connection Info -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Connection Details</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Status:</span>
                      <span class="text-sm font-medium {navigator.onLine ? 'text-green-500' : 'text-red-500'}">
                        {navigator.onLine ? 'Online' : 'Offline'}
          </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Type:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{systemInfo.connectionType}</span>
                    </div>
                    {#if errorReport?.diagnostics?.networkStatus}
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-slate-600 dark:text-slate-400">Latency:</span>
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {Math.round(errorReport.diagnostics.networkStatus.latency)}ms
          </span>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Network Tests -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Network Tests</h4>
                  <div class="space-y-3">
                    <button
                      onclick={testApiConnection}
                      class="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-600"
                    >
                      Test API Connection
                    </button>
                    <button
                      onclick={() => window.open('https://www.google.com', '_blank')}
                      class="w-full px-3 py-2 bg-green-500 text-white rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 hover:bg-green-600"
                    >
                      Test Internet Connection
                    </button>
                  </div>
                </div>
              </div>

              <!-- API Test Result -->
              {#if apiTestResult}
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icon src={apiTestResult.success ? CheckCircle : XCircle} size="16" class={apiTestResult.success ? 'text-green-500' : 'text-red-500'} />
                    API Test Result
                  </h4>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-slate-600 dark:text-slate-400">Status:</span>
                    <span class="text-sm font-medium {apiTestResult.success ? 'text-green-500' : 'text-red-500'}">
                      {apiTestResult.message}
          </span>
        </div>
      </div>
    {/if}
            </div>
          {/if}

          <!-- Storage Tab -->
          {#if activeTab === 'storage'}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Storage Information</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Local Storage -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Local Storage</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Items:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{localStorage.length}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Size:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {JSON.stringify(localStorage).length} bytes
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Session Storage -->
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Session Storage</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Items:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{sessionStorage.length}</span>
        </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-slate-600 dark:text-slate-400">Size:</span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {JSON.stringify(sessionStorage).length} bytes
            </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Storage Actions -->
              <div class="flex gap-3">
                <button
                  onclick={() => localStorage.clear()}
                  class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-red-600"
                >
                  Clear Local Storage
                </button>
                <button
                  onclick={() => sessionStorage.clear()}
                  class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 hover:bg-orange-600"
                >
                  Clear Session Storage
                </button>
              </div>
            </div>
          {/if}

          <!-- Troubleshooting Tab -->
          {#if activeTab === 'troubleshooting'}
            <div class="space-y-6">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Troubleshooting Steps</h3>
              
              <div class="space-y-4">
                <!-- Common Solutions -->
                <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 class="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <Icon src={LightBulb} size="16" />
                    Common Solutions
                  </h4>
                  <div class="space-y-2">
                    <div class="text-sm text-blue-600 dark:text-blue-300">
                      1. <strong>Refresh the page</strong> - This often resolves temporary issues
                    </div>
                    <div class="text-sm text-blue-600 dark:text-blue-300">
                      2. <strong>Clear browser cache</strong> - Remove stored data that might be corrupted
                    </div>
                    <div class="text-sm text-blue-600 dark:text-blue-300">
                      3. <strong>Check internet connection</strong> - Ensure you have a stable connection
                    </div>
                    <div class="text-sm text-blue-600 dark:text-blue-300">
                      4. <strong>Restart the application</strong> - Close and reopen the app
                    </div>
                  </div>
          </div>
          
                <!-- Advanced Troubleshooting -->
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <h4 class="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                    <Icon src={CommandLine} size="16" />
                    Advanced Troubleshooting
                  </h4>
                  <div class="space-y-2">
                    <div class="text-sm text-yellow-600 dark:text-yellow-300">
                      1. <strong>Check browser console</strong> - Press F12 and look for error messages
                    </div>
                    <div class="text-sm text-yellow-600 dark:text-yellow-300">
                      2. <strong>Disable browser extensions</strong> - Some extensions can interfere
                    </div>
                    <div class="text-sm text-yellow-600 dark:text-yellow-300">
                      3. <strong>Check system resources</strong> - Ensure you have enough memory and CPU
                    </div>
                    <div class="text-sm text-yellow-600 dark:text-yellow-300">
                      4. <strong>Contact support</strong> - If problems persist, provide the diagnostic report
                    </div>
          </div>
        </div>

                <!-- Error-Specific Solutions -->
                {#if errorReport?.recommendations?.length > 0}
                  <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <h4 class="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                      <Icon src={CheckCircle} size="16" />
                      Specific Recommendations
                    </h4>
                    <ul class="space-y-2">
                      {#each errorReport.recommendations as recommendation}
                        <li class="text-sm text-green-600 dark:text-green-300 flex items-start gap-2">
                          <Icon src={CheckCircle} size="14" class="mt-0.5 text-green-500" />
                          {recommendation}
                        </li>
                      {/each}
                    </ul>
        </div>
      {/if}
    </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if} 