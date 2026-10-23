import { Module } from '@nestjs/common';
import { GuardrailsService } from './guardrails.service';

/**
 * GuardrailsModule
 * ----------------
 * Exports GuardrailsService so any other module (ConversationsModule, AiModule,
 * KnowledgeModule) can inject it without re-declaring the provider.
 *
 * Architecture note: Keeping guardrails in `common/` signals it is a
 * cross-cutting concern�just like auth guards or exception filters�not tied
 * to any single business domain.
 */
@Module({
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
