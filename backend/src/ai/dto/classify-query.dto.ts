import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClassifyQueryDto {
  @ApiProperty({
    example: 'I would like to return an unopened laptop I bought 2 weeks ago',
    description: 'Customer message to classify',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @ApiProperty({
    example: 'conv-123e4567',
    description: 'Optional conversation ID to load conversation context',
    required: false,
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
