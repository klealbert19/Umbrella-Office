export interface FilesystemTask {
    id: string;
    type: 'filesystem.read' | 'filesystem.write' | 'filesystem.edit' | 'filesystem.delete' | 'directory.list' | 'directory.create';
    payload: unknown;
    createdAt: string;
}
export interface WorkspaceTask {
    id: string;
    type: 'workspace.open' | 'workspace.close' | 'workspace.scan' | 'workspace.read';
    payload: unknown;
    createdAt: string;
}
export interface ProcessTask {
    id: string;
    type: 'process.execute';
    payload: {
        command: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        timeout?: number;
    };
    createdAt: string;
}
export interface NpmTask {
    id: string;
    type: 'npm.install' | 'npm.run' | 'npm.test' | 'npm.build' | 'npm.exec';
    payload: {
        args?: string[];
        script?: string;
        cwd?: string;
        env?: Record<string, string>;
        timeout?: number;
    };
    createdAt: string;
}
export interface GitTask {
    id: string;
    type: 'git.status' | 'git.diff' | 'git.log' | 'git.branch' | 'git.remote' | 'git.add' | 'git.commit' | 'git.checkout';
    payload: {
        args?: string[];
        paths?: string[];
        message?: string;
        branch?: string;
        cwd?: string;
        timeout?: number;
    };
    createdAt: string;
}
export type TaskV2 = FilesystemTask | WorkspaceTask | ProcessTask | NpmTask | GitTask;
export declare function createFilesystemTask(type: FilesystemTask['type'], payload: unknown): FilesystemTask;
export declare function createWorkspaceTask(type: WorkspaceTask['type'], payload: unknown): WorkspaceTask;
export declare function createProcessTask(payload: ProcessTask['payload']): ProcessTask;
export declare function createNpmTask(type: NpmTask['type'], payload: NpmTask['payload']): NpmTask;
export declare function createGitTask(type: GitTask['type'], payload: GitTask['payload']): GitTask;
export declare function isFilesystemTask(task: {
    type: string;
}): task is FilesystemTask;
export declare function isWorkspaceTask(task: {
    type: string;
}): task is WorkspaceTask;
export declare function isProcessTask(task: {
    type: string;
}): task is ProcessTask;
export declare function isNpmTask(task: {
    type: string;
}): task is NpmTask;
export declare function isGitTask(task: {
    type: string;
}): task is GitTask;
//# sourceMappingURL=task-v2.d.ts.map