import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  fullText: string;
  pages: ExtractedPage[];
  pageCount: number;
}

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  async extractText(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<ExtractedDocument> {
    const lowerFilename = filename.toLowerCase();

    // 1. PDF File Extraction
    if (mimetype === 'application/pdf' || lowerFilename.endsWith('.pdf')) {
      try {
        // Bug #35 fix: Use pdf-parse's per-page render callback to capture actual page text.
        // The old approach sliced the full concatenated string by character count, which
        // assigned wrong page numbers. The render callback fires once per real PDF page.
        const pageTexts: string[] = [];

        const renderPage = (pageData: any): string => {
          return pageData.getTextContent().then((content: any) => {
            const pageText = content.items
              .map((item: any) => item.str)
              .join(' ')
              .trim();
            pageTexts.push(pageText);
            return pageText;
          });
        };

        const pdfData = await (pdfParse as any)(buffer, { pagerender: renderPage });
        const fullText = pdfData.text.trim();
        const pageCount = pdfData.numpages || 1;

        const pages: ExtractedPage[] = [];

        if (pageTexts.length > 0) {
          // Real per-page text captured by render callback
          for (let i = 0; i < pageTexts.length; i++) {
            if (pageTexts[i].trim()) {
              pages.push({ pageNumber: i + 1, text: pageTexts[i].trim() });
            }
          }
        }

        // Fallback: if render callback captured nothing, treat as single page
        if (pages.length === 0) {
          pages.push({ pageNumber: 1, text: fullText });
        }

        this.logger.log(
          `Extracted PDF ${filename}: ${fullText.length} characters across ${pages.length} real pages (reported: ${pageCount})`,
        );

        return { fullText, pages, pageCount };
      } catch (err: any) {
        this.logger.error(`Failed to parse PDF ${filename}: ${err.message}`);
        throw new BadRequestException(`Failed to extract text from PDF file: ${err.message}`);
      }
    }

    // 2. Plain Text / Markdown / CSV / JSON Extraction
    if (
      mimetype.startsWith('text/') ||
      lowerFilename.endsWith('.txt') ||
      lowerFilename.endsWith('.md') ||
      lowerFilename.endsWith('.json') ||
      lowerFilename.endsWith('.csv')
    ) {
      const fullText = buffer.toString('utf-8').trim();
      return {
        fullText,
        pages: [{ pageNumber: 1, text: fullText }],
        pageCount: 1,
      };
    }

    throw new BadRequestException(
      `Unsupported file format: ${filename}. Please upload a PDF, Markdown (.md), Plain Text (.txt), CSV, or JSON file.`,
    );
  }
}
