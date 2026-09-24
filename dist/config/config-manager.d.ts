import { UmbrellaConfig } from './config-schema';
import { Logger } from '../logging/logger';
export interface AppState {
    lastVersion: string;
    lastStartedAt: string | null;
    lastShutdownAt: string | null;
    activeWorkspace: string | null;
}
export declare class ConfigManager {
    private readonly baseDir;
    private readonly configPath;
    private readonly statePath;
    private readonly logDir;
    private readonly logger;
    private config;
    private state;
    constructor(logger: Logger, baseDir?: string);
    get homeDir(): string;
    get logFilePath(): string;
    init(): Promise<void>;
    getConfig(): UmbrellaConfig;
    getState(): AppState;
    getActiveWorkspace(): string | null;
    setActiveWorkspace(workspacePath: string | null): Promise<void>;
    markStarted(): Promise<void>;
    markShutdown(currentVersion: string): Promise<void>;
    private defaultState;
    private ensureDirectory;
    private loadOrCreateConfig;
    private loadState;
    private saveState;
    private readJson;
    private writeJson;
}
//# sourceMappingURL=config-manager.d.ts.map