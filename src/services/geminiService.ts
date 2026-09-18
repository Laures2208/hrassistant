/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DỊCH VỤ GIAO TIẾP GEMINI AI (UNIFIED CHAT SERVICE)
 * Hỗ trợ linh hoạt cả Backend API (/api/chat trên Cloud Run, Express & Vercel)
 * và Client-side Fallback (sử dụng VITE_GEMINI_API_KEY trên Vercel SPA)
 */

import { GoogleGenAI } from '@google/genai';
import { ChatMessage, LawDocumentFile } from '../types';
import { DEFAULT_KNOWLEDGE_BASE } from '../config/knowledgeBase';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const CLIENT_SYSTEM_INSTRUCTION = `
Bạn là Chuyên gia Pháp lý Lao động và Cố vấn Tuân thủ Nội quy Doanh nghiệp cấp cao. Nhiệm vụ của bạn là đọc kỹ và phân tích toàn diện nội dung từ TẤT CẢ các TỆP TÀI LIỆU LUẬT / NỘI QUY mà người dùng đã tải lên hệ thống để giải đáp mọi thắc mắc.

CÁC QUY TẮC BẮT BUỘC KHI TRẢ LỜI:

1. NHIỆM VỤ CHÍNH:
- Đọc toàn bộ tài liệu luật/nội quy được cung cấp và tìm TẤT CẢ các Điều, Khoản, Điểm có liên quan trực tiếp hoặc gián tiếp đến câu hỏi của người dùng.

2. YÊU CẦU ĐẦY ĐỦ & KHÔNG BỎ SÓT:
- Tuyệt đối KHÔNG trả lời chung chung hoặc tóm tắt quá ngắn gọn làm mất ý.
- Khi có nhiều điều luật liên quan (ví dụ: vừa có Bộ luật Lao động, vừa có Nội quy công ty; hoặc liên quan đến nhiều điều như Điều 12, Điều 13, Điều 105...), BẮT BUỘC phải liệt kê đầy đủ danh sách từng Điều / Khoản có liên quan, không được bỏ sót bất kỳ điều khoản nào.

3. ĐỊNH DẠNG CÂU TRẢ LỜI RÕ RÀNG (BẮT BUỘC THEO 3 PHẦN):
Mỗi câu trả lời cần được cấu trúc theo 3 phần chuẩn mực:
- **Phần 1: Tóm tắt nhanh câu trả lời (Direct Answer)**:
  Nêu câu trả lời trực tiếp, rõ ràng cho câu hỏi của nhân viên ngay ở phần đầu (ngắn gọn trong 1-3 câu).
- **Phần 2: Căn cứ pháp lý chi tiết**:
  Liệt kê chi tiết từng căn cứ theo cấu trúc:
  [Tên File / Tên Luật] ➔ [Điều / Khoản / Điểm] ➔ [Trích dẫn nội dung cụ thể hoặc phân tích rõ ràng].
- **Phần 3: Hướng dẫn thực hành / Lưu ý đối với nhân viên**:
  Chỉ rõ các bước nhân viên cần làm trong thực tế, các mốc thời gian (deadline), thủ tục biểu mẫu, hoặc lưu ý bảo vệ quyền lợi hợp pháp.

4. QUY TRÌNH & THỦ TỤC:
- Nếu câu hỏi liên quan đến quy trình hoặc thủ tục (ví dụ: quy trình xin nghỉ phép, chế độ thai sản, thủ tục thôi việc, xử lý kỷ luật sa thải, đăng ký OT/WFH...): Hãy liệt kê ĐẦY ĐỦ các bước theo đúng thứ tự được quy định trong tài liệu.

5. TRƯỜNG HỢP NGOẠI LỆ / THIẾU THÔNG TIN:
- Nếu vấn đề người dùng hỏi KHÔNG có trong bất kỳ tệp tài liệu nào đã tải lên, bạn BẮT BUỘC phải thông báo rõ: "Thông tin này chưa có trong các tài liệu bạn đã tải lên, vui lòng cung cấp thêm file liên quan hoặc liên hệ trực tiếp Phòng Nhân sự (HR)."
- Nếu người dùng chưa tải file riêng nào lên, hãy căn cứ vào Bộ luật Lao động 2019 mặc định và nhắc nhở người dùng có thể tải file nội quy riêng của công ty lên bất cứ lúc nào.
`;

export interface ChatRequestParams {
  message: string;
  history: ChatMessage[];
  dynamicKnowledgeBase: string;
  uploadedFiles: LawDocumentFile[];
  sessionId: string;
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
}: ChatRequestParams): Promise<ChatResponseResult> {
  const readyFiles = uploadedFiles.filter((f) => f.status === 'ready');
  const uploadedFilesSummary = readyFiles.map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    wordCount: f.wordCount,
  }));

  // BƯỚC 1: Thử gọi qua Backend API (/api/chat)
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.map((m) => ({
          sender: m.sender,
          message: m.message,
        })),
        dynamicKnowledgeBase,
        uploadedFilesSummary,
        sessionId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        reply: data.reply,
        timestamp: data.timestamp || Date.now(),
      };
    }

    // Nếu mã lỗi trả về 404 (thường gặp khi host static trên Vercel mà không dùng serverless function)
    // Hoặc 500 / 503 có JSON lỗi rõ ràng
    const errorData = await response.json().catch(() => null);
    if (response.status !== 404 && errorData?.error) {
      throw new Error(errorData.error);
    }
  } catch (apiError: any) {
    // Nếu lỗi có thông báo chi tiết từ server (như lỗi hết hạn key, quá tải model 503, ...), chuyển tiếp lỗi
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

  // BƯỚC 2: Fallback trực tiếp qua Client-side SDK với biến VITE_GEMINI_API_KEY (hỗ trợ Vercel SPA)
  const clientApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string)?.trim();

  if (!clientApiKey || clientApiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Chưa cấu hình API Key. Nếu bạn đang triển khai trên Vercel, vui lòng vào **Project Settings ➔ Environment Variables** và thêm biến `VITE_GEMINI_API_KEY` (hoặc `GEMINI_API_KEY`).'
    );
  }

  try {
    const clientAi = new GoogleGenAI({ apiKey: clientApiKey });
    const knowledgeDoc = dynamicKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;

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
${CLIENT_SYSTEM_INSTRUCTION}

---
${filesSummaryHeader}
DƯỚI ĐÂY LÀ NỘI DUNG TOÀN BỘ CÁC TỆP TÀI LIỆU ĐƯỢC CUNG CẤP (DYNAMIC GROUNDING CONTEXT - ĐÃ NẠP ĐẦY ĐỦ):
${knowledgeDoc}
---
`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const recentHistory = history.slice(-10);
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

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await clientAi.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });

        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Lỗi khi gọi model ${modelName} từ client:`, err);
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
