import { Injectable, Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsOverview {
  summary: {
    totalConversations: number;
    totalMessages: number;
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    containmentRatePercentage: number;
    escalationRatePercentage: number;
    avgResolutionTimeMinutes: number;
  };
  csat: {
    averageRating: number;
    totalRatings: number;
    distribution: {
      star1: number;
      star2: number;
      star3: number;
      star4: number;
      star5: number;
    };
  };
  intentBreakdown: {
    intent: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  recentEscalations: {
    id: string;
    subject: string;
    priority: string;
    status: string;
    customerName: string;
    customerEmail: string;
    createdAt: Date;
    resolvedAt: Date | null;
    durationMinutes: number | null;
    conversationSummary: string | null;
  }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AnalyticsOverview> {
    this.logger.log('Aggregating real-time customer support & Gen-AI analytics...');

    // 1. Parallel aggregations for speed
    const [
      totalConversations,
      totalMessages,
      allTickets,
      feedbackList,
      messagesWithClassification,
    ] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.ticket.findMany({
        include: {
          customer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Bug #23 fix: Filter feedback to valid 1-5 rating range so invalid/corrupt entries don't skew metrics
      this.prisma.feedback.findMany({
        where: { rating: { gte: 1, lte: 5 } },
        select: { rating: true },
      }),
      this.prisma.message.findMany({
        where: {
          sender: 'AI',
        },
        select: { metadata: true },
        take: 200,
      }),
    ]);

    // 2. Ticket Status breakdown
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter((t) => t.status === TicketStatus.OPEN).length;
    const inProgressTickets = allTickets.filter(
      (t) =>
        t.status === TicketStatus.IN_PROGRESS ||
        t.status === TicketStatus.WAITING_FOR_CUSTOMER,
    ).length;
    const resolvedTickets = allTickets.filter(
      (t) => t.status === TicketStatus.RESOLVED,
    ).length;

    // 3. Containment Rate calculation
    // Unique conversations that had human tickets escalated
    const escalatedConvIds = new Set(
      allTickets.map((t) => t.conversationId).filter(Boolean),
    );
    const escalatedConversationsCount = escalatedConvIds.size;

    let containmentRatePercentage = 100;
    let escalationRatePercentage = 0;
    if (totalConversations > 0) {
      escalationRatePercentage = Math.min(
        100,
        Math.round((escalatedConversationsCount / totalConversations) * 1000) / 10,
      );
      containmentRatePercentage = Math.round((100 - escalationRatePercentage) * 10) / 10;
    }

    // 4. Resolution Time SLA (in minutes)
    const resolvedWithDates = allTickets.filter((t) => t.status === TicketStatus.RESOLVED && t.resolvedAt);
    let avgResolutionTimeMinutes = 0;
    if (resolvedWithDates.length > 0) {
      const totalMinutes = resolvedWithDates.reduce((acc, t) => {
        const diffMs = new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime();
        return acc + Math.max(1, Math.round(diffMs / (1000 * 60)));
      }, 0);
      avgResolutionTimeMinutes = Math.round((totalMinutes / resolvedWithDates.length) * 10) / 10;
    }

    // 5. CSAT Feedback Metrics
    const distribution = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
    let sumRatings = 0;
    for (const f of feedbackList) {
      sumRatings += f.rating;
      if (f.rating === 1) distribution.star1++;
      else if (f.rating === 2) distribution.star2++;
      else if (f.rating === 3) distribution.star3++;
      else if (f.rating === 4) distribution.star4++;
      else if (f.rating >= 5) distribution.star5++;
    }

    const totalRatings = feedbackList.length;
    // Bug #21 fix: Return null when no feedback exists instead of fabricating 4.8 stars
    const averageRating =
      totalRatings > 0 ? Math.round((sumRatings / totalRatings) * 10) / 10 : null;

    // 6. Intent Distribution
    const intentCounts: Record<string, number> = {
      refund_return: 0,
      shipping_order: 0,
      product_info: 0,
      account_issue: 0,
      technical_support: 0,
      billing_payment: 0,
      general_faq: 0,
    };

    let countedIntents = 0;
    for (const msg of messagesWithClassification) {
      const meta = msg.metadata as any;
      const intent = meta?.classification?.intent;
      if (intent && intentCounts[intent] !== undefined) {
        intentCounts[intent]++;
        countedIntents++;
      }
    }

    // Bug #22 fix: Do NOT inject fake data when database is empty.
    // Return real zeros so the frontend can show a "No data yet" empty state.

    const intentLabels: Record<string, string> = {
      refund_return: 'Refund & Returns',
      shipping_order: 'Shipping & Delivery',
      product_info: 'Product Specifications',
      account_issue: 'Account Access & Security',
      technical_support: 'Hardware & Tech Diagnostics',
      billing_payment: 'Billing & Charges',
      general_faq: 'General Policy FAQ',
    };

    const intentBreakdown = Object.entries(intentCounts)
      .map(([intent, count]) => ({
        intent,
        label: intentLabels[intent] || intent,
        count,
        percentage: countedIntents > 0 ? Math.round((count / countedIntents) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 7. Recent Escalations (Top 10)
    const recentEscalations = allTickets.slice(0, 10).map((t) => {
      let durationMinutes: number | null = null;
      if (t.resolvedAt) {
        durationMinutes = Math.max(
          1,
          Math.round((new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60)),
        );
      }

      return {
        id: t.id,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        customerName: t.customer?.name || 'Customer',
        customerEmail: t.customer?.email || 'N/A',
        createdAt: t.createdAt,
        resolvedAt: t.resolvedAt,
        durationMinutes,
        conversationSummary: t.conversationSummary,
      };
    });

    return {
      summary: {
        totalConversations,
        totalMessages,
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        containmentRatePercentage,
        escalationRatePercentage,
        avgResolutionTimeMinutes,
      },
      csat: {
        averageRating,
        totalRatings,
        distribution,
      },
      intentBreakdown,
      recentEscalations,
    };
  }
}
