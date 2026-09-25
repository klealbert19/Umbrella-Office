export type ScheduleType = 'once' | 'interval' | 'cron';
export interface ScheduleConfig {
    type: ScheduleType;
    value: string | number;
}
export interface ScheduledTask {
    id: string;
    name: string;
    task: {
        type: string;
        payload: unknown;
    };
    schedule: ScheduleConfig;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastResult: {
        success: boolean;
        output?: string;
        error?: string;
        exitCode?: number;
    } | null;
}
export interface SchedulerState {
    tasks: ScheduledTask[];
}
export declare function createScheduledTask(name: string, task: {
    type: string;
    payload: unknown;
}, schedule: ScheduleConfig): ScheduledTask;
//# sourceMappingURL=scheduler-types.d.ts.map