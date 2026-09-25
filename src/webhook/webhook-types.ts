/**
 * Tipos para o Webhook Server do Umbrella Office V0.4.
 */
import { randomUUID } from 'crypto';

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

export function createWebhookEvent(event: string, source: string, payload: unknown): WebhookEvent {
  return {
    id: randomUUID(),
    event,
    source,
    timestamp: new Date().toISOString(),
    payload,
  };
}