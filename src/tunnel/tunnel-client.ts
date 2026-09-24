/**
 * Fronteira arquitetural para a futura conexão com o Orchestrator.
 *
 * Na V0.1 o túnel NÃO é conectado. O estado inicial é sempre DISCONNECTED.
 * Não cria conexão falsa, WebSocket falso, nem finge conexão.
 */
import { Logger } from '../logging/logger';

export type TunnelState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export interface TunnelConfig {
  enabled: boolean;
  endpoint: string | null;
}

export class TunnelClient {
  private state: TunnelState = 'DISCONNECTED';
  private readonly logger: Logger;
  private config: TunnelConfig;

  constructor(logger: Logger, config: TunnelConfig) {
    this.logger = logger;
    this.config = config;
  }

  getState(): TunnelState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'CONNECTED';
  }

  updateConfig(config: TunnelConfig): void {
    this.config = config;
  }

  /**
   * Na V0.1 o túnel permanece desconectado.
   * Este método apenas registra a intenção e mantém DISCONNECTED.
   */
  async start(): Promise<void> {
    if (!this.config.enabled || !this.config.endpoint) {
      this.state = 'DISCONNECTED';
      this.logger.info('Tunnel state', { state: this.state, reason: 'orchestrator disabled' });
      return;
    }
    // Futuras versões implementarão a conexão real aqui.
    this.state = 'DISCONNECTED';
    this.logger.info('Tunnel state', { state: this.state });
  }

  async stop(): Promise<void> {
    this.state = 'DISCONNECTED';
    this.logger.info('Tunnel state', { state: this.state, reason: 'stopped' });
  }
}
