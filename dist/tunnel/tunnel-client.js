"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunnelClient = void 0;
class TunnelClient {
    state = 'DISCONNECTED';
    logger;
    config;
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
    }
    getState() {
        return this.state;
    }
    isConnected() {
        return this.state === 'CONNECTED';
    }
    updateConfig(config) {
        this.config = config;
    }
    /**
     * Na V0.1 o túnel permanece desconectado.
     * Este método apenas registra a intenção e mantém DISCONNECTED.
     */
    async start() {
        if (!this.config.enabled || !this.config.endpoint) {
            this.state = 'DISCONNECTED';
            this.logger.info('Tunnel state', { state: this.state, reason: 'orchestrator disabled' });
            return;
        }
        // Futuras versões implementarão a conexão real aqui.
        this.state = 'DISCONNECTED';
        this.logger.info('Tunnel state', { state: this.state });
    }
    async stop() {
        this.state = 'DISCONNECTED';
        this.logger.info('Tunnel state', { state: this.state, reason: 'stopped' });
    }
}
exports.TunnelClient = TunnelClient;
//# sourceMappingURL=tunnel-client.js.map