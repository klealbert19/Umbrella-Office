/**
 * Executa comandos do sistema de forma controlada.
 *
 * Utiliza spawn com command + args[] (nunca shell concatenado).
 * Captura stdout, stderr, exit code, início, término e duração.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Task, isLocalCommandPayload } from '../core/task';
import { TaskResult, createSuccessResult, createFailureResult } from '../core/result';
import { Logger } from '../logging/logger';

/**
 * No Windows, comandos como `npm` são arquivos `.cmd` e o spawn direto
 * (sem shell) falha com ENOENT. Resolve a extensão via PATH mantendo
 * o modelo seguro command + args[] (sem shell, sem concatenação).
 */
function resolveCommand(command: string): string {
  if (process.platform !== 'win32') return command;
  if (command.includes('/') || command.includes('\\') || path.extname(command) !== '') {
    return command;
  }
  const pathDirs = (process.env['PATH'] ?? '').split(path.delimiter);
  const extensions = ['.exe', '.cmd', '.bat', '.com'];
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // tenta o próximo candidato
      }
    }
  }
  return command;
}

export class LocalExecutor {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();

    if (task.type !== 'local.command') {
      const finishedAt = new Date().toISOString();
      return createFailureResult(
        task.id,
        startedAt,
        finishedAt,
        `Unsupported task type: ${task.type}`
      );
    }

    if (!isLocalCommandPayload(task.payload)) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(
        task.id,
        startedAt,
        finishedAt,
        'Invalid payload for local.command task'
      );
    }

    const { command, args } = task.payload;
    this.logger.info('Task started', { taskId: task.id, command, args });

    return new Promise<TaskResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      let child;
      try {
        child = spawn(resolveCommand(command), args, {
          shell: false,
          windowsHide: true,
        });
      } catch (err) {
        const finishedAt = new Date().toISOString();
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Task failed to spawn', { taskId: task.id, error: message });
        resolve(createFailureResult(task.id, startedAt, finishedAt, message));
        return;
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err: Error) => {
        const finishedAt = new Date().toISOString();
        this.logger.error('Task failed', { taskId: task.id, error: err.message });
        resolve(createFailureResult(task.id, startedAt, finishedAt, err.message));
      });

      child.on('close', (code: number | null) => {
        const finishedAt = new Date().toISOString();
        const exitCode = code ?? -1;
        const combined = (stdout + (stderr ? '\n' + stderr : '')).trim();

        if (exitCode === 0) {
          this.logger.info('Task completed', { taskId: task.id, exitCode });
          resolve(createSuccessResult(task.id, startedAt, finishedAt, combined, exitCode));
        } else {
          const errorMsg = stderr.trim() || `Process exited with code ${exitCode}`;
          this.logger.error('Task failed', { taskId: task.id, exitCode, error: errorMsg });
          resolve(createFailureResult(task.id, startedAt, finishedAt, errorMsg, exitCode));
        }
      });
    });
  }
}
