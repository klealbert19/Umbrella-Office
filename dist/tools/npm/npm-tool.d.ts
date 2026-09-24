import { Logger } from '../../logging/logger';
import { FilesystemSecurity } from '../../filesystem/filesystem-security';
import { ProcessTool } from '../process/process-tool';
import { NpmInstallPayload, NpmRunPayload, NpmTestPayload, NpmBuildPayload, NpmExecPayload, NpmResult } from './npm-types';
export declare class NpmTool {
    private readonly logger;
    private readonly security;
    private readonly processTool;
    constructor(logger: Logger, security: FilesystemSecurity, processTool: ProcessTool);
    /**
     * Detecta o package manager no diretório especificado.
     */
    detectPackageManager(cwd: string): Promise<string | undefined>;
    /**
     * Verifica se o package manager é suportado (apenas npm na V0.3).
     */
    private validatePackageManager;
    /**
     * Executa npm install.
     */
    install(payload: NpmInstallPayload): Promise<NpmResult>;
    /**
     * Executa npm run <script>.
     */
    run(payload: NpmRunPayload): Promise<NpmResult>;
    /**
     * Executa npm test.
     */
    test(payload: NpmTestPayload): Promise<NpmResult>;
    /**
     * Executa npm run build (se o script existir).
     */
    build(payload: NpmBuildPayload): Promise<NpmResult>;
    /**
     * Executa comando npm genérico.
     */
    exec(payload: NpmExecPayload): Promise<NpmResult>;
    /**
     * Executa comando npm via ProcessTool.
     */
    private executeNpmCommand;
    private createErrorResult;
}
//# sourceMappingURL=npm-tool.d.ts.map