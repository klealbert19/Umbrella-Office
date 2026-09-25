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
exports.SshWorkspaceProvider = void 0;
/**
 * SSH Workspace Provider do Umbrella Office V0.4.
 *
 * Permite operações em workspaces remotos via SSH.
 */
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class SshWorkspaceProvider {
    type = 'ssh';
    name;
    logger;
    connected = false;
    config = null;
    sshClient = null;
    constructor(logger) {
        this.logger = logger;
        this.name = 'ssh';
    }
    async connect(config) {
        if (config.type !== 'ssh') {
            throw new Error('Invalid config type for SshWorkspaceProvider');
        }
        if (!config.host || !config.user || !config.path) {
            throw new Error('SSH config requires host, user, and path');
        }
        // Verificar se ssh2 está disponível
        let Client;
        try {
            Client = require('ssh2').Client;
        }
        catch {
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
            this.sshClient.on('error', (err) => {
                this.logger.error('SSH connection error', { error: err.message });
                reject(err);
            });
            this.sshClient.on('close', () => {
                this.connected = false;
                this.logger.info('SSH connection closed');
            });
            // Configurar conexão
            const connectConfig = {
                host: config.host,
                port: config.port ?? 22,
                username: config.user,
            };
            // Autenticação por chave SSH
            if (config.keyPath) {
                const expandedKeyPath = config.keyPath.replace('~', os.homedir());
                connectConfig.privateKey = require('fs').readFileSync(expandedKeyPath);
            }
            else {
                // Tentar usar agente SSH
                connectConfig.agent = process.env.SSH_AUTH_SOCK;
            }
            this.sshClient.connect(connectConfig);
        });
    }
    async disconnect() {
        if (this.sshClient) {
            this.sshClient.end();
            this.sshClient = null;
        }
        this.connected = false;
        this.config = null;
        this.logger.info('SSH workspace disconnected');
    }
    isConnected() {
        return this.connected && this.sshClient !== null;
    }
    async executeCommand(command, args, cwd) {
        if (!this.isConnected() || !this.sshClient) {
            throw new Error('Not connected to SSH workspace');
        }
        const workingDir = cwd ? path.posix.join(this.config.path, cwd) : this.config.path;
        const fullCommand = `${command} ${args.join(' ')}`;
        return new Promise((resolve, reject) => {
            this.sshClient.exec(`cd "${workingDir}" && ${fullCommand}`, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                let stdout = '';
                let stderr = '';
                let exitCode = 0;
                stream.on('close', (code) => {
                    exitCode = code;
                });
                stream.on('data', (data) => {
                    stdout += data.toString();
                });
                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                stream.on('exit', () => {
                    resolve({ exitCode, stdout, stderr });
                });
            });
        });
    }
    async readFile(filePath) {
        if (!this.isConnected() || !this.sshClient) {
            throw new Error('Not connected to SSH workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        return new Promise((resolve, reject) => {
            this.sshClient.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                sftp.readFile(fullPath, 'utf-8', (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(data);
                });
            });
        });
    }
    async writeFile(filePath, content) {
        if (!this.isConnected() || !this.sshClient) {
            throw new Error('Not connected to SSH workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        return new Promise((resolve, reject) => {
            this.sshClient.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                // Garantir que o diretório existe
                const dir = path.posix.dirname(fullPath);
                sftp.mkdir(dir, { recursive: true }, (err) => {
                    if (err && err.message !== 'File exists') {
                        // Ignorar erro se diretório já existe
                    }
                    sftp.writeFile(fullPath, content, 'utf-8', (err) => {
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
    async listDirectory(dirPath) {
        if (!this.isConnected() || !this.sshClient) {
            throw new Error('Not connected to SSH workspace');
        }
        const fullPath = path.posix.join(this.config.path, dirPath);
        return new Promise((resolve, reject) => {
            this.sshClient.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                sftp.readdir(fullPath, (err, entries) => {
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
    async fileExists(filePath) {
        if (!this.isConnected() || !this.sshClient) {
            throw new Error('Not connected to SSH workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        return new Promise((resolve, reject) => {
            this.sshClient.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                sftp.stat(fullPath, (err) => {
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
exports.SshWorkspaceProvider = SshWorkspaceProvider;
//# sourceMappingURL=ssh-provider.js.map