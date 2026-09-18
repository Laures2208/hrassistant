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

// Danh sách các model chuẩn được Google hỗ trợ
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

const CLIENT_SYSTEM_INSTRUCTION = `
Bạn là Chuyên gia Pháp lý Lao động và Cố vấn Tuân thủ Nội quy Doanh nghiệp cấp cao. Nhiệm vụ của bạn là đọc kỹ và phân tích toàn diện nội dung từ TẤT CẢ các TỆP TÀI LIỆU LUẬT / NỘI QUY mà người dùng đã tải lên hệ thống để giải đáp mọi thắc mắc.

CÁC QUY TẮC BẮT BUỘC KHI TRẢ LỜI:

1. ĐỌC KỸ TOÀN BỘ NGỮ CẢNH & TRÍCH DẪN ĐẦY ĐỦ CĂN CỨ PHÁP LÝ:
- Bắt buộc trích dẫn rõ ràng: [Tên File / Tên Văn bản] ➔ [Điều / Khoản / Điểm cụ thể] đã được cung cấp trong tài liệu.
- Đọc kỹ toàn bộ các tệp tài liệu được đính kèm. Tuyệt đối không viện dẫn chung chung hoặc giả định không có căn cứ.

2. LIỆT KÊ ĐẦY ĐỦ, CHI TIẾT & TUYỆT ĐỐI KHÔNG BỎ SÓT:
- Khi câu hỏi liên quan đến danh mục quyền lợi, các trường hợp nghỉ phép (nghỉ phép năm, nghỉ việc riêng có lương/không lương, nghỉ ốm đau, thai sản...), các hình thức kỷ luật, mức trợ cấp thôi việc, phụ cấp hoặc giờ làm thêm (OT/WFH): BẮT BUỘC phải liệt kê ĐẦY ĐỦ TẤT CẢ các trường hợp và điều kiện được ghi trong tài liệu.
- Tuyệt đối KHÔNG được tóm tắt sơ sài, cắt xén làm mất đi các chi tiết, mốc thời gian hoặc ngoại lệ pháp lý quan trọng.

3. ĐỊNH DẠNG MARKDOWN RÕ RÀNG, CHUYÊN NGHIỆP:
Mỗi câu trả lời cần được cấu trúc mạch lạc, chuẩn mực theo 3 phần:
- **Phần 1: Tóm tắt nhanh câu trả lời (Direct Answer)**: Nêu trực tiếp kết luận chính trong 1-3 câu rõ ràng.
- **Phần 2: Căn cứ pháp lý chi tiết**:
  Liệt kê từng căn cứ theo cấu trúc:
  [Tên File / Tên Luật] ➔ [Điều / Khoản / Điểm] ➔ [Trích dẫn nội dung cụ thể hoặc phân tích rõ ràng].
- **Phần 3: Hướng dẫn thực hành / Lưu ý đối với nhân viên**:
  Chỉ rõ các bước nhân viên cần làm trong thực tế, các mốc thời gian (deadline), thủ tục biểu mẫu, hoặc lưu ý bảo vệ quyền lợi hợp pháp.
- Sử dụng in đậm cho các từ khóa quan trọng, danh sách gạch đầu dòng và bảng biểu (Markdown table) nếu so sánh hoặc thống kê số liệu.

4. QUY TRÌNH & THỦ TỤC THEO THỨ TỰ:
- Nếu câu hỏi liên quan đến quy trình hoặc thủ tục (xin nghỉ, bàn giao, thanh toán lương/OT, xử lý kỷ luật...): Hãy liệt kê ĐẦY ĐỦ các bước theo đúng trình tự thời gian trong tài liệu.

5. THÔNG BÁO MINH BẠCH KHI THIẾU DỮ LIỆU:
- Nếu vấn đề người dùng hỏi KHÔNG có trong bất kỳ tệp tài liệu nào đã tải lên, bạn BẮT BUỘC phải thông báo rõ: "Thông tin này chưa có trong các tài liệu bạn đã tải lên, vui lòng cung cấp thêm file liên quan hoặc liên hệ trực tiếp Phòng Nhân sự (HR)."
- Nếu người dùng chưa tải file riêng nào lên, hãy căn cứ vào Bộ luật Lao động 2019 mặc định và nhắc nhở người dùng có thể tải file nội quy riêng của công ty lên bất cứ lúc nào.
`;

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
${CLIENT_SYSTEM_INSTRUCTION}

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

    // Duyệt qua danh sách CANDIDATE_MODELS cho đến khi tìm thấy model phản hồi thành công
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

        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Client SDK] Cảnh báo với model ${modelName}:`, err?.message || err);
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
