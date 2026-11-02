/**
 * File MIME types and categorization utility for WhiteDesk
 * Supports:
 * - Images: JPG, JPEG, PNG, WEBP, GIF, BMP, SVG, HEIC
 * - Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, RTF
 */

export const EXTENSION_MIME_MAP: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',

  // Documents & Office
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
};

export function getFileExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const clean = fileName.trim().split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileMimeType(fileName?: string | null, fallbackMime?: string | null): string {
  const ext = getFileExtension(fileName);
  if (ext && EXTENSION_MIME_MAP[ext]) {
    return EXTENSION_MIME_MAP[ext];
  }
  return fallbackMime || 'application/octet-stream';
}

export function isImageFile(fileName?: string | null, mimeType?: string | null, rawData?: string | null): boolean {
  const ext = getFileExtension(fileName);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext)) {
    return true;
  }
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }
  if (rawData && typeof rawData === 'string') {
    if (rawData.startsWith('data:image/')) return true;
    // Base64 JPEG header starts with /9j/
    if (rawData.startsWith('/9j/')) return true;
    // Base64 PNG header starts with iVBORw0KGgo
    if (rawData.startsWith('iVBORw0KGgo')) return true;
  }
  return false;
}
