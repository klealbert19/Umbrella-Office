#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Ponto de entrada do Umbrella Office.
 */
const office_runtime_1 = require("./core/office-runtime");
const cli_interface_1 = require("./cli/cli-interface");
async function main() {
    const runtime = new office_runtime_1.OfficeRuntime();
    const onSignal = async () => {
        try {
            await runtime.stop();
        }
        finally {
            process.exit(0);
        }
    };
    process.on('SIGINT', () => {
        void onSignal();
    });
    process.on('SIGTERM', () => {
        void onSignal();
    });
    try {
        await runtime.start();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to start Umbrella Office: ${message}`);
        process.exit(1);
    }
    const cli = new cli_interface_1.CliInterface(runtime);
    await cli.start();
    process.exit(0);
}
void main();
//# sourceMappingURL=main.js.map