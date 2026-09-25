"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookEvent = createWebhookEvent;
/**
 * Tipos para o Webhook Server do Umbrella Office V0.4.
 */
const crypto_1 = require("crypto");
function createWebhookEvent(event, source, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        event,
        source,
        timestamp: new Date().toISOString(),
        payload,
    };
}
//# sourceMappingURL=webhook-types.js.map