import { Injectable, Logger } from '@nestjs/common';
import { ExtractedDocument } from './text-extractor.service';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  pageNumber: number;
  metadata: {
    characterCount: number;
    tokenEstimate: number;
    sectionHeading?: string;
  };
}

@Injectable()
export class TextChunkerService {
  private readonly logger = new Logger(TextChunkerService.name);

  chunkDocument(
    doc: ExtractedDocument,
    chunkSize = 600,
    chunkOverlap = 100,
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let globalIndex = 0;

    for (const page of doc.pages) {
      const pageText = page.text.trim();
      if (!pageText) continue;

      // If page is shorter than chunk size, emit as single chunk
      if (pageText.length <= chunkSize) {
        chunks.push({
          chunkIndex: globalIndex++,
          content: pageText,
          pageNumber: page.pageNumber,
          metadata: {
            characterCount: pageText.length,
            tokenEstimate: Math.ceil(pageText.length / 4),
          },
        });
        continue;
      }

      // Paragraph / Sentence-aware sliding window chunker
      let start = 0;
      while (start < pageText.length) {
        let end = Math.min(start + chunkSize, pageText.length);

        // If not at the end of the text, try to find a natural boundary
        if (end < pageText.length) {
          const naturalBoundary = this.findNaturalBreak(pageText, end, start);
          if (naturalBoundary > start + Math.floor(chunkSize * 0.5)) {
            end = naturalBoundary;
          }
        }

        const chunkText = pageText.slice(start, end).trim();
        if (chunkText.length > 20) {
          chunks.push({
            chunkIndex: globalIndex++,
            content: chunkText,
            pageNumber: page.pageNumber,
            metadata: {
              characterCount: chunkText.length,
              tokenEstimate: Math.ceil(chunkText.length / 4),
            },
          });
        }

        if (end >= pageText.length) break;
        // Slide forward by chunkSize - chunkOverlap
        start = Math.max(start + 1, end - chunkOverlap);
      }
    }

    this.logger.log(`Chunked document into ${chunks.length} semantic chunks`);
    return chunks;
  }

  private findNaturalBreak(text: string, preferredEnd: number, minStart: number): number {
    // Look backwards from preferredEnd for paragraph break, newline, period, or space
    const searchSlice = text.slice(minStart, preferredEnd + 50);
    const offset = minStart;

    const paragraphIdx = text.lastIndexOf('\n\n', preferredEnd);
    if (paragraphIdx > minStart + 200) return paragraphIdx + 2;

    const sentenceIdx = text.lastIndexOf('. ', preferredEnd);
    if (sentenceIdx > minStart + 200) return sentenceIdx + 2;

    const newlineIdx = text.lastIndexOf('\n', preferredEnd);
    if (newlineIdx > minStart + 200) return newlineIdx + 1;

    const spaceIdx = text.lastIndexOf(' ', preferredEnd);
    if (spaceIdx > minStart + 100) return spaceIdx + 1;

    return preferredEnd;
  }
}
