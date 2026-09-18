/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scale, RotateCcw, FolderOpen, Database, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onNewChat: () => void;
  onOpenFileManager: () => void;
  onOpenFirebase: () => void;
  isFirebaseActive: boolean;
  messageCount: number;
  fileCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewChat,
  onOpenFileManager,
  onOpenFirebase,
  isFirebaseActive,
  messageCount,
  fileCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Logo & Tiêu đề ứng dụng */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                Trợ Lý Pháp Lý Lao Động
              </h1>
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60 flex-shrink-0">
                <ShieldCheck className="w-3 h-3" />
                Bộ luật Lao động 2019
              </span>
            </div>
            
            {/* Trạng thái hoạt động: Dấu chấm xanh "Sẵn sàng hỗ trợ" */}
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 font-medium whitespace-nowrap">
                Sẵn sàng hỗ trợ
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 whitespace-nowrap">
                {messageCount > 0 ? `${messageCount} tin nhắn` : 'Phiên mới'}
              </span>
            </div>
          </div>
        </div>

        {/* Nhóm nút điều hướng tác vụ */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Nút Quản lý File Luật & Nội quy */}
          <button
            id="open-file-manager-button"
            type="button"
            onClick={onOpenFileManager}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Quản lý và tải file tài liệu Luật & Nội quy công ty (.pdf, .docx, .txt, .md)"
          >
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Quản lý File Luật & Nội quy</span>
            <span className="sm:hidden">File</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </span>
          </button>

          {/* Nút trạng thái Firebase */}
          <button
            id="open-firebase-config-button"
            type="button"
            onClick={onOpenFirebase}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
              isFirebaseActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title="Xem hoặc cấu hình kết nối Firebase Firestore"
          >
            <Database className={`w-3.5 h-3.5 ${isFirebaseActive ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">
              {isFirebaseActive ? 'Firestore' : 'Bộ nhớ'}
            </span>
          </button>

          {/* Nút Tạo hội thoại mới / Xóa lịch sử chat */}
          <button
            id="new-chat-button"
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
            title="Tạo hội thoại mới / Xóa lịch sử tin nhắn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mới</span>
          </button>
        </div>
      </div>
    </header>
  );
};
