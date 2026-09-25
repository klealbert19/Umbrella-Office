"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
/**
 * Scheduler do Umbrella Office V0.4.
 *
 * Gerencia tarefas agendadas, executa via TaskRouter,
 * persiste estado e restaura na inicialização.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const result_1 = require("../core/result");
const scheduler_types_1 = require("./scheduler-types");
const cron_1 = require("cron");
class Scheduler {
    logger;
    taskRouter;
    statePath;
    tasks = new Map();
    cronJobs = new Map();
    intervalTimers = new Map();
    oneTimeTimers = new Map();
    isRunning = false;
    constructor(logger, taskRouter, baseDir) {
        this.logger = logger;
        this.taskRouter = taskRouter;
        const dir = baseDir ?? path.join(os.homedir(), '.umbrella');
        this.statePath = path.join(dir, 'scheduler.json');
    }
    set taskRouterRef(router) {
        this.taskRouter = router;
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        await this.loadState();
        this.scheduleEnabledTasks();
        this.logger.info('Scheduler started', { taskCount: this.tasks.size });
    }
    async stop() {
        if (!this.isRunning)
            return;
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
    scheduleEnabledTasks() {
        for (const task of this.tasks.values()) {
            if (task.enabled) {
                this.scheduleTask(task);
            }
        }
    }
    scheduleTask(task) {
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
                    }
                    else {
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
                    const job = new cron_1.CronJob(cronExpr, () => {
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
        }
        catch (err) {
            this.logger.error('Failed to schedule task', { taskId: task.id, error: String(err) });
        }
    }
    async executeTask(task) {
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
            }
            else {
                this.logger.warn('Scheduled task failed', { taskId: task.id, name: task.name, error: result.error });
            }
        }
        catch (err) {
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
        }
        else if (task.schedule.type === 'cron') {
            const job = this.cronJobs.get(task.id);
            if (job) {
                const next = job.nextDate();
                if (next) {
                    task.nextRunAt = next.toString();
                }
            }
        }
        else if (task.schedule.type === 'once') {
            task.nextRunAt = null;
            task.enabled = false; // Desabilitar após execução única
        }
        task.updatedAt = new Date().toISOString();
        await this.saveState();
    }
    // API pública
    createTask(name, task, schedule) {
        const scheduledTask = (0, scheduler_types_1.createScheduledTask)(name, task, schedule);
        this.tasks.set(scheduledTask.id, scheduledTask);
        if (scheduledTask.enabled && this.isRunning) {
            this.scheduleTask(scheduledTask);
        }
        this.saveState();
        this.logger.info('Scheduled task created', { taskId: scheduledTask.id, name });
        return scheduledTask;
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    listTasks() {
        return Array.from(this.tasks.values());
    }
    async pauseTask(id) {
        const task = this.tasks.get(id);
        if (!task)
            return false;
        task.enabled = false;
        task.updatedAt = new Date().toISOString();
        // Parar timer/job se existir
        this.unscheduleTask(id);
        await this.saveState();
        this.logger.info('Scheduled task paused', { taskId: id });
        return true;
    }
    async resumeTask(id) {
        const task = this.tasks.get(id);
        if (!task)
            return false;
        task.enabled = true;
        task.updatedAt = new Date().toISOString();
        if (this.isRunning) {
            this.scheduleTask(task);
        }
        await this.saveState();
        this.logger.info('Scheduled task resumed', { taskId: id });
        return true;
    }
    async removeTask(id) {
        const task = this.tasks.get(id);
        if (!task)
            return false;
        this.unscheduleTask(id);
        this.tasks.delete(id);
        await this.saveState();
        this.logger.info('Scheduled task removed', { taskId: id });
        return true;
    }
    async runTaskNow(id) {
        const task = this.tasks.get(id);
        if (!task) {
            return (0, result_1.createFailureResult)(id, new Date().toISOString(), new Date().toISOString(), 'Task not found');
        }
        this.logger.info('Manual execution of scheduled task', { taskId: id, name: task.name });
        return this.executeTaskAndReturnResult(task);
    }
    async executeTaskAndReturnResult(task) {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            task.lastResult = {
                success: false,
                error: message,
            };
            task.updatedAt = new Date().toISOString();
            await this.saveState();
            return (0, result_1.createFailureResult)(task.id, startedAt, new Date().toISOString(), message);
        }
    }
    unscheduleTask(id) {
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
    async loadState() {
        if (!fs.existsSync(this.statePath)) {
            return;
        }
        try {
            const content = await fs.promises.readFile(this.statePath, 'utf-8');
            const state = JSON.parse(content);
            for (const task of state.tasks) {
                this.tasks.set(task.id, task);
            }
            this.logger.info('Scheduler state loaded', { taskCount: this.tasks.size });
        }
        catch (err) {
            this.logger.warn('Failed to load scheduler state', { error: String(err) });
        }
    }
    async saveState() {
        try {
            const state = {
                tasks: Array.from(this.tasks.values()),
            };
            await fs.promises.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
        }
        catch (err) {
            this.logger.error('Failed to save scheduler state', { error: String(err) });
        }
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map