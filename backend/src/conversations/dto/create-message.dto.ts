import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    example: 'What is the standard warranty and return policy on electronics?',
    description: 'Message content text sent by the customer or agent',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  @MaxLength(4000, { message: 'Message cannot exceed 4000 characters' })
  content: string;

  @ApiProperty({
    example: { clientTimestamp: '2026-10-18T08:00:00Z' },
    description: 'Optional client metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
