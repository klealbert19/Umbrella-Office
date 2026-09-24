"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
async function runMigrations(config, logger) {
    // Na V0.1 não há migrações reais.
    // Apenas retorna a configuração como está.
    // Futuras versões implementarão:
    // if (config.configVersion === '1') { return migrateV1toV2(config); }
    logger.debug('No migrations needed for current config version', {
        version: config.configVersion,
    });
    return config;
}
//# sourceMappingURL=migration-runner.js.map