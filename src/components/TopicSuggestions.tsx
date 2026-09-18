/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Clock, 
  DollarSign, 
  Calendar, 
  Heart, 
  FileText, 
  Home, 
  AlertTriangle 
} from 'lucide-react';

interface TopicSuggestionsProps {
  onSelectTopic: (prompt: string) => void;
}

interface Suggestion {
  icon: React.ElementType;
  label: string;
  prompt: string;
  category: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: Clock,
    label: 'Thời gian & Lương thử việc',
    prompt: 'Thời gian thử việc tối đa cho các vị trí công việc theo Bộ luật Lao động là bao lâu, và mức lương thử việc tối thiểu được quy định như thế nào?',
    category: 'Thử việc'
  },
  {
    icon: DollarSign,
    label: 'Tiền lương làm thêm giờ (OT)',
    prompt: 'Quy định về tiền lương làm thêm giờ vào ngày thường, ngày nghỉ hằng tuần, ngày Lễ Tết và làm việc vào ban đêm được tính như thế nào theo Điều 98 Bộ luật Lao động 2019?',
    category: 'Tiền lương'
  },
  {
    icon: Calendar,
    label: 'Nghỉ phép năm & Thâm niên',
    prompt: 'Người lao động được hưởng bao nhiêu ngày nghỉ phép năm theo quy định? Làm việc bao nhiêu năm thì được cộng thêm ngày nghỉ phép theo thâm niên?',
    category: 'Nghỉ ngơi'
  },
  {
    icon: Heart,
    label: 'Nghỉ việc riêng có nguyên lương',
    prompt: 'Những trường hợp nghỉ việc riêng nào người lao động được nghỉ mà vẫn được hưởng nguyên 100% tiền lương theo Điều 115 Bộ luật Lao động?',
    category: 'Chế độ'
  },
  {
    icon: FileText,
    label: 'Bảo vệ thai sản & Nuôi con nhỏ',
    prompt: 'Lao động nữ mang thai và nuôi con dưới 12 tháng tuổi có những quyền lợi và sự bảo vệ nào theo quy định của pháp luật lao động?',
    category: 'Thai sản'
  },
  {
    icon: AlertTriangle,
    label: 'Thời hạn báo trước khi nghỉ việc',
    prompt: 'Khi người lao động đơn phương chấm dứt hợp đồng lao động thì phải báo trước bao nhiêu ngày đối với từng loại hợp đồng xác định và không xác định thời hạn?',
    category: 'Chấm dứt HĐLĐ'
  },
  {
    icon: Home,
    label: 'Chính sách WFH & Giờ làm việc',
    prompt: 'Theo Nội quy lao động của công ty, giờ làm việc tiêu chuẩn hằng ngày là từ mấy giờ và chính sách Làm việc từ xa (Work From Home) được quy định như thế nào?',
    category: 'Nội quy công ty'
  }
];

export const TopicSuggestions: React.FC<TopicSuggestionsProps> = ({ onSelectTopic }) => {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 mb-3 shadow-2xs">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          Bạn cần tư vấn vấn đề gì về Luật Lao động?
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
          Trợ lý AI đã được nạp dữ liệu <span className="font-semibold text-slate-700">Bộ luật Lao động 2019</span> và <span className="font-semibold text-slate-700">Nội quy công ty</span>. Bạn có thể chọn câu hỏi mẫu hoặc nhập thắc mắc bên dưới:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {SUGGESTIONS.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <button
              key={index}
              id={`suggestion-chip-${index}`}
              type="button"
              onClick={() => onSelectTopic(item.prompt)}
              className="flex items-start gap-3 p-3.5 text-left bg-white hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-300 rounded-xl transition-all shadow-2xs cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-700 flex items-center justify-center flex-shrink-0 transition-colors">
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-medium">
                    {item.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                  {item.prompt}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
