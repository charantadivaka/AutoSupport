import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { TicketsModule } from './tickets/tickets.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    /**
     * Rate Limiting (Phase 9)
     * Named tiers:
     *   default -> 60 req / 60s  (general API traffic)
     *   ai      -> 10 req / 60s  (LLM endpoints - expensive + quota-limited)
     *   auth    -> 10 req / 60s  (login/register brute-force protection)
     */
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'ai',
        ttl: 60000,
        limit: 10,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
    ]),
    IdempotencyModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ConversationsModule,
    TicketsModule,
    AiModule,
    KnowledgeModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
