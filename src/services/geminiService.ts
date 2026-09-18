/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DỊCH VỤ GIAO TIẾP GEMINI AI (UNIFIED CHAT SERVICE)
 * Hỗ trợ linh hoạt cả Backend API (/api/chat trên Cloud Run, Express & Vercel)
 * và Client-side Fallback (sử dụng User API Key hoặc VITE_GEMINI_API_KEY)
 */

import { GoogleGenAI } from '@google/genai';
import { ChatMessage, LawDocumentFile } from '../types';
import { DEFAULT_KNOWLEDGE_BASE } from '../config/knowledgeBase';
import { 
  PRIMARY_MODEL_NAME, 
  CANDIDATE_MODELS, 
  AI_TEMPERATURE, 
  BASE_SYSTEM_INSTRUCTION 
} from '../config/ai';

/**
 * Nén khoảng trắng dư thừa trong văn bản
 */
export function compressClientDocumentText(text: string, maxChars: number = 1000000): string {
  if (!text) return '';
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars) + '\n\n[... Đã tối ưu hóa độ dài tài liệu để bảo đảm phản hồi tức thì ...]';
  }
  return cleaned.trim();
}

export interface ChatRequestParams {
  message: string;
  history: ChatMessage[];
  dynamicKnowledgeBase: string;
  uploadedFiles: LawDocumentFile[];
  sessionId: string;
  userApiKey?: string;
}

export interface ChatResponseResult {
  reply: string;
  timestamp: number;
}

/**
 * Gọi API chat với cơ chế dự phòng đa tầng (Server -> Client)
 */
export async function sendLegalChatMessage({
  message,
  history,
  dynamicKnowledgeBase,
  uploadedFiles,
  sessionId,
  userApiKey,
}: ChatRequestParams): Promise<ChatResponseResult> {
  const readyFiles = uploadedFiles.filter((f) => f.status === 'ready');
  const uploadedFilesSummary = readyFiles.map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    wordCount: f.wordCount,
  }));

  // Nén bớt khoảng trắng của tài liệu để tránh lỗi Payload quá 4.5MB của Vercel
  const compressedContext = compressClientDocumentText(dynamicKnowledgeBase);

  // BƯỚC 1: Thử gọi qua Backend API (/api/chat)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userApiKey && userApiKey.trim()) {
      headers['x-gemini-api-key'] = userApiKey.trim();
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        history: history.map((m) => ({
          sender: m.sender,
          message: m.message,
        })),
        dynamicKnowledgeBase: compressedContext,
        uploadedFilesSummary,
        sessionId,
        apiKey: userApiKey || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        reply: data.reply,
        timestamp: data.timestamp || Date.now(),
      };
    }

    const errorData = await response.json().catch(() => null);

    // Nếu server trả về lỗi thiếu API Key (mã 400)
    if (response.status === 400 && (errorData?.needsApiKey || errorData?.error === 'CHUA_CAU_HINH_API_KEY')) {
      const customErr: any = new Error(
        errorData?.message || 'Chưa cấu hình Gemini API Key. Vui lòng bấm nút "⚙️ Cấu hình API Key" trên thanh Header để nhập mã API Key của bạn từ Google AI Studio.'
      );
      customErr.needsApiKey = true;
      throw customErr;
    }

    if (response.status !== 404 && errorData?.error) {
      const err: any = new Error(errorData.error);
      if (errorData.needsApiKey) err.needsApiKey = true;
      throw err;
    }
  } catch (apiError: any) {
    if (apiError?.needsApiKey) {
      throw apiError;
    }

    const errorMsg = apiError?.message || '';
    if (
      errorMsg.includes('503') ||
      errorMsg.includes('high demand') ||
      errorMsg.includes('UNAVAILABLE') ||
      errorMsg.includes('429')
    ) {
      throw apiError;
    }
    console.warn('Backend /api/chat không khả dụng hoặc bị lỗi, chuyển sang kiểm tra Client SDK:', apiError);
  }

  // BƯỚC 2: Fallback trực tiếp qua Client-side SDK (khi deploy tĩnh trên Vercel)
  // Thứ tự ưu tiên:
  // 1. Key người dùng nhập lưu trong localStorage
  // 2. Biến môi trường Vercel import.meta.env.VITE_GEMINI_API_KEY
  const clientApiKey = (userApiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '').trim();

  if (!clientApiKey || clientApiKey === 'MY_GEMINI_API_KEY' || clientApiKey.length < 10) {
    const keyError: any = new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng bấm nút "⚙️ Cấu hình API Key" trên thanh Header để dán mã API Key của bạn từ Google AI Studio (hoặc cài đặt biến môi trường VITE_GEMINI_API_KEY trong Project Settings của Vercel).'
    );
    keyError.needsApiKey = true;
    throw keyError;
  }

  try {
    const clientAi = new GoogleGenAI({ apiKey: clientApiKey });
    const knowledgeDoc = compressedContext || DEFAULT_KNOWLEDGE_BASE;

    let filesSummaryHeader = '';
    if (uploadedFilesSummary.length > 0) {
      filesSummaryHeader =
        `DANH SÁCH CÁC TỆP TÀI LIỆU ĐANG ĐƯỢC TRA CỨU TRỰC TIẾP (${uploadedFilesSummary.length} tệp):\n` +
        uploadedFilesSummary
          .map(
            (f, idx) =>
              `${idx + 1}. [Tệp: ${f.name}] - Định dạng: ${String(f.type || '').toUpperCase()} - Dung lượng: ${Math.round(
                (f.size || 0) / 1024
              )} KB - Số từ: ${f.wordCount || 0}`
          )
          .join('\n') +
        '\n';
    }

    const systemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

---
${filesSummaryHeader}
DƯỚI ĐÂY LÀ NỘI DUNG TOÀN BỘ CÁC TỆP TÀI LIỆU ĐƯỢC CUNG CẤP (DYNAMIC GROUNDING CONTEXT - ĐÃ NẠP ĐẦY ĐỦ):
${knowledgeDoc}
---
`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const recentHistory = history.slice(-8);
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.message }] });
      } else if (item.sender === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: item.message }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    let reply = '';
    let lastError: any = null;

    // Duyệt qua danh sách CANDIDATE_MODELS (ưu tiên PRIMARY_MODEL_NAME, tự động Fallback nếu lỗi)
    for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
      const modelName = CANDIDATE_MODELS[i];
      try {
        const response = await clientAi.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: AI_TEMPERATURE,
          },
        });

        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        const nextModel = CANDIDATE_MODELS[i + 1];
        if (nextModel) {
          console.warn(`[Client SDK] Model '${modelName}' gặp sự cố (${err?.message || err}). Đang tự động chuyển đổi fallback sang '${nextModel}'...`);
        } else {
          console.warn(`[Client SDK] Model cuối cùng '${modelName}' gặp lỗi:`, err?.message || err);
        }
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return {
      reply: reply || 'Không tìm thấy thông tin phù hợp trong tài liệu.',
      timestamp: Date.now(),
    };
  } catch (clientError: any) {
    console.error('Lỗi khi gọi Gemini trực tiếp từ client:', clientError);
    throw clientError;
  }
}
