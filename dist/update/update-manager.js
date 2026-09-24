"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateManager = void 0;
/**
 * Infraestrutura futura de atualização do Umbrella Office.
 *
 * Na V0.1 não há download real. checkForUpdates() informa
 * "Update system: NOT CONFIGURED".
 *
 * Fluxo futuro:
 *   Check → Download → Backup → Migration → Install → Restart
 *
 * A atualização nunca deve apagar ~/.umbrella/ sem migração explícita.
 */
const version_1 = require("../core/version");
class UpdateManager {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    getCurrentVersion() {
        return version_1.VERSION;
    }
    async checkForUpdates() {
        this.logger.info('Checking for updates', { currentVersion: version_1.VERSION });
        return {
            status: 'NOT_CONFIGURED',
            currentVersion: version_1.VERSION,
            availableVersion: null,
            message: 'Update system: NOT CONFIGURED',
        };
    }
    getAvailableVersion() {
        return null;
    }
    async installUpdate() {
        throw new Error('Update system: NOT CONFIGURED');
    }
}
exports.UpdateManager = UpdateManager;
//# sourceMappingURL=update-manager.js.map