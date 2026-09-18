/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Search, RotateCcw, Check, BookOpen, Edit3, Save } from 'lucide-react';
import { DEFAULT_KNOWLEDGE_BASE } from '../config/knowledgeBase';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: string;
  onSaveKnowledgeBase: (newContent: string) => void;
  onResetKnowledgeBase: () => void;
}

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  knowledgeBase,
  onSaveKnowledgeBase,
  onResetKnowledgeBase,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(knowledgeBase);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKnowledgeBase(editText);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    if (confirm('Bạn có chắc muốn khôi phục tài liệu Luật Lao động & Nội quy công ty về mặc định ban đầu không?')) {
      onResetKnowledgeBase();
      setEditText(DEFAULT_KNOWLEDGE_BASE);
      setIsEditing(false);
    }
  };

  // Lọc hiển thị khi tìm kiếm
  const getHighlightedText = () => {
    if (!searchTerm.trim()) {
      return knowledgeBase;
    }
    return knowledgeBase;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Cơ Sở Tri Thức: Luật Lao Động & Nội Quy
              </h3>
              <p className="text-xs text-slate-500">
                Tài liệu được AI tra cứu làm căn cứ trích dẫn Điều, Khoản khi tư vấn
              </p>
            </div>
          </div>
          <button
            id="close-kb-modal-button"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-kb-input"
              type="text"
              placeholder="Tìm kiếm Điều luật, từ khóa (VD: Điều 98, thử việc, WFH...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isEditing}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  id="save-kb-button"
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu thay đổi</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Khôi phục tài liệu gốc"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đặt lại mặc định</span>
                </button>
                <button
                  id="edit-kb-button"
                  type="button"
                  onClick={() => {
                    setEditText(knowledgeBase);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa nội quy / tài liệu</span>
                </button>
              </>
            )}
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-6 py-2 flex items-center gap-2 border-b border-emerald-200">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Đã lưu thành công tài liệu cơ sở kiến thức mới vào bộ nhớ ứng dụng!</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans">
          {isEditing ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Chỉnh sửa tài liệu (Hỗ trợ định dạng Markdown, văn bản điều luật):
              </label>
              <textarea
                id="edit-kb-textarea"
                rows={18}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed text-slate-800"
              />
            </div>
          ) : (
            <div className="bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
              {getHighlightedText()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Nguồn: Bộ luật Lao động số 45/2019/QH14 & Nội quy công ty</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
