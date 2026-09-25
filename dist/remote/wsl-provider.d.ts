import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';
export declare class WslWorkspaceProvider implements WorkspaceProvider {
    readonly type: RemoteWorkspaceType;
    readonly name: string;
    private readonly logger;
    private connected;
    private config;
    constructor(logger: Logger);
    connect(config: RemoteWorkspaceConfig): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    private runWslCommand;
    executeCommand(command: string, args: string[], cwd?: string): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    listDirectory(dirPath: string): Promise<Array<{
        name: string;
        isDirectory: boolean;
        size: number;
    }>>;
    fileExists(filePath: string): Promise<boolean>;
}
//# sourceMappingURL=wsl-provider.d.ts.map