#!/usr/bin/env node
/**
 * Ponto de entrada do Umbrella Office.
 */
import { OfficeRuntime } from './core/office-runtime';
import { CliInterface } from './cli/cli-interface';

async function main(): Promise<void> {
  const runtime = new OfficeRuntime();

  const onSignal = async (): Promise<void> => {
    try {
      await runtime.stop();
    } finally {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to start Umbrella Office: ${message}`);
    process.exit(1);
  }

  const cli = new CliInterface(runtime);
  await cli.start();
  process.exit(0);
}

void main();
