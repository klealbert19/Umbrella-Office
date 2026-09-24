/**
 * Git Tool do Umbrella Office V0.3.
 *
 * Fornece operações Git estruturadas que usam o Process Tool internamente.
 * Operações READ: status, diff, log, branch, remote
 * Operações WRITE: add, commit, checkout
 * Operações DESTRUTIVAS: bloqueadas na V0.3
 */
import * as path from 'path';
import { Logger } from '../../logging/logger';
import { FilesystemSecurity } from '../../filesystem/filesystem-security';
import { ProcessTool } from '../process/process-tool';
import { 
  GitOperationType, 
  GitStatusPayload, 
  GitDiffPayload, 
  GitLogPayload, 
  GitBranchPayload, 
  GitRemotePayload, 
  GitAddPayload, 
  GitCommitPayload, 
  GitCheckoutPayload,
  GitResult 
} from './git-types';

export class GitTool {
  private readonly logger: Logger;
  private readonly security: FilesystemSecurity;
  private readonly processTool: ProcessTool;

  constructor(logger: Logger, security: FilesystemSecurity, processTool: ProcessTool) {
    this.logger = logger;
    this.security = security;
    this.processTool = processTool;
  }

  /**
   * Resolve o cwd: usa workspace ativo se não fornecido.
   */
  private resolveCwd(cwd?: string): string {
    return cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
  }

  /**
   * Valida se os caminhos estão dentro do workspace.
   */
  private validatePaths(paths: string[], cwd: string): { valid: boolean; error?: string } {
    const activeWorkspace = this.security.getActiveWorkspace();
    if (!activeWorkspace) {
      return { valid: true }; // Sem workspace ativo, não valida
    }
    
    for (const p of paths) {
      const fullPath = path.isAbsolute(p) ? p : path.join(cwd, p);
      const isWithin = this.security.isWithinWorkspace(fullPath);
      if (!isWithin) {
        return { 
          valid: false, 
          error: `Caminho "${p}" está fora do workspace ativo "${activeWorkspace}"` 
        };
      }
    }
    return { valid: true };
  }

  /**
   * Executa comando git via ProcessTool.
   */
  private async executeGitCommand(
    operation: GitOperationType,
    cwd: string,
    args: string[],
    timeout?: number
  ): Promise<GitResult> {
    const result = await this.processTool.execute({
      command: 'git',
      args,
      cwd,
      timeout,
    });

    this.logger.info('Git operation completed', {
      operation,
      exitCode: result.exitCode,
      duration: result.duration,
      timedOut: result.timedOut,
    });

    return {
      success: result.success,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
      timedOut: result.timedOut,
      command: 'git',
      args,
      cwd,
    };
  }

  // ============ READ OPERATIONS ============

  /**
   * git status --short
   */
  async status(payload: GitStatusPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    return this.executeGitCommand('git.status', cwd, ['status', '--short'], payload.timeout);
  }

  /**
   * git diff
   */
  async diff(payload: GitDiffPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    const args = ['diff', ...(payload.args ?? [])];
    return this.executeGitCommand('git.diff', cwd, args, payload.timeout);
  }

  /**
   * git log (histórico recente estruturado)
   */
  async log(payload: GitLogPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    // Formato estruturado para facilitar parsing
    const args = ['log', '--oneline', '-20', '--pretty=format:%H|%an|%ad|%s', ...(payload.args ?? [])];
    return this.executeGitCommand('git.log', cwd, args, payload.timeout);
  }

  /**
   * git branch (branch atual e branches disponíveis)
   */
  async branch(payload: GitBranchPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    return this.executeGitCommand('git.branch', cwd, ['branch', '-a'], payload.timeout);
  }

  /**
   * git remote (remotes configurados)
   */
  async remote(payload: GitRemotePayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    return this.executeGitCommand('git.remote', cwd, ['remote', '-v'], payload.timeout);
  }

  // ============ WRITE OPERATIONS ============

  /**
   * git add <paths...>
   * Nunca executa git add . automaticamente.
   */
  async add(payload: GitAddPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    
    if (!payload.paths || payload.paths.length === 0) {
      return this.createErrorResult('Nenhum caminho fornecido para git add', cwd, ['add']);
    }

    // Valida caminhos
    const validation = this.validatePaths(payload.paths, cwd);
    if (!validation.valid) {
      return this.createErrorResult(validation.error!, cwd, ['add', ...payload.paths]);
    }

    const args = ['add', ...payload.paths];
    return this.executeGitCommand('git.add', cwd, args, payload.timeout);
  }

  /**
   * git commit -m <message>
   * Não aceita mensagem vazia.
   */
  async commit(payload: GitCommitPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    
    if (!payload.message || payload.message.trim() === '') {
      return this.createErrorResult('Mensagem de commit não pode ser vazia', cwd, ['commit', '-m', '']);
    }

    const args = ['commit', '-m', payload.message];
    return this.executeGitCommand('git.commit', cwd, args, payload.timeout);
  }

  /**
   * git checkout <branch>
   * Apenas checkout explícito, não apaga alterações silenciosamente.
   */
  async checkout(payload: GitCheckoutPayload): Promise<GitResult> {
    const cwd = this.resolveCwd(payload.cwd);
    
    if (!payload.branch || payload.branch.trim() === '') {
      return this.createErrorResult('Nome da branch não pode ser vazio', cwd, ['checkout']);
    }

    const args = ['checkout', payload.branch];
    return this.executeGitCommand('git.checkout', cwd, args, payload.timeout);
  }

  private createErrorResult(error: string, cwd: string, args: string[]): GitResult {
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: error,
      duration: 0,
      timedOut: false,
      command: 'git',
      args,
      cwd,
    };
  }
}