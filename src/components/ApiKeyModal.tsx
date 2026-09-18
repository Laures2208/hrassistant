/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODAL CẤU HÌNH GEMINI API KEY (FALLBACK UI)
 * Cho phép người dùng nhập trực tiếp Gemini API Key khi deploy lên Vercel
 * hoặc khi chưa cấu hình biến môi trường trên server.
 */

import React, { useState, useEffect } from 'react';
import { Key, ExternalLink, CheckCircle2, ShieldAlert, X, Trash2, Eye, EyeOff } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedApiKey: string;
  onSaveApiKey: (newKey: string) => void;
  onClearApiKey: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  savedApiKey,
  onSaveApiKey,
  onClearApiKey,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(savedApiKey);
      setStatusMessage(null);
    }
  }, [isOpen, savedApiKey]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setStatusMessage('Vui lòng nhập API Key hợp lệ hoặc bấm "Xóa Key" để khôi phục mặc định.');
      return;
    }
    onSaveApiKey(cleanKey);
    setStatusMessage('Đã lưu thành công Gemini API Key vào trình duyệt!');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleClear = () => {
    onClearApiKey();
    setApiKeyInput('');
    setStatusMessage('Đã xóa API Key tùy chỉnh.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
        {/* Nút đóng */}
        <button
          id="close-api-key-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Cấu hình Gemini API Key
            </h2>
            <p className="text-xs text-slate-500">
              Dành cho triển khai trên Vercel hoặc môi trường độc lập
            </p>
          </div>
        </div>

        {/* Hướng dẫn & Lưu ý an toàn */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 mb-4 text-xs text-slate-700 leading-relaxed space-y-2">
          <p className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Ứng dụng ưu tiên sử dụng <strong>API Key bạn lưu trong trình duyệt (localStorage)</strong>. Nếu chưa cấu hình, ứng dụng sẽ tự động dùng biến môi trường trên Vercel (<code className="px-1 py-0.5 bg-blue-100/80 text-blue-800 rounded font-mono text-[11px]">VITE_GEMINI_API_KEY</code> / <code className="px-1 py-0.5 bg-blue-100/80 text-blue-800 rounded font-mono text-[11px]">GEMINI_API_KEY</code>).
            </span>
          </p>
          <div className="pt-1 flex items-center justify-between border-t border-blue-200/60 text-[11px]">
            <span className="text-slate-500">Chưa có API Key miễn phí?</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              Lấy Key tại Google AI Studio
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Form nhập liệu */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mã Gemini API Key
            </label>
            <div className="relative">
              <input
                id="gemini-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Thông báo trạng thái */}
          {statusMessage && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Các nút hành động */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {savedApiKey ? (
              <button
                id="clear-api-key-button"
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Key đã lưu</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                id="save-api-key-button"
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Lưu và áp dụng
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
