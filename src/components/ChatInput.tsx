/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, KeyboardEvent } from 'react';
import { Send, CornerDownLeft, Paperclip } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onOpenFileUpload?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  onOpenFileUpload,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tự động co giãn chiều cao theo độ dài văn bản
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full bg-white border-t border-slate-200/90 px-4 py-3 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-2xs">
          {/* Nút đính kèm / Quản lý File tài liệu */}
          {onOpenFileUpload && (
            <button
              id="chat-upload-file-button"
              type="button"
              onClick={onOpenFileUpload}
              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer flex-shrink-0 ml-1 mb-1"
              title="Tải lên tệp tài liệu Luật / Nội quy (.pdf, .docx, .txt, .md)"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          <textarea
            id="chat-textarea"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Đặt câu hỏi về Hợp đồng, Thử việc, Lương OT, Nghỉ phép, Thai sản hoặc Nội quy công ty..."
            rows={1}
            className={`w-full resize-none py-3 pr-12 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden leading-relaxed max-h-40 overflow-y-auto ${
              onOpenFileUpload ? 'pl-2' : 'pl-4'
            }`}
          />

          {/* Nút gửi */}
          <button
            id="send-message-button"
            type="button"
            onClick={onSend}
            disabled={isLoading || !input.trim()}
            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              !input.trim() || isLoading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-xs'
            }`}
            title="Gửi câu hỏi (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Thanh gợi ý phím tắt & Lưu ý nhỏ */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <CornerDownLeft className="w-3 h-3" />
            <span>Nhấn <kbd className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded font-mono text-[10px]">Enter</kbd> để gửi, <kbd className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded font-mono text-[10px]">Shift + Enter</kbd> để xuống dòng</span>
          </div>
          <span className="hidden sm:inline">Phản hồi dựa trên Tài liệu Luật & Nội quy đã tải lên</span>
        </div>
      </div>
    </div>
  );
};
