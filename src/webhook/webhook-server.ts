/**
 * Webhook Server do Umbrella Office V0.4.
 *
 * Servidor HTTP local para receber eventos externos e transformá-los em Tasks.
 */
import * as http from 'http';
import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { WebhookConfig, WebhookEndpoint, createWebhookEvent } from './webhook-types';

export class WebhookServer {
  private readonly logger: Logger;
  private taskRouter: TaskRouter;
  private readonly config: WebhookConfig;
  private server: http.Server | null = null;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private isRunning: boolean = false;

  constructor(logger: Logger, taskRouter: TaskRouter, config: WebhookConfig) {
    this.logger = logger;
    this.taskRouter = taskRouter;
    this.config = config;
  }

  set taskRouterRef(router: TaskRouter) {
    this.taskRouter = router;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
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

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        this.logger.info('Webhook server stopped');
        resolve();
      });
    });
  }

  getStatus(): { running: boolean; port: number; host: string } {
    return {
      running: this.isRunning,
      port: this.config.port,
      host: this.config.host,
    };
  }

  registerEndpoint(endpoint: WebhookEndpoint): void {
    this.endpoints.set(endpoint.path, endpoint);
    this.logger.info('Webhook endpoint registered', { path: endpoint.path, eventType: endpoint.eventType });
  }

  unregisterEndpoint(path: string): boolean {
    const result = this.endpoints.delete(path);
    if (result) {
      this.logger.info('Webhook endpoint unregistered', { path });
    }
    return result;
  }

  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        this.sendResponse(res, 400, { error: 'Invalid JSON' });
        this.logger.warn('Webhook: invalid JSON', { path: url.pathname });
        return;
      }

      // Validar source se especificado
      const source = req.headers['x-webhook-source'] as string ?? 'unknown';
      if (endpoint.allowedSources.length > 0 && !endpoint.allowedSources.includes(source)) {
        this.sendResponse(res, 403, { error: 'Source not allowed' });
        this.logger.warn('Webhook: source not allowed', { source, allowed: endpoint.allowedSources });
        return;
      }

      // Criar evento
      const event = createWebhookEvent(endpoint.eventType, source, payload);

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
      } else {
        this.sendResponse(res, 500, { success: false, taskId: event.id, error: result.error });
        this.logger.warn('Webhook task failed', { eventId: event.id, error: result.error, duration });
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Webhook request error', { error: message, duration });
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  private sendResponse(res: http.ServerResponse, statusCode: number, body: unknown): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}