/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HEADER THANH ĐIỀU HƯỚNG VÀ BẢO VỆ QUYỀN QUẢN TRỊ VIÊN (ADMIN)
 */

import React from 'react';
import { 
  Scale, 
  RotateCcw, 
  FolderOpen, 
  Database, 
  ShieldCheck, 
  Key, 
  Lock, 
  LogOut, 
  Shield, 
  Cloud 
} from 'lucide-react';

interface HeaderProps {
  onNewChat: () => void;
  onOpenFileManager: () => void;
  onOpenFirebase: () => void;
  onOpenApiKey: () => void;
  isFirebaseActive: boolean;
  hasCustomApiKey: boolean;
  messageCount: number;
  fileCount: number;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewChat,
  onOpenFileManager,
  onOpenFirebase,
  onOpenApiKey,
  isFirebaseActive,
  hasCustomApiKey,
  messageCount,
  fileCount,
  isAdminLoggedIn,
  onAdminLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Tiêu đề ứng dụng */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                Trợ Lý Pháp Lý Lao Động
              </h1>
              <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60 flex-shrink-0">
                <ShieldCheck className="w-3 h-3" />
                Bộ luật Lao động 2019
              </span>
            </div>
            
            {/* Trạng thái hoạt động & Trạng thái Admin */}
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 font-medium whitespace-nowrap hidden sm:inline">
                Sẵn sàng hỗ trợ
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-slate-500 whitespace-nowrap text-[11px] sm:text-xs">
                {messageCount > 0 ? `${messageCount} tin nhắn` : 'Phiên mới'}
              </span>

              {/* Huy hiệu Admin nếu đang đăng nhập */}
              {isAdminLoggedIn && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold text-[10px] border border-amber-300">
                    <Shield className="w-2.5 h-2.5 text-amber-700" />
                    Admin
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nhóm nút điều hướng tác vụ & Quản trị */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          
          {/* Nút Quản lý File Luật & Nội quy (Đồng bộ Cloud Firestore) */}
          <button
            id="open-file-manager-button"
            type="button"
            onClick={onOpenFileManager}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs border ${
              isAdminLoggedIn 
                ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200' 
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
            title="Quản lý và tải file tài liệu Luật & Nội quy công ty (.pdf, .docx, .txt, .md) đồng bộ toàn hệ thống"
          >
            <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="hidden md:inline">Quản lý File</span>
            <span className="md:hidden">File</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white flex-shrink-0">
              {fileCount}
            </span>
            {!isAdminLoggedIn && (
              <span title="Cần mật khẩu Admin" className="inline-flex">
                <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
              </span>
            )}
          </button>

          {/* Nút trạng thái Firebase Firestore */}
          <button
            id="open-firebase-config-button"
            type="button"
            onClick={onOpenFirebase}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
              isFirebaseActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Xem và quản lý cơ sở dữ liệu Cloud Firestore"
          >
            <Cloud className={`w-3.5 h-3.5 ${isFirebaseActive ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span className="hidden lg:inline">
              {isFirebaseActive ? 'Cloud Firestore' : 'Bộ nhớ'}
            </span>
            {!isAdminLoggedIn && (
              <Lock className="w-2.5 h-2.5 text-slate-400" />
            )}
          </button>

          {/* Nút Cấu hình Gemini API Key */}
          <button
            id="open-api-key-config-button"
            type="button"
            onClick={onOpenApiKey}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
              hasCustomApiKey
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Cấu hình Gemini API Key tùy chỉnh"
          >
            <Key className={`w-3.5 h-3.5 ${hasCustomApiKey ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className="hidden xl:inline">
              {hasCustomApiKey ? 'API Key (Đã lưu)' : 'API Key'}
            </span>
            {!isAdminLoggedIn && (
              <Lock className="w-2.5 h-2.5 text-slate-400" />
            )}
          </button>

          {/* Nút Đăng xuất Admin (chỉ hiển thị khi Admin đang đăng nhập) */}
          {isAdminLoggedIn ? (
            <button
              id="admin-logout-button"
              type="button"
              onClick={onAdminLogout}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Khóa lại quyền quản trị viên"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          ) : null}

          {/* Nút Tạo hội thoại mới */}
          <button
            id="new-chat-button"
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-red-700 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
            title="Tạo hội thoại mới / Làm mới phiên chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mới</span>
          </button>
        </div>
      </div>
    </header>
  );
};
