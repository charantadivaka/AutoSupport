export type SupportIntent =
  | 'general_faq'
  | 'product_info'
  | 'shipping_order'
  | 'refund_return'
  | 'account_issue'
  | 'billing_payment'
  | 'technical_support'
  | 'human_support_request'
  | 'unknown';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface IntentClassificationResult {
  intent: SupportIntent;
  urgency: UrgencyLevel;
  requiresEscalation: boolean;
  confidenceScore: number; // 0.0 to 1.0
  reasoning: string;
  suggestedAction?: string;
}

export interface ChatMessageContext {
  role: 'customer' | 'assistant' | 'agent' | 'system';
  content: string;
}

export interface LlmResponse {
  content: string;
  classification: IntentClassificationResult;
  modelUsed: string;
  latencyMs: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface ConversationSynopsis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'urgent';
  suggestedAction: string;
}

export interface AiProvider {
  readonly name: string;
  isAvailable(): boolean;
  classifyIntent(
    message: string,
    history?: ChatMessageContext[],
  ): Promise<IntentClassificationResult>;
  generateResponse(
    userMessage: string,
    history?: ChatMessageContext[],
    retrievedContext?: string,
  ): Promise<LlmResponse>;
  generateSynopsis?(
    messages: ChatMessageContext[],
  ): Promise<ConversationSynopsis>;
}
