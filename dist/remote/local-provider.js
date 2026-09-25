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
exports.LocalWorkspaceProvider = void 0;
/**
 * Workspace Provider Abstraction do Umbrella Office V0.4.
 *
 * Permite operações de filesystem/process em workspaces locais ou remotos.
 */
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class LocalWorkspaceProvider {
    type = 'local';
    name;
    logger;
    connected = false;
    workspacePath = '';
    constructor(logger) {
        this.logger = logger;
        this.name = 'local';
    }
    async connect(config) {
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
    async disconnect() {
        this.connected = false;
        this.workspacePath = '';
        this.logger.info('Local workspace disconnected');
    }
    isConnected() {
        return this.connected;
    }
    async executeCommand(command, args, cwd) {
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
    async writeFile(filePath, content) {
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
    async listDirectory(dirPath) {
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
    async fileExists(filePath) {
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
exports.LocalWorkspaceProvider = LocalWorkspaceProvider;
//# sourceMappingURL=local-provider.js.map