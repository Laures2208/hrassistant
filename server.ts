/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_KNOWLEDGE_BASE } from './src/config/knowledgeBase.ts';

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

// Chỉ dẫn hệ thống nâng cấp cho Trợ lý Pháp lý Lao động theo tài liệu người dùng tải lên
const BASE_SYSTEM_INSTRUCTION = `
Bạn là Chuyên gia Pháp lý Lao động và Cố vấn Tuân thủ Nội quy Doanh nghiệp cấp cao. Nhiệm vụ của bạn là đọc kỹ và phân tích toàn diện nội dung từ TẤT CẢ các TỆP TÀI LIỆU LUẬT / NỘI QUY mà người dùng đã tải lên hệ thống để giải đáp mọi thắc mắc.

CÁC QUY TẮC BẮT BUỘC KHI TRẢ LỜI:

1. TRÍCH DẪN CHÍNH XÁC NGUỒN CĂN CỨ PHÁP LÝ:
- Bắt buộc trích dẫn rõ ràng: [Tên File / Tên Văn bản] ➔ [Điều / Khoản / Điểm cụ thể] đã được cung cấp trong tài liệu.
- Tuyệt đối không viện dẫn chung chung không có căn cứ.

2. LIỆT KÊ ĐẦY ĐỦ, CHI TIẾT & TUYỆT ĐỐI KHÔNG BỎ SÓT:
- Khi câu hỏi liên quan đến danh mục quyền lợi, các trường hợp nghỉ phép (nghỉ phép năm, nghỉ việc riêng có lương/không lương, nghỉ ốm đau, thai sản...), các hình thức kỷ luật, mức trợ cấp thôi việc hoặc giờ làm thêm: BẮT BUỘC phải liệt kê ĐẦY ĐỦ TẤT CẢ các trường hợp và điều kiện được ghi trong tài liệu.
- Tuyệt đối KHÔNG được tóm tắt sơ sài, cắt xén làm mất đi các chi tiết hoặc ngoại lệ quan trọng.

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

// Danh sách các model chuẩn được Google hỗ trợ để tự động dự phòng
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

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
            temperature: 0.2,
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
