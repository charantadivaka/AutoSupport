import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Linked conversation ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'conversationId must be a valid UUID' })
  conversationId?: string;

  @ApiProperty({
    example: 'Order #48291 damaged upon delivery',
    description: 'Brief headline of the support issue',
  })
  @IsString()
  @IsNotEmpty({ message: 'Subject cannot be empty' })
  subject: string;

  @ApiProperty({
    example:
      'The package arrived with water damage and the electronics do not turn on. Requesting immediate replacement or refund.',
    description: 'Detailed description of the customer issue',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description cannot be empty' })
  description: string;

  @ApiProperty({
    example: 'Damaged Goods / Refund',
    description: 'Category of the request',
    required: false,
    default: 'General',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
    description: 'Ticket urgency/priority',
    required: false,
    default: TicketPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({
    example: 'Customer ordered laptop that arrived damaged. Requesting replacement.',
    description: 'AI synopsis or agent summary of conversation',
    required: false,
  })
  @IsOptional()
  @IsString()
  conversationSummary?: string;
}
