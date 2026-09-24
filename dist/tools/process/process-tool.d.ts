import { Logger } from '../../logging/logger';
import { FilesystemSecurity } from '../../filesystem/filesystem-security';
import { ProcessExecutePayload, ProcessExecuteResult } from './process-types';
export declare class ProcessTool {
    private readonly logger;
    private readonly security;
    constructor(logger: Logger, security: FilesystemSecurity);
    /**
     * Executa um processo com as opções especificadas.
     */
    execute(payload: ProcessExecutePayload): Promise<ProcessExecuteResult>;
    /**
     * Resolve o comando para Windows (procura .exe, .cmd, .bat)
     * Retorna o comando resolvido e se deve usar shell.
     * No Windows, arquivos .cmd/.bat precisam de shell: true ou cmd /c.
     */
    private resolveCommand;
}
//# sourceMappingURL=process-tool.d.ts.map