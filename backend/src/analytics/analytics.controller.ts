import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.AGENT)
  @ApiOperation({
    summary:
      'Get aggregate support metrics: AI containment rate, SLA resolution times, CSAT distribution, and intent trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary payload',
  })
  getOverview() {
    return this.analyticsService.getOverview();
  }
}
