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
exports.GitTool = void 0;
/**
 * Git Tool do Umbrella Office V0.3.
 *
 * Fornece operações Git estruturadas que usam o Process Tool internamente.
 * Operações READ: status, diff, log, branch, remote
 * Operações WRITE: add, commit, checkout
 * Operações DESTRUTIVAS: bloqueadas na V0.3
 */
const path = __importStar(require("path"));
class GitTool {
    logger;
    security;
    processTool;
    constructor(logger, security, processTool) {
        this.logger = logger;
        this.security = security;
        this.processTool = processTool;
    }
    /**
     * Resolve o cwd: usa workspace ativo se não fornecido.
     */
    resolveCwd(cwd) {
        return cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
    }
    /**
     * Valida se os caminhos estão dentro do workspace.
     */
    validatePaths(paths, cwd) {
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
    async executeGitCommand(operation, cwd, args, timeout) {
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
    async status(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        return this.executeGitCommand('git.status', cwd, ['status', '--short'], payload.timeout);
    }
    /**
     * git diff
     */
    async diff(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        const args = ['diff', ...(payload.args ?? [])];
        return this.executeGitCommand('git.diff', cwd, args, payload.timeout);
    }
    /**
     * git log (histórico recente estruturado)
     */
    async log(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        // Formato estruturado para facilitar parsing
        const args = ['log', '--oneline', '-20', '--pretty=format:%H|%an|%ad|%s', ...(payload.args ?? [])];
        return this.executeGitCommand('git.log', cwd, args, payload.timeout);
    }
    /**
     * git branch (branch atual e branches disponíveis)
     */
    async branch(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        return this.executeGitCommand('git.branch', cwd, ['branch', '-a'], payload.timeout);
    }
    /**
     * git remote (remotes configurados)
     */
    async remote(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        return this.executeGitCommand('git.remote', cwd, ['remote', '-v'], payload.timeout);
    }
    // ============ WRITE OPERATIONS ============
    /**
     * git add <paths...>
     * Nunca executa git add . automaticamente.
     */
    async add(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        if (!payload.paths || payload.paths.length === 0) {
            return this.createErrorResult('Nenhum caminho fornecido para git add', cwd, ['add']);
        }
        // Valida caminhos
        const validation = this.validatePaths(payload.paths, cwd);
        if (!validation.valid) {
            return this.createErrorResult(validation.error, cwd, ['add', ...payload.paths]);
        }
        const args = ['add', ...payload.paths];
        return this.executeGitCommand('git.add', cwd, args, payload.timeout);
    }
    /**
     * git commit -m <message>
     * Não aceita mensagem vazia.
     */
    async commit(payload) {
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
    async checkout(payload) {
        const cwd = this.resolveCwd(payload.cwd);
        if (!payload.branch || payload.branch.trim() === '') {
            return this.createErrorResult('Nome da branch não pode ser vazio', cwd, ['checkout']);
        }
        const args = ['checkout', payload.branch];
        return this.executeGitCommand('git.checkout', cwd, args, payload.timeout);
    }
    createErrorResult(error, cwd, args) {
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
exports.GitTool = GitTool;
//# sourceMappingURL=git-tool.js.map