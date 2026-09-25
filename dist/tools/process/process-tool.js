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
exports.ProcessTool = void 0;
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
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ProcessTool {
    logger;
    security;
    constructor(logger, security) {
        this.logger = logger;
        this.security = security;
    }
    /**
     * Executa um processo com as opções especificadas.
     */
    async execute(payload) {
        const startedAt = Date.now();
        const { command, args = [], cwd, env, timeout = 120000 } = payload;
        // Resolve o cwd: se não fornecido, usa workspace ativo
        let resolvedCwd = cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
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
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let child = null;
            // Timeout handler
            const timeoutId = setTimeout(() => {
                timedOut = true;
                if (child) {
                    child.kill('SIGTERM');
                    // Force kill after 5 seconds if still running
                    const forceKillTimeout = setTimeout(() => {
                        if (child && !child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 5000);
                    // Store force kill timeout to clear it on close
                    child._forceKillTimeout = forceKillTimeout;
                }
            }, timeout);
            try {
                child = (0, child_process_1.spawn)(resolvedCommand, args, {
                    cwd: resolvedCwd,
                    env: mergedEnv,
                    shell: useShell,
                    windowsHide: true,
                });
            }
            catch (err) {
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
            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', (err) => {
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
            child.on('close', (code) => {
                clearTimeout(timeoutId);
                // Clear force kill timeout if it was set
                const forceKillTimeout = child._forceKillTimeout;
                if (forceKillTimeout) {
                    clearTimeout(forceKillTimeout);
                }
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
    resolveCommand(command) {
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
            if (!dir)
                continue;
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
                }
                catch {
                    // tenta o próximo candidato
                }
            }
        }
        return { resolvedCommand: command, useShell: false };
    }
}
exports.ProcessTool = ProcessTool;
//# sourceMappingURL=process-tool.js.map