/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VERCEL SERVERLESS FUNCTION HANDLER CHO /api/chat
 * Cho phép ứng dụng hoạt động mượt mà khi deploy lên Vercel
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_KNOWLEDGE_BASE } from '../src/config/knowledgeBase';
import {
  PRIMARY_MODEL_NAME,
  CANDIDATE_MODELS,
  AI_TEMPERATURE,
  BASE_SYSTEM_INSTRUCTION,
} from '../src/config/ai';

/**
 * Nén khoảng trắng dư thừa trong văn bản để tối ưu kích thước payload và tốc độ xử lý
 */
function compressDocumentText(text: string, maxChars: number = 1000000): string {
  if (!text) return '';
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars) + '\n\n[... Đã tối ưu hóa độ dài tài liệu để bảo đảm phản hồi tức thì ...]';
  }
  return cleaned.trim();
}

export default async function handler(req: any, res: any) {
  // Cấu hình CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Gemini-Api-Key, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { 
      message, 
      history = [], 
      dynamicKnowledgeBase, 
      uploadedFilesSummary = [], 
      customKnowledgeBase,
      apiKey: bodyApiKey
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

    // 1. Đọc API Key theo đúng thứ tự ưu tiên:
    // Ưu tiên 1: API Key do người dùng nhập lưu trong localStorage (truyền qua Header hoặc Body)
    const headerKey = (req.headers['x-gemini-api-key'] as string) || 
      (typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : '');
    const clientProvidedKey = (headerKey || bodyApiKey || '').trim();

    // Ưu tiên 2: Biến môi trường Vercel hoặc Server (GEMINI_API_KEY hoặc VITE_GEMINI_API_KEY)
    const envApiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    
    const activeApiKey = (clientProvidedKey && clientProvidedKey.length >= 10)
      ? clientProvidedKey
      : (envApiKey && envApiKey !== 'MY_GEMINI_API_KEY' ? envApiKey : clientProvidedKey);

    // Trả về mã 400 rõ ràng (thay vì làm sập function với lỗi 500)
    if (!activeApiKey || activeApiKey === 'MY_GEMINI_API_KEY' || activeApiKey.length < 10) {
      res.status(400).json({
        error: 'CHUA_CAU_HINH_API_KEY',
        needsApiKey: true,
        message: 'Chưa cấu hình Gemini API Key. Vui lòng bấm nút "⚙️ Cấu hình API Key" trên thanh Header để dán mã API Key của bạn từ Google AI Studio (hoặc cài đặt biến môi trường GEMINI_API_KEY trên Vercel).',
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const rawKnowledge = dynamicKnowledgeBase || customKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    // Nén khoảng trắng văn bản để tránh vượt quá Vercel payload limit
    const knowledgeDoc = compressDocumentText(rawKnowledge);
    const hasUploadedFiles = uploadedFilesSummary && uploadedFilesSummary.length > 0;

    let filesSummaryHeader = '';
    if (hasUploadedFiles) {
      filesSummaryHeader = `DANH SÁCH CÁC TỆP TÀI LIỆU ĐANG ĐƯỢC TRA CỨU TRỰC TIẾP (${uploadedFilesSummary.length} tệp):\n` +
        uploadedFilesSummary.map((f: any, idx: number) => 
          `${idx + 1}. [Tệp: ${f.name}] - Định dạng: ${String(f.type || '').toUpperCase()} - Dung lượng: ${Math.round((f.size || 0) / 1024)} KB - Số từ: ${f.wordCount || 0}`
        ).join('\n') + '\n';
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
        const response = await ai.models.generateContent({
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
          console.warn(`[Vercel Serverless] Model '${modelName}' gặp sự cố (${err?.message || err}). Đang tự động chuyển đổi fallback sang '${nextModel}'...`);
        } else {
          console.warn(`[Vercel Serverless] Model cuối cùng '${modelName}' gặp lỗi:`, err?.message || err);
        }
      }
    }

    if (!reply && lastError) {
      const errMsg = lastError?.message || String(lastError);
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
        res.status(400).json({
          error: 'API_KEY_INVALID',
          needsApiKey: true,
          message: 'Gemini API Key không hợp lệ hoặc đã hết hạn. Vui lòng bấm "⚙️ Cấu hình API Key" trên thanh Header để cập nhật lại key mới từ Google AI Studio.',
        });
        return;
      }
      throw lastError;
    }

    res.status(200).json({
      reply: reply || 'Không tìm thấy câu trả lời phù hợp trong tài liệu.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Lỗi Vercel function /api/chat:', error);
    res.status(500).json({
      error: error?.message || 'Đã có lỗi xảy ra khi xử lý câu hỏi.',
    });
  }
}
