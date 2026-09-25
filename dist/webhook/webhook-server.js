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
exports.WebhookServer = void 0;
/**
 * Webhook Server do Umbrella Office V0.4.
 *
 * Servidor HTTP local para receber eventos externos e transformá-los em Tasks.
 */
const http = __importStar(require("http"));
const webhook_types_1 = require("./webhook-types");
class WebhookServer {
    logger;
    taskRouter;
    config;
    server = null;
    endpoints = new Map();
    isRunning = false;
    constructor(logger, taskRouter, config) {
        this.logger = logger;
        this.taskRouter = taskRouter;
        this.config = config;
    }
    set taskRouterRef(router) {
        this.taskRouter = router;
    }
    async start() {
        if (this.isRunning)
            return;
        if (!this.config.enabled) {
            this.logger.info('Webhook server disabled in config');
            return;
        }
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });
            this.server.on('error', (err) => {
                this.logger.error('Webhook server error', { error: String(err) });
                if (!this.isRunning) {
                    reject(err);
                }
            });
            this.server.listen(this.config.port, this.config.host, () => {
                this.isRunning = true;
                this.logger.info('Webhook server started', {
                    host: this.config.host,
                    port: this.config.port,
                });
                resolve();
            });
        });
    }
    async stop() {
        if (!this.isRunning || !this.server)
            return;
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                this.server = null;
                this.logger.info('Webhook server stopped');
                resolve();
            });
        });
    }
    getStatus() {
        return {
            running: this.isRunning,
            port: this.config.port,
            host: this.config.host,
        };
    }
    registerEndpoint(endpoint) {
        this.endpoints.set(endpoint.path, endpoint);
        this.logger.info('Webhook endpoint registered', { path: endpoint.path, eventType: endpoint.eventType });
    }
    unregisterEndpoint(path) {
        const result = this.endpoints.delete(path);
        if (result) {
            this.logger.info('Webhook endpoint unregistered', { path });
        }
        return result;
    }
    listEndpoints() {
        return Array.from(this.endpoints.values());
    }
    async handleRequest(req, res) {
        const startTime = Date.now();
        try {
            // Validar método
            if (req.method !== 'POST') {
                this.sendResponse(res, 405, { error: 'Method not allowed' });
                this.logger.warn('Webhook: invalid method', { method: req.method, url: req.url });
                return;
            }
            // Validar endpoint
            const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
            const endpoint = this.endpoints.get(url.pathname);
            if (!endpoint) {
                this.sendResponse(res, 404, { error: 'Endpoint not found' });
                this.logger.warn('Webhook: endpoint not found', { path: url.pathname });
                return;
            }
            // Validar autenticação
            if (endpoint.requiredAuth && this.config.authToken) {
                const authHeader = req.headers['authorization'];
                if (!authHeader || authHeader !== `Bearer ${this.config.authToken}`) {
                    this.sendResponse(res, 401, { error: 'Unauthorized' });
                    this.logger.warn('Webhook: authentication failed', { path: url.pathname });
                    return;
                }
            }
            // Validar tamanho do payload
            const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
            if (contentLength > this.config.maxPayloadSize) {
                this.sendResponse(res, 413, { error: 'Payload too large' });
                this.logger.warn('Webhook: payload too large', { size: contentLength, max: this.config.maxPayloadSize });
                return;
            }
            // Ler body
            const body = await this.readBody(req);
            // Validar JSON
            let payload;
            try {
                payload = JSON.parse(body);
            }
            catch {
                this.sendResponse(res, 400, { error: 'Invalid JSON' });
                this.logger.warn('Webhook: invalid JSON', { path: url.pathname });
                return;
            }
            // Validar source se especificado
            const source = req.headers['x-webhook-source'] ?? 'unknown';
            if (endpoint.allowedSources.length > 0 && !endpoint.allowedSources.includes(source)) {
                this.sendResponse(res, 403, { error: 'Source not allowed' });
                this.logger.warn('Webhook: source not allowed', { source, allowed: endpoint.allowedSources });
                return;
            }
            // Criar evento
            const event = (0, webhook_types_1.createWebhookEvent)(endpoint.eventType, source, payload);
            // Verificar se evento é permitido
            if (this.config.allowedEvents.length > 0 && !this.config.allowedEvents.includes(event.event)) {
                this.sendResponse(res, 403, { error: 'Event type not allowed' });
                this.logger.warn('Webhook: event type not allowed', { event: event.event });
                return;
            }
            // Transformar em Task e executar via TaskRouter
            const task = {
                id: event.id,
                type: event.event,
                payload: event.payload,
                createdAt: event.timestamp,
            };
            this.logger.info('Webhook received', { eventId: event.id, event: event.event, source: event.source });
            const result = await this.taskRouter.route(task);
            const duration = Date.now() - startTime;
            if (result.success) {
                this.sendResponse(res, 200, { success: true, taskId: event.id, output: result.output });
                this.logger.info('Webhook task completed', { eventId: event.id, duration });
            }
            else {
                this.sendResponse(res, 500, { success: false, taskId: event.id, error: result.error });
                this.logger.warn('Webhook task failed', { eventId: event.id, error: result.error, duration });
            }
        }
        catch (err) {
            const duration = Date.now() - startTime;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Webhook request error', { error: message, duration });
            this.sendResponse(res, 500, { error: 'Internal server error' });
        }
    }
    readBody(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            req.on('error', reject);
        });
    }
    sendResponse(res, statusCode, body) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    }
}
exports.WebhookServer = WebhookServer;
//# sourceMappingURL=webhook-server.js.map