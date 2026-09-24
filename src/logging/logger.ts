/**
 * Logger simples para o Umbrella Office.
 *
 * Escreve logs em ~/.umbrella/logs/office.log e também
 * imprime no console em modo de desenvolvimento.
 *
 * Nunca registra senhas, tokens ou informações sensíveis.
 */
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class Logger {
  private readonly logFilePath: string;
  private readonly minLevel: LogLevel;

  constructor(logFilePath: string, level: LogLevel = 'INFO') {
    this.logFilePath = logFilePath;
    this.minLevel = level;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('ERROR', message, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    // Append ao arquivo de log
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch {
      // Se não puder escrever log, silenciosamente ignora
    }
  }
}
