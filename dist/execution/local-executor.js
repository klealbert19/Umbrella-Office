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
exports.LocalExecutor = void 0;
/**
 * Executa comandos do sistema de forma controlada.
 *
 * Utiliza spawn com command + args[] (nunca shell concatenado).
 * Captura stdout, stderr, exit code, início, término e duração.
 */
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const task_1 = require("../core/task");
const result_1 = require("../core/result");
/**
 * No Windows, comandos como `npm` são arquivos `.cmd` e o spawn direto
 * (sem shell) falha com ENOENT. Resolve a extensão via PATH mantendo
 * o modelo seguro command + args[] (sem shell, sem concatenação).
 */
function resolveCommand(command) {
    if (process.platform !== 'win32')
        return command;
    if (command.includes('/') || command.includes('\\') || path.extname(command) !== '') {
        return command;
    }
    const pathDirs = (process.env['PATH'] ?? '').split(path.delimiter);
    const extensions = ['.exe', '.cmd', '.bat', '.com'];
    for (const dir of pathDirs) {
        if (!dir)
            continue;
        for (const ext of extensions) {
            const candidate = path.join(dir, command + ext);
            try {
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            }
            catch {
                // tenta o próximo candidato
            }
        }
    }
    return command;
}
class LocalExecutor {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async execute(task) {
        const startedAt = new Date().toISOString();
        if (task.type !== 'local.command') {
            const finishedAt = new Date().toISOString();
            return (0, result_1.createFailureResult)(task.id, startedAt, finishedAt, `Unsupported task type: ${task.type}`);
        }
        if (!(0, task_1.isLocalCommandPayload)(task.payload)) {
            const finishedAt = new Date().toISOString();
            return (0, result_1.createFailureResult)(task.id, startedAt, finishedAt, 'Invalid payload for local.command task');
        }
        const { command, args } = task.payload;
        this.logger.info('Task started', { taskId: task.id, command, args });
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let child;
            try {
                child = (0, child_process_1.spawn)(resolveCommand(command), args, {
                    shell: false,
                    windowsHide: true,
                });
            }
            catch (err) {
                const finishedAt = new Date().toISOString();
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error('Task failed to spawn', { taskId: task.id, error: message });
                resolve((0, result_1.createFailureResult)(task.id, startedAt, finishedAt, message));
                return;
            }
            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', (err) => {
                const finishedAt = new Date().toISOString();
                this.logger.error('Task failed', { taskId: task.id, error: err.message });
                resolve((0, result_1.createFailureResult)(task.id, startedAt, finishedAt, err.message));
            });
            child.on('close', (code) => {
                const finishedAt = new Date().toISOString();
                const exitCode = code ?? -1;
                const combined = (stdout + (stderr ? '\n' + stderr : '')).trim();
                if (exitCode === 0) {
                    this.logger.info('Task completed', { taskId: task.id, exitCode });
                    resolve((0, result_1.createSuccessResult)(task.id, startedAt, finishedAt, combined, exitCode));
                }
                else {
                    const errorMsg = stderr.trim() || `Process exited with code ${exitCode}`;
                    this.logger.error('Task failed', { taskId: task.id, exitCode, error: errorMsg });
                    resolve((0, result_1.createFailureResult)(task.id, startedAt, finishedAt, errorMsg, exitCode));
                }
            });
        });
    }
}
exports.LocalExecutor = LocalExecutor;
//# sourceMappingURL=local-executor.js.map