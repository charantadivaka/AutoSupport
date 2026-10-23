import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { GeminiAiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { MockAiProvider } from './providers/mock.provider';
import { EvaluationController } from './eval/evaluation.controller';
import { EvaluationService } from './eval/evaluation.service';

@Module({
  controllers: [AiController, EvaluationController],
  providers: [
    AiService,
    GeminiAiProvider,
    OpenAiProvider,
    MockAiProvider,
    EvaluationService,
  ],
  exports: [AiService, EvaluationService],
})
export class AiModule {}
