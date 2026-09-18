/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_KNOWLEDGE_BASE } from './src/config/knowledgeBase.ts';
import {
  PRIMARY_MODEL_NAME,
  CANDIDATE_MODELS,
  AI_TEMPERATURE,
  BASE_SYSTEM_INSTRUCTION,
} from './src/config/ai.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Khởi tạo Google Gen AI client theo chuẩn @google/genai SDK
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint trả về tài liệu cơ sở kiến thức mặc định
app.get('/api/knowledge-base', (req, res) => {
  res.json({
    content: DEFAULT_KNOWLEDGE_BASE,
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithFallback(
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string,
  apiKey: string
) {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    // Thử tối đa 2 lần cho mỗi model với thời gian chờ ngắn
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Đang gọi model: ${modelName} (lần thử ${attempt})...`);
        const response = await client.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: AI_TEMPERATURE,
          },
        });

        if (response && response.text) {
          console.log(`[Gemini API] Phản hồi thành công từ model: ${modelName}`);
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`[Gemini API] Cảnh báo từ ${modelName} (lần ${attempt}):`, errMsg);

        const isOverloadedOrRateLimited =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (isOverloadedOrRateLimited && attempt < 2) {
          // Chờ 1 giây rồi thử lại
          await sleep(1000);
          continue;
        }

        // Nếu lỗi 503 hoặc quá tải và đã hết lần thử của model này, chuyển ngay sang model dự phòng kế tiếp
        break;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối đến các model Gemini API.');
}

// Endpoint xử lý câu hỏi tư vấn pháp lý qua Google Gemini API
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      history = [], 
      dynamicKnowledgeBase, 
      uploadedFilesSummary = [], 
      customKnowledgeBase,
      apiKey: bodyApiKey
    } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

    // 1. Đọc API Key từ 3 nguồn: Client Header, Client Body, hoặc Server Environment
    const headerKey = (req.headers['x-gemini-api-key'] as string) || 
      (typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : '');
    const clientProvidedKey = (headerKey || bodyApiKey || '').trim();
    const envApiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    
    const activeApiKey = clientProvidedKey || envApiKey;

    // Trả về mã 400 rõ ràng kèm cờ needsApiKey: true khi chưa có API Key
    if (!activeApiKey || activeApiKey === 'MY_GEMINI_API_KEY' || activeApiKey.length < 10) {
      res.status(400).json({
        error: 'CHUA_CAU_HINH_API_KEY',
        needsApiKey: true,
        message: 'Chưa cấu hình Gemini API Key. Bạn có thể bấm nút "⚙️ Cấu hình API Key" trên thanh Header hoặc thiết lập biến môi trường GEMINI_API_KEY.',
      });
      return;
    }

    const rawKnowledge = dynamicKnowledgeBase || customKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    // Nén khoảng trắng để bảo đảm payload gọn nhẹ và tăng tốc độ xử lý
    const knowledgeDoc = compressDocumentText(rawKnowledge);
    const hasUploadedFiles = uploadedFilesSummary && uploadedFilesSummary.length > 0;

    let filesSummaryHeader = '';
    if (hasUploadedFiles) {
      filesSummaryHeader = `DANH SÁCH CÁC TỆP TÀI LIỆU ĐANG ĐƯỢC TRA CỨU TRỰC TIẾP (${uploadedFilesSummary.length} tệp):\n` +
        uploadedFilesSummary.map((f: any, idx: number) => 
          `${idx + 1}. [Tệp: ${f.name}] - Định dạng: ${String(f.type || '').toUpperCase()} - Dung lượng: ${Math.round((f.size || 0) / 1024)} KB - Số từ: ${f.wordCount || 0}`
        ).join('\n') + '\n';
    }

    // Tổng hợp System Instruction kết hợp Context Grounding từ Tệp Tài liệu Luật & Nội quy
    const systemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

---
${filesSummaryHeader}
DƯỚI ĐÂY LÀ NỘI DUNG CHI TIẾT ĐÃ TRÍCH XUẤT TỪ CÁC TỆP TÀI LIỆU LUẬT & NỘI QUY (DYNAMIC GROUNDING CONTEXT):
${knowledgeDoc}
---
HƯỚNG DẪN QUAN TRỌNG KHI ĐỐI CHIẾU:
- Hãy tra cứu trực tiếp trong nội dung các tệp tài liệu trên.
- Luôn trích dẫn rõ [Tên tệp], [Điều], [Khoản] khi cung cấp căn cứ cho câu trả lời.
- Nếu vấn đề người dùng hỏi KHÔNG xuất hiện trong bất kỳ tệp tài liệu nào ở trên, bạn BẮT BUỘC phải thông báo: "Thông tin này chưa có trong các tài liệu bạn đã tải lên, vui lòng cung cấp thêm file liên quan hoặc liên hệ HR."
`;

    // Chuẩn bị lịch sử hội thoại
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Giới hạn 10 tin nhắn gần nhất để giữ ngữ cảnh mà không làm quá tải context
    const recentHistory = history.slice(-10);
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.message }] });
      } else if (item.sender === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: item.message }] });
      }
    }

    // Thêm tin nhắn hiện tại của người dùng
    contents.push({ role: 'user', parts: [{ text: message }] });

    const reply = await generateContentWithFallback(contents, systemInstruction, activeApiKey);

    res.json({
      reply: reply || 'Xin lỗi, tôi chưa thể tìm thấy quy định phù hợp cho câu hỏi này. Bạn vui lòng liên hệ trực tiếp Phòng Nhân sự (HR) để được hỗ trợ.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Lỗi khi gọi Gemini API:', error);

    let clientFriendlyMessage = 'Đã có lỗi xảy ra khi xử lý câu hỏi với Gemini AI.';
    const rawMsg = error?.message || String(error);

    if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      clientFriendlyMessage = 'Máy chủ AI hiện đang trong thời điểm quá tải yêu cầu tạm thời (High demand 503). Hệ thống đã tự động thử lại nhưng chưa thành công. Bạn vui lòng bấm "Thử lại" sau vài giây hoặc liên hệ Phòng Nhân sự (HR).';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      clientFriendlyMessage = 'Hệ thống đã đạt giới hạn tần suất yêu cầu tạm thời. Vui lòng đợi khoảng 30 giây rồi thử lại.';
    } else if (error?.status === 400 || rawMsg.includes('API_KEY_INVALID')) {
      clientFriendlyMessage = 'Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY trong Google AI Studio.';
    } else if (rawMsg) {
      // Làm sạch các chuỗi JSON rườm rà nếu có
      try {
        const jsonMatch = rawMsg.match(/\{.*"message"\s*:\s*"([^"]+)".*\}/);
        if (jsonMatch && jsonMatch[1]) {
          clientFriendlyMessage = jsonMatch[1];
        } else {
          clientFriendlyMessage = rawMsg.replace(/ApiError:\s*/, '');
        }
      } catch {
        clientFriendlyMessage = rawMsg;
      }
    }

    res.status(500).json({
      error: clientFriendlyMessage,
    });
  }
});

// Tích hợp Vite middleware cho môi trường Development và static server cho Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Máy chủ Trợ lý Luật Lao Động đang hoạt động tại: http://localhost:${PORT}`);
  });
}

startServer();
