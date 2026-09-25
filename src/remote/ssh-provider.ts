/**
 * SSH Workspace Provider do Umbrella Office V0.4.
 *
 * Permite operações em workspaces remotos via SSH.
 */
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';

export class SshWorkspaceProvider implements WorkspaceProvider {
  readonly type: RemoteWorkspaceType = 'ssh';
  readonly name: string;

  private readonly logger: Logger;
  private connected: boolean = false;
  private config: RemoteWorkspaceConfig | null = null;
  private sshClient: any = null;

  constructor(logger: Logger) {
    this.logger = logger;
    this.name = 'ssh';
  }

  async connect(config: RemoteWorkspaceConfig): Promise<void> {
    if (config.type !== 'ssh') {
      throw new Error('Invalid config type for SshWorkspaceProvider');
    }

    if (!config.host || !config.user || !config.path) {
      throw new Error('SSH config requires host, user, and path');
    }

    // Verificar se ssh2 está disponível
    let Client: any;
    try {
      Client = require('ssh2').Client;
    } catch {
      throw new Error('ssh2 package not installed. Run: npm install ssh2');
    }

    this.config = config;
    this.sshClient = new Client();

    return new Promise((resolve, reject) => {
      this.sshClient.on('ready', () => {
        this.connected = true;
        this.logger.info('SSH workspace connected', { host: config.host, path: config.path });
        resolve();
      });

      this.sshClient.on('error', (err: Error) => {
        this.logger.error('SSH connection error', { error: err.message });
        reject(err);
      });

      this.sshClient.on('close', () => {
        this.connected = false;
        this.logger.info('SSH connection closed');
      });

      // Configurar conexão
      const connectConfig: any = {
        host: config.host,
        port: config.port ?? 22,
        username: config.user,
      };

      // Autenticação por chave SSH
      if (config.keyPath) {
        const expandedKeyPath = config.keyPath.replace('~', os.homedir());
        connectConfig.privateKey = require('fs').readFileSync(expandedKeyPath);
      } else {
        // Tentar usar agente SSH
        connectConfig.agent = process.env.SSH_AUTH_SOCK;
      }

      this.sshClient.connect(connectConfig);
    });
  }

  async disconnect(): Promise<void> {
    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = null;
    }
    this.connected = false;
    this.config = null;
    this.logger.info('SSH workspace disconnected');
  }

  isConnected(): boolean {
    return this.connected && this.sshClient !== null;
  }

  async executeCommand(command: string, args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    if (!this.isConnected() || !this.sshClient) {
      throw new Error('Not connected to SSH workspace');
    }

    const workingDir = cwd ? path.posix.join(this.config!.path, cwd) : this.config!.path;
    const fullCommand = `${command} ${args.join(' ')}`;

    return new Promise((resolve, reject) => {
      this.sshClient.exec(`cd "${workingDir}" && ${fullCommand}`, (err: Error, stream: any) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        stream.on('close', (code: number) => {
          exitCode = code;
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('exit', () => {
          resolve({ exitCode, stdout, stderr });
        });
      });
    });
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.isConnected() || !this.sshClient) {
      throw new Error('Not connected to SSH workspace');
    }

    const fullPath = path.posix.join(this.config!.path, filePath);

    return new Promise((resolve, reject) => {
      this.sshClient.sftp((err: Error, sftp: any) => {
        if (err) {
          reject(err);
          return;
        }

        sftp.readFile(fullPath, 'utf-8', (err: Error, data: string) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        });
      });
    });
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isConnected() || !this.sshClient) {
      throw new Error('Not connected to SSH workspace');
    }

    const fullPath = path.posix.join(this.config!.path, filePath);

    return new Promise((resolve, reject) => {
      this.sshClient.sftp((err: Error, sftp: any) => {
        if (err) {
          reject(err);
          return;
        }

        // Garantir que o diretório existe
        const dir = path.posix.dirname(fullPath);
        sftp.mkdir(dir, { recursive: true }, (err: Error) => {
          if (err && err.message !== 'File exists') {
            // Ignorar erro se diretório já existe
          }

          sftp.writeFile(fullPath, content, 'utf-8', (err: Error) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  async listDirectory(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; size: number }>> {
    if (!this.isConnected() || !this.sshClient) {
      throw new Error('Not connected to SSH workspace');
    }

    const fullPath = path.posix.join(this.config!.path, dirPath);

    return new Promise((resolve, reject) => {
      this.sshClient.sftp((err: Error, sftp: any) => {
        if (err) {
          reject(err);
          return;
        }

        sftp.readdir(fullPath, (err: Error, entries: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const result = entries.map(entry => ({
            name: entry.filename,
            isDirectory: entry.attrs.isDirectory(),
            size: entry.attrs.size,
          }));

          resolve(result);
        });
      });
    });
  }

  async fileExists(filePath: string): Promise<boolean> {
    if (!this.isConnected() || !this.sshClient) {
      throw new Error('Not connected to SSH workspace');
    }

    const fullPath = path.posix.join(this.config!.path, filePath);

    return new Promise((resolve, reject) => {
      this.sshClient.sftp((err: Error, sftp: any) => {
        if (err) {
          reject(err);
          return;
        }

        sftp.stat(fullPath, (err: Error) => {
          if (err) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      });
    });
  }
}