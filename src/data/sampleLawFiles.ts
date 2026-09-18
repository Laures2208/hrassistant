/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TÀI LIỆU MẪU BAN ĐẦU: BỘ LUẬT LAO ĐỘNG 2019 & NỘI QUY CÔNG TY
 */

import { LawDocumentFile } from '../types';
import { DEFAULT_KNOWLEDGE_BASE } from '../config/knowledgeBase';

export const INITIAL_SAMPLE_FILES: LawDocumentFile[] = [
  {
    id: 'sample_doc_bllđ_2019',
    name: 'Bo_Luat_Lao_Dong_2019_So_45-2019-QH14.txt',
    size: 13624,
    type: 'txt',
    extractedText: DEFAULT_KNOWLEDGE_BASE,
    characterCount: DEFAULT_KNOWLEDGE_BASE.length,
    wordCount: DEFAULT_KNOWLEDGE_BASE.split(/\s+/).filter(Boolean).length,
    uploadedAt: Date.now() - 3600000,
    status: 'ready',
  },
  {
    id: 'sample_doc_noi_quy_cty',
    name: 'Noi_Quy_Lao_Dong_Va_Che_Do_Phuc_Loi_Cong_Ty_2024.docx',
    size: 28450,
    type: 'docx',
    extractedText: `QUY ĐỊNH NỘI BỘ VÀ CHẾ ĐỘ PHÚC LỢI CÔNG TY NĂM 2024
Ban hành kèm theo Quyết định số 15/2024/QĐ-TGĐ

CHƯƠNG 1: THỜI GIỜ LÀM VIỆC VÀ NGHỈ NGƠI
- Điều 1: Giờ làm việc tiêu chuẩn: Từ 08h30 đến 17h30 (nghỉ trưa từ 12h00 đến 13h00), từ Thứ Hai đến Thứ Sáu. Thứ Bảy và Chủ Nhật là ngày nghỉ hằng tuần.
- Điều 2: Chính sách Làm việc từ xa (Work From Home - WFH):
  + Mỗi nhân viên chính thức được đăng ký WFH tối đa 02 ngày/tháng với sự phê duyệt trước 24h của Trưởng bộ phận trên hệ thống HR Portal.
  + Trong ngày WFH, nhân viên phải duy trì liên lạc qua Slack và email công ty trong giờ làm việc.
- Điều 3: Làm thêm giờ (OT):
  + Phải có đăng ký phê duyệt trước của Quản lý trực tiếp (Manager) và gửi HR xác nhận.
  + Tiền làm thêm giờ được chi trả vào kỳ lương cùng tháng: ngày thường x150%, ngày nghỉ hằng tuần (Thứ 7, Chủ Nhật) x200%, ngày Lễ Tết x300% cộng tiền lương ngày nghỉ lễ có hưởng lương.

CHƯƠNG 2: CHẾ ĐỘ NGHỈ PHÉP VÀ PHÚC LỢI NỘI BỘ
- Điều 4: Nghỉ phép năm:
  + Nhân viên làm đủ 12 tháng được hưởng 12 ngày phép năm. Cứ mỗi 05 năm làm việc liên tục tại công ty được cộng thêm 01 ngày phép.
  + Phép năm chưa sử dụng hết trong năm tài chính được bảo lưu và chuyển sang năm sau sử dụng đến hết ngày 31/03.
- Điều 5: Nghỉ ốm đau và thai sản:
  + Hưởng trợ cấp BHXH theo quy định Nhà nước.
  + Công ty hỗ trợ thêm 01 khoản phụ cấp phục hồi sức khỏe tương đương 500.000 VNĐ/lần ốm nằm viện từ 03 ngày trở lên.
  + Lao động nữ sinh con được công ty tặng quà chúc mừng trị giá 2.000.000 VNĐ.

CHƯƠNG 3: QUY TRÌNH NGHỈ VIỆC VÀ BÀN GIAO
- Điều 6: Thông báo nghỉ việc:
  + Hợp đồng xác định thời hạn: Báo trước tối thiểu 30 ngày.
  + Hợp đồng không xác định thời hạn: Báo trước tối thiểu 45 ngày.
  + Bàn giao đầy đủ thiết bị (Laptop, thẻ ra vào, tài khoản email) và ký biên bản thanh lý hợp đồng trước ngày làm việc cuối cùng.
- Điều 7: Kênh giải đáp và khiếu nại:
  + Mọi thắc mắc chưa rõ, nhân viên liên hệ Phòng Nhân sự qua email: hr@company.internal hoặc hotline nội bộ máy lẻ: #102.`,
    characterCount: 2210,
    wordCount: 395,
    uploadedAt: Date.now() - 1800000,
    status: 'ready',
  }
];
