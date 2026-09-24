import { Logger } from '../../logging/logger';
import { FilesystemSecurity } from '../../filesystem/filesystem-security';
import { ProcessTool } from '../process/process-tool';
import { GitStatusPayload, GitDiffPayload, GitLogPayload, GitBranchPayload, GitRemotePayload, GitAddPayload, GitCommitPayload, GitCheckoutPayload, GitResult } from './git-types';
export declare class GitTool {
    private readonly logger;
    private readonly security;
    private readonly processTool;
    constructor(logger: Logger, security: FilesystemSecurity, processTool: ProcessTool);
    /**
     * Resolve o cwd: usa workspace ativo se não fornecido.
     */
    private resolveCwd;
    /**
     * Valida se os caminhos estão dentro do workspace.
     */
    private validatePaths;
    /**
     * Executa comando git via ProcessTool.
     */
    private executeGitCommand;
    /**
     * git status --short
     */
    status(payload: GitStatusPayload): Promise<GitResult>;
    /**
     * git diff
     */
    diff(payload: GitDiffPayload): Promise<GitResult>;
    /**
     * git log (histórico recente estruturado)
     */
    log(payload: GitLogPayload): Promise<GitResult>;
    /**
     * git branch (branch atual e branches disponíveis)
     */
    branch(payload: GitBranchPayload): Promise<GitResult>;
    /**
     * git remote (remotes configurados)
     */
    remote(payload: GitRemotePayload): Promise<GitResult>;
    /**
     * git add <paths...>
     * Nunca executa git add . automaticamente.
     */
    add(payload: GitAddPayload): Promise<GitResult>;
    /**
     * git commit -m <message>
     * Não aceita mensagem vazia.
     */
    commit(payload: GitCommitPayload): Promise<GitResult>;
    /**
     * git checkout <branch>
     * Apenas checkout explícito, não apaga alterações silenciosamente.
     */
    checkout(payload: GitCheckoutPayload): Promise<GitResult>;
    private createErrorResult;
}
//# sourceMappingURL=git-tool.d.ts.map