"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultConfig = createDefaultConfig;
exports.isConfigVersionSupported = isConfigVersionSupported;
/**
 * Esquema de configuração do Umbrella Office.
 *
 * Define a forma da configuração persistida em ~/.umbrella/config.json.
 * A `configVersion` permite futuras migrações sem destruir a configuração.
 */
const version_1 = require("../core/version");
function createDefaultConfig() {
    return {
        configVersion: version_1.CONFIG_VERSION,
        office: {
            name: 'Umbrella Office',
        },
        orchestrator: {
            enabled: false,
            endpoint: null,
        },
    };
}
function isConfigVersionSupported(configVersion) {
    return configVersion === version_1.CONFIG_VERSION;
}
//# sourceMappingURL=config-schema.js.map