import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ContestsModule } from './contests/contests.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { HealthModule } from './health/health.module.js';
import { TablesModule } from './tables/tables.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletModule } from './wallet/wallet.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // monorepo root .env then apps/server/.env (later wins via ConfigModule array order reverse)
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        // Default high limit; auth routes override via @Throttle
        ttl: 60_000,
        limit: 10_000,
      },
    ]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WalletModule,
    TablesModule,
    FriendsModule,
    ContestsModule,
    GatewayModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Only apply throttling when decorators set limits — global guard still needed for @Throttle
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
