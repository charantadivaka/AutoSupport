import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { TextExtractorService } from './services/text-extractor.service';
import { TextChunkerService } from './services/text-chunker.service';
import { EmbeddingService } from './services/embedding.service';

@Module({
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    TextExtractorService,
    TextChunkerService,
    EmbeddingService,
  ],
  exports: [KnowledgeService, EmbeddingService],
})
export class KnowledgeModule {}
