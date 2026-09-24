import { Logger } from '../logging/logger';
export type UpdateStatus = 'NOT_CONFIGURED' | 'UP_TO_DATE' | 'AVAILABLE' | 'ERROR';
export interface UpdateInfo {
    status: UpdateStatus;
    currentVersion: string;
    availableVersion: string | null;
    message: string;
}
export declare class UpdateManager {
    private readonly logger;
    constructor(logger: Logger);
    getCurrentVersion(): string;
    checkForUpdates(): Promise<UpdateInfo>;
    getAvailableVersion(): string | null;
    installUpdate(): Promise<void>;
}
//# sourceMappingURL=update-manager.d.ts.map