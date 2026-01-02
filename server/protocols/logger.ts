// Logging utilities for protocol services

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  data?: any;
}

export class ProtocolLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries

  log(level: LogEntry['level'], service: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      data
    };

    this.logs.push(entry);

    // Trim logs if exceeded maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also output to console
    const logMessage = `[${entry.timestamp}] [${service.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'debug':
        console.debug(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  }

  info(service: string, message: string, data?: any) {
    this.log('info', service, message, data);
  }

  warn(service: string, message: string, data?: any) {
    this.log('warn', service, message, data);
  }

  error(service: string, message: string, data?: any) {
    this.log('error', service, message, data);
  }

  debug(service: string, message: string, data?: any) {
    this.log('debug', service, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByService(service: string): LogEntry[] {
    return this.logs.filter(log => log.service === service);
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  clearLogs() {
    this.logs = [];
  }
}

// Global logger instance
export const protocolLogger = new ProtocolLogger();