import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { ClassifyQueryDto } from './dto/classify-query.dto';

@ApiTags('AI')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('provider-info')
  @ApiOperation({ summary: 'Get current AI provider status and active model configuration' })
  @ApiResponse({ status: 200, description: 'Provider configuration status' })
  getProviderInfo() {
    return {
      activeProvider: this.aiService.activeProviderName,
      supportedIntents: [
        'general_faq',
        'product_info',
        'shipping_order',
        'refund_return',
        'account_issue',
        'billing_payment',
        'technical_support',
        'human_support_request',
        'unknown',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 10 req/min per IP on this endpoint.
   * Each call triggers an LLM API request which costs tokens and is subject
   * to provider quota limits. Throttling prevents quota drain or billing overruns.
   */
  @Post('classify')
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Classify customer message intent and assess escalation urgency' })
  @ApiResponse({ status: 200, description: 'Structured intent classification output' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - AI rate limit exceeded' })
  async classifyQuery(@Body() dto: ClassifyQueryDto) {
    const classification = await this.aiService.classifyIntent(dto.message);
    return {
      query: dto.message,
      classification,
      provider: this.aiService.activeProviderName,
      evaluatedAt: new Date().toISOString(),
    };
  }
}