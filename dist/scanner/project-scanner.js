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
exports.ProjectScanner = void 0;
/**
 * Project Scanner do Umbrella Office V0.2.
 *
 * Analisa um workspace para detectar tipo de projeto, gerenciador de pacotes, Git e estrutura.
 * Não executa comandos externos, apenas lê arquivos e lista diretórios.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.cache',
    '.dart_tool',
    '.idea',
    '.vscode',
]);
class ProjectScanner {
    logger;
    engine;
    constructor(logger, engine) {
        this.logger = logger;
        this.engine = engine;
    }
    async scanProject(rootPath) {
        try {
            const normalizedRoot = path.resolve(rootPath);
            const projectTypes = [];
            let packageManager;
            let git = false;
            let filesCount = 0;
            let directoriesCount = 0;
            const files = [];
            const excludedDirectories = [];
            // Detectar TypeScript
            const tsConfigPath = path.join(normalizedRoot, 'tsconfig.json');
            if (await this.fileExists(tsConfigPath)) {
                projectTypes.push('typescript');
            }
            // Detectar Node.js
            const packageJsonPath = path.join(normalizedRoot, 'package.json');
            if (await this.fileExists(packageJsonPath)) {
                projectTypes.push('nodejs');
                // Detectar gerenciador de pacotes
                packageManager = await this.detectPackageManager(normalizedRoot);
            }
            // Detectar Flutter
            const pubspecPath = path.join(normalizedRoot, 'pubspec.yaml');
            if (await this.fileExists(pubspecPath)) {
                projectTypes.push('flutter');
            }
            // Detectar Python
            const pyProjectPath = path.join(normalizedRoot, 'pyproject.toml');
            const requirementsPath = path.join(normalizedRoot, 'requirements.txt');
            if (await this.fileExists(pyProjectPath) || await this.fileExists(requirementsPath)) {
                projectTypes.push('python');
            }
            // Detectar Git
            const gitDir = path.join(normalizedRoot, '.git');
            if (await this.directoryExists(gitDir)) {
                git = true;
            }
            // Listar diretório recursivamente (limitado)
            const listResult = await this.engine.listDirectory(normalizedRoot);
            if (!listResult.success || !listResult.entries) {
                return { success: false, error: 'Falha ao listar diretório' };
            }
            for (const entry of listResult.entries) {
                if (EXCLUDED_DIRS.has(entry.name)) {
                    excludedDirectories.push(entry.name);
                    continue;
                }
                if (entry.type === 'file') {
                    filesCount++;
                    files.push(entry.relativePath);
                }
                else {
                    directoriesCount++;
                }
            }
            // Limitar a quantidade de arquivos retornados para evitar sobrecarga
            const maxFiles = 1000;
            if (files.length > maxFiles) {
                files.splice(maxFiles);
            }
            const project = {
                root: normalizedRoot,
                projectTypes,
                packageManager,
                git,
                filesCount,
                directoriesCount,
                excludedDirectories,
                files,
            };
            this.logger.info('Projeto escaneado', {
                root: normalizedRoot,
                types: projectTypes,
                packageManager,
                git,
                filesCount,
                directoriesCount,
            });
            return { success: true, project };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao escanear projeto', { rootPath, error: message });
            return { success: false, error: message };
        }
    }
    async fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async directoryExists(dirPath) {
        try {
            const stats = await fs.promises.stat(dirPath);
            return stats.isDirectory();
        }
        catch {
            return false;
        }
    }
    async detectPackageManager(root) {
        const lockFiles = [
            { path: path.join(root, 'package-lock.json'), manager: 'npm' },
            { path: path.join(root, 'pnpm-lock.yaml'), manager: 'pnpm' },
            { path: path.join(root, 'yarn.lock'), manager: 'yarn' },
            { path: path.join(root, 'bun.lockb'), manager: 'bun' },
            { path: path.join(root, 'bun.lock'), manager: 'bun' },
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
}
exports.ProjectScanner = ProjectScanner;
//# sourceMappingURL=project-scanner.js.map