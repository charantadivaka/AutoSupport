import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationService } from './evaluation.service';
import { AiService } from '../ai.service';
import { GOLDEN_EVALUATION_DATASET } from './evaluation-dataset';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let aiService: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        {
          provide: AiService,
          useValue: {
            activeProviderName: 'mock-provider',
            classifyIntent: jest.fn().mockImplementation((query: string) => {
              // Return accurate classification matching expected for benchmark test
              const matched = GOLDEN_EVALUATION_DATASET.find((tc) => tc.query === query);
              if (matched) {
                return Promise.resolve({
                  intent: matched.expectedIntent,
                  urgency: matched.expectedUrgency,
                  requiresEscalation: matched.expectedRequiresEscalation,
                  confidenceScore: 0.95,
                  reasoning: 'Evaluation mock matched criteria',
                });
              }
              return Promise.resolve({
                intent: 'unknown',
                urgency: 'low',
                requiresEscalation: false,
                confidenceScore: 0.5,
                reasoning: 'Fallback',
              });
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
    aiService = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the curated golden dataset with 28 items', () => {
    const dataset = service.getDataset();
    expect(dataset.length).toBe(28);
    expect(dataset[0].id).toBe('tc-01');
  });

  it('should run benchmark evaluation and compute 100% accuracy on perfect mock', async () => {
    const report = await service.runEvaluation();

    expect(report.summary.totalTestCases).toBe(28);
    expect(report.summary.passedCases).toBe(28);
    expect(report.summary.failedCases).toBe(0);
    expect(report.summary.overallAccuracyPercentage).toBe(100);
    expect(report.summary.escalationRecallPercentage).toBe(100);
    expect(report.summary.evaluatedProvider).toBe('mock-provider');
    expect(report.detailedResults.length).toBe(28);
    expect(report.categoryBreakdown.length).toBeGreaterThan(0);
  });

  it('should detect failures and compute partial accuracy when predictions diverge', async () => {
    (aiService.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'general_faq', // Diverges from expected for tc-01
      urgency: 'low',
      requiresEscalation: true, // Unexpected escalation
      confidenceScore: 0.8,
      reasoning: 'Mismatched',
    });

    // For all other cases, return wrong intent
    (aiService.classifyIntent as jest.Mock).mockResolvedValue({
      intent: 'unknown',
      urgency: 'low',
      requiresEscalation: false,
      confidenceScore: 0.4,
      reasoning: 'Mismatched',
    });

    const report = await service.runEvaluation();
    expect(report.summary.overallAccuracyPercentage).toBeLessThan(50);
    expect(report.summary.failedCases).toBeGreaterThan(0);
  });
});
