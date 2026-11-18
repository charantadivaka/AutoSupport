import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Bug #24 fix: Added .json — text-extractor.service.ts already handles JSON files,
// but the upload validator was rejecting them before they could reach the extractor.
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.csv', '.json']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/csv',
  'application/json',
  'text/json',
  'application/octet-stream',
]);

/**
 * Validate knowledge-base uploads before they touch disk.
 * Checks size, extension, MIME type, path traversal, and PDF magic bytes.
 */
export function assertSafeUpload(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('File is required for knowledge base upload');
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Uploaded file is empty');
  }

  if (file.size > MAX_UPLOAD_BYTES || file.buffer.length > MAX_UPLOAD_BYTES) {
    throw new BadRequestException(
      'File size exceeds maximum permitted limit of 10MB',
    );
  }

  const original = file.originalname || '';
  if (
    original.includes('..') ||
    original.includes('/') ||
    original.includes('\\')
  ) {
    throw new BadRequestException(
      'File name contains invalid path characters',
    );
  }

  const extension = path.extname(original).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new BadRequestException(
      `Unsupported file type "${extension}". Allowed: PDF, TXT, MD, CSV, JSON`,
    );
  }

  const mime = (file.mimetype || '').toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    throw new BadRequestException(
      `Unsupported MIME type "${file.mimetype}". Allowed: PDF and plain text`,
    );
  }

  if (extension === '.pdf') {
    const header = file.buffer.subarray(0, 5).toString('utf8');
    if (!header.startsWith('%PDF')) {
      throw new BadRequestException(
        'File extension is PDF but contents are not a valid PDF',
      );
    }
  }
}

export function multerFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const allowed =
    ALLOWED_EXTENSIONS.has(extension) &&
    (!mime || ALLOWED_MIME_TYPES.has(mime));

  if (!allowed) {
    callback(
      new BadRequestException(
        'Unsupported file type. Upload PDF, TXT, MD, CSV, or JSON only.',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}
