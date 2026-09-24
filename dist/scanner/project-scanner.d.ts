import { Logger } from '../logging/logger';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { ProjectScanResult } from './project-types';
export declare class ProjectScanner {
    private readonly logger;
    private readonly engine;
    constructor(logger: Logger, engine: FilesystemEngine);
    scanProject(rootPath: string): Promise<ProjectScanResult>;
    private fileExists;
    private directoryExists;
    private detectPackageManager;
}
//# sourceMappingURL=project-scanner.d.ts.map