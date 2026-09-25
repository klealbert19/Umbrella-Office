/**
 * Tipos para o Scheduler do Umbrella Office V0.4.
 */
import { randomUUID } from 'crypto';

export type ScheduleType = 'once' | 'interval' | 'cron';

export interface ScheduleConfig {
  type: ScheduleType;
  // Para 'once': timestamp ISO string
  // Para 'interval': milissegundos
  // Para 'cron': expressão cron
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

export function createScheduledTask(
  name: string,
  task: { type: string; payload: unknown },
  schedule: ScheduleConfig
): ScheduledTask {
  return {
    id: randomUUID(),
    name,
    task,
    schedule,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
  };
}