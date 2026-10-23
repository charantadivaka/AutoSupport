import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai.service';
import {
  GOLDEN_EVALUATION_DATASET,
  EvaluationTestCase,
} from './evaluation-dataset';
import { SupportIntent } from '../interfaces/ai-provider.interface';

export interface TestCaseResult {
  id: string;
  query: string;
  category: string;
  expectedIntent: SupportIntent;
  predictedIntent: SupportIntent;
  expectedRequiresEscalation: boolean;
  predictedRequiresEscalation: boolean;
  confidenceScore: number;
  latencyMs: number;
  passed: boolean;
  failureReason?: string;
}

export interface EvaluationReport {
  summary: {
    totalTestCases: number;
    passedCases: number;
    failedCases: number;
    overallAccuracyPercentage: number;
    escalationRecallPercentage: number;
    escalationPrecisionPercentage?: number;
    falsePositiveEscalations?: number;
    averageLatencyMs: number;
    evaluatedProvider: string;
    evaluatedAt: string;
  };
  categoryBreakdown: {
    category: string;
    total: number;
    passed: number;
    accuracyPercentage: number;
  }[];
  detailedResults: TestCaseResult[];
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(private readonly aiService: AiService) {}

  getDataset(): EvaluationTestCase[] {
    return GOLDEN_EVALUATION_DATASET;
  }

  async runEvaluation(): Promise<EvaluationReport> {
    const startTime = Date.now();
    const dataset = GOLDEN_EVALUATION_DATASET;
    this.logger.log(`Starting AI benchmark evaluation against ${dataset.length} test cases...`);

    const detailedResults: TestCaseResult[] = [];
    let passedCount = 0;
    let expectedEscalationCount = 0;
    let truePositiveEscalations = 0;
    // Bug #34 fix: track false positives (AI escalated when it shouldn't have)
    let falsePositiveEscalations = 0;
    let predictedEscalationCount = 0;
    let totalLatency = 0;

    const categoryStats: Record<string, { total: number; passed: number }> = {};

    for (const testCase of dataset) {
      if (!categoryStats[testCase.category]) {
        categoryStats[testCase.category] = { total: 0, passed: 0 };
      }
      categoryStats[testCase.category].total++;

      if (testCase.expectedRequiresEscalation) {
        expectedEscalationCount++;
      }

      const caseStart = Date.now();
      const classification = await this.aiService.classifyIntent(testCase.query);
      const caseLatency = Date.now() - caseStart;
      totalLatency += caseLatency;

      // Evaluation criteria:
      // 1. Intent must match expectedIntent
      // 2. If testCase expects escalation, predicted must require escalation
      const intentMatches = classification.intent === testCase.expectedIntent;
      const escalationMatches =
        classification.requiresEscalation === testCase.expectedRequiresEscalation;

      let passed = intentMatches;
      let failureReason: string | undefined;

      if (!intentMatches) {
        failureReason = `Expected intent "${testCase.expectedIntent}", got "${classification.intent}"`;
      } else if (testCase.expectedRequiresEscalation && !classification.requiresEscalation) {
        // Missed escalation (false negative)
        passed = false;
        failureReason = 'Failed to trigger required human escalation';
      } else if (!testCase.expectedRequiresEscalation && classification.requiresEscalation) {
        // Bug #34 fix: False positive escalation — AI escalated when it shouldn't
        passed = false;
        failureReason = 'Incorrectly triggered human escalation when not expected';
      }

      if (testCase.expectedRequiresEscalation && classification.requiresEscalation) {
        truePositiveEscalations++;
      }
      if (classification.requiresEscalation) {
        predictedEscalationCount++;
      }
      if (!testCase.expectedRequiresEscalation && classification.requiresEscalation) {
        falsePositiveEscalations++;
      }

      if (passed) {
        passedCount++;
        categoryStats[testCase.category].passed++;
      }

      detailedResults.push({
        id: testCase.id,
        query: testCase.query,
        category: testCase.category,
        expectedIntent: testCase.expectedIntent,
        predictedIntent: classification.intent,
        expectedRequiresEscalation: testCase.expectedRequiresEscalation,
        predictedRequiresEscalation: classification.requiresEscalation,
        confidenceScore: classification.confidenceScore,
        latencyMs: caseLatency,
        passed,
        failureReason,
      });
    }

    const overallAccuracyPercentage =
      Math.round((passedCount / dataset.length) * 1000) / 10;

    const escalationRecallPercentage =
      expectedEscalationCount > 0
        ? Math.round((truePositiveEscalations / expectedEscalationCount) * 1000) / 10
        : 100;

    // Bug #34 fix: also compute precision (how often escalations were correct)
    const escalationPrecisionPercentage =
      predictedEscalationCount > 0
        ? Math.round((truePositiveEscalations / predictedEscalationCount) * 1000) / 10
        : 100;

    const averageLatencyMs = Math.round(totalLatency / dataset.length);

    const categoryBreakdown = Object.entries(categoryStats).map(
      ([category, stats]) => ({
        category,
        total: stats.total,
        passed: stats.passed,
        accuracyPercentage:
          Math.round((stats.passed / stats.total) * 1000) / 10,
      }),
    );

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Evaluation complete in ${elapsed}ms: Accuracy=${overallAccuracyPercentage}%, EscalationRecall=${escalationRecallPercentage}%`,
    );

    return {
      summary: {
        totalTestCases: dataset.length,
        passedCases: passedCount,
        failedCases: dataset.length - passedCount,
        overallAccuracyPercentage,
        escalationRecallPercentage,
        escalationPrecisionPercentage,  // Bug #34 fix: added precision metric
        falsePositiveEscalations,       // Bug #34 fix: expose FP count
        averageLatencyMs,
        evaluatedProvider: this.aiService.activeProviderName,
        evaluatedAt: new Date().toISOString(),
      },
      categoryBreakdown,
      detailedResults,
    };
  }
}
