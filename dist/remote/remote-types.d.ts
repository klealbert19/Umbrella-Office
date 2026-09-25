/**
 * Tipos para Remote Workspace do Umbrella Office V0.4.
 */
export type RemoteWorkspaceType = 'local' | 'ssh' | 'wsl';
export interface RemoteWorkspaceConfig {
    type: RemoteWorkspaceType;
    name: string;
    host?: string;
    port?: number;
    user?: string;
    keyPath?: string;
    distribution?: string;
    path: string;
}
export interface WorkspaceProvider {
    readonly type: RemoteWorkspaceType;
    readonly name: string;
    connect(config: RemoteWorkspaceConfig): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    executeCommand(command: string, args: string[], cwd?: string): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    listDirectory(path: string): Promise<Array<{
        name: string;
        isDirectory: boolean;
        size: number;
    }>>;
    fileExists(path: string): Promise<boolean>;
}
export interface LocalWorkspaceProviderConfig {
    type: 'local';
}
export interface SshWorkspaceProviderConfig {
    type: 'ssh';
    host: string;
    port: number;
    user: string;
    keyPath?: string;
}
export interface WslWorkspaceProviderConfig {
    type: 'wsl';
    distribution: string;
}
//# sourceMappingURL=remote-types.d.ts.map