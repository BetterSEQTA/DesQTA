# Logging System - Quick Reference

## Frontend Logging (TypeScript)

### Basic Usage
```typescript
import { logger } from '../utils/logger';

logger.trace('module', 'function', 'Detailed trace info');
logger.debug('module', 'function', 'Debug information');
logger.info('module', 'function', 'General information');
logger.warn('module', 'function', 'Warning message');
logger.error('module', 'function', 'Error occurred');
logger.fatal('module', 'function', 'Critical failure');
```

### With Metadata
```typescript
logger.error('auth', 'login', 'Login failed', { 
  username: 'user@example.com',
  errorCode: 401,
  attempts: 3
});
```

### Convenience Functions
```typescript
import { info, error, debug } from '../utils/logger';

info('module', 'function', 'Message');
error('module', 'function', 'Error', { context: 'data' });
```

### Component Lifecycle
```typescript
// In Svelte components
onMount(() => logger.logComponentMount('ComponentName'));
onDestroy(() => logger.logComponentUnmount('ComponentName'));
```

### HTTP Requests
```typescript
import { loggedFetch } from '../utils/logger';

const response = await loggedFetch('service', 'function', '/api/endpoint');
```

### Decorators
```typescript
import { logFunction, logPerformance } from '../utils/logger';

class Service {
  @logFunction('service')
  @logPerformance('service')
  async method() { /* auto-logged */ }
}
```

## Backend Logging (Rust)

### Basic Usage
```rust
use crate::{log_info, log_error, log_debug, log_warn, log_trace, log_fatal};

log_info!("module", "function", "Message");
log_error!("module", "function", "Error message", 
  serde_json::json!({"error_code": 500}));
```

### Function Entry/Exit
```rust
use crate::{log_function_entry, log_function_exit};

pub fn my_function(data: &str) -> Result<String, String> {
    log_function_entry!("module", "my_function", 
      serde_json::json!({"data_len": data.len()}));
    
    let result = process_data(data);
    
    log_function_exit!("module", "my_function", 
      serde_json::json!({"success": result.is_ok()}));
    
    result
}
```

## Log Levels

| Level | Frontend | Rust | Usage |
|-------|----------|------|-------|
| TRACE | `logger.trace()` | `log_trace!()` | Function entry/exit |
| DEBUG | `logger.debug()` | `log_debug!()` | Development info |
| INFO | `logger.info()` | `log_info!()` | Important events |
| WARN | `logger.warn()` | `log_warn!()` | Non-critical issues |
| ERROR | `logger.error()` | `log_error!()` | Application errors |
| FATAL | `logger.fatal()` | `log_fatal!()` | Critical failures |

## Configuration

### Frontend
```typescript
logger.setConfig({
  level: LogLevel.DEBUG,
  enableConsole: true,
  enableBackend: true,
  bufferSize: 50,
  flushInterval: 3000
});
```

### Backend (via Tauri command)
```typescript
await invoke('set_log_level_command', { level: 'DEBUG' });
```

## Log Management Commands

```typescript
// Get log file path
const path = await invoke<string>('get_log_file_path_command');

// Get recent logs
const logs = await invoke<string>('get_logs_for_troubleshooting');

// Export support package
const support = await invoke<string>('export_logs_for_support');

// Clear logs
await invoke('clear_logs');
```

## Log File Location

- **Windows**: `%APPDATA%/DesQTA/logs/latest.log`
- **macOS**: `~/Library/Application Support/DesQTA/logs/latest.log`
- **Linux**: `~/.local/share/DesQTA/logs/latest.log`
- **Android**: `/data/data/com.desqta.app/files/DesQTA/logs/latest.log`

## Best Practices

### ✅ Do
- Use appropriate log levels
- Include relevant metadata
- Use consistent module/function names
- Log important state changes
- Log errors with context

### ❌ Don't
- Log sensitive information (passwords, tokens)
- Use string concatenation in log messages
- Log in tight loops without throttling
- Use TRACE level in production
- Ignore error logging

## Common Patterns

### Service Initialization
```typescript
logger.info('serviceName', 'constructor', 'Service initialized', { 
  version: '1.0.0',
  config: sanitizedConfig 
});
```

### Error Handling
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('module', 'function', `Operation failed: ${error.message}`, {
    error: error.name,
    stack: error.stack
  });
  throw error;
}
```

### Performance Monitoring
```typescript
const stopTimer = logger.startTimer('module', 'function', 'operation');
await performOperation();
stopTimer(); // Automatically logs duration
```

### User Actions
```typescript
logger.logUserAction('click', 'login-button', { 
  timestamp: Date.now(),
  page: '/login' 
});
```

## Troubleshooting

### Enable Debug Mode
```typescript
// Frontend
logger.setLogLevel(LogLevel.TRACE);

// Backend
await invoke('set_log_level_command', { level: 'TRACE' });
```

### Check Log Output
1. Open troubleshooting modal in app
2. View recent logs
3. Export support package
4. Check log file directly at system path

### Performance Issues
- Increase flush interval: `flushInterval: 5000`
- Reduce log level: `level: LogLevel.WARN`
- Disable console output: `enableConsole: false` 