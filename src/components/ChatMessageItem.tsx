/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { Scale, User, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === 'user';

  const formatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Không thể sao chép văn bản:', err);
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`flex w-full gap-3 py-2 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar AI */}
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Scale className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Nội dung bóng tin nhắn */}
      <div
        className={`relative group max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 transition-all duration-150 ${
          isUser
            ? 'bg-slate-800 text-white rounded-tr-xs shadow-xs'
            : message.isError
            ? 'bg-red-50/90 text-red-900 border border-red-200 rounded-tl-xs shadow-xs'
            : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs'
        }`}
      >
        {/* Header thông tin người gửi */}
        <div className="flex items-center justify-between gap-4 mb-1.5 text-xs">
          <span className={`font-semibold ${isUser ? 'text-slate-200' : message.isError ? 'text-red-700' : 'text-blue-700'}`}>
            {isUser ? 'Bạn' : 'Chuyên gia Pháp lý Lao động'}
          </span>
          <div className="flex items-center gap-1.5 opacity-70">
            <span>{formatTime(message.timestamp)}</span>
            {!isUser && !message.isError && (
              <button
                id={`copy-btn-${message.id}`}
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                title="Sao chép nội dung câu trả lời"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Nội dung text */}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
            {message.message}
          </p>
        ) : message.isError ? (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 text-sm text-red-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="markdown-content text-sm text-red-900">
                <Markdown>{message.message}</Markdown>
              </div>
            </div>

            {onRetry && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-medium rounded-lg cursor-pointer transition-all shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Thử lại</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="markdown-content text-sm text-slate-800 leading-relaxed">
            <Markdown>{message.message}</Markdown>
          </div>
        )}
      </div>

      {/* Avatar User */}
      {isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-xs">
            <User className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
};
