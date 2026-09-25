import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { TaskResult } from '../core/result';
import { ScheduledTask, ScheduleConfig } from './scheduler-types';
export declare class Scheduler {
    private readonly logger;
    private taskRouter;
    private readonly statePath;
    private tasks;
    private cronJobs;
    private intervalTimers;
    private oneTimeTimers;
    private isRunning;
    constructor(logger: Logger, taskRouter: TaskRouter, baseDir?: string);
    set taskRouterRef(router: TaskRouter);
    start(): Promise<void>;
    stop(): Promise<void>;
    private scheduleEnabledTasks;
    private scheduleTask;
    private executeTask;
    createTask(name: string, task: {
        type: string;
        payload: unknown;
    }, schedule: ScheduleConfig): ScheduledTask;
    getTask(id: string): ScheduledTask | undefined;
    listTasks(): ScheduledTask[];
    pauseTask(id: string): Promise<boolean>;
    resumeTask(id: string): Promise<boolean>;
    removeTask(id: string): Promise<boolean>;
    runTaskNow(id: string): Promise<TaskResult>;
    private executeTaskAndReturnResult;
    private unscheduleTask;
    private loadState;
    private saveState;
}
//# sourceMappingURL=scheduler.d.ts.map