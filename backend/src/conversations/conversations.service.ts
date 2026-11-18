import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConversationStatus, MessageSender, Role, TicketPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { TicketsService } from '../tickets/tickets.service';
import { KnowledgeService, RetrievedChunk } from '../knowledge/knowledge.service';
import { GuardrailsService } from '../common/guardrails/guardrails.service';
import { wrapUntrustedKnowledge } from '../common/security/untrusted-context';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMessageContext } from '../ai/interfaces/ai-provider.interface';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly ticketsService: TicketsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly guardrails: GuardrailsService,
  ) {}

  async createConversation(
    customerId: string,
    dto?: CreateConversationDto,
    role: Role = Role.CUSTOMER,
  ) {
    const conversation = await this.prisma.conversation.create({
      data: {
        customerId,
        status: ConversationStatus.ACTIVE,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(`Created conversation ${conversation.id} for user ${customerId}`);

    if (dto?.initialMessage) {
      await this.addMessage(conversation.id, customerId, role, {
        content: dto.initialMessage,
      });
    }

    return this.findOne(conversation.id, customerId, role);
  }

  async findAllForUser(userId: string, role: Role) {
    const whereClause =
      role === Role.CUSTOMER ? { customerId: userId } : {};

    return this.prisma.conversation.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, sender: true, createdAt: true },
        },
        _count: {
          select: { messages: true, tickets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: Role) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sources: {
              include: {
                documentChunk: {
                  select: {
                    content: true,
                    pageNumber: true,
                    document: { select: { title: true, originalFilename: true } },
                  },
                },
              },
            },
            feedback: true,
          },
        },
        tickets: {
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            assignedAgentId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    // Customer Isolation Guard
    if (role === Role.CUSTOMER && conversation.customerId !== userId) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view this conversation',
      );
    }

    return conversation;
  }

  // Bug #33 fix: Dedicated lightweight query for messages without fetching entire conversation metadata & tickets
  async getMessages(id: string, userId: string, role: Role) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { customerId: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (role === Role.CUSTOMER && conversation.customerId !== userId) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view this conversation',
      );
    }

    return this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        sources: {
          include: {
            documentChunk: {
              select: {
                content: true,
                pageNumber: true,
                document: { select: { title: true, originalFilename: true } },
              },
            },
          },
        },
        feedback: true,
      },
    });
  }

  async addMessage(
    conversationId: string,
    userId: string,
    role: Role,
    dto: CreateMessageDto,
  ) {
    // 1. Verify existence and authorization
    const conversation = await this.findOne(conversationId, userId, role);

    const sender =
      role === Role.CUSTOMER ? MessageSender.CUSTOMER : MessageSender.AGENT;

    // 2. Persist incoming customer or agent message
    await this.prisma.message.create({
      data: {
        conversationId,
        sender,
        content: dto.content.trim(),
        metadata: dto.metadata || {},
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 3. Customer messages: guardrails, then RAG + generation. The customer
    //    message is already stored so a later AI/DB failure cannot lose it.
    if (sender === MessageSender.CUSTOMER) {
      const scanResult = this.guardrails.scan(dto.content.trim());
      if (!scanResult.safe) {
        this.logger.warn(
          `Guardrail blocked message from user ${userId}: flags=[${scanResult.flags.join(', ')}]`,
        );
        await this.prisma.message.create({
          data: {
            conversationId,
            sender: MessageSender.SYSTEM,
            content:
              scanResult.reason ||
              'Your message was blocked by the content safety system. Please rephrase your support question.',
            metadata: {
              blocked: true,
              flags: scanResult.flags,
            },
          },
        });
        return this.prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          include: {
            sources: {
              include: {
                documentChunk: {
                  select: {
                    content: true,
                    pageNumber: true,
                    document: { select: { title: true, originalFilename: true } },
                  },
                },
              },
            },
            feedback: true,
          },
        });
      }

      try {
        let retrievedChunks: RetrievedChunk[] = [];
        try {
          retrievedChunks = await this.knowledgeService.searchSimilarChunks(
            dto.content.trim(),
            4,
            0.45,
          );
          this.logger.log(
            `RAG retrieved ${retrievedChunks.length} chunks for query length=${dto.content.trim().length}`,
          );
        } catch (err: any) {
          this.logger.warn(`RAG retrieval warning: ${err.message}`);
        }

        const retrievedContext = wrapUntrustedKnowledge(retrievedChunks) || undefined;

        // Bug #26 fix: Filter out SYSTEM messages so they do not confuse LLM context
        const historyContext: ChatMessageContext[] = conversation.messages
          .filter((m) => m.sender !== MessageSender.SYSTEM)
          .slice(-6)
          .map((m) => ({
            role: m.sender === MessageSender.CUSTOMER ? 'customer' : 'assistant',
            content: m.content,
          }));

        const llmResult = await this.aiService.generateResponse(
          dto.content.trim(),
          historyContext,
          retrievedContext,
        );

        const classification = llmResult.classification;

        const shouldEscalate =
          classification.requiresEscalation ||
          classification.intent === 'human_support_request' ||
          classification.urgency === 'urgent';

        if (shouldEscalate && conversation.status !== ConversationStatus.WAITING_AGENT) {
          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { status: ConversationStatus.WAITING_AGENT },
          });

          const priorityMap: Record<string, TicketPriority> = {
            urgent: TicketPriority.URGENT,
            high: TicketPriority.HIGH,
            medium: TicketPriority.MEDIUM,
            low: TicketPriority.LOW,
          };

          const ticketPriority = priorityMap[classification.urgency] || TicketPriority.HIGH;
          const subject = `AI Escalation: ${classification.intent.replace(/_/g, ' ').toUpperCase()} (${conversationId.slice(0, 8)})`;

          await this.ticketsService.createTicket(conversation.customerId, {
            conversationId,
            subject,
            description: dto.content.trim(),
            category: classification.intent,
            priority: ticketPriority,
          });

          await this.prisma.message.create({
            data: {
              conversationId,
              sender: MessageSender.SYSTEM,
              content: `Your inquiry has been escalated to a human support agent (Priority: ${ticketPriority}, Intent: ${classification.intent}). A support specialist will assist you shortly.`,
              metadata: {
                escalated: true,
                intent: classification.intent,
                reasoning: classification.reasoning,
              },
            },
          });
        } else {
          const aiMessage = await this.prisma.message.create({
            data: {
              conversationId,
              sender: MessageSender.AI,
              content: llmResult.content,
              metadata: {
                classification: JSON.parse(JSON.stringify(llmResult.classification)),
                modelUsed: llmResult.modelUsed,
                latencyMs: llmResult.latencyMs,
                tokensUsed: llmResult.tokensUsed ? JSON.parse(JSON.stringify(llmResult.tokensUsed)) : null,
                retrievedChunkCount: retrievedChunks.length,
              } as any,
            },
          });

          if (retrievedChunks.length > 0) {
            for (const chunk of retrievedChunks) {
              try {
                await this.prisma.messageSource.create({
                  data: {
                    messageId: aiMessage.id,
                    documentChunkId: chunk.id,
                    relevanceScore: chunk.similarityScore,
                  },
                });
              } catch (err: any) {
                this.logger.warn(`Could not save message source citation: ${err.message}`);
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.error(
          `AI pipeline failed after storing customer message: ${err.message}`,
        );
        try {
          await this.ticketsService.createTicket(conversation.customerId, {
            conversationId,
            subject: `AI service failure (${conversationId.slice(0, 8)})`,
            description: dto.content.trim(),
            category: 'unknown',
            priority: TicketPriority.HIGH,
          });
        } catch (ticketErr: any) {
          this.logger.warn(`Could not open fallback ticket: ${ticketErr.message}`);
        }
        await this.prisma.message.create({
          data: {
            conversationId,
            sender: MessageSender.SYSTEM,
            content:
              'The AI assistant is temporarily unavailable. Your message has been saved and a support ticket was opened so a human agent can help.',
            metadata: {
              aiFailure: true,
            },
          },
        });
      }
    }

    // Return the updated message list with sources included
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sources: {
          include: {
            documentChunk: {
              select: {
                content: true,
                pageNumber: true,
                document: { select: { title: true, originalFilename: true } },
              },
            },
          },
        },
        feedback: true,
      },
    });
  }
}
