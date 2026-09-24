import { Task } from '../core/task';
import { TaskResult } from '../core/result';
import { Logger } from '../logging/logger';
export declare class LocalExecutor {
    private readonly logger;
    constructor(logger: Logger);
    execute(task: Task): Promise<TaskResult>;
}
//# sourceMappingURL=local-executor.d.ts.map