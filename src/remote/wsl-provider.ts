/**
 * WSL Workspace Provider do Umbrella Office V0.4.
 *
 * Permite operações em workspaces dentro do WSL (Windows Subsystem for Linux).
 */
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';

export class WslWorkspaceProvider implements WorkspaceProvider {
  readonly type: RemoteWorkspaceType = 'wsl';
  readonly name: string;

  private readonly logger: Logger;
  private connected: boolean = false;
  private config: RemoteWorkspaceConfig | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
    this.name = 'wsl';
  }

  async connect(config: RemoteWorkspaceConfig): Promise<void> {
    if (config.type !== 'wsl') {
      throw new Error('Invalid config type for WslWorkspaceProvider');
    }

    if (!config.distribution || !config.path) {
      throw new Error('WSL config requires distribution and path');
    }

    // Verificar se estamos no Windows
    if (os.platform() !== 'win32') {
      throw new Error('WSL provider only works on Windows');
    }

    // Verificar se a distribuição existe
    const distroCheck = await this.runWslCommand(config.distribution, ['ls', '-la', config.path]);
    if (distroCheck.exitCode !== 0) {
      throw new Error(`WSL distribution "${config.distribution}" not found or path "${config.path}" does not exist`);
    }

    this.config = config;
    this.connected = true;
    this.logger.info('WSL workspace connected', { distribution: config.distribution, path: config.path });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
    this.logger.info('WSL workspace disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async runWslCommand(distribution: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const wslArgs = ['-d', distribution, ...args];
      const child = spawn('wsl.exe', wslArgs, { shell: false, windowsHide: true });

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

  async executeCommand(command: string, args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    if (!this.isConnected() || !this.config) {
      throw new Error('Not connected to WSL workspace');
    }

    const workingDir = cwd ? path.posix.join(this.config.path, cwd) : this.config.path;
    const fullCommand = `${command} ${args.join(' ')}`;

    // Executar via wsl.exe
    const wslArgs = [
      '-d', this.config.distribution,
      'bash', '-c', `cd "${workingDir}" && ${fullCommand}`
    ];

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn('wsl.exe', wslArgs, { shell: false, windowsHide: true });

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
    if (!this.isConnected() || !this.config) {
      throw new Error('Not connected to WSL workspace');
    }

    const fullPath = path.posix.join(this.config.path, filePath);
    const result = await this.runWslCommand(this.config.distribution!, ['cat', fullPath]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read file: ${result.stderr}`);
    }

    return result.stdout;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isConnected() || !this.config) {
      throw new Error('Not connected to WSL workspace');
    }

    const fullPath = path.posix.join(this.config.path, filePath);
    const dir = path.posix.dirname(fullPath);

    // Criar diretório se não existir
    await this.runWslCommand(this.config.distribution!, ['mkdir', '-p', dir]);

    // Escrever arquivo usando tee
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const wslArgs = ['-d', this.config!.distribution!, 'tee', fullPath];
      const child = spawn('wsl.exe', wslArgs, { shell: false, windowsHide: true });

      let stderr = '';

      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to write file: ${stderr}`));
        }
      });

      child.on('error', (err: Error) => {
        reject(err);
      });

      child.stdin.write(content);
      child.stdin.end();
    });
  }

  async listDirectory(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; size: number }>> {
    if (!this.isConnected() || !this.config) {
      throw new Error('Not connected to WSL workspace');
    }

    const fullPath = path.posix.join(this.config.path, dirPath);
    const result = await this.runWslCommand(this.config.distribution!, ['ls', '-la', fullPath]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list directory: ${result.stderr}`);
    }

    // Parse ls -la output
    const lines = result.stdout.trim().split('\n').slice(1); // Skip "total X"
    const entries: Array<{ name: string; isDirectory: boolean; size: number }> = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');

      if (name === '.' || name === '..') continue;

      entries.push({
        name,
        isDirectory: permissions.startsWith('d'),
        size,
      });
    }

    return entries;
  }

  async fileExists(filePath: string): Promise<boolean> {
    if (!this.isConnected() || !this.config) {
      throw new Error('Not connected to WSL workspace');
    }

    const fullPath = path.posix.join(this.config.path, filePath);
    const result = await this.runWslCommand(this.config.distribution!, ['test', '-e', fullPath]);

    return result.exitCode === 0;
  }
}