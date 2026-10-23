import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { GeminiAiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { MockAiProvider } from './providers/mock.provider';

describe('AiService', () => {
  let service: AiService;
  let mockProvider: MockAiProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        MockAiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'LLM_PROVIDER') return 'mock';
              return null;
            }),
          },
        },
        {
          provide: GeminiAiProvider,
          useValue: {
            name: 'gemini',
            isAvailable: jest.fn().mockReturnValue(false),
            classifyIntent: jest.fn(),
            generateResponse: jest.fn(),
          },
        },
        {
          provide: OpenAiProvider,
          useValue: {
            name: 'openai',
            isAvailable: jest.fn().mockReturnValue(false),
            classifyIntent: jest.fn(),
            generateResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    mockProvider = module.get<MockAiProvider>(MockAiProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Intent Classification Across Support Categories', () => {
    it('should classify human escalation requests', async () => {
      const result = await service.classifyIntent('I want to speak with a human agent right now');
      expect(result.intent).toBe('human_support_request');
      expect(result.requiresEscalation).toBe(true);
      expect(result.urgency).toBe('high');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
    });

    it('should classify refund and return policy queries', async () => {
      const result = await service.classifyIntent('Can I get a refund if the item was damaged?');
      expect(result.intent).toBe('refund_return');
      expect(result.requiresEscalation).toBe(true); // damaged goods triggers escalation
    });

    it('should classify shipping and order tracking queries', async () => {
      const result = await service.classifyIntent('Where is my package? The tracking number is delayed');
      expect(result.intent).toBe('shipping_order');
      expect(result.confidenceScore).toBeGreaterThan(0.8);
    });

    it('should classify billing and payment issues', async () => {
      const result = await service.classifyIntent('I was charged twice on my credit card invoice');
      expect(result.intent).toBe('billing_payment');
      expect(result.urgency).toBe('urgent');
      expect(result.requiresEscalation).toBe(true);
    });

    it('should classify account and password queries', async () => {
      const result = await service.classifyIntent('I cannot login and forgot my password');
      expect(result.intent).toBe('account_issue');
    });

    it('should classify technical support queries', async () => {
      const result = await service.classifyIntent('The web app crashed with a network error');
      expect(result.intent).toBe('technical_support');
    });

    it('should classify product specifications and warranties', async () => {
      const result = await service.classifyIntent('What is the warranty period for this electronic device?');
      expect(result.intent).toBe('product_info');
    });

    it('should classify general greeting and FAQ queries', async () => {
      const result = await service.classifyIntent('Hello, what are your store opening hours?');
      expect(result.intent).toBe('general_faq');
      expect(result.requiresEscalation).toBe(false);
    });
  });

  describe('Response Generation with Fallback', () => {
    it('should generate helpful grounded response with metadata', async () => {
      const response = await service.generateResponse('What is your refund policy?');
      expect(response.content).toContain('30-day');
      expect(response.classification.intent).toBe('refund_return');
      expect(response.modelUsed).toBeDefined();
      expect(response.tokensUsed).toBeDefined();
    });
  });
});
