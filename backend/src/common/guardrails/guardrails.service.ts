import { Injectable, Logger } from '@nestjs/common';

/**
 * Result returned by GuardrailsService.scan().
 * - `safe`  : true  -> input is clean; forward to LLM.
 * - `safe`  : false -> input matched a guardrail; block and return `reason`.
 * - `flags` : list of matched rule IDs for audit logging.
 */
export interface GuardrailScanResult {
  safe: boolean;
  reason?: string;
  flags: string[];
}

/**
 * A single detection rule with a human-readable id, description, and regex.
 */
interface GuardrailRule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * GuardrailsService
 * -----------------
 * Provides defense-in-depth against prompt-injection and jailbreak attacks by
 * scanning user input BEFORE it reaches the LLM.
 *
 * Architecture note for interviews:
 *   Pattern-matching alone is not sufficient. This layer is a first-pass filter.
 *   The LLM structured JSON output schema (only 9-category enum) acts as second
 *   line of defense. Together they make successful injection extremely unlikely.
 *
 * Rules are additive: a single HIGH or CRITICAL match blocks the request.
 * Multiple LOW/MEDIUM matches combine into a block.
 */
@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  private readonly rules: GuardrailRule[] = [
    {
      id: 'INJ-001',
      description: 'Classic ignore previous instructions injection',
      pattern: /ignore\s+(all\s+)?(previous|prior|above|your)\s+instructions?/i,
      severity: 'CRITICAL',
    },
    {
      id: 'INJ-002',
      description: 'System prompt extraction attempt',
      pattern: /print\s+(your\s+)?(system\s+prompt|initial\s+prompt|original\s+instructions?)/i,
      severity: 'CRITICAL',
    },
    {
      id: 'INJ-003',
      description: 'Forget / reset instruction override',
      pattern: /forget\s+(everything|all\s+previous|your\s+(instructions?|training))/i,
      severity: 'HIGH',
    },
    {
      id: 'INJ-004',
      description: 'New instruction injection via markdown-style block',
      pattern: /```\s*(system|instruction|prompt|override)/i,
      severity: 'HIGH',
    },
    {
      id: 'INJ-005',
      description: 'Role reassignment injection (you are now)',
      pattern: /you\s+are\s+now\s+(a\s+)?(DAN|jailbreak|unrestricted|evil|root)/i,
      severity: 'CRITICAL',
    },
    {
      id: 'JB-001',
      description: 'DAN jailbreak mode activation',
      pattern: /\bDAN\b.*\b(mode|jailbreak|enabled|activated)\b/i,
      severity: 'CRITICAL',
    },
    {
      id: 'JB-002',
      description: 'Developer / debug mode activation attempt',
      pattern: /\b(developer|debug|god|root|admin)\s+mode\s+(enabled|on|activated)/i,
      severity: 'HIGH',
    },
    {
      id: 'JB-003',
      description: 'Safety rules bypass phrase',
      pattern: /ignore\s+(safety|ethical|content)\s+(rules?|guidelines?|filters?|policy)/i,
      severity: 'CRITICAL',
    },
    {
      id: 'EX-001',
      description: 'API key / secret / token extraction attempt',
      // Matches: "reveal your api key", "show me your secret token", "print the password", etc.
      // (?:\w+\s+){0,3} allows up to 3 optional words between the verb and the sensitive noun
      pattern: /\b(reveal|show|print|output|display|give|tell|send)\b(?:\s+\w+){0,3}\s+(api\s+key|secret\s*token|secret|password|credential|bearer\s+token)/i,
      severity: 'CRITICAL',
    },
    {
      id: 'EX-002',
      description: 'Environment variable extraction attempt',
      pattern: /\b(process\.env|env\s+variables?|environment\s+variables?)\b/i,
      severity: 'HIGH',
    },
  ];

  /** Maximum allowed input length in characters (anti-stuffing / anti-DoS). */
  private readonly MAX_INPUT_LENGTH = 4000;

  /**
   * Scans a user-submitted message for prompt-injection violations.
   * Returns GuardrailScanResult with safe flag, optional reason, and matched rule IDs.
   */
  scan(input: string): GuardrailScanResult {
    const flags: string[] = [];

    if (input.length > this.MAX_INPUT_LENGTH) {
      this.logger.warn(`Guardrail blocked: input exceeded max length (${input.length} chars)`);
      return {
        safe: false,
        reason: `Message exceeds the maximum allowed length of ${this.MAX_INPUT_LENGTH} characters.`,
        flags: ['LENGTH-001'],
      };
    }

    for (const rule of this.rules) {
      if (rule.pattern.test(input)) {
        flags.push(rule.id);
        this.logger.warn(
          `Guardrail flag: rule=${rule.id} severity=${rule.severity} input="${input.slice(0, 80)}..."`,
        );

        if (rule.severity === 'CRITICAL' || rule.severity === 'HIGH') {
          return {
            safe: false,
            reason:
              'Your message was flagged by our content safety system. Please rephrase your support question.',
            flags,
          };
        }
      }
    }

    if (flags.length >= 2) {
      this.logger.warn(`Guardrail blocked: multiple flags (${flags.join(', ')})`);
      return {
        safe: false,
        reason:
          'Your message contains patterns that cannot be processed. Please rephrase.',
        flags,
      };
    }

    return { safe: true, flags };
  }

  /** Returns all configured rules for admin audit endpoints. */
  getRules(): Pick<GuardrailRule, 'id' | 'description' | 'severity'>[] {
    return this.rules.map(({ id, description, severity }) => ({ id, description, severity }));
  }
}