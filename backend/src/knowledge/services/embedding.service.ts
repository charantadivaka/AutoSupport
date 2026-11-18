import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  readonly dimension = 1536;
  private openAiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey && !openaiKey.includes('placeholder') && openaiKey.length > 10) {
      this.openAiClient = new OpenAI({ apiKey: openaiKey });
      this.logger.log('OpenAI Embedding client initialized (text-embedding-3-small, 1536 dims)');
    }

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey && !geminiKey.includes('placeholder') && geminiKey.length > 10) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.logger.log('Gemini Embedding client initialized');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.replace(/\n+/g, ' ').trim();

    // 1. Try OpenAI text-embedding-3-small if configured
    if (this.openAiClient) {
      try {
        const response = await this.openAiClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: cleanText,
          dimensions: this.dimension,
        });
        return response.data[0].embedding;
      } catch (err: any) {
        this.logger.warn(`OpenAI embedding failed: ${err.message}. Using deterministic fallback.`);
      }
    }

    // 2. Try Gemini text-embedding-004 if configured
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'text-embedding-004' });
        const res = await model.embedContent(cleanText);
        const rawVector = res.embedding.values;
        // Project/pad 768 to 1536
        return this.padOrProjectVector(rawVector, this.dimension);
      } catch (err: any) {
        this.logger.warn(`Gemini embedding failed: ${err.message}. Using deterministic fallback.`);
      }
    }

    // 3. Deterministic semantic mock embedding
    return this.generateDeterministicVector(cleanText, this.dimension);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const vec = await this.generateEmbedding(text);
      embeddings.push(vec);
    }
    return embeddings;
  }

  private padOrProjectVector(vector: number[], targetDim: number): number[] {
    // Bug #2 fix: The previous implementation used cyclic tiling (i % vector.length),
    // which duplicates the first 768 Gemini values into positions 769-1536.
    // This makes every pair of Gemini embeddings artificially similar because the
    // second half of the vector is perfectly correlated with the first half.
    //
    // Fix: truncate or zero-pad instead. If the vector is shorter than targetDim,
    // copy real values and leave the rest as zeros. This preserves genuine
    // semantic signal in the first 768 dims and keeps the padding inert.
    //
    // NOTE: Ideally, change DocumentChunk.embedding to vector(768) to store native
    // Gemini embeddings without any padding. The schema change requires a migration.
    if (vector.length >= targetDim) {
      return this.l2Normalize(vector.slice(0, targetDim));
    }
    const result = new Array(targetDim).fill(0);
    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i];
    }
    return this.l2Normalize(result);
  }

  /**
   * Generates a 1536-dimensional L2-normalized unit vector based on text token hashes.
   * Semantically similar texts will hash to overlapping vector dimensions, yielding
   * realistic cosine similarity scores for pgvector testing!
   */
  generateDeterministicVector(text: string, dim: number): number[] {
    const vector = new Array(dim).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) {
      vector[0] = 1;
      return vector;
    }

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }

      const index = Math.abs(hash) % dim;
      const weight = 1 + (word.length / 10);
      vector[index] += weight;

      // Secondary hash for spread
      const index2 = Math.abs((hash * 31) + 17) % dim;
      vector[index2] += weight * 0.5;
    }

    return this.l2Normalize(vector);
  }

  private l2Normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }
}
