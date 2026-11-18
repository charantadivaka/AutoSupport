import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProcessingStatus } from '@prisma/client';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractorService } from './services/text-extractor.service';
import { TextChunkerService } from './services/text-chunker.service';
import { EmbeddingService } from './services/embedding.service';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let prisma: PrismaService;
  let textExtractor: TextExtractorService;
  let textChunker: TextChunkerService;
  let embeddingService: EmbeddingService;

  const mockAdminId = 'admin-uuid-1';
  const mockDoc = {
    id: 'doc-123',
    title: 'Return Policy',
    originalFilename: 'policy.txt',
    filePath: 'uploads/policy.txt',
    processingStatus: ProcessingStatus.COMPLETED,
    createdBy: mockAdminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        TextChunkerService,
        {
          provide: PrismaService,
          useValue: {
            knowledgeDocument: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            documentChunk: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $executeRaw: jest.fn().mockResolvedValue(1),
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TextExtractorService,
          useValue: {
            extractText: jest.fn().mockResolvedValue({
              fullText: 'All items can be returned within 30 days for a full refund.',
              pages: [{ pageNumber: 1, text: 'All items can be returned within 30 days for a full refund.' }],
              pageCount: 1,
            }),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.01)),
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    prisma = module.get<PrismaService>(PrismaService);
    textExtractor = module.get<TextExtractorService>(TextExtractorService);
    textChunker = module.get<TextChunkerService>(TextChunkerService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadDocument', () => {
    it('should extract, chunk, embed, and complete document ingestion', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'policy.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('All items can be returned within 30 days for a full refund.'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      (prisma.knowledgeDocument.create as jest.Mock).mockResolvedValue(mockDoc);
      (prisma.knowledgeDocument.update as jest.Mock).mockResolvedValue({
        ...mockDoc,
        processingStatus: ProcessingStatus.COMPLETED,
      });

      const result = await service.uploadDocument(mockFile, 'Return Policy', mockAdminId);

      expect(textExtractor.extractText).toHaveBeenCalled();
      expect(embeddingService.generateEmbedding).toHaveBeenCalled();
      expect(result.processingStatus).toBe(ProcessingStatus.COMPLETED);
    });

    it('should reject files exceeding 10MB', async () => {
      const largeFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 15 * 1024 * 1024, // 15MB
        buffer: Buffer.alloc(100),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await expect(
        service.uploadDocument(largeFile, 'Huge Document', mockAdminId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchSimilarChunks', () => {
    it('should call embedding service and return pgvector matches', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-123',
          chunkIndex: 0,
          content: '30-day return policy',
          pageNumber: 1,
          similarityScore: '0.8950',
          documentTitle: 'Return Policy',
          originalFilename: 'policy.txt',
        },
      ]);

      const results = await service.searchSimilarChunks('refund policy', 2, 0.5);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('refund policy');
      expect(results).toHaveLength(1);
      expect(results[0].similarityScore).toBe(0.895);
      expect(results[0].documentTitle).toBe('Return Policy');
    });
  });

  describe('deleteDocument', () => {
    it('should throw NotFoundException if document does not exist', async () => {
      (prisma.knowledgeDocument.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteDocument('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete document and cascade chunks', async () => {
      (prisma.knowledgeDocument.findUnique as jest.Mock).mockResolvedValue(mockDoc);
      (prisma.knowledgeDocument.delete as jest.Mock).mockResolvedValue(mockDoc);

      const result = await service.deleteDocument(mockDoc.id);
      expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
      });
      expect(result.message).toContain('deleted successfully');
    });
  });
});
