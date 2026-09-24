export interface Task {
    id: string;
    type: string;
    payload: unknown;
    createdAt: string;
}
export interface LocalCommandPayload {
    command: string;
    args: string[];
}
export declare function createTask(type: string, payload: unknown): Task;
export declare function createLocalCommandTask(command: string, args: string[]): Task;
export declare function isLocalCommandPayload(payload: unknown): payload is LocalCommandPayload;
//# sourceMappingURL=task.d.ts.map