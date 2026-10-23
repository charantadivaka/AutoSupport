import { Test, TestingModule } from '@nestjs/testing';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  const mockResolvedTicket = {
    id: 'ticket-1',
    conversationId: 'conv-1',
    customerId: 'cust-1',
    subject: 'Damaged item',
    priority: TicketPriority.HIGH,
    status: TicketStatus.RESOLVED,
    createdAt: new Date('2026-10-18T10:00:00Z'),
    resolvedAt: new Date('2026-10-18T10:20:00Z'), // 20 minutes duration
    customer: { name: 'Alice', email: 'alice@example.com' },
    conversationSummary: 'Customer received cracked monitor',
  };

  const mockOpenTicket = {
    id: 'ticket-2',
    conversationId: 'conv-2',
    customerId: 'cust-2',
    subject: 'Where is my order?',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    createdAt: new Date('2026-10-18T11:00:00Z'),
    resolvedAt: null,
    customer: { name: 'Bob', email: 'bob@example.com' },
    conversationSummary: 'Tracking delay inquiry',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            conversation: {
              count: jest.fn().mockResolvedValue(10), // 10 total conversations
            },
            message: {
              count: jest.fn().mockResolvedValue(50),
              findMany: jest.fn().mockResolvedValue([
                { metadata: { classification: { intent: 'refund_return' } } },
                { metadata: { classification: { intent: 'shipping_order' } } },
              ]),
            },
            ticket: {
              findMany: jest.fn().mockResolvedValue([mockResolvedTicket, mockOpenTicket]),
            },
            feedback: {
              findMany: jest.fn().mockResolvedValue([
                { rating: 5 },
                { rating: 4 },
                { rating: 5 },
              ]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should aggregate containment rate, SLA, and CSAT correctly', async () => {
      const overview = await service.getOverview();

      expect(overview.summary.totalConversations).toBe(10);
      expect(overview.summary.totalTickets).toBe(2);
      expect(overview.summary.openTickets).toBe(1);
      expect(overview.summary.resolvedTickets).toBe(1);

      // 2 escalated conversations out of 10 total conversations => 20% escalation, 80% containment
      expect(overview.summary.escalationRatePercentage).toBe(20);
      expect(overview.summary.containmentRatePercentage).toBe(80);

      // Resolution time: 20 minutes
      expect(overview.summary.avgResolutionTimeMinutes).toBe(20);

      // CSAT: (5 + 4 + 5) / 3 = 4.67 => 4.7
      expect(overview.csat.totalRatings).toBe(3);
      expect(overview.csat.averageRating).toBe(4.7);
      expect(overview.csat.distribution.star5).toBe(2);
      expect(overview.csat.distribution.star4).toBe(1);

      // Recent escalations
      expect(overview.recentEscalations.length).toBe(2);
      expect(overview.recentEscalations[0].customerName).toBe('Alice');
      expect(overview.recentEscalations[0].durationMinutes).toBe(20);
    });

    it('should handle zero conversations gracefully', async () => {
      (prisma.conversation.count as jest.Mock).mockResolvedValue(0);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.feedback.findMany as jest.Mock).mockResolvedValue([]);

      const overview = await service.getOverview();

      expect(overview.summary.totalConversations).toBe(0);
      expect(overview.summary.containmentRatePercentage).toBe(100);
      expect(overview.summary.avgResolutionTimeMinutes).toBe(0);
      expect(overview.csat.totalRatings).toBe(0);
    });
  });
});
