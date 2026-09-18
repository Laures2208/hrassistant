/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TIỆN ÍCH TRÍCH XUẤT NỘI DUNG TÀI LIỆU (DOCUMENT PARSER)
 * Hỗ trợ các định dạng: .pdf, .docx, .txt, .md
 */

import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { LawDocumentFile } from '../types';

// Cấu hình worker cho pdfjs-dist
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Không thể nạp worker cho PDF.js:', e);
  }
}

/**
 * Xác định định dạng tệp dựa trên tên và MIME type
 */
export function getDocumentFileType(fileName: string, mimeType?: string): 'pdf' | 'docx' | 'txt' | 'md' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType?.includes('pdf')) return 'pdf';
  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) return 'docx';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'txt' || mimeType?.includes('text/plain')) return 'txt';
  return 'other';
}

/**
 * Định dạng dung lượng tệp cho giao diện
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Trích xuất text từ tệp PDF
 */
async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || '')
      .join(' ');
    
    if (pageText.trim()) {
      textParts.push(`--- Trang ${pageNum} ---\n${pageText}`);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Trích xuất text từ tệp Word (.docx)
 */
async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * Trích xuất text từ tệp văn bản thường (.txt, .md)
 */
async function parseText(file: File): Promise<string> {
  return await file.text();
}

/**
 * Hàm tổng xử lý đọc và trích xuất nội dung từ tệp
 */
export async function parseUploadedDocument(file: File): Promise<LawDocumentFile> {
  const fileType = getDocumentFileType(file.name, file.type);
  const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  try {
    let rawText = '';

    switch (fileType) {
      case 'pdf':
        rawText = await parsePdf(file);
        break;
      case 'docx':
        rawText = await parseDocx(file);
        break;
      case 'txt':
      case 'md':
        rawText = await parseText(file);
        break;
      default:
        // Cố gắng đọc dưới dạng văn bản
        try {
          rawText = await parseText(file);
        } catch {
          throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng tải file .pdf, .docx, .txt hoặc .md');
        }
    }

    const trimmedText = rawText.trim();
    if (!trimmedText) {
      throw new Error('Không tìm thấy nội dung văn bản nào trong tệp này.');
    }

    // Đếm số từ & ký tự
    const words = trimmedText.split(/\s+/).filter(Boolean);

    return {
      id: docId,
      name: file.name,
      size: file.size,
      type: fileType,
      extractedText: trimmedText,
      characterCount: trimmedText.length,
      wordCount: words.length,
      uploadedAt: Date.now(),
      status: 'ready',
    };
  } catch (error: any) {
    console.error(`Lỗi khi đọc file ${file.name}:`, error);
    return {
      id: docId,
      name: file.name,
      size: file.size,
      type: fileType,
      extractedText: '',
      characterCount: 0,
      wordCount: 0,
      uploadedAt: Date.now(),
      status: 'error',
      errorMessage: error?.message || 'Không thể trích xuất nội dung văn bản từ tệp.',
    };
  }
}
