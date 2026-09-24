import { Logger } from '../logging/logger';
import { FilesystemSecurity } from '../filesystem/filesystem-security';
import { ProjectScanner } from '../scanner/project-scanner';
import { ConfigManager } from '../config/config-manager';
import { WorkspaceOpenResult, WorkspaceCloseResult, WorkspaceScanResult } from './workspace-types';
export declare class WorkspaceManager {
    private readonly logger;
    private readonly security;
    private readonly scanner;
    private readonly configManager;
    private activeWorkspacePath;
    constructor(logger: Logger, security: FilesystemSecurity, scanner: ProjectScanner, configManager: ConfigManager);
    /**
     * Abre um workspace no caminho especificado.
     */
    openWorkspace(workspacePath: string): Promise<WorkspaceOpenResult>;
    /**
     * Fecha o workspace ativo.
     */
    closeWorkspace(): Promise<WorkspaceCloseResult>;
    /**
     * Retorna informações sobre o workspace ativo.
     */
    getWorkspaceInfo(): Promise<WorkspaceOpenResult>;
    /**
     * Escaneia o workspace atual ou um caminho especificado para tipo de projeto.
     */
    scanWorkspace(scanPath?: string): Promise<WorkspaceScanResult>;
    /**
     * Retorna o caminho do workspace ativo.
     */
    getActiveWorkspacePath(): string | null;
}
//# sourceMappingURL=workspace-manager.d.ts.map