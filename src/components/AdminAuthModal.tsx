/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODAL XÁC THỰC MẬT KHẨU QUẢN TRỊ VIÊN (ADMIN AUTH MODAL)
 * Bảo vệ các tính năng Quản lý File Luật, Bộ nhớ Firestore và Gemini API Key
 */

import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { checkAdminPassword, setAdminSession } from '../config/adminConfig';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetFeatureName?: string; // Tên tính năng người dùng đang muốn mở
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetFeatureName = 'Quản trị hệ thống',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu Quản trị viên.');
      return;
    }

    const isValid = checkAdminPassword(password);
    if (isValid) {
      setAdminSession(true);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 400);
    } else {
      setError('Mật khẩu Admin không chính xác! Vui lòng thử lại.');
      inputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Nút đóng */}
        <button
          id="close-admin-auth-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Tiêu đề */}
        <div className="text-center mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs transition-colors ${
            isSuccess 
              ? 'bg-emerald-100 text-emerald-700' 
              : error 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-blue-100 text-blue-700'
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-7 h-7 animate-in zoom-in" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-lg">
            Xác Thực Quản Trị Viên (Admin)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Mục <strong className="text-blue-700">{targetFeatureName}</strong> được bảo vệ bằng mật khẩu quản trị.
          </p>
        </div>

        {/* Form nhập mật khẩu */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              Mật khẩu Admin:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nhập mật khẩu quản trị viên..."
                className={`w-full px-3.5 py-2.5 pr-10 text-sm border rounded-xl focus:outline-hidden transition-all ${
                  error
                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400'
                    : isSuccess
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
                disabled={isSuccess}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Thông báo thành công */}
          {isSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Đăng nhập Admin thành công! Đang mở bảng điều khiển...</span>
            </div>
          )}

          {/* Nút hành động */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              id="submit-admin-password-btn"
              type="submit"
              disabled={isSuccess}
              className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-75"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Xác nhận mở</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
