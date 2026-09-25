import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { WebhookConfig, WebhookEndpoint } from './webhook-types';
export declare class WebhookServer {
    private readonly logger;
    private taskRouter;
    private readonly config;
    private server;
    private endpoints;
    private isRunning;
    constructor(logger: Logger, taskRouter: TaskRouter, config: WebhookConfig);
    set taskRouterRef(router: TaskRouter);
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): {
        running: boolean;
        port: number;
        host: string;
    };
    registerEndpoint(endpoint: WebhookEndpoint): void;
    unregisterEndpoint(path: string): boolean;
    listEndpoints(): WebhookEndpoint[];
    private handleRequest;
    private readBody;
    private sendResponse;
}
//# sourceMappingURL=webhook-server.d.ts.map