import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module.js';
import { isAllowedOrigin, parseExtraOrigins } from './config/cors.js';

// Load monorepo root .env then apps/server/.env (later wins) before Nest boot.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(serverDir, '../../../.env') });
loadEnv({ path: path.resolve(serverDir, '../../.env') });
loadEnv({ path: path.resolve(serverDir, '../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const extraOrigins = parseExtraOrigins(config.get<string>('WEB_ORIGIN'));

  app.enableCors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Reject with `false` (not Error) so preflight still gets a clean CORS response.
      if (isAllowedOrigin(origin, extraOrigins)) callback(null, true);
      else callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  const port = Number(config.get<string>('PORT') ?? process.env.PORT ?? 4000);
  // Explicit host so local clients always reach the process.
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`[poker-server] http://0.0.0.0:${port}`);
  logger.log(`[poker-server] ws://0.0.0.0:${port}/ws`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
