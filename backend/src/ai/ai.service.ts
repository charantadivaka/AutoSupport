import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  ChatMessageContext,
  ConversationSynopsis,
  IntentClassificationResult,
  LlmResponse,
} from './interfaces/ai-provider.interface';
import { GeminiAiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { MockAiProvider } from './providers/mock.provider';
import { retryTransient, withTimeout } from '../common/utils/retry';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private primaryProvider: AiProvider;
  private readonly timeoutMs: number;
  private readonly retryAttempts: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiAiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly mockProvider: MockAiProvider,
  ) {
    const configured = (this.configService.get<string>('LLM_PROVIDER') || 'gemini').toLowerCase();

    if (configured === 'gemini' && this.geminiProvider.isAvailable()) {
      this.primaryProvider = this.geminiProvider;
    } else if (configured === 'openai' && this.openAiProvider.isAvailable()) {
      this.primaryProvider = this.openAiProvider;
    } else {
      this.primaryProvider = this.mockProvider;
      this.logger.log(`Using MockAiProvider as primary AI engine (configured: ${configured})`);
    }

    this.timeoutMs = Number(this.configService.get('LLM_TIMEOUT_MS') || 20000);
    this.retryAttempts = Number(this.configService.get('LLM_RETRY_ATTEMPTS') || 2);
  }

  private callProvider<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return retryTransient(
      () => withTimeout(fn(), this.timeoutMs, label),
      {
        attempts: Math.max(1, this.retryAttempts),
        delayMs: 400,
        label,
      },
    );
  }

  get activeProviderName(): string {
    return this.primaryProvider.name;
  }

  async classifyIntent(
    message: string,
    history?: ChatMessageContext[],
  ): Promise<IntentClassificationResult> {
    try {
      if (this.primaryProvider.isAvailable()) {
        return await this.callProvider('classifyIntent', () =>
          this.primaryProvider.classifyIntent(message, history),
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Primary provider (${this.primaryProvider.name}) failed to classify intent: ${err.message}. Falling back to deterministic mock provider.`,
      );
    }
    return this.mockProvider.classifyIntent(message, history);
  }

  async generateResponse(
    userMessage: string,
    history?: ChatMessageContext[],
    retrievedContext?: string,
  ): Promise<LlmResponse> {
    try {
      if (this.primaryProvider.isAvailable()) {
        return await this.callProvider('generateResponse', () =>
          this.primaryProvider.generateResponse(userMessage, history, retrievedContext),
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Primary provider (${this.primaryProvider.name}) failed to generate response: ${err.message}. Falling back to mock provider.`,
      );
    }
    return this.mockProvider.generateResponse(userMessage, history, retrievedContext);
  }

  async generateSynopsis(
    messages: ChatMessageContext[],
  ): Promise<ConversationSynopsis> {
    try {
      if (this.primaryProvider.isAvailable() && this.primaryProvider.generateSynopsis) {
        return await this.callProvider('generateSynopsis', () =>
          this.primaryProvider.generateSynopsis!(messages),
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Primary provider (${this.primaryProvider.name}) failed to generate synopsis: ${err.message}. Falling back to mock synopsis generator.`,
      );
    }
    return this.mockProvider.generateSynopsis(messages);
  }
}
