"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPluginManifest = createPluginManifest;
function createPluginManifest(id, name, version, description, capabilities, entryPoint) {
    return {
        id,
        name,
        version,
        description,
        capabilities,
        entryPoint,
    };
}
//# sourceMappingURL=plugin-types.js.map