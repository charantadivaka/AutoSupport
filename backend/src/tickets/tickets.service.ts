import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ConversationStatus,
  MessageSender,
  Role,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async createTicket(customerId: string, dto: CreateTicketDto) {
    // 1. Idempotency Check: prevent duplicate active tickets for the same conversation
    if (dto.conversationId) {
      const activeTicket = await this.prisma.ticket.findFirst({
        where: {
          conversationId: dto.conversationId,
          status: {
            in: [
              TicketStatus.OPEN,
              TicketStatus.IN_PROGRESS,
              TicketStatus.WAITING_FOR_CUSTOMER,
            ],
          },
        },
      });

      if (activeTicket) {
        this.logger.log(
          `Idempotency hit: Returning existing active ticket ${activeTicket.id} for conversation ${dto.conversationId}`,
        );
        return activeTicket;
      }
    }

    // 2. Automated AI Conversation Synopsis Generation
    let synopsisSummary = dto.conversationSummary || null;
    if (!synopsisSummary && dto.conversationId) {
      try {
        const historyMessages = await this.prisma.message.findMany({
          where: { conversationId: dto.conversationId },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });

        if (historyMessages.length > 0) {
          const chatContext = historyMessages.map((m) => ({
            role: (m.sender === MessageSender.CUSTOMER
              ? 'customer'
              : m.sender === MessageSender.AGENT
              ? 'agent'
              : 'assistant') as any,
            content: m.content,
          }));

          const synopsis = await this.aiService.generateSynopsis(chatContext);
          synopsisSummary = `${synopsis.summary}\n[Customer Sentiment: ${synopsis.sentiment.toUpperCase()}]\n[Suggested Action: ${synopsis.suggestedAction}]`;
          this.logger.log(
            `Generated AI synopsis for ticket from conversation ${dto.conversationId}: sentiment=${synopsis.sentiment}`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`Could not generate AI synopsis for ticket: ${err.message}`);
      }
    }

    // 3. Persist new ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        customerId,
        conversationId: dto.conversationId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        category: dto.category || 'General',
        priority: dto.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        conversationSummary: synopsisSummary,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Created support ticket ${ticket.id} by customer ${customerId}`);

    // 3. Update conversation status to WAITING_AGENT if linked
    if (dto.conversationId) {
      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { status: ConversationStatus.WAITING_AGENT },
      });
    }

    return ticket;
  }

  async findAll(
    userId: string,
    role: Role,
    status?: TicketStatus,
    priority?: TicketPriority,
  ) {
    const where: any = {};

    // Customer Isolation
    if (role === Role.CUSTOMER) {
      where.customerId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        conversation: {
          select: {
            id: true,
            status: true,
            _count: { select: { messages: true } },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, userId: string, role: Role) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                sender: true,
                content: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Customer Isolation
    if (role === Role.CUSTOMER && ticket.customerId !== userId) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view this ticket',
      );
    }

    return ticket;
  }

  async updateTicket(
    id: string,
    userId: string,
    role: Role,
    dto: UpdateTicketDto,
  ) {
    // Only Support Agents and Administrators can update tickets
    if (role === Role.CUSTOMER) {
      throw new ForbiddenException(
        'Access denied: Only support agents and administrators can manage tickets',
      );
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assignedAgentId !== undefined) data.assignedAgentId = dto.assignedAgentId;
    if (dto.resolutionNotes !== undefined) data.resolutionNotes = dto.resolutionNotes;
    if (dto.conversationSummary !== undefined) data.conversationSummary = dto.conversationSummary;

    if (dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
      data.resolvedAt = new Date();

      // If conversation is linked, mark conversation resolved
      if (ticket.conversationId) {
        await this.prisma.conversation.update({
          where: { id: ticket.conversationId },
          data: { status: ConversationStatus.RESOLVED },
        });
      }
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Ticket ${id} updated by ${role} ${userId}`);
    return updated;
  }

  async claimTicket(id: string, agentId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedAgentId: agentId,
        status: TicketStatus.IN_PROGRESS,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        conversation: {
          select: { id: true, status: true },
        },
      },
    });

    if (ticket.conversationId) {
      // Post system announcement into conversation
      await this.prisma.message.create({
        data: {
          conversationId: ticket.conversationId,
          sender: MessageSender.SYSTEM,
          content: `Support Agent has joined and claimed Ticket #${ticket.id.slice(0, 8)}. A human representative is now actively assisting you.`,
        },
      });
      await this.prisma.conversation.update({
        where: { id: ticket.conversationId },
        data: { status: ConversationStatus.ACTIVE, updatedAt: new Date() },
      });
    }

    this.logger.log(`Ticket ${id} claimed by agent ${agentId}`);
    return updated;
  }

  async replyToTicket(id: string, agentId: string, content: string) {
    // Bug #4 fix: guard against missing/empty content before any DB call
    if (!content || !content.trim()) {
      throw new BadRequestException('Reply content cannot be empty');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    if (!ticket.conversationId) {
      throw new BadRequestException(`Ticket ${id} is not linked to any conversation thread.`);
    }

    // Auto-assign to agent if currently unassigned
    const dataUpdate: any = {
      status: TicketStatus.WAITING_FOR_CUSTOMER,
    };
    if (!ticket.assignedAgentId) {
      dataUpdate.assignedAgentId = agentId;
    }

    await this.prisma.ticket.update({
      where: { id },
      data: dataUpdate,
    });

    // Create message with sender AGENT
    await this.prisma.message.create({
      data: {
        conversationId: ticket.conversationId,
        sender: MessageSender.AGENT,
        content: content.trim(),
        metadata: {
          agentId,
          ticketId: ticket.id,
        },
      },
    });

    // Keep conversation active
    await this.prisma.conversation.update({
      where: { id: ticket.conversationId },
      data: { status: ConversationStatus.ACTIVE, updatedAt: new Date() },
    });

    this.logger.log(`Agent ${agentId} posted reply to Ticket ${id} in Conversation ${ticket.conversationId}`);

    // Return the updated ticket with messages
    return this.findOne(id, agentId, Role.AGENT);
  }

  async resolveTicket(id: string, agentId: string, resolutionNotes: string) {
    // Bug #5 fix: guard against missing/empty resolutionNotes before any DB call
    if (!resolutionNotes || !resolutionNotes.trim()) {
      throw new BadRequestException('Resolution notes cannot be empty');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.RESOLVED,
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: new Date(),
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    if (ticket.conversationId) {
      await this.prisma.conversation.update({
        where: { id: ticket.conversationId },
        data: { status: ConversationStatus.RESOLVED, updatedAt: new Date() },
      });

      await this.prisma.message.create({
        data: {
          conversationId: ticket.conversationId,
          sender: MessageSender.SYSTEM,
          content: `Ticket #${ticket.id.slice(0, 8)} has been marked as RESOLVED by Support Agent. Resolution: "${resolutionNotes.trim()}". Thank you for contacting AutoSupport!`,
        },
      });
    }

    this.logger.log(`Ticket ${id} resolved by agent ${agentId}`);
    return updated;
  }

  async recordFeedback(
    ticketId: string,
    customerId: string,
    rating: number,
    comment?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        conversation: {
          include: {
            messages: {
              where: { sender: { in: [MessageSender.AI, MessageSender.AGENT] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    if (ticket.customerId !== customerId) {
      throw new ForbiddenException('You can only submit feedback for your own support tickets');
    }

    const targetMessage = ticket.conversation?.messages?.[0];
    if (!targetMessage) {
      throw new BadRequestException('No agent or AI message found to attach feedback to');
    }

    // Upsert feedback
    const feedback = await this.prisma.feedback.upsert({
      where: { messageId: targetMessage.id },
      create: {
        messageId: targetMessage.id,
        customerId,
        rating: Math.min(5, Math.max(1, rating)),
        comment: comment?.trim() || null,
      },
      update: {
        rating: Math.min(5, Math.max(1, rating)),
        comment: comment?.trim() || null,
      },
    });

    this.logger.log(`Customer ${customerId} submitted ${rating}-star feedback for Ticket ${ticketId}`);
    return feedback;
  }
}
