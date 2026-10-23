import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  ChatMessageContext,
  ConversationSynopsis,
  IntentClassificationResult,
  LlmResponse,
  SupportIntent,
  UrgencyLevel,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock-provider';
  private readonly logger = new Logger(MockAiProvider.name);

  isAvailable(): boolean {
    return true;
  }

  async classifyIntent(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    history?: ChatMessageContext[],
  ): Promise<IntentClassificationResult> {
    const text = message.toLowerCase();

    let intent: SupportIntent = 'unknown';
    let urgency: UrgencyLevel = 'low';
    let requiresEscalation = false;
    let confidenceScore = 0.88;
    let reasoning = 'Categorized via deterministic intent matching rules.';
    let suggestedAction = 'Provide general response';

    // 1. Human Escalation Intent
    if (
      text.includes('human') ||
      text.includes('agent') ||
      text.includes('representative') ||
      text.includes('manager') ||
      text.includes('person') ||
      text.includes('escalate') ||
      text.includes('talk to someone')
    ) {
      intent = 'human_support_request';
      urgency = 'high';
      requiresEscalation = true;
      confidenceScore = 0.98;
      reasoning = 'Customer explicitly requested to interact with a human support agent.';
      suggestedAction = 'Route conversation to human agent queue';
    }
    // 2. Refund or Return Intent
    else if (
      text.includes('refund') ||
      text.includes('return') ||
      text.includes('exchange') ||
      text.includes('money back') ||
      text.includes('send back')
    ) {
      intent = 'refund_return';
      urgency = text.includes('stolen') || text.includes('damaged') ? 'urgent' : 'medium';
      requiresEscalation = text.includes('damaged') || text.includes('defective');
      confidenceScore = 0.94;
      reasoning = 'Query pertains to return policy guidelines or refund claims.';
      suggestedAction = 'Cite standard 30-day return window and refund guidelines';
    }
    // 3. Shipping or Order Issue
    else if (
      text.includes('shipping') ||
      text.includes('delivery') ||
      text.includes('tracking') ||
      text.includes('order') ||
      text.includes('arrive') ||
      text.includes('delayed') ||
      text.includes('transit')
    ) {
      intent = 'shipping_order';
      urgency = text.includes('lost') || text.includes('missing') ? 'high' : 'medium';
      requiresEscalation = text.includes('lost') || text.includes('never arrived');
      confidenceScore = 0.92;
      reasoning = 'Query regarding order status, delivery timelines, or tracking information.';
      suggestedAction = 'Verify tracking number or explain shipping turnaround time';
    }
    // 4. Billing or Payment Issue
    else if (
      text.includes('billing') ||
      text.includes('charged') ||
      text.includes('invoice') ||
      text.includes('credit card') ||
      text.includes('payment') ||
      text.includes('receipt') ||
      text.includes('double charge')
    ) {
      intent = 'billing_payment';
      urgency =
        text.includes('fraud') ||
        text.includes('unauthorized') ||
        text.includes('double charge') ||
        text.includes('twice')
          ? 'urgent'
          : 'high';
      requiresEscalation = urgency === 'urgent';
      confidenceScore = 0.95;
      reasoning = 'Financial inquiry regarding charges, billing accuracy, or payment methods.';
      suggestedAction = 'Review payment transaction history securely';
    }
    // 5. Account Issue
    else if (
      text.includes('password') ||
      text.includes('login') ||
      text.includes('account') ||
      text.includes('locked') ||
      text.includes('email change') ||
      text.includes('2fa')
    ) {
      intent = 'account_issue';
      urgency = text.includes('hacked') || text.includes('locked') ? 'urgent' : 'medium';
      requiresEscalation = text.includes('hacked');
      confidenceScore = 0.93;
      reasoning = 'Security or authentication access inquiry.';
      suggestedAction = 'Guide user through self-service password reset';
    }
    // 6. Technical Support
    else if (
      text.includes('error') ||
      text.includes('crash') ||
      text.includes('bug') ||
      text.includes('not working') ||
      text.includes('failed') ||
      text.includes('broken') ||
      text.includes('glitch')
    ) {
      intent = 'technical_support';
      urgency = 'medium';
      requiresEscalation = false;
      confidenceScore = 0.89;
      reasoning = 'Diagnostic report concerning software or device malfunction.';
      suggestedAction = 'Provide step-by-step troubleshooting checklist';
    }
    // 7. Product Information
    else if (
      text.includes('warranty') ||
      text.includes('specs') ||
      text.includes('feature') ||
      text.includes('compatible') ||
      text.includes('model') ||
      text.includes('price') ||
      text.includes('size')
    ) {
      intent = 'product_info';
      urgency = 'low';
      requiresEscalation = false;
      confidenceScore = 0.91;
      reasoning = 'Customer seeking specifications, compatibility, or product guidance.';
      suggestedAction = 'Retrieve relevant product catalog details';
    }
    // 8. General FAQ
    else if (
      text.includes('hours') ||
      text.includes('contact') ||
      text.includes('store') ||
      text.includes('policy') ||
      text.includes('about') ||
      text.includes('hello') ||
      text.includes('hi') ||
      text.includes('help')
    ) {
      intent = 'general_faq';
      urgency = 'low';
      requiresEscalation = false;
      confidenceScore = 0.86;
      reasoning = 'General company policy, support availability, or greeting.';
      suggestedAction = 'Answer with approved knowledge base facts';
    }

    return {
      intent,
      urgency,
      requiresEscalation,
      confidenceScore,
      reasoning,
      suggestedAction,
    };
  }

  async generateResponse(
    userMessage: string,
    history?: ChatMessageContext[],
    retrievedContext?: string,
  ): Promise<LlmResponse> {
    const startTime = Date.now();
    const classification = await this.classifyIntent(userMessage, history);

    let content = '';

    if (classification.requiresEscalation || classification.intent === 'human_support_request') {
      content =
        'I understand this issue requires personal attention. I have escalated this conversation to our support team and created a priority ticket for you.';
    } else {
      switch (classification.intent) {
        case 'refund_return':
          content =
            'We offer a 30-day money-back guarantee on all standard items in original condition. To start a return, please keep your order number ready. Would you like instructions on generating a prepaid return shipping label?';
          break;
        case 'shipping_order':
          content =
            'Standard domestic shipping typically takes 3 to 5 business days. Once an order ships, a tracking email is automatically dispatched. If you share your order ID, our team can verify its current dispatch status.';
          break;
        case 'billing_payment':
          content =
            'We accept major credit cards, PayPal, and Apple Pay. If you see an unexpected charge on your statement, please provide the transaction date and amount so we can trace the billing record.';
          break;
        case 'account_issue':
          content =
            'For account security, password resets can be requested from the login screen via the "Forgot Password" link. A verification link will be sent to your registered email address immediately.';
          break;
        case 'technical_support':
          content =
            'To resolve this technical issue, we recommend: 1) Clearing your browser cache or updating the application, 2) Restarting your device, and 3) Checking that your internet connection is stable. Let me know if the error persists.';
          break;
        case 'product_info':
          content =
            'All our electronic products include a 1-year manufacturer warranty covering hardware defects. You can find detailed technical specifications and user manuals in our knowledge base.';
          break;
        default:
          content =
            'Hello! I am your AutoSupport AI Assistant. I can help answer questions regarding our company policies, products, shipping, returns, and order support. How can I assist you today?';
          break;
      }
    }

    if (retrievedContext) {
      content += `\n\n[Grounded Evidence Reference]: ${retrievedContext.slice(0, 150)}...`;
    }

    return {
      content,
      classification,
      modelUsed: 'mock-llm-v1',
      latencyMs: Date.now() - startTime,
      tokensUsed: {
        prompt: Math.ceil(userMessage.length / 4),
        completion: Math.ceil(content.length / 4),
        total: Math.ceil((userMessage.length + content.length) / 4),
      },
    };
  }

  async generateSynopsis(messages: ChatMessageContext[]): Promise<ConversationSynopsis> {
    const customerMsgs = messages
      .filter((m) => m.role === 'customer')
      .map((m) => m.content);
    const fullText = customerMsgs.join(' ').toLowerCase();

    let sentiment: 'positive' | 'neutral' | 'frustrated' | 'urgent' = 'neutral';
    if (
      fullText.includes('urgent') ||
      fullText.includes('emergency') ||
      fullText.includes('immediately') ||
      fullText.includes('asap')
    ) {
      sentiment = 'urgent';
    } else if (
      fullText.includes('angry') ||
      fullText.includes('frustrated') ||
      fullText.includes('terrible') ||
      fullText.includes('scam') ||
      fullText.includes('unacceptable') ||
      fullText.includes('ridiculous')
    ) {
      sentiment = 'frustrated';
    } else if (fullText.includes('thank') || fullText.includes('great')) {
      sentiment = 'positive';
    }

    const latestMsg = customerMsgs[customerMsgs.length - 1] || 'Customer support inquiry';
    const cleanMsg = latestMsg.replace(/\s+/g, ' ').trim();
    const summary = `Customer initiated support inquiry: "${cleanMsg.slice(0, 100)}${cleanMsg.length > 100 ? '...' : ''}". Conversation escalated to human support queue for priority review.`;
    const suggestedAction =
      sentiment === 'urgent'
        ? 'Expedite ticket triage and verify customer account verification status immediately.'
        : sentiment === 'frustrated'
        ? 'Acknowledge customer frustration, offer priority resolution or fee waiver if applicable.'
        : 'Review linked knowledge base articles and verify customer order status in CRM.';

    return {
      summary,
      sentiment,
      suggestedAction,
    };
  }
}
