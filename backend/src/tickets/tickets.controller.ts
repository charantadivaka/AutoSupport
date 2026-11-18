import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayloadDto } from '../auth/dto/auth-response.dto';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Idempotent } from '../common/idempotency/idempotency.decorator';

@ApiTags('Tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create or escalate a support ticket (idempotent)' })
  @ApiResponse({ status: 201, description: 'Ticket created or existing active ticket returned' })
  createTicket(
    @CurrentUser() user: UserPayloadDto,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.createTicket(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (scoped to customer, or all for agents/admins)' })
  @ApiQuery({ name: 'status', enum: TicketStatus, required: false })
  @ApiQuery({ name: 'priority', enum: TicketPriority, required: false })
  @ApiResponse({ status: 200, description: 'List of support tickets' })
  findAll(
    @CurrentUser() user: UserPayloadDto,
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
  ) {
    return this.ticketsService.findAll(user.id, user.role, status, priority);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details with conversation transcript' })
  @ApiResponse({ status: 200, description: 'Ticket details' })
  @ApiResponse({ status: 403, description: 'Forbidden: Cannot access another customer ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.ticketsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket status, priority, or resolution notes (Agents/Admins)' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Customers cannot edit tickets' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.updateTicket(id, user.id, user.role, dto);
  }

  @Patch(':id/claim')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Support agent claims an unassigned ticket' })
  @ApiResponse({ status: 200, description: 'Ticket claimed and assigned to agent' })
  claimTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.ticketsService.claimTicket(id, user.id);
  }

  @Post(':id/reply')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Agent sends direct message into customer chat thread' })
  @ApiResponse({ status: 201, description: 'Agent reply posted and conversation updated' })
  replyToTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Body('content') content: string,
  ) {
    return this.ticketsService.replyToTicket(id, user.id, content);
  }

  @Post(':id/resolve')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Mark ticket as RESOLVED with resolution notes' })
  @ApiResponse({ status: 200, description: 'Ticket resolved and closed' })
  resolveTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Body('resolutionNotes') resolutionNotes: string,
  ) {
    return this.ticketsService.resolveTicket(id, user.id, resolutionNotes || 'Issue resolved by support representative.');
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Customer submits 1-5 star CSAT rating and comment on ticket' })
  @ApiResponse({ status: 201, description: 'Feedback recorded' })
  submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.ticketsService.recordFeedback(id, user.id, body.rating, body.comment);
  }
}
