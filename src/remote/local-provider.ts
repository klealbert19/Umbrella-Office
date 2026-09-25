/**
 * Workspace Provider Abstraction do Umbrella Office V0.4.
 *
 * Permite operações de filesystem/process em workspaces locais ou remotos.
 */
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';

export class LocalWorkspaceProvider implements WorkspaceProvider {
  readonly type: RemoteWorkspaceType = 'local';
  readonly name: string;

  private readonly logger: Logger;
  private connected: boolean = false;
  private workspacePath: string = '';

  constructor(logger: Logger) {
    this.logger = logger;
    this.name = 'local';
  }

  async connect(config: RemoteWorkspaceConfig): Promise<void> {
    if (config.type !== 'local') {
      throw new Error('Invalid config type for LocalWorkspaceProvider');
    }

    const resolvedPath = path.resolve(config.path);
    const realPath = fs.realpathSync(resolvedPath);

    // Validar se é um diretório
    const stats = fs.statSync(realPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    this.workspacePath = realPath;
    this.connected = true;
    this.logger.info('Local workspace connected', { path: this.workspacePath });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.workspacePath = '';
    this.logger.info('Local workspace disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async executeCommand(command: string, args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    if (!this.connected) {
      throw new Error('Not connected to workspace');
    }

    const { spawn } = require('child_process');
    const workingDir = cwd ? path.resolve(this.workspacePath, cwd) : this.workspacePath;

    // Validar se o cwd está dentro do workspace
    const realCwd = fs.realpathSync(workingDir);
    const realWorkspace = fs.realpathSync(this.workspacePath);
    const relative = path.relative(realWorkspace, realCwd);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Command cwd outside workspace');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: realCwd,
        shell: false,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code: number) => {
        resolve({ exitCode: code ?? 0, stdout, stderr });
      });

      child.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to workspace');
    }

    const resolvedPath = path.resolve(this.workspacePath, filePath);
    const realPath = fs.realpathSync(resolvedPath);

    // Validar se está dentro do workspace
    const realWorkspace = fs.realpathSync(this.workspacePath);
    const relative = path.relative(realWorkspace, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path outside workspace');
    }

    return fs.promises.readFile(realPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to workspace');
    }

    const resolvedPath = path.resolve(this.workspacePath, filePath);
    const realPath = fs.realpathSync(resolvedPath);

    // Validar se está dentro do workspace
    const realWorkspace = fs.realpathSync(this.workspacePath);
    const relative = path.relative(realWorkspace, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path outside workspace');
    }

    // Garantir que o diretório existe
    const dir = path.dirname(realPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(realPath, content, 'utf-8');
  }

  async listDirectory(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; size: number }>> {
    if (!this.connected) {
      throw new Error('Not connected to workspace');
    }

    const resolvedPath = path.resolve(this.workspacePath, dirPath);
    const realPath = fs.realpathSync(resolvedPath);

    // Validar se está dentro do workspace
    const realWorkspace = fs.realpathSync(this.workspacePath);
    const relative = path.relative(realWorkspace, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path outside workspace');
    }

    const entries = await fs.promises.readdir(realPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      size: entry.isDirectory() ? 0 : fs.statSync(path.join(realPath, entry.name)).size,
    }));
  }

  async fileExists(filePath: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to workspace');
    }

    const resolvedPath = path.resolve(this.workspacePath, filePath);
    const realPath = fs.realpathSync(resolvedPath);

    // Validar se está dentro do workspace
    const realWorkspace = fs.realpathSync(this.workspacePath);
    const relative = path.relative(realWorkspace, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path outside workspace');
    }

    return fs.existsSync(realPath);
  }
}