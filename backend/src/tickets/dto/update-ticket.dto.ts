import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TicketPriority, TicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @ApiProperty({
    enum: TicketStatus,
    example: TicketStatus.IN_PROGRESS,
    required: false,
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.URGENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Assign ticket to an agent by UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  assignedAgentId?: string;

  @ApiProperty({
    example: 'Customer provided photo evidence. Issued return label and processed refund #RF9912.',
    description: 'Internal notes summarizing how the issue was addressed',
    required: false,
  })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiProperty({
    example: 'Customer ordered Sony headphones that arrived damaged; wants replacement.',
    description: 'AI-generated or agent-curated summary of the conversation',
    required: false,
  })
  @IsOptional()
  @IsString()
  conversationSummary?: string;
}
