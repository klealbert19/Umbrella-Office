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
exports.WslWorkspaceProvider = void 0;
/**
 * WSL Workspace Provider do Umbrella Office V0.4.
 *
 * Permite operações em workspaces dentro do WSL (Windows Subsystem for Linux).
 */
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class WslWorkspaceProvider {
    type = 'wsl';
    name;
    logger;
    connected = false;
    config = null;
    constructor(logger) {
        this.logger = logger;
        this.name = 'wsl';
    }
    async connect(config) {
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
    async disconnect() {
        this.connected = false;
        this.config = null;
        this.logger.info('WSL workspace disconnected');
    }
    isConnected() {
        return this.connected;
    }
    async runWslCommand(distribution, args) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const wslArgs = ['-d', distribution, ...args];
            const child = spawn('wsl.exe', wslArgs, { shell: false, windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
                resolve({ exitCode: code ?? 0, stdout, stderr });
            });
            child.on('error', (err) => {
                reject(err);
            });
        });
    }
    async executeCommand(command, args, cwd) {
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
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
                resolve({ exitCode: code ?? 0, stdout, stderr });
            });
            child.on('error', (err) => {
                reject(err);
            });
        });
    }
    async readFile(filePath) {
        if (!this.isConnected() || !this.config) {
            throw new Error('Not connected to WSL workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        const result = await this.runWslCommand(this.config.distribution, ['cat', fullPath]);
        if (result.exitCode !== 0) {
            throw new Error(`Failed to read file: ${result.stderr}`);
        }
        return result.stdout;
    }
    async writeFile(filePath, content) {
        if (!this.isConnected() || !this.config) {
            throw new Error('Not connected to WSL workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        const dir = path.posix.dirname(fullPath);
        // Criar diretório se não existir
        await this.runWslCommand(this.config.distribution, ['mkdir', '-p', dir]);
        // Escrever arquivo usando tee
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const wslArgs = ['-d', this.config.distribution, 'tee', fullPath];
            const child = spawn('wsl.exe', wslArgs, { shell: false, windowsHide: true });
            let stderr = '';
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Failed to write file: ${stderr}`));
                }
            });
            child.on('error', (err) => {
                reject(err);
            });
            child.stdin.write(content);
            child.stdin.end();
        });
    }
    async listDirectory(dirPath) {
        if (!this.isConnected() || !this.config) {
            throw new Error('Not connected to WSL workspace');
        }
        const fullPath = path.posix.join(this.config.path, dirPath);
        const result = await this.runWslCommand(this.config.distribution, ['ls', '-la', fullPath]);
        if (result.exitCode !== 0) {
            throw new Error(`Failed to list directory: ${result.stderr}`);
        }
        // Parse ls -la output
        const lines = result.stdout.trim().split('\n').slice(1); // Skip "total X"
        const entries = [];
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 9)
                continue;
            const permissions = parts[0];
            const size = parseInt(parts[4], 10);
            const name = parts.slice(8).join(' ');
            if (name === '.' || name === '..')
                continue;
            entries.push({
                name,
                isDirectory: permissions.startsWith('d'),
                size,
            });
        }
        return entries;
    }
    async fileExists(filePath) {
        if (!this.isConnected() || !this.config) {
            throw new Error('Not connected to WSL workspace');
        }
        const fullPath = path.posix.join(this.config.path, filePath);
        const result = await this.runWslCommand(this.config.distribution, ['test', '-e', fullPath]);
        return result.exitCode === 0;
    }
}
exports.WslWorkspaceProvider = WslWorkspaceProvider;
//# sourceMappingURL=wsl-provider.js.map