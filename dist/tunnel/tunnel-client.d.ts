/**
 * Fronteira arquitetural para a futura conexão com o Orchestrator.
 *
 * Na V0.1 o túnel NÃO é conectado. O estado inicial é sempre DISCONNECTED.
 * Não cria conexão falsa, WebSocket falso, nem finge conexão.
 */
import { Logger } from '../logging/logger';
export type TunnelState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';
export interface TunnelConfig {
    enabled: boolean;
    endpoint: string | null;
}
export declare class TunnelClient {
    private state;
    private readonly logger;
    private config;
    constructor(logger: Logger, config: TunnelConfig);
    getState(): TunnelState;
    isConnected(): boolean;
    updateConfig(config: TunnelConfig): void;
    /**
     * Na V0.1 o túnel permanece desconectado.
     * Este método apenas registra a intenção e mantém DISCONNECTED.
     */
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=tunnel-client.d.ts.map