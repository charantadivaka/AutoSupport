import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: PrismaService;
  let aiService: AiService;

  const mockCustomer = { id: 'cust-1', name: 'Alice', email: 'alice@example.com' };
  const mockTicket = {
    id: 'ticket-999',
    customerId: mockCustomer.id,
    conversationId: 'conv-123',
    subject: 'Refund for order',
    description: 'Item broken',
    category: 'Refund',
    priority: TicketPriority.HIGH,
    status: TicketStatus.OPEN,
    conversationSummary: 'Customer broke item',
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            conversation: {
              update: jest.fn(),
            },
            message: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            feedback: {
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: AiService,
          useValue: {
            generateSynopsis: jest.fn().mockResolvedValue({
              summary: 'Customer issue with damaged item',
              sentiment: 'frustrated',
              suggestedAction: 'Offer replacement',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTicket', () => {
    it('should be idempotent and return existing ticket if already active for conversation', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const result = await service.createTicket(mockCustomer.id, {
        conversationId: 'conv-123',
        subject: 'Refund for order',
        description: 'Item broken',
      });

      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(result.id).toBe(mockTicket.id);
    });

    it('should create a new ticket when none exists', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ticket.create as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});

      const result = await service.createTicket(mockCustomer.id, {
        conversationId: 'conv-123',
        subject: 'Refund for order',
        description: 'Item broken',
      });

      expect(prisma.ticket.create).toHaveBeenCalled();
      expect(result.id).toBe(mockTicket.id);
    });
  });

  describe('updateTicket', () => {
    it('should throw ForbiddenException if customer attempts to update ticket', async () => {
      await expect(
        service.updateTicket(mockTicket.id, mockCustomer.id, Role.CUSTOMER, {
          status: TicketStatus.RESOLVED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow AGENT to resolve ticket and mark resolvedAt timestamp', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateTicket(mockTicket.id, 'agent-1', Role.AGENT, {
        status: TicketStatus.RESOLVED,
        resolutionNotes: 'Refund approved and customer notified',
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.RESOLVED,
            resolvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(TicketStatus.RESOLVED);
    });
  });

  describe('claimTicket', () => {
    it('should assign agent and set status to IN_PROGRESS', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        assignedAgentId: 'agent-1',
        status: TicketStatus.IN_PROGRESS,
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({});
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});

      const result = await service.claimTicket(mockTicket.id, 'agent-1');

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedAgentId: 'agent-1',
            status: TicketStatus.IN_PROGRESS,
          }),
        }),
      );
      expect(result.assignedAgentId).toBe('agent-1');
    });
  });

  describe('replyToTicket', () => {
    it('should create AGENT message in conversation and update ticket status', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicket,
        conversation: { messages: [] },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.message.create as jest.Mock).mockResolvedValue({ id: 'msg-agent-1' });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});

      const result = await service.replyToTicket(
        mockTicket.id,
        'agent-1',
        'Hello Alice, I am processing your replacement right now.',
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sender: 'AGENT',
            content: 'Hello Alice, I am processing your replacement right now.',
          }),
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('resolveTicket', () => {
    it('should mark ticket RESOLVED and post system resolution notice', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.RESOLVED,
        resolutionNotes: 'Item replaced under warranty.',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const result = await service.resolveTicket(
        mockTicket.id,
        'agent-1',
        'Item replaced under warranty.',
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.RESOLVED,
            resolutionNotes: 'Item replaced under warranty.',
          }),
        }),
      );
      expect(result.status).toBe(TicketStatus.RESOLVED);
    });
  });

  describe('recordFeedback', () => {
    it('should record CSAT rating and customer comments on ticket', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicket,
        conversation: {
          messages: [{ id: 'msg-ai-1', sender: 'AI' }],
        },
      });
      (prisma.feedback.upsert as jest.Mock).mockResolvedValue({
        id: 'fb-1',
        rating: 5,
        comment: 'Great service from agent Alice!',
      });

      const result = await service.recordFeedback(
        mockTicket.id,
        mockCustomer.id,
        5,
        'Great service from agent Alice!',
      );

      expect(prisma.feedback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            rating: 5,
            comment: 'Great service from agent Alice!',
          }),
        }),
      );
      expect(result.rating).toBe(5);
    });
  });
});
