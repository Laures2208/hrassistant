/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DỊCH VỤ GIAO TIẾP GEMINI AI STREAMING SIÊU TỐC
 * - Chế độ Streaming gõ chữ thời gian thực (Server-Sent Events & Client SDK Stream)
 * - Tối ưu hóa Model Flash (gemini-1.5-flash / gemini-2.0-flash)
 * - Thuật toán Context Trimming & Semantic Keyword Filtering (tối đa 20.000 ký tự)
 */

import { GoogleGenAI } from '@google/genai';
import { ChatMessage, LawDocumentFile } from '../types';
import { DEFAULT_KNOWLEDGE_BASE } from '../config/knowledgeBase';
import { 
  PRIMARY_MODEL_NAME, 
  CANDIDATE_MODELS, 
  AI_TEMPERATURE, 
  MAX_OUTPUT_TOKENS,
  MAX_CONTEXT_CHARACTERS,
  BASE_SYSTEM_INSTRUCTION 
} from '../config/ai';

/**
 * Trích xuất từ khóa trọng tâm từ câu hỏi của người dùng để tìm đoạn văn bản phù hợp nhất
 */
function extractQueryKeywords(query: string): string[] {
  if (!query) return [];
  const normalized = query.toLowerCase();
  
  // Tách từ và loại bỏ các từ dừng (stop-words) phổ biến trong tiếng Việt
  const stopWords = new Set([
    'là', 'gì', 'như', 'thế', 'nào', 'sao', 'cho', 'tôi', 'hỏi', 'về', 'của', 'và', 'các', 'những',
    'được', 'không', 'có', 'thì', 'ở', 'tại', 'với', 'khi', 'nếu', 'đã', 'sẽ', 'đang', 'cho', 'mình',
    'bạn', 'ơi', 'xin', 'hãy', 'giúp', 'tư', 'vấn', 'em', 'anh', 'chị'
  ]);

  const words = normalized
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  return Array.from(new Set(words));
}

/**
 * Thuật toán Context Trimming & Relevance Scoring:
 * 1. Làm sạch khoảng trắng và dòng trống dư thừa
 * 2. Ưu tiên giữ lại các điều khoản, đoạn văn bản có chứa từ khóa liên quan đến câu hỏi
 * 3. Khống chế tổng dung lượng dưới ngưỡng MAX_CONTEXT_CHARACTERS (20.000 ký tự) để tăng tốc độ nạp AI
 */
export function trimAndFilterContext(
  text: string, 
  userQuery: string, 
  maxChars: number = MAX_CONTEXT_CHARACTERS
): string {
  if (!text) return '';

  // 1. Làm sạch cơ bản
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Nếu tổng dung lượng đã nhỏ hơn giới hạn, trả về ngay
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  // 2. Trích xuất từ khóa tìm kiếm
  const keywords = extractQueryKeywords(userQuery);

  // 3. Phân tách văn bản thành các khối điều khoản / đoạn văn
  const rawSections = cleaned.split(/(?=\n\n(?:===|###|Điều\s+\d+|Chương\s+[IVXLCDM\d]+))/i);
  
  if (rawSections.length <= 1) {
    return cleaned.substring(0, maxChars) + '\n\n[... Đã tối ưu hóa ngữ cảnh để phản hồi tức thì ...]';
  }

  // 4. Chấm điểm độ liên quan (Relevance Score) cho từng khối
  const scoredSections = rawSections.map((section, index) => {
    const lowerSec = section.toLowerCase();
    let score = 0;

    // Giữ lại phần tiêu đề đầu file (overview)
    if (index === 0 || section.includes('=== TỆP TÀI LIỆU') || section.includes('TỔNG QUAN')) {
      score += 50;
    }

    for (const kw of keywords) {
      if (lowerSec.includes(kw)) {
        score += 15;
        // Thưởng điểm cho từ khóa xuất hiện ở tiêu đề điều khoản
        if (lowerSec.includes(`điều`) && lowerSec.includes(kw)) {
          score += 25;
        }
      }
    }

    return { section, score, index, length: section.length };
  });

  // Sắp xếp các đoạn theo điểm liên quan giảm dần
  const sortedByScore = [...scoredSections].sort((a, b) => b.score - a.score);

  // Thu thập các đoạn đạt điểm cao nhất cho đến khi đạt giới hạn dung lượng
  const selectedIndices = new Set<number>();
  let currentLength = 0;

  for (const item of sortedByScore) {
    if (currentLength + item.length <= maxChars) {
      selectedIndices.add(item.index);
      currentLength += item.length;
    }
  }

  // Nếu còn chỗ trống mà chưa lấy hết, bổ sung theo thứ tự ban đầu
  if (currentLength < maxChars) {
    for (const item of scoredSections) {
      if (!selectedIndices.has(item.index) && currentLength + item.length <= maxChars) {
        selectedIndices.add(item.index);
        currentLength += item.length;
      }
    }
  }

  // Lắp ghép lại các đoạn theo đúng thứ tự logic nguyên bản của văn bản
  const finalSections = scoredSections
    .filter((item) => selectedIndices.has(item.index))
    .map((item) => item.section);

  let result = finalSections.join('\n\n');
  if (result.length > maxChars) {
    result = result.substring(0, maxChars);
  }

  return result + '\n\n[... Ngữ cảnh đã được lọc thông minh theo trọng tâm câu hỏi để phản hồi tức thì ...]';
}

export interface StreamChatRequestParams {
  message: string;
  history: ChatMessage[];
  dynamicKnowledgeBase: string;
  uploadedFiles: LawDocumentFile[];
  sessionId: string;
  userApiKey?: string;
  onChunk: (accumulatedText: string, newChunk: string) => void;
}

export interface ChatResponseResult {
  reply: string;
  timestamp: number;
}

/**
 * Gửi yêu cầu đến Gemini AI với chế độ STREAMING thời gian thực
 */
export async function streamLegalChatMessage({
  message,
  history,
  dynamicKnowledgeBase,
  uploadedFiles,
  sessionId,
  userApiKey,
  onChunk,
}: StreamChatRequestParams): Promise<ChatResponseResult> {
  const readyFiles = uploadedFiles.filter((f) => f.status === 'ready');
  const uploadedFilesSummary = readyFiles.map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    wordCount: f.wordCount,
  }));

  // Tối ưu hóa và cắt lọc ngữ cảnh thông minh (Context Trimming tối đa 20.000 ký tự)
  const trimmedContext = trimAndFilterContext(
    dynamicKnowledgeBase || DEFAULT_KNOWLEDGE_BASE,
    message,
    MAX_CONTEXT_CHARACTERS
  );

  let accumulatedText = '';

  // =========================================================================
  // BƯỚC 1: Thử gọi qua Backend Streaming API (/api/chat) bằng SSE
  // =========================================================================
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
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
        dynamicKnowledgeBase: trimmedContext,
        uploadedFilesSummary,
        sessionId,
        apiKey: userApiKey || undefined,
        stream: true,
      }),
    });

    // Nếu server trả về lỗi mã 400 (chưa cấu hình API Key)
    if (response.status === 400) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.needsApiKey || errorData?.error === 'CHUA_CAU_HINH_API_KEY') {
        const customErr: any = new Error(
          errorData?.message || 'Chưa cấu hình Gemini API Key. Vui lòng bấm "⚙️ Cấu hình API Key" trên Header để nhập mã API Key.'
        );
        customErr.needsApiKey = true;
        throw customErr;
      }
    }

    const contentType = response.headers.get('content-type') || '';

    // Nếu server hỗ trợ Streaming SSE (text/event-stream)
    if (response.ok && contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.replace(/^data:\s*/, '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedText += parsed.text;
                onChunk(accumulatedText, parsed.text);
              }
            } catch (jsonErr) {
              // Bỏ qua các dòng không phải JSON chuẩn
            }
          }
        }
      }

      if (accumulatedText.trim().length > 0) {
        return {
          reply: accumulatedText,
          timestamp: Date.now(),
        };
      }
    }

    // Nếu server trả về JSON thông thường (non-stream fallback)
    if (response.ok) {
      const data = await response.json();
      const fullReply = data.reply || '';
      onChunk(fullReply, fullReply);
      return {
        reply: fullReply,
        timestamp: data.timestamp || Date.now(),
      };
    }
  } catch (apiError: any) {
    if (apiError?.needsApiKey) {
      throw apiError;
    }
    console.warn('Backend SSE /api/chat chuyển sang chế độ Client Streaming:', apiError?.message || apiError);
  }

  // =========================================================================
  // BƯỚC 2: Fallback trực tiếp qua Client-side SDK Streaming
  // =========================================================================
  const clientApiKey = (userApiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '').trim();

  if (!clientApiKey || clientApiKey === 'MY_GEMINI_API_KEY' || clientApiKey.length < 10) {
    const keyError: any = new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng bấm nút "⚙️ Cấu hình API Key" trên Header để dán mã API Key của bạn từ Google AI Studio.'
    );
    keyError.needsApiKey = true;
    throw keyError;
  }

  try {
    const clientAi = new GoogleGenAI({ apiKey: clientApiKey });

    let filesSummaryHeader = '';
    if (uploadedFilesSummary.length > 0) {
      filesSummaryHeader =
        `DANH SÁCH CÁC TỆP TÀI LIỆU (${uploadedFilesSummary.length} tệp):\n` +
        uploadedFilesSummary
          .map((f, idx) => `${idx + 1}. [Tệp: ${f.name}] (${Math.round((f.size || 0) / 1024)} KB)`)
          .join('\n') +
        '\n';
    }

    const systemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

---
${filesSummaryHeader}
DƯỚI ĐÂY LÀ NỘI DUNG TÀI LIỆU ĐƯỢC CHỌN LỌC TRỌNG TÂM:
${trimmedContext}
---
`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const recentHistory = history.slice(-6); // Giữ 6 tin nhắn gần nhất để tối ưu hóa context
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.message }] });
      } else if (item.sender === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: item.message }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    let lastError: any = null;
    accumulatedText = '';

    // Thử tuần tự các model trong CANDIDATE_MODELS (ưu tiên Flash model)
    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[Client SDK Stream] Đang khởi tạo luồng gõ chữ với model: ${modelName}...`);
        const responseStream = await clientAi.models.generateContentStream({
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
            accumulatedText += chunkText;
            onChunk(accumulatedText, chunkText);
          }
        }

        if (accumulatedText.trim().length > 0) {
          return {
            reply: accumulatedText,
            timestamp: Date.now(),
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Client SDK Stream] Model '${modelName}' gặp lỗi:`, err?.message || err);
      }
    }

    if (accumulatedText.trim().length > 0) {
      return {
        reply: accumulatedText,
        timestamp: Date.now(),
      };
    }

    throw lastError || new Error('Không thể kết nối đến Gemini Streaming API.');
  } catch (clientError: any) {
    console.error('Lỗi Client Streaming:', clientError);
    throw clientError;
  }
}
