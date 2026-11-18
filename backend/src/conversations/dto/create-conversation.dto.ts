import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    example: 'Inquiry regarding refund policy and order delivery',
    description: 'Initial topic or first question for the conversation',
    required: false,
  })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}
