import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayloadDto } from '../auth/dto/auth-response.dto';
import { KnowledgeService } from './knowledge.service';
import { MAX_UPLOAD_BYTES, multerFileFilter } from './services/file-upload.validator';

@ApiTags('Knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('documents')
  @Roles(Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload and ingest PDF or plain-text document into pgvector (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', example: 'Standard Return & Warranty Policy 2026' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: multerFileFilter,
    }),
  )
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @CurrentUser() user: UserPayloadDto,
  ) {
    return this.knowledgeService.uploadDocument(file, title, user.id);
  }

  @Get('documents')
  @Roles(Role.ADMIN, Role.AGENT)
  @ApiOperation({ summary: 'List all knowledge base documents and processing statuses' })
  @ApiResponse({ status: 200, description: 'List of knowledge documents' })
  findAll() {
    return this.knowledgeService.findAllDocuments();
  }

  @Get('documents/:id')
  @Roles(Role.ADMIN, Role.AGENT)
  @ApiOperation({ summary: 'Get document details with all indexed chunks' })
  @ApiResponse({ status: 200, description: 'Document and chunk details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeService.findOneDocument(id);
  }

  @Delete('documents/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete document and cascade-remove all vector chunks (Admin only)' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  deleteDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeService.deleteDocument(id);
  }

  @Post('search')
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Execute pgvector semantic search query to test RAG retrieval' })
  @ApiResponse({ status: 200, description: 'Retrieved chunks with similarity scores' })
  async search(@Body() body: { query: string; limit?: number; threshold?: number }) {
    return this.knowledgeService.searchSimilarChunks(
      body.query,
      body.limit || 4,
      body.threshold || 0.5,
    );
  }
}
