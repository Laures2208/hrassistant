/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODAL CẤU HÌNH GEMINI API KEY VÀ THAY ĐỔI MẬT KHẨU ADMIN
 * Cho phép quản trị viên:
 * 1. Cấu hình Gemini API Key tùy chỉnh cho Vercel / Cloud Run
 * 2. Thay đổi mật khẩu Quản trị viên (Admin Password) an toàn, nhanh chóng
 */

import React, { useState, useEffect } from 'react';
import { 
  Key, 
  ExternalLink, 
  CheckCircle2, 
  ShieldAlert, 
  X, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock, 
  ShieldCheck, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { 
  saveCustomAdminPassword, 
  resetCustomAdminPassword, 
  isCustomAdminPasswordSet,
  getAdminPassword
} from '../config/adminConfig';

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
  // Trạng thái cho tab / phân mục
  const [activeTab, setActiveTab] = useState<'api_key' | 'admin_password'>('api_key');

  // Trạng thái Gemini API Key
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [apiKeyStatusMessage, setApiKeyStatusMessage] = useState<string | null>(null);

  // Trạng thái Đổi mật khẩu Admin
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStatusMessage, setPasswordStatusMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [hasCustomPassword, setHasCustomPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(savedApiKey);
      setApiKeyStatusMessage(null);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatusMessage(null);
      setPasswordError(null);
      setHasCustomPassword(isCustomAdminPasswordSet());
    }
  }, [isOpen, savedApiKey]);

  if (!isOpen) return null;

  // Xử lý lưu Gemini API Key
  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setApiKeyStatusMessage('Vui lòng nhập API Key hợp lệ hoặc bấm "Xóa Key" để khôi phục mặc định.');
      return;
    }
    onSaveApiKey(cleanKey);
    setApiKeyStatusMessage('Đã lưu thành công Gemini API Key vào hệ thống!');
  };

  const handleClearApiKey = () => {
    onClearApiKey();
    setApiKeyInput('');
    setApiKeyStatusMessage('Đã xóa API Key tùy chỉnh. Ứng dụng sẽ sử dụng biến môi trường mặc định.');
  };

  // Xử lý đổi mật khẩu Admin
  const handleChangeAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordStatusMessage(null);

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedNew) {
      setPasswordError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (trimmedNew.length < 4) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 4 ký tự để đảm bảo an toàn.');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setPasswordError('Mật khẩu nhập lại không khớp! Vui lòng kiểm tra lại.');
      return;
    }

    const success = saveCustomAdminPassword(trimmedNew);
    if (success) {
      setHasCustomPassword(true);
      setPasswordStatusMessage('Đổi mật khẩu Admin thành công! Mật khẩu mới đã được áp dụng ngay lập tức.');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError('Không thể lưu mật khẩu. Vui lòng thử lại.');
    }
  };

  const handleResetAdminPassword = () => {
    if (confirm('Bạn có chắc muốn khôi phục mật khẩu Quản trị viên về mật khẩu mặc định của hệ thống không?')) {
      resetCustomAdminPassword();
      setHasCustomPassword(false);
      setPasswordError(null);
      setPasswordStatusMessage('Đã khôi phục mật khẩu Quản trị viên về mặc định hệ thống!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Nút đóng */}
        <button
          id="close-api-key-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cấu Hình Quản Trị & API Key
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập khóa bảo mật và khóa kết nối Google Gemini AI
              </p>
            </div>
          </div>

          {/* Tab điều hướng: API Key / Đổi mật khẩu Admin */}
          <div className="flex items-center gap-2 mt-4 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('api_key')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'api_key'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Gemini API Key</span>
            </button>

            <button
              id="tab-change-admin-password"
              type="button"
              onClick={() => setActiveTab('admin_password')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'admin_password'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đổi Mật Khẩu Admin</span>
              {hasCustomPassword && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Đã đổi mật khẩu tùy chỉnh" />
              )}
            </button>
          </div>
        </div>

        {/* Nội dung theo Tab */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'api_key' ? (
            /* ========================================================================= */
            /* TAB 1: CẤU HÌNH GEMINI API KEY                                            */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Hướng dẫn & Lưu ý an toàn */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed space-y-2">
                <p className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Ứng dụng ưu tiên sử dụng <strong>API Key bạn lưu trong trình duyệt</strong>. Nếu chưa cấu hình, ứng dụng sẽ tự động dùng biến môi trường trên máy chủ (<code className="px-1 py-0.5 bg-blue-100/80 text-blue-800 rounded font-mono text-[11px]">GEMINI_API_KEY</code> / <code className="px-1 py-0.5 bg-blue-100/80 text-blue-800 rounded font-mono text-[11px]">VITE_GEMINI_API_KEY</code>).
                  </span>
                </p>
                <div className="pt-1.5 flex items-center justify-between border-t border-blue-200/60 text-[11px]">
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

              {/* Form nhập API Key */}
              <form onSubmit={handleSaveApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mã Gemini API Key tùy chỉnh:
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
                {apiKeyStatusMessage && (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{apiKeyStatusMessage}</span>
                  </div>
                )}

                {/* Các nút hành động cho API Key */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  {savedApiKey ? (
                    <button
                      id="clear-api-key-button"
                      type="button"
                      onClick={handleClearApiKey}
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
          ) : (
            /* ========================================================================= */
            /* TAB 2: THAY ĐỔI MẬT KHẨU ADMIN                                            */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Giới thiệu tính năng */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-950 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Bảo mật bảng điều khiển Quản trị viên:</p>
                  <p className="text-amber-900/90 mt-0.5">
                    Mật khẩu này được dùng để bảo vệ các mục: <strong>Quản lý File Luật</strong>, <strong>Cơ sở dữ liệu Firestore</strong> và <strong>Cấu hình API Key</strong>.
                  </p>
                </div>
              </div>

              {/* Form đổi mật khẩu */}
              <form onSubmit={handleChangeAdminPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mật khẩu Admin mới:
                  </label>
                  <div className="relative">
                    <input
                      id="new-admin-password-input"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Nhập mật khẩu quản trị mới..."
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Xác nhận lại mật khẩu mới:
                  </label>
                  <input
                    id="confirm-admin-password-input"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Nhập lại mật khẩu mới..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                {/* Thông báo lỗi nếu có */}
                {passwordError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Thông báo thành công nếu có */}
                {passwordStatusMessage && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{passwordStatusMessage}</span>
                  </div>
                )}

                {/* Các nút hành động cho đổi mật khẩu */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {hasCustomPassword ? (
                    <button
                      id="reset-admin-password-btn"
                      type="button"
                      onClick={handleResetAdminPassword}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="Khôi phục mật khẩu về mặc định ban đầu"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Về mặc định</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Đang dùng mật khẩu mặc định
                    </span>
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
                      id="save-new-admin-password-btn"
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Cập nhật mật khẩu</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
