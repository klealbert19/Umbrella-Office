/**
 * Remote Workspace Manager do Umbrella Office V0.4.
 *
 * Gerencia múltiplos providers de workspace (local, SSH, WSL).
 */
import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';
export declare class RemoteWorkspaceManager {
    private readonly logger;
    private providers;
    private activeProvider;
    private activeConfig;
    constructor(logger: Logger);
    registerProvider(provider: WorkspaceProvider): void;
    getProvider(type: RemoteWorkspaceType): WorkspaceProvider | undefined;
    listProviders(): WorkspaceProvider[];
    connect(config: RemoteWorkspaceConfig): Promise<void>;
    disconnect(): Promise<void>;
    getActiveProvider(): WorkspaceProvider | null;
    getActiveConfig(): RemoteWorkspaceConfig | null;
    isConnected(): boolean;
    executeCommand(command: string, args: string[], cwd?: string): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    listDirectory(dirPath: string): Promise<{
        name: string;
        isDirectory: boolean;
        size: number;
    }[]>;
    fileExists(filePath: string): Promise<boolean>;
}
//# sourceMappingURL=remote-manager.d.ts.map