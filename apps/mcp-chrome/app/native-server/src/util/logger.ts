import { stderr } from 'process';

export type LogData = unknown;

export type Logger = (level: string, message: string, data?: LogData) => void;

export function createLogger(scope: string): Logger {
  return (level: string, message: string, data?: LogData): void => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${scope}] [${level}] ${message}`;

    if (data) {
      stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
      return;
    }

    stderr.write(`${logMessage}\n`);
  };
}
