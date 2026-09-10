export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'message' | 'command' | 'system' | 'chat';
  message: string;
  details?: Record<string, any>;
}

const MAX_LOGS = 100;
const logs: LogEntry[] = [];
let counter = 0;

export function addLog(
  level: 'info' | 'warn' | 'error' | 'success',
  category: 'message' | 'command' | 'system' | 'chat',
  message: string,
  details?: Record<string, any>
): LogEntry {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  counter += 1;
  const entry: LogEntry = {
    id: `${Date.now()}-${counter}`,
    timestamp: timeStr,
    level,
    category,
    message,
    ...(details ? { details } : {}),
  };

  logs.unshift(entry);
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }

  return entry;
}

export function getRecentLogs(limit = 50): LogEntry[] {
  return logs.slice(0, Math.min(limit, logs.length));
}

export function clearLogs(): void {
  logs.length = 0;
}
