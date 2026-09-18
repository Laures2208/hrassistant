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

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export default async function handler(req: any, res: any) {
  // Hỗ trợ CORS nếu gọi từ client khác domain
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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
      customKnowledgeBase 
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY hoặc VITE_GEMINI_API_KEY trên Vercel. Vui lòng thiết lập biến môi trường trong Project Settings của Vercel.',
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const knowledgeDoc = dynamicKnowledgeBase || customKnowledgeBase || DEFAULT_KNOWLEDGE_BASE;
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
        const response = await ai.models.generateContent({
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
        console.warn(`Lỗi với model ${modelName} trên Vercel:`, err?.message || err);
      }
    }

    if (!reply && lastError) {
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
