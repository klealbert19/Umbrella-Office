export interface WebhookEvent {
    id: string;
    event: string;
    source: string;
    timestamp: string;
    payload: unknown;
}
export interface WebhookConfig {
    enabled: boolean;
    port: number;
    host: string;
    authToken: string | null;
    allowedEvents: string[];
    maxPayloadSize: number;
}
export interface WebhookEndpoint {
    path: string;
    eventType: string;
    allowedSources: string[];
    requiredAuth: boolean;
}
export declare function createWebhookEvent(event: string, source: string, payload: unknown): WebhookEvent;
//# sourceMappingURL=webhook-types.d.ts.map