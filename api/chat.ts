/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VERCEL SERVERLESS FUNCTION HANDLER CHO /api/chat
 * Cho phép ứng dụng hoạt động mượt mà khi deploy lên Vercel
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_KNOWLEDGE_BASE } from '../src/config/knowledgeBase';

const BASE_SYSTEM_INSTRUCTION = `
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

// Danh sách các model chuẩn được Google hỗ trợ, sắp xếp theo thứ tự ưu tiên
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

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

    // Duyệt qua danh sách các model hợp lệ cho đến khi tìm thấy model phản hồi thành công
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
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
        console.warn(`[Vercel Serverless] Cảnh báo với model ${modelName}:`, err?.message || err);
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
