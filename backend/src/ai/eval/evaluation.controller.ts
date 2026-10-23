import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EvaluationService } from './evaluation.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('AI Evaluation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('ai/eval')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get('dataset')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get the curated 28-query golden evaluation test dataset' })
  @ApiResponse({ status: 200, description: 'Evaluation test cases' })
  getDataset() {
    return this.evaluationService.getDataset();
  }

  @Post('run')
  @Throttle({ ai: { limit: 3, ttl: 60000 } })
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Execute full AI evaluation benchmark measuring accuracy, escalation recall, and latency',
  })
  @ApiResponse({ status: 200, description: 'Comprehensive evaluation benchmark report' })
  runEvaluation() {
    return this.evaluationService.runEvaluation();
  }
}
