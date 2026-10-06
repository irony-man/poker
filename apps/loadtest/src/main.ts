import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createApp } from './server/app.js';
import { RunManager } from './server/runs.js';
import { ReportStore } from './server/store.js';

/** Local dev: app `.env` then monorepo `.env`; existing env vars always win. */
function loadDotEnv(): void {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const file of [path.join(appRoot, '.env'), path.join(appRoot, '../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  const store = new ReportStore(config.reportsDir);
  await store.init();
  const runs = new RunManager(config, store);
  const server = createApp(config, { store, runs });

  server.listen(config.port, config.host, () => {
    console.log(`[loadtest] dashboard on http://${config.host}:${config.port}`);
    console.log(`[loadtest] targets: ${config.targets.map((t) => `${t.name} (${t.apiUrl})`).join(', ')}`);
    console.log(`[loadtest] reports in ${config.reportsDir}`);
    if (!config.loadtestToken) {
      console.warn('[loadtest] LOADTEST_TOKEN not set — target rate limits will apply to signups and requests');
    }
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[loadtest] ${signal} — stopping active run and saving its report`);
    server.close();
    await runs.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[loadtest]', err instanceof Error ? err.message : err);
  process.exit(1);
});
