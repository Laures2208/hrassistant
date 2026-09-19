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
  MAX_OUTPUT_TOKENS,
  MAX_CONTEXT_CHARACTERS,
  BASE_SYSTEM_INSTRUCTION,
} from './src/config/ai.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Khởi tạo Google Gen AI client theo chuẩn @google/genai SDK
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

/**
 * Trích xuất từ khóa từ câu hỏi người dùng
 */
function extractKeywords(query: string): string[] {
  if (!query) return [];
  const normalized = query.toLowerCase();
  const stopWords = new Set([
    'là', 'gì', 'như', 'thế', 'nào', 'sao', 'cho', 'tôi', 'hỏi', 'về', 'của', 'và', 'các', 'những',
    'được', 'không', 'có', 'thì', 'ở', 'tại', 'với', 'khi', 'nếu', 'đã', 'sẽ', 'đang', 'cho', 'mình',
    'bạn', 'ơi', 'xin', 'hãy', 'giúp', 'tư', 'vấn', 'em', 'anh', 'chị'
  ]);
  return normalized
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

/**
 * Nén và cắt lọc ngữ cảnh tài liệu thông minh (tối đa 20.000 ký tự) để tăng tốc độ nạp AI
 */
function compressAndTrimDocumentText(text: string, query: string, maxChars: number = MAX_CONTEXT_CHARACTERS): string {
  if (!text) return '';
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const keywords = extractKeywords(query);
  const sections = cleaned.split(/(?=\n\n(?:===|###|Điều\s+\d+|Chương\s+[IVXLCDM\d]+))/i);

  if (sections.length <= 1) {
    return cleaned.substring(0, maxChars) + '\n\n[... Đã tối ưu hóa độ dài tài liệu để phản hồi tức thì ...]';
  }

  const scored = sections.map((sec, idx) => {
    const lower = sec.toLowerCase();
    let score = (idx === 0 || sec.includes('=== TỆP TÀI LIỆU') || sec.includes('TỔNG QUAN')) ? 40 : 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += 15;
        if (lower.includes('điều') && lower.includes(kw)) score += 20;
      }
    }
    return { sec, score, idx, len: sec.length };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = new Set<number>();
  let totalLen = 0;
  for (const item of scored) {
    if (totalLen + item.len <= maxChars) {
      selected.add(item.idx);
      totalLen += item.len;
    }
  }

  if (totalLen < maxChars) {
    for (const item of scored) {
      if (!selected.has(item.idx) && totalLen + item.len <= maxChars) {
        selected.add(item.idx);
        totalLen += item.len;
      }
    }
  }

  const finalSecs = scored.filter((i) => selected.has(i.idx)).map((i) => i.sec);
  let res = finalSecs.join('\n\n');
  if (res.length > maxChars) {
    res = res.substring(0, maxChars);
  }
  return res + '\n\n[... Ngữ cảnh đã được tối ưu hóa theo câu hỏi ...]';
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY'),
    primaryModel: PRIMARY_MODEL_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint trả về tài liệu cơ sở kiến thức mặc định
app.get('/api/knowledge-base', (req, res) => {
  res.json({
    content: DEFAULT_KNOWLEDGE_BASE,
  });
});

// Endpoint xử lý câu hỏi tư vấn pháp lý qua Google Gemini API với STREAMING SSE
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      history = [], 
      dynamicKnowledgeBase, 
      uploadedFilesSummary = [], 
      customKnowledgeBase,
      apiKey: bodyApiKey,
      stream = true,
    } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

    // Đọc API Key từ Client Header, Body, hoặc Server Environment
    const headerKey = (req.headers['x-gemini-api-key'] as string) || 
      (typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : '');
    const clientProvidedKey = (headerKey || bodyApiKey || '').trim();
    const envApiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    
    const activeApiKey = (clientProvidedKey && clientProvidedKey.length >= 10)
      ? clientProvidedKey
      : (envApiKey && envApiKey !== 'MY_GEMINI_API_KEY' ? envApiKey : clientProvidedKey);

    if (!activeApiKey || activeApiKey === 'MY_GEMINI_API_KEY' || activeApiKey.length < 10) {
      res.status(400).json({
        error: 'CHUA_CAU_HINH_API_KEY',
        needsApiKey: true,
        message: 'Chưa cấu hình Gemini API Key. Vui lòng bấm nút "⚙️ Cấu hình API Key" trên thanh Header hoặc thiết lập biến môi trường GEMINI_API_KEY.',
      });
      return;
    }

    const rawKnowledge = dynamicKnowledgeBase || customKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;
    // Cắt lọc ngữ cảnh thông minh tối đa 20.000 ký tự
    const knowledgeDoc = compressAndTrimDocumentText(rawKnowledge, message, MAX_CONTEXT_CHARACTERS);
    const hasUploadedFiles = uploadedFilesSummary && uploadedFilesSummary.length > 0;

    let filesSummaryHeader = '';
    if (hasUploadedFiles) {
      filesSummaryHeader = `DANH SÁCH CÁC TỆP TÀI LIỆU (${uploadedFilesSummary.length} tệp):\n` +
        uploadedFilesSummary.map((f: any, idx: number) => 
          `${idx + 1}. [Tệp: ${f.name}] (${Math.round((f.size || 0) / 1024)} KB)`
        ).join('\n') + '\n';
    }

    const systemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

---
${filesSummaryHeader}
DƯỚI ĐÂY LÀ NỘI DUNG TÀI LIỆU ĐƯỢC CHỌN LỌC TRỌNG TÂM:
${knowledgeDoc}
---
`;

    // Chuẩn bị lịch sử hội thoại (giữ 6 tin nhắn gần nhất)
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const recentHistory = history.slice(-6);
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.message }] });
      } else if (item.sender === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: item.message }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const client = new GoogleGenAI({
      apiKey: activeApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // =========================================================================
    // CHẾ ĐỘ STREAMING SSE (GÕ CHỮ THỜI GIAN THỰC)
    // =========================================================================
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      let streamSuccess = false;
      let lastError: any = null;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          console.log(`[Server SSE Stream] Đang gọi model: ${modelName}...`);
          const responseStream = await client.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: AI_TEMPERATURE,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          });

          for await (const chunk of responseStream) {
            const chunkText = chunk.text || '';
            if (chunkText) {
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
          }

          streamSuccess = true;
          res.write(`data: ${JSON.stringify({ done: true, timestamp: Date.now() })}\n\n`);
          res.end();
          return;
        } catch (err: any) {
          lastError = err;
          console.warn(`[Server SSE Stream] Model '${modelName}' gặp sự cố:`, err?.message || err);
        }
      }

      if (!streamSuccess) {
        res.write(`data: ${JSON.stringify({ error: lastError?.message || 'Lỗi khi tạo luồng phản hồi từ Gemini API.' })}\n\n`);
        res.end();
      }
      return;
    }

    // =========================================================================
    // CHẾ ĐỘ NON-STREAMING FALLBACK
    // =========================================================================
    const response = await client.models.generateContent({
      model: PRIMARY_MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        temperature: AI_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    res.json({
      reply: response.text || 'Không có phản hồi.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Lỗi khi gọi Gemini API:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error?.message || 'Đã có lỗi xảy ra khi xử lý câu hỏi với Gemini AI.',
      });
    } else {
      res.end();
    }
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
    console.log(`🚀 Máy chủ Trợ lý Luật Lao Động (Streaming Flash) đang hoạt động tại: http://localhost:${PORT}`);
  });
}

startServer();
