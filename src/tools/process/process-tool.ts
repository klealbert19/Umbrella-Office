/**
 * Process Tool do Umbrella Office V0.3.
 *
 * Executa processos de forma controlada com:
 * - cwd seguro (dentro do workspace)
 * - timeout
 * - captura separada de stdout/stderr
 * - ambiente customizado (merge com ambiente atual)
 * - sem shell concatenado
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../logging/logger';
import { FilesystemSecurity } from '../../filesystem/filesystem-security';
import { ProcessExecutePayload, ProcessExecuteResult } from './process-types';

export class ProcessTool {
  private readonly logger: Logger;
  private readonly security: FilesystemSecurity;

  constructor(logger: Logger, security: FilesystemSecurity) {
    this.logger = logger;
    this.security = security;
  }

  /**
   * Executa um processo com as opções especificadas.
   */
  async execute(payload: ProcessExecutePayload): Promise<ProcessExecuteResult> {
    const startedAt = Date.now();
    const { command, args = [], cwd, env, timeout = 120000 } = payload;

    // Resolve o cwd: se não fornecido, usa workspace ativo
    let resolvedCwd: string = cwd ?? this.security.getActiveWorkspace() ?? process.cwd();

    // Valida se o cwd está dentro do workspace (se houver workspace ativo)
    const activeWorkspace = this.security.getActiveWorkspace();
    if (activeWorkspace) {
      const isWithin = this.security.isWithinWorkspace(resolvedCwd);
      if (!isWithin) {
        return {
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: `cwd "${resolvedCwd}" está fora do workspace ativo "${activeWorkspace}"`,
          duration: Date.now() - startedAt,
          timedOut: false,
          command,
          args,
          cwd: resolvedCwd,
        };
      }
    }

    // Resolve o comando (compatibilidade Windows)
    const { resolvedCommand, useShell } = this.resolveCommand(command);

    // Prepara ambiente: merge do ambiente atual com overrides
    const mergedEnv = { ...process.env, ...env };

    this.logger.info('Process execute started', {
      command: resolvedCommand,
      args,
      cwd: resolvedCwd,
      timeout,
      useShell,
    });

    return new Promise<ProcessExecuteResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let child: ReturnType<typeof spawn> | null = null;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        if (child) {
          child.kill('SIGTERM');
          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (child && !child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }
      }, timeout);

      try {
        child = spawn(resolvedCommand, args, {
          cwd: resolvedCwd,
          env: mergedEnv,
          shell: useShell,
          windowsHide: true,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Process failed to spawn', { command: resolvedCommand, error: message });
        resolve({
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: message,
          duration: Date.now() - startedAt,
          timedOut: false,
          command,
          args,
          cwd: resolvedCwd,
        });
        return;
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        this.logger.error('Process error', { command: resolvedCommand, error: err.message });
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: err.message,
          duration: Date.now() - startedAt,
          timedOut: false,
          command,
          args,
          cwd: resolvedCwd,
        });
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        const exitCode = code ?? -1;
        const duration = Date.now() - startedAt;

        this.logger.info('Process execute completed', {
          command: resolvedCommand,
          exitCode,
          duration,
          timedOut,
        });

        resolve({
          success: exitCode === 0 && !timedOut,
          exitCode,
          stdout,
          stderr,
          duration,
          timedOut,
          command,
          args,
          cwd: resolvedCwd,
        });
      });
    });
  }

  /**
   * Resolve o comando para Windows (procura .exe, .cmd, .bat)
   * Retorna o comando resolvido e se deve usar shell.
   * No Windows, arquivos .cmd/.bat precisam de shell: true ou cmd /c.
   */
  private resolveCommand(command: string): { resolvedCommand: string; useShell: boolean } {
    if (process.platform !== 'win32') {
      return { resolvedCommand: command, useShell: false };
    }
    if (command.includes('/') || command.includes('\\') || path.extname(command) !== '') {
      // Caminho absoluto ou com extensão - verifica se é .cmd/.bat
      const ext = path.extname(command).toLowerCase();
      if (ext === '.cmd' || ext === '.bat') {
        // Se o caminho contém espaços, precisa ser quoted para shell
        const needsQuotes = command.includes(' ') && !command.startsWith('"');
        return { 
          resolvedCommand: needsQuotes ? `"${command}"` : command, 
          useShell: true 
        };
      }
      return { resolvedCommand: command, useShell: false };
    }
    const pathDirs = (process.env['PATH'] ?? '').split(path.delimiter);
    const extensions = ['.exe', '.cmd', '.bat', '.com'];
    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const ext of extensions) {
        const candidate = path.join(dir, command + ext);
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          // Se for .cmd ou .bat, usa shell
          if (ext === '.cmd' || ext === '.bat') {
            // Se o caminho contém espaços, precisa ser quoted para shell
            const needsQuotes = candidate.includes(' ') && !candidate.startsWith('"');
            return { 
              resolvedCommand: needsQuotes ? `"${candidate}"` : candidate, 
              useShell: true 
            };
          }
          return { resolvedCommand: candidate, useShell: false };
        } catch {
          // tenta o próximo candidato
        }
      }
    }
    return { resolvedCommand: command, useShell: false };
  }
}