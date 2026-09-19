/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VERCEL SERVERLESS FUNCTION HANDLER CHO /api/chat
 * Hỗ trợ Streaming SSE siêu tốc với Gemini Flash
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_KNOWLEDGE_BASE } from '../src/config/knowledgeBase';
import {
  PRIMARY_MODEL_NAME,
  CANDIDATE_MODELS,
  AI_TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  MAX_CONTEXT_CHARACTERS,
  BASE_SYSTEM_INSTRUCTION,
} from '../src/config/ai';

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
      apiKey: bodyApiKey,
      stream = true,
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

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
        message: 'Chưa cấu hình Gemini API Key. Vui lòng bấm "⚙️ Cấu hình API Key" trên thanh Header.',
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const rawKnowledge = dynamicKnowledgeBase || customKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;
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

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const responseStream = await ai.models.generateContentStream({
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

          res.write(`data: ${JSON.stringify({ done: true, timestamp: Date.now() })}\n\n`);
          res.end();
          return;
        } catch (err: any) {
          console.warn(`[Vercel Serverless Stream] Model '${modelName}' lỗi:`, err?.message || err);
        }
      }
      res.write(`data: ${JSON.stringify({ error: 'Lỗi khi tạo luồng phản hồi từ Gemini API.' })}\n\n`);
      res.end();
      return;
    }

    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        temperature: AI_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    res.status(200).json({
      reply: response.text || 'Không có phản hồi.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Lỗi Vercel function /api/chat:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error?.message || 'Đã có lỗi xảy ra khi xử lý câu hỏi.',
      });
    } else {
      res.end();
    }
  }
}
