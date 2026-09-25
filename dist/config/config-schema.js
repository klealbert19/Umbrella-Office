"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultConfig = createDefaultConfig;
exports.isConfigVersionSupported = isConfigVersionSupported;
exports.normalizeConfig = normalizeConfig;
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
        scheduler: {
            enabled: true,
        },
        webhook: {
            enabled: false,
            port: 3456,
            host: '127.0.0.1',
            authToken: null,
            allowedEvents: [],
            maxPayloadSize: 1048576, // 1MB
        },
        plugins: {
            enabled: [],
            directory: 'plugins',
        },
        remote: {
            defaultProvider: 'local',
        },
    };
}
function isConfigVersionSupported(configVersion) {
    return configVersion === version_1.CONFIG_VERSION;
}
/**
 * Normaliza uma configuração bruta contra os defaults atuais.
 * Preenche campos ausentes recursivamente, preservando valores existentes.
 */
function normalizeConfig(raw) {
    const defaults = createDefaultConfig();
    return deepMerge(defaults, raw);
}
/**
 * Merge profundo que preserva valores existentes e preenche ausentes.
 * Arrays são substituídos (não mesclados) para evitar duplicatas.
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue === undefined || sourceValue === null) {
            // Manter o valor do target (default) se source for undefined/null
            continue;
        }
        if (typeof sourceValue === 'object' &&
            typeof targetValue === 'object' &&
            sourceValue !== null &&
            targetValue !== null &&
            !Array.isArray(sourceValue) &&
            !Array.isArray(targetValue)) {
            // Merge recursivo para objetos
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else {
            // Valor primitivo ou array: usar o valor do source
            result[key] = sourceValue;
        }
    }
    return result;
}
//# sourceMappingURL=config-schema.js.map