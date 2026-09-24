export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export declare class Logger {
    private readonly logFilePath;
    private readonly minLevel;
    constructor(logFilePath: string, level?: LogLevel);
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    private shouldLog;
    private write;
}
//# sourceMappingURL=logger.d.ts.map