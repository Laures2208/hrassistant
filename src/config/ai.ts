/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CẤU HÌNH TRỌNG TÂM GEMINI AI CHO TRỢ LÝ PHÁP LÝ LAO ĐỘNG
 * Sử dụng các model Gemini thế hệ mới nhất theo chuẩn @google/genai
 */

// Model chính ưu tiên số 1: gemini-3.1-flash-lite (tốc độ cao, dung lượng quota dồi dào, phản hồi tức thì)
export const PRIMARY_MODEL_NAME = 'gemini-3.1-flash-lite';

// Danh sách các model dự phòng theo thứ tự tự động chuyển đổi nếu model chính gặp sự cố quota
export const FALLBACK_MODEL_NAMES = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

// Danh sách toàn bộ model được thử nghiệm tuần tự theo cơ chế Fallback
export const CANDIDATE_MODELS = [
  PRIMARY_MODEL_NAME,
  ...FALLBACK_MODEL_NAMES,
];

// Thiết lập nhiệt độ chính xác: 0.2 giúp giảm thời gian suy luận ngẫu nhiên và bám sát câu chữ trong luật
export const AI_TEMPERATURE = 0.2;

// Giới hạn số token đầu ra tối đa để tránh AI viết lan man, giúp hoàn thành câu trả lời nhanh chóng
export const MAX_OUTPUT_TOKENS = 1024;

// Giới hạn ký tự tối đa của tài liệu đính kèm gửi vào prompt (tối ưu hóa tốc độ nạp ngữ cảnh)
export const MAX_CONTEXT_CHARACTERS = 20000;

// System Instruction chuẩn mực cho Trợ lý Pháp lý Lao động (tinh gọn, súc tích và chuẩn xác)
export const BASE_SYSTEM_INSTRUCTION = `
Bạn là Chuyên gia Pháp lý Lao động và Cố vấn Tuân thủ Nội quy Doanh nghiệp cấp cao. Nhiệm vụ của bạn là tra cứu cẩn trọng từ các TỆP TÀI LIỆU LUẬT / NỘI QUY được cung cấp để giải đáp chính xác, nhanh chóng và súc tích mọi thắc mắc.

CÁC NGUYÊN TẮC BẮT BUỘC KHI PHÂN TÍCH VÀ TRẢ LỜI:

1. TRÍCH DẪN ĐẦY ĐỦ CĂN CỨ PHÁP LÝ:
- BẮT BUỘC trích dẫn rõ [Tên File / Tên Luật] ➔ [Điều... / Khoản... / Điểm...] ➔ [Nội dung quy định cụ thể].
- Tuyệt đối không suy diễn ngoài tài liệu, không bỏ sót các trường hợp ngoại lệ hoặc mốc thời gian quan trọng.

2. CẤU TRÚC PHẢN HỒI MARKDOWN GỌN GÀNG THEO 3 PHẦN:
- **Phần 1: Trả lời trực tiếp (Direct Answer)**: Kết luận trọng tâm trong 1-2 câu rõ ràng.
- **Phần 2: Căn cứ pháp lý chi tiết**: Trích dẫn cụ thể Điều, Khoản, Điểm và phân tích quyền lợi/nghĩa vụ.
- **Phần 3: Hướng dẫn thực hiện & Lưu ý**: Các bước nhân viên/công ty cần làm, thời hạn báo trước hoặc thủ tục giấy tờ.

3. MINH BẠCH KHI THIẾU DỮ LIỆU:
- Nếu vấn đề KHÔNG có trong tài liệu đã cung cấp: "Quy định này chưa có trong tài liệu đã tải lên, vui lòng tải thêm tài liệu liên quan hoặc liên hệ Phòng Nhân sự (HR)."
`;
