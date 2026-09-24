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
exports.NpmTool = void 0;
/**
 * NPM Tool do Umbrella Office V0.3.
 *
 * Fornece operações NPM estruturadas que usam o Process Tool internamente.
 * Respeita o package manager detectado (npm, pnpm, yarn, bun).
 * Para V0.3, implementa suporte completo apenas ao npm.
 * Para outros gerenciadores, retorna erro claro.
 */
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class NpmTool {
    logger;
    security;
    processTool;
    constructor(logger, security, processTool) {
        this.logger = logger;
        this.security = security;
        this.processTool = processTool;
    }
    /**
     * Detecta o package manager no diretório especificado.
     */
    async detectPackageManager(cwd) {
        const lockFiles = [
            { path: path.join(cwd, 'package-lock.json'), manager: 'npm' },
            { path: path.join(cwd, 'pnpm-lock.yaml'), manager: 'pnpm' },
            { path: path.join(cwd, 'yarn.lock'), manager: 'yarn' },
            { path: path.join(cwd, 'bun.lockb'), manager: 'bun' },
            { path: path.join(cwd, 'bun.lock'), manager: 'bun' },
        ];
        for (const lock of lockFiles) {
            try {
                await fs.promises.access(lock.path);
                return lock.manager;
            }
            catch {
                // continua
            }
        }
        return undefined;
    }
    /**
     * Verifica se o package manager é suportado (apenas npm na V0.3).
     */
    async validatePackageManager(cwd) {
        const manager = await this.detectPackageManager(cwd);
        if (!manager) {
            // Se não há lock file, assume npm
            return { supported: true, manager: 'npm' };
        }
        if (manager !== 'npm') {
            return {
                supported: false,
                manager,
                error: `Package manager "${manager}" não suportado na V0.3. Apenas npm é suportado.`
            };
        }
        return { supported: true, manager };
    }
    /**
     * Executa npm install.
     */
    async install(payload) {
        const cwd = payload.cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
        const validation = await this.validatePackageManager(cwd);
        if (!validation.supported) {
            return this.createErrorResult(validation.error, cwd, ['install', ...(payload.args ?? [])]);
        }
        const args = ['install', ...(payload.args ?? [])];
        return this.executeNpmCommand('npm.install', cwd, args, payload.env, payload.timeout);
    }
    /**
     * Executa npm run <script>.
     */
    async run(payload) {
        const cwd = payload.cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
        const validation = await this.validatePackageManager(cwd);
        if (!validation.supported) {
            return this.createErrorResult(validation.error, cwd, ['run', payload.script, ...(payload.args ?? [])]);
        }
        // Verifica se o script existe no package.json
        const packageJsonPath = path.join(cwd, 'package.json');
        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            if (!pkg.scripts || !pkg.scripts[payload.script]) {
                return this.createErrorResult(`Script "${payload.script}" não encontrado no package.json`, cwd, ['run', payload.script, ...(payload.args ?? [])]);
            }
        }
        catch {
            // Se não conseguir ler, tenta executar mesmo assim
        }
        const args = ['run', payload.script, ...(payload.args ?? [])];
        return this.executeNpmCommand('npm.run', cwd, args, payload.env, payload.timeout);
    }
    /**
     * Executa npm test.
     */
    async test(payload) {
        const cwd = payload.cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
        const validation = await this.validatePackageManager(cwd);
        if (!validation.supported) {
            return this.createErrorResult(validation.error, cwd, ['test', ...(payload.args ?? [])]);
        }
        const args = ['test', ...(payload.args ?? [])];
        return this.executeNpmCommand('npm.test', cwd, args, payload.env, payload.timeout);
    }
    /**
     * Executa npm run build (se o script existir).
     */
    async build(payload) {
        const cwd = payload.cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
        const validation = await this.validatePackageManager(cwd);
        if (!validation.supported) {
            return this.createErrorResult(validation.error, cwd, ['run', 'build']);
        }
        // Verifica se o script build existe
        const packageJsonPath = path.join(cwd, 'package.json');
        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            if (!pkg.scripts || !pkg.scripts['build']) {
                return this.createErrorResult('Script "build" não encontrado no package.json', cwd, ['run', 'build']);
            }
        }
        catch {
            // Se não conseguir ler, tenta executar mesmo assim
        }
        const args = ['run', 'build'];
        return this.executeNpmCommand('npm.build', cwd, args, payload.env, payload.timeout);
    }
    /**
     * Executa comando npm genérico.
     */
    async exec(payload) {
        const cwd = payload.cwd ?? this.security.getActiveWorkspace() ?? process.cwd();
        const validation = await this.validatePackageManager(cwd);
        if (!validation.supported) {
            return this.createErrorResult(validation.error, cwd, payload.args);
        }
        return this.executeNpmCommand('npm.exec', cwd, payload.args, payload.env, payload.timeout);
    }
    /**
     * Executa comando npm via ProcessTool.
     */
    async executeNpmCommand(operation, cwd, args, env, timeout) {
        const result = await this.processTool.execute({
            command: 'npm',
            args,
            cwd,
            env,
            timeout,
        });
        this.logger.info('NPM operation completed', {
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
            command: 'npm',
            args,
            cwd,
        };
    }
    createErrorResult(error, cwd, args) {
        return {
            success: false,
            exitCode: -1,
            stdout: '',
            stderr: error,
            duration: 0,
            timedOut: false,
            command: 'npm',
            args,
            cwd,
        };
    }
}
exports.NpmTool = NpmTool;
//# sourceMappingURL=npm-tool.js.map