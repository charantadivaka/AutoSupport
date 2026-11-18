import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AiModule } from '../ai/ai.module';
import { TicketsModule } from '../tickets/tickets.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { GuardrailsModule } from '../common/guardrails/guardrails.module';

@Module({
  imports: [AiModule, TicketsModule, KnowledgeModule, GuardrailsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
