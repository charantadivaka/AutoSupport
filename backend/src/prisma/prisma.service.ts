import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to PostgreSQL database');
        return;
      } catch (error) {
        this.logger.warn(
          `Database connect attempt ${attempt}/${attempts} failed: ${error.message}`,
        );
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        } else {
          this.logger.warn(
            'Database connection deferred (will retry when queries execute or credentials provided)',
          );
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database');
  }

  async isHealthy(): Promise<{ status: string; database: string; details?: any }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      return { status: 'degraded', database: 'disconnected', details: error.message };
    }
  }
}
