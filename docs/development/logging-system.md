# DesQTA Logging System

## Overview

DesQTA features a comprehensive, multi-layered logging system that captures detailed application activity across both the frontend (TypeScript/Svelte) and backend (Rust/Tauri). The system is designed to provide extensive debugging information while maintaining optimal performance.

## Architecture

### Dual-Layer Design

The logging system operates on two layers:

1. **Frontend Logger** (`src/utils/logger.ts`) - TypeScript-based logging for web components
2. **Backend Logger** (`src-tauri/src/utils/logger.rs`) - Rust-based logging for native operations

Both layers write to the same `latest.log` file located in the application's data directory.

### Log File Location

- **Windows**: `%APPDATA%/DesQTA/logs/latest.log`
- **macOS**: `~/Library/Application Support/DesQTA/logs/latest.log`
- **Linux**: `~/.local/share/DesQTA/logs/latest.log`
- **Android**: `/data/data/com.desqta.app/files/DesQTA/logs/latest.log`

## Log Levels

The system supports six log levels in order of severity:

| Level | Code | Description | Usage |
|-------|------|-------------|-------|
| TRACE | 0 | Extremely detailed debugging | Function entry/exit tracking |
| DEBUG | 1 | Detailed debugging information | Development debugging |
| INFO | 2 | General information messages | Important application events |
| WARN | 3 | Warning conditions | Non-critical issues |
| ERROR | 4 | Error conditions | Application errors |
| FATAL | 5 | Critical failures | System-breaking errors |

**Default Level**: INFO (to balance detail with performance)

## Log Format

Each log entry follows a structured format:

```
[TIMESTAMP] [LEVEL] [MODULE::FUNCTION] [FILE:LINE] [THREAD_ID] MESSAGE | METADATA
```

### Example Log Entry

```
[2025-01-24 20:51:00.649] [INFO] [netgrab::fetch_api_data] [netgrab.rs:170] [ThreadId(15)] Starting POST /seqta/student/login | {"url":"/seqta/student/login","method":"POST","is_image":false}
```

## Frontend Logging

### Basic Usage

```typescript
import { logger } from '../utils/logger';

// Simple logging
logger.info('module', 'function', 'User logged in successfully');

// With metadata
logger.error('auth', 'login', 'Login failed', { 
  username: 'user@example.com',
  errorCode: 401 
});
```

### Convenience Functions

```typescript
import { info, error, debug } from '../utils/logger';

info('module', 'function', 'Message');
error('module', 'function', 'Error message', { context: 'data' });
```

### Decorators

#### Function Logging Decorator

```typescript
import { logFunction } from '../utils/logger';

class UserService {
  @logFunction('userService')
  async loadUser(userId: string) {
    // Automatically logs function entry/exit
    return await fetchUser(userId);
  }
}
```

#### Performance Timing Decorator

```typescript
import { logPerformance } from '../utils/logger';

class DataService {
  @logPerformance('dataService')
  async processLargeDataset(data: any[]) {
    // Automatically logs execution time
    return processData(data);
  }
}
```

### HTTP Request Logging

```typescript
import { loggedFetch } from '../utils/logger';

// Automatically logs request/response details
const response = await loggedFetch(
  'apiService', 
  'fetchUserData', 
  '/api/users/123'
);
```

### Component Lifecycle Logging

```typescript
import { logger } from '../utils/logger';

// In Svelte components
onMount(() => {
  logger.logComponentMount('MyComponent');
});

onDestroy(() => {
  logger.logComponentUnmount('MyComponent');
});
```

### Configuration

```typescript
// Adjust logging configuration
logger.setConfig({
  level: LogLevel.DEBUG,
  enableConsole: true,
  enableBackend: true,
  bufferSize: 50,
  flushInterval: 3000
});
```

## Backend Logging (Rust)

### Basic Usage

```rust
use crate::{log_info, log_error, log_debug};

// Simple logging
log_info!("module", "function", "Operation completed successfully");

// With metadata
log_error!("auth", "validate_token", "Token validation failed", 
  serde_json::json!({"token_length": token.len(), "expired": true}));
```

### Function Entry/Exit Logging

```rust
use crate::{log_function_entry, log_function_exit};

pub fn process_data(data: &str) -> Result<String, String> {
    log_function_entry!("processor", "process_data", 
      serde_json::json!({"data_length": data.len()}));
    
    let result = do_processing(data);
    
    log_function_exit!("processor", "process_data", 
      serde_json::json!({"success": result.is_ok()}));
    
    result
}
```

### Available Macros

- `log_trace!(module, function, message, metadata)`
- `log_debug!(module, function, message, metadata)`
- `log_info!(module, function, message, metadata)`
- `log_warn!(module, function, message, metadata)`
- `log_error!(module, function, message, metadata)`
- `log_fatal!(module, function, message, metadata)`
- `log_function_entry!(module, function, metadata)`
- `log_function_exit!(module, function, metadata)`

## Logged Components & Services

### Frontend Components

- **Authentication Service**: Login/logout operations, session management
- **Weather Service**: API calls, settings loading
- **Error Service**: Global error handling, error queuing
- **Theme Store**: Theme changes, accent color updates
- **App Header**: User interactions, notifications
- **Cache System**: Cache hits/misses, performance tracking

### Backend Services

- **Network Operations**: All HTTP requests/responses via `netgrab`
- **Settings Management**: Configuration loading/saving
- **Session Management**: Session persistence, authentication state
- **File Operations**: Data persistence, file I/O
- **Analytics**: Data collection and processing

## Log Management

### Tauri Commands

The system provides several Tauri commands for log management:

```typescript
// Get log file path
const logPath = await invoke<string>('get_log_file_path_command');

// Get recent logs for troubleshooting
const logs = await invoke<string>('get_logs_for_troubleshooting');

// Export complete support package
const supportData = await invoke<string>('export_logs_for_support');

// Clear all logs
await invoke('clear_logs');

// Set log level
await invoke('set_log_level_command', { level: 'DEBUG' });
```

### Troubleshooting Modal

DesQTA includes a built-in troubleshooting interface accessible through the application:

- **View Recent Logs**: See the last 50 lines or full log content
- **Export Support Logs**: Download complete troubleshooting package
- **Copy to Clipboard**: Easy sharing with support team
- **Log Statistics**: Error/warning/info counts
- **Clear Logs**: Reset log file
- **Adjust Log Level**: Change verbosity in real-time

## Session Management

### Fresh Start Policy

The logging system implements a "fresh start" policy:

- **Log file is cleared** on every application startup
- **New session ID** generated for each run
- **Clean troubleshooting data** for current session only
- **No log accumulation** across application restarts

### Session Tracking

Each log entry includes:
- **Session ID**: Unique identifier for the current app session
- **Thread ID**: Identifies which thread generated the log
- **Timestamp**: Precise timing with millisecond accuracy

## Performance Considerations

### Optimizations

- **Buffered Writing**: Logs are batched and flushed periodically
- **Configurable Verbosity**: Default INFO level reduces noise
- **Selective Stack Traces**: Only included for ERROR level and above
- **Efficient Metadata**: Minimal overhead for structured data
- **Thread-Safe Operations**: Concurrent logging without blocking

### Configuration Recommendations

```typescript
// Development
logger.setConfig({
  level: LogLevel.DEBUG,
  enableConsole: true,
  bufferSize: 100,
  flushInterval: 1000
});

// Production
logger.setConfig({
  level: LogLevel.INFO,
  enableConsole: false,
  bufferSize: 50,
  flushInterval: 5000
});
```

## Error Handling & Recovery

### Automatic Error Capture

The system automatically captures:
- **Unhandled JavaScript errors**
- **Unhandled promise rejections**
- **Network request failures**
- **File I/O errors**
- **Authentication failures**

### Graceful Degradation

If logging fails:
- **Frontend**: Falls back to console output
- **Backend**: Continues operation without logging
- **No application blocking**: Logging failures don't crash the app

## Best Practices

### Logging Guidelines

1. **Use appropriate log levels**:
   - DEBUG: Development information
   - INFO: Important application events
   - WARN: Recoverable issues
   - ERROR: Application errors
   - FATAL: Critical system failures

2. **Include relevant context**:
   ```typescript
   logger.error('payment', 'processPayment', 'Payment processing failed', {
     amount: payment.amount,
     currency: payment.currency,
     errorCode: error.code,
     userId: user.id
   });
   ```

3. **Avoid sensitive data**:
   - Never log passwords, tokens, or personal information
   - Use sanitized or redacted versions when necessary

4. **Use structured metadata**:
   ```typescript
   // Good
   logger.info('user', 'login', 'User authenticated', { 
     userId: user.id, 
     loginMethod: 'oauth' 
   });
   
   // Avoid
   logger.info('user', 'login', `User ${user.id} authenticated via oauth`);
   ```

### Module Naming Conventions

- **Frontend**: Use component/service name (e.g., 'authService', 'AppHeader')
- **Backend**: Use module name (e.g., 'netgrab', 'settings', 'session')
- **Functions**: Use actual function name for easy tracing

## Troubleshooting

### Common Issues

**Logs not appearing**:
- Check log level configuration
- Verify log file permissions
- Ensure logger is initialized

**Performance impact**:
- Increase flush interval
- Reduce log level verbosity
- Disable console output in production

**Large log files**:
- Logs are cleared on each app start
- Use troubleshooting modal to export specific sessions

### Debug Mode

Enable debug mode for maximum logging detail:

```typescript
// Frontend
logger.setLogLevel(LogLevel.TRACE);

// Backend (via Tauri command)
await invoke('set_log_level_command', { level: 'TRACE' });
```

## Integration Examples

### Adding Logging to New Components

```typescript
// New service
import { logger } from '../utils/logger';

export class NewService {
  async performOperation(data: any) {
    logger.info('newService', 'performOperation', 'Starting operation', { 
      dataSize: data.length 
    });
    
    try {
      const result = await processData(data);
      logger.debug('newService', 'performOperation', 'Operation completed successfully');
      return result;
    } catch (error) {
      logger.error('newService', 'performOperation', `Operation failed: ${error}`, { 
        error: error.message 
      });
      throw error;
    }
  }
}
```

### Adding Logging to Rust Functions

```rust
#[tauri::command]
pub async fn new_command(param: String) -> Result<String, String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "commands",
            "new_command",
            "Executing new command",
            serde_json::json!({"param_length": param.len()})
        );
    }
    
    // Command implementation
    
    Ok("Success".to_string())
}
```

## Conclusion

The DesQTA logging system provides comprehensive visibility into application behavior while maintaining excellent performance. It's designed to be developer-friendly during development and user-friendly for troubleshooting, making it an essential tool for maintaining and debugging the application.

For support issues, users can easily export their logs using the built-in troubleshooting interface, providing developers with detailed information about the application's behavior during any reported issues. 