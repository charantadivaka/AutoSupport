import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'System health and database connectivity check' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async getHealth() {
    const dbStatus = await this.prisma.isHealthy();
    return {
      service: 'ai-customer-support-backend',
      status: dbStatus.database === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
