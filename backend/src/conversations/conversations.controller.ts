import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayloadDto } from '../auth/dto/auth-response.dto';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new support conversation session' })
  @ApiResponse({ status: 201, description: 'Conversation session created' })
  createConversation(
    @CurrentUser() user: UserPayloadDto,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(user.id, dto, user.role);
  }

  @Get()
  @ApiOperation({ summary: 'List all conversations for current user (or all for agents)' })
  @ApiResponse({ status: 200, description: 'List of conversation sessions' })
  findAll(@CurrentUser() user: UserPayloadDto) {
    return this.conversationsService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation details and full message transcript' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 403, description: 'Forbidden: Cannot access another customer conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.conversationsService.findOne(id, user.id, user.role);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get all messages in a conversation thread' })
  @ApiResponse({ status: 200, description: 'List of messages in chronological order' })
  // Bug #33 fix: Use optimized getMessages query instead of loading full conversation entity
  getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.conversationsService.getMessages(id, user.id, user.role);
  }

  @Post(':id/messages')
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message in a conversation thread' })
  // Bug #32 fix: Clarify Swagger docs that full message list including AI response is returned
  @ApiResponse({ status: 201, description: 'Message created and full updated messages list returned' })
  addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayloadDto,
    @Body() dto: CreateMessageDto,
  ) {
    return this.conversationsService.addMessage(id, user.id, user.role, dto);
  }
}
