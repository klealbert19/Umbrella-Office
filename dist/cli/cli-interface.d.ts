import { OfficeRuntime } from '../core/office-runtime';
export declare class CliInterface {
    private readonly runtime;
    private rl;
    private exitRequested;
    private readonly isPipe;
    constructor(runtime: OfficeRuntime);
    start(): Promise<void>;
    /**
     * Divide uma linha em tokens respeitando aspas duplas/simples.
     * Necessário para caminhos com espaço (ex.: "C:\Program Files\...").
     */
    private splitLine;
    private handleLine;
    private printHelp;
    private printStatus;
    private printVersion;
    private printConfig;
    private handleRun;
    private handleWorkspace;
    private handleWorkspaceOpen;
    private handleWorkspaceInfo;
    private handleWorkspaceCurrent;
    private handleWorkspaceClose;
    private handleWorkspaceScan;
    private handleFile;
    private handleProcess;
    private handleNpm;
    private handleGit;
    private shutdown;
}
//# sourceMappingURL=cli-interface.d.ts.map