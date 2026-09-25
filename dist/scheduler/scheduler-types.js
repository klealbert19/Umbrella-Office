"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScheduledTask = createScheduledTask;
/**
 * Tipos para o Scheduler do Umbrella Office V0.4.
 */
const crypto_1 = require("crypto");
function createScheduledTask(name, task, schedule) {
    return {
        id: (0, crypto_1.randomUUID)(),
        name,
        task,
        schedule,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRunAt: null,
        nextRunAt: null,
        lastResult: null,
    };
}
//# sourceMappingURL=scheduler-types.js.map