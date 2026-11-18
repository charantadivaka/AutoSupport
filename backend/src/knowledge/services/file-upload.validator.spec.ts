import { BadRequestException } from '@nestjs/common';
import { assertSafeUpload } from './file-upload.validator';

function makeFile(
  overrides: Partial<Express.Multer.File>,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'policy.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    size: 12,
    buffer: Buffer.from('hello policy'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('assertSafeUpload', () => {
  it('accepts a plain-text policy file', () => {
    expect(() => assertSafeUpload(makeFile({}))).not.toThrow();
  });

  it('accepts a PDF whose magic bytes are valid', () => {
    const buffer = Buffer.concat([
      Buffer.from('%PDF-1.4'),
      Buffer.from(' rest of file'),
    ]);
    expect(() =>
      assertSafeUpload(
        makeFile({
          originalname: 'policy.pdf',
          mimetype: 'application/pdf',
          size: buffer.length,
          buffer,
        }),
      ),
    ).not.toThrow();
  });

  it('rejects executable extensions', () => {
    expect(() =>
      assertSafeUpload(makeFile({ originalname: 'malware.exe' })),
    ).toThrow(BadRequestException);
  });

  it('rejects path traversal in the original filename', () => {
    expect(() =>
      assertSafeUpload(makeFile({ originalname: '../etc/passwd.txt' })),
    ).toThrow(BadRequestException);
  });

  it('rejects files larger than 10MB', () => {
    expect(() =>
      assertSafeUpload(
        makeFile({
          size: 11 * 1024 * 1024,
          buffer: Buffer.alloc(100),
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a .pdf file without PDF magic bytes', () => {
    expect(() =>
      assertSafeUpload(
        makeFile({
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('not a pdf'),
        }),
      ),
    ).toThrow(BadRequestException);
  });
});
