/**
 * Scheduler do Umbrella Office V0.4.
 *
 * Gerencia tarefas agendadas, executa via TaskRouter,
 * persiste estado e restaura na inicialização.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { TaskResult, createFailureResult } from '../core/result';
import { createScheduledTask, ScheduledTask, ScheduleConfig, SchedulerState } from './scheduler-types';
import { CronJob } from 'cron';

export class Scheduler {
  private readonly logger: Logger;
  private taskRouter: TaskRouter;
  private readonly statePath: string;
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private oneTimeTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(logger: Logger, taskRouter: TaskRouter, baseDir?: string) {
    this.logger = logger;
    this.taskRouter = taskRouter;
    const dir = baseDir ?? path.join(os.homedir(), '.umbrella');
    this.statePath = path.join(dir, 'scheduler.json');
  }

  set taskRouterRef(router: TaskRouter) {
    this.taskRouter = router;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.loadState();
    this.scheduleEnabledTasks();
    this.logger.info('Scheduler started', { taskCount: this.tasks.size });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Parar todos os cron jobs
    for (const [, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();

    // Parar todos os interval timers
    for (const [, timer] of this.intervalTimers) {
      clearInterval(timer);
    }
    this.intervalTimers.clear();

    // Parar todos os one-time timers
    for (const [, timer] of this.oneTimeTimers) {
      clearTimeout(timer);
    }
    this.oneTimeTimers.clear();

    await this.saveState();
    this.logger.info('Scheduler stopped');
  }

  private scheduleEnabledTasks(): void {
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  private scheduleTask(task: ScheduledTask): void {
    const { schedule } = task;

    try {
      switch (schedule.type) {
        case 'once': {
          const runAt = new Date(typeof schedule.value === 'string' ? schedule.value : String(schedule.value)).getTime();
          const now = Date.now();
          const delay = Math.max(0, runAt - now);

          if (delay === 0) {
            // Executar imediatamente se já passou
            this.executeTask(task);
          } else {
            const timer = setTimeout(() => {
              this.executeTask(task);
              this.oneTimeTimers.delete(task.id);
            }, delay);
            this.oneTimeTimers.set(task.id, timer);
            task.nextRunAt = new Date(runAt).toISOString();
          }
          break;
        }

        case 'interval': {
          const intervalMs = typeof schedule.value === 'number' ? schedule.value : parseInt(String(schedule.value), 10);
          if (intervalMs < 1000) {
            this.logger.warn('Interval too small, minimum 1000ms', { taskId: task.id, intervalMs });
            return;
          }
          const timer = setInterval(() => {
            this.executeTask(task);
          }, intervalMs);
          this.intervalTimers.set(task.id, timer);
          task.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
          break;
        }

        case 'cron': {
          const cronExpr = String(schedule.value);
          const job = new CronJob(cronExpr, () => {
            this.executeTask(task);
          });
          job.start();
          this.cronJobs.set(task.id, job);
          // Calcular próxima execução
          const next = job.nextDate();
          if (next) {
            task.nextRunAt = next.toString();
          }
          break;
        }
      }
      this.saveState();
    } catch (err) {
      this.logger.error('Failed to schedule task', { taskId: task.id, error: String(err) });
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    this.logger.info('Executing scheduled task', { taskId: task.id, name: task.name });

    const startedAt = new Date().toISOString();
    task.lastRunAt = startedAt;

    try {
      // Criar task para o TaskRouter
      const taskToExecute = {
        id: task.id,
        type: task.task.type,
        payload: task.task.payload,
        createdAt: new Date().toISOString(),
      };

      const result = await this.taskRouter.route(taskToExecute);

      task.lastResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      };

      if (result.success) {
        this.logger.info('Scheduled task completed', { taskId: task.id, name: task.name });
      } else {
        this.logger.warn('Scheduled task failed', { taskId: task.id, name: task.name, error: result.error });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      task.lastResult = {
        success: false,
        error: message,
      };
      this.logger.error('Scheduled task error', { taskId: task.id, name: task.name, error: message });
    }

    // Atualizar nextRunAt para interval/cron
    if (task.schedule.type === 'interval') {
      const intervalMs = typeof task.schedule.value === 'number' ? task.schedule.value : parseInt(String(task.schedule.value), 10);
      task.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    } else if (task.schedule.type === 'cron') {
      const job = this.cronJobs.get(task.id);
      if (job) {
        const next = job.nextDate();
        if (next) {
          task.nextRunAt = next.toString();
        }
      }
    } else if (task.schedule.type === 'once') {
      task.nextRunAt = null;
      task.enabled = false; // Desabilitar após execução única
    }

    task.updatedAt = new Date().toISOString();
    await this.saveState();
  }

  // API pública

  createTask(name: string, task: { type: string; payload: unknown }, schedule: ScheduleConfig): ScheduledTask {
    const scheduledTask = createScheduledTask(name, task, schedule);
    this.tasks.set(scheduledTask.id, scheduledTask);

    if (scheduledTask.enabled && this.isRunning) {
      this.scheduleTask(scheduledTask);
    }

    this.saveState();
    this.logger.info('Scheduled task created', { taskId: scheduledTask.id, name });
    return scheduledTask;
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  async pauseTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;

    task.enabled = false;
    task.updatedAt = new Date().toISOString();

    // Parar timer/job se existir
    this.unscheduleTask(id);

    await this.saveState();
    this.logger.info('Scheduled task paused', { taskId: id });
    return true;
  }

  async resumeTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;

    task.enabled = true;
    task.updatedAt = new Date().toISOString();

    if (this.isRunning) {
      this.scheduleTask(task);
    }

    await this.saveState();
    this.logger.info('Scheduled task resumed', { taskId: id });
    return true;
  }

  async removeTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;

    this.unscheduleTask(id);
    this.tasks.delete(id);

    await this.saveState();
    this.logger.info('Scheduled task removed', { taskId: id });
    return true;
  }

  async runTaskNow(id: string): Promise<TaskResult> {
    const task = this.tasks.get(id);
    if (!task) {
      return createFailureResult(id, new Date().toISOString(), new Date().toISOString(), 'Task not found');
    }

    this.logger.info('Manual execution of scheduled task', { taskId: id, name: task.name });
    return this.executeTaskAndReturnResult(task);
  }

  private async executeTaskAndReturnResult(task: ScheduledTask): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    task.lastRunAt = startedAt;

    try {
      const taskToExecute = {
        id: task.id,
        type: task.task.type,
        payload: task.task.payload,
        createdAt: new Date().toISOString(),
      };

      const result = await this.taskRouter.route(taskToExecute);

      task.lastResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      };

      task.updatedAt = new Date().toISOString();
      await this.saveState();

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      task.lastResult = {
        success: false,
        error: message,
      };
      task.updatedAt = new Date().toISOString();
      await this.saveState();

      return createFailureResult(task.id, startedAt, new Date().toISOString(), message);
    }
  }

  private unscheduleTask(id: string): void {
    const cronJob = this.cronJobs.get(id);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(id);
    }

    const intervalTimer = this.intervalTimers.get(id);
    if (intervalTimer) {
      clearInterval(intervalTimer);
      this.intervalTimers.delete(id);
    }

    const oneTimeTimer = this.oneTimeTimers.get(id);
    if (oneTimeTimer) {
      clearTimeout(oneTimeTimer);
      this.oneTimeTimers.delete(id);
    }
  }

  private async loadState(): Promise<void> {
    if (!fs.existsSync(this.statePath)) {
      return;
    }

    try {
      const content = await fs.promises.readFile(this.statePath, 'utf-8');
      const state: SchedulerState = JSON.parse(content);

      for (const task of state.tasks) {
        this.tasks.set(task.id, task);
      }

      this.logger.info('Scheduler state loaded', { taskCount: this.tasks.size });
    } catch (err) {
      this.logger.warn('Failed to load scheduler state', { error: String(err) });
    }
  }

  private async saveState(): Promise<void> {
    try {
      const state: SchedulerState = {
        tasks: Array.from(this.tasks.values()),
      };
      await fs.promises.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error('Failed to save scheduler state', { error: String(err) });
    }
  }
}