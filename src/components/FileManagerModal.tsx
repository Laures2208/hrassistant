/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODAL QUẢN LÝ VÀ TẢI FILE TÀI LIỆU LUẬT & NỘI QUY CÔNG TY
 * Đồng bộ Cloud Firestore toàn hệ thống - Mọi máy tính đều truy cập cùng dữ liệu
 */

import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  Loader2, 
  Sparkles, 
  Info,
  Cloud,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { LawDocumentFile } from '../types';
import { parseUploadedDocument, formatFileSize } from '../utils/documentParser';

interface FileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: LawDocumentFile[];
  onAddFiles: (newFiles: LawDocumentFile[]) => Promise<void> | void;
  onRemoveFile: (fileId: string) => Promise<void> | void;
  onClearAllFiles: () => Promise<void> | void;
  onLoadSampleFiles: () => Promise<void> | void;
  isCloudSyncing?: boolean;
}

export const FileManagerModal: React.FC<FileManagerModalProps> = ({
  isOpen,
  onClose,
  files,
  onAddFiles,
  onRemoveFile,
  onClearAllFiles,
  onLoadSampleFiles,
  isCloudSyncing = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Xử lý khi chọn file qua thẻ input
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    await processFileList(Array.from(selectedFiles));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Xử lý kéo thả (Drag and Drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    await processFileList(Array.from(droppedFiles));
  };

  // Quá trình trích xuất văn bản từ mảng file và lưu vào Firestore
  const processFileList = async (fileList: File[]) => {
    setIsProcessing(true);
    setUploadError(null);
    const parsedResults: LawDocumentFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setProcessingStatus(`Đang đọc (${i + 1}/${fileList.length}): ${file.name}...`);
      try {
        const parsed = await parseUploadedDocument(file);
        parsed.uploadedBy = 'Admin';
        parsedResults.push(parsed);
      } catch (err: any) {
        console.error('Lỗi khi phân tích file:', err);
      }
    }

    if (parsedResults.length > 0) {
      setProcessingStatus('Đang đồng bộ dữ liệu lên Cloud Firestore...');
      try {
        await onAddFiles(parsedResults);
      } catch (err) {
        console.error('Lỗi khi đồng bộ lên Firestore:', err);
      }
    } else {
      setUploadError('Không thể trích xuất nội dung từ các file đã chọn. Vui lòng kiểm tra lại định dạng (.pdf, .docx, .txt, .md).');
    }

    setIsProcessing(false);
    setProcessingStatus('');
  };

  // Tính tổng số ký tự và số từ đã nạp
  const totalWords = files.reduce((acc, f) => acc + (f.wordCount || 0), 0);
  const totalCharacters = files.reduce((acc, f) => acc + (f.characterCount || 0), 0);
  const activeFilesCount = files.filter((f) => f.status === 'ready').length;

  // Lấy icon tương ứng định dạng file
  const getFileBadge = (file: LawDocumentFile) => {
    switch (file.type) {
      case 'pdf':
        return {
          icon: <FileText className="w-5 h-5 text-rose-600" />,
          bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'PDF',
        };
      case 'docx':
        return {
          icon: <FileText className="w-5 h-5 text-blue-600" />,
          bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'DOCX',
        };
      case 'md':
        return {
          icon: <FileCode className="w-5 h-5 text-indigo-600" />,
          bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          label: 'MARKDOWN',
        };
      case 'txt':
      default:
        return {
          icon: <FileText className="w-5 h-5 text-emerald-600" />,
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'TXT',
        };
    }
  };

  const handleLoadSample = async () => {
    setIsActionLoading(true);
    try {
      await onLoadSampleFiles();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Bạn có chắc muốn xóa tất cả tài liệu trên Cloud Firestore không? Mọi máy truy cập sẽ được cập nhật.')) {
      setIsActionLoading(true);
      try {
        await onClearAllFiles();
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Quản lý File Luật & Nội quy Công ty
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Đồng bộ Cloud Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tài liệu tải lên được lưu trữ trên Firestore và tự động đồng bộ tức thì cho tất cả nhân viên
              </p>
            </div>
          </div>
          <button
            id="close-file-manager-button"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thân Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Khu vực Drag & Drop Upload */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                isDragging ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-100 text-blue-700'
              }`}>
                {isProcessing || isCloudSyncing ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {isProcessing ? (
                    <span className="text-blue-600 font-medium">{processingStatus}</span>
                  ) : isDragging ? (
                    'Thả tệp vào đây để nạp ngay lên Cloud'
                  ) : (
                    <>
                      <span className="text-blue-600 hover:underline">Nhấn để tải file lên</span> hoặc kéo thả vào khung này
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Hỗ trợ: <span className="font-medium text-slate-700">.PDF, .DOCX, .TXT, .MD</span> (Tự động trích xuất văn bản & lưu trữ Cloud)
                </p>
              </div>

              {/* Badges định dạng file */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  .PDF
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  .DOCX
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  .TXT
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  .MD
                </span>
              </div>
            </div>
          </div>

          {/* Thông báo lỗi nếu có */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Thanh công cụ danh sách file */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                Tài liệu Cloud ({files.length})
              </h3>
              {files.length > 0 && (
                <span className="text-xs text-slate-400">
                  • {totalWords.toLocaleString()} từ ({formatFileSize(totalCharacters)})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Nút nạp file mẫu Bộ luật Lao động & Nội quy */}
              <button
                id="load-sample-law-files-button"
                type="button"
                onClick={handleLoadSample}
                disabled={isActionLoading || isProcessing}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Nạp file mẫu Bộ luật Lao động 2019 & Nội quy công ty lên Cloud"
              >
                {isActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Nạp file mẫu</span>
              </button>

              {/* Nút xóa tất cả file */}
              {files.length > 0 && (
                <button
                  id="clear-all-files-button"
                  type="button"
                  onClick={handleClearAll}
                  disabled={isActionLoading || isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Xóa tất cả tài liệu khỏi Cloud Firestore"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>
          </div>

          {/* Danh sách tệp đã tải lên */}
          {files.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/60 rounded-2xl border border-slate-200/80">
              <Cloud className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium text-slate-700">Chưa có tệp tài liệu nào trên Cloud Firestore</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Kéo thả file PDF, DOCX, TXT ở trên hoặc bấm nút <strong>"Nạp file mẫu"</strong> để tải dữ liệu mẫu Bộ luật Lao động 2019 & Nội quy công ty lên hệ thống.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {files.map((file) => {
                const badge = getFileBadge(file);
                const isPreviewing = previewFileId === file.id;

                return (
                  <div
                    key={file.id}
                    className="border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-shadow shadow-2xs overflow-hidden"
                  >
                    <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                      {/* Icon & Thông tin file */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                          {badge.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 truncate" title={file.name}>
                              {file.name}
                            </h4>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${badge.bgColor}`}>
                              {badge.label}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                              {file.uploadedBy || 'Admin'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.wordCount.toLocaleString()} từ</span>
                            <span>•</span>
                            <span className="hidden sm:inline text-slate-400">
                              {new Date(file.uploadedAt).toLocaleDateString('vi-VN')} {new Date(file.uploadedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            {file.status === 'ready' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Đã đồng bộ Cloud
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                {file.errorMessage || 'Lỗi đọc tệp'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Các nút hành động */}
                      <div className="flex items-center gap-1">
                        {/* Nút xem trước text */}
                        <button
                          type="button"
                          onClick={() => setPreviewFileId(isPreviewing ? null : file.id)}
                          className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isPreviewing
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                          title={isPreviewing ? 'Ẩn xem trước' : 'Xem nội dung văn bản trích xuất'}
                        >
                          {isPreviewing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        {/* Nút xóa file */}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn xóa file "${file.name}" khỏi Cloud Firestore?`)) {
                              onRemoveFile(file.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa tệp này khỏi Cloud Firestore"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Khung xem trước văn bản trích xuất */}
                    {isPreviewing && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 bg-slate-50/70 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                          <span>Trích đoạn văn bản AI đang đối chiếu:</span>
                          <span>{file.characterCount.toLocaleString()} ký tự</span>
                        </div>
                        <div className="max-h-44 overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap select-text">
                          {file.extractedText.slice(0, 2000)}
                          {file.extractedText.length > 2000 && (
                            <span className="text-slate-400 italic">
                              {'\n'}... [Còn {file.extractedText.length - 2000} ký tự tiếp theo đã được đồng bộ đầy đủ lên Cloud]
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ghi chú bảo mật & đồng bộ */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lưu trữ tập trung và Đồng bộ tức thì (Real-time Cloud Sync):</p>
              <p className="text-blue-900/90 mt-0.5 leading-relaxed">
                Khi Admin tải lên, chỉnh sửa hoặc xóa tài liệu, toàn bộ thay đổi sẽ được cập nhật ngay lập tức lên cơ sở dữ liệu Cloud Firestore. Mọi nhân viên truy cập ứng dụng từ bất kỳ máy tính nào đều sẽ tra cứu chính xác theo dữ liệu mới nhất.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {activeFilesCount > 0
              ? `Đang áp dụng ${activeFilesCount} tệp cho toàn bộ câu hỏi của nhân viên`
              : 'Chưa có file nào, AI sẽ sử dụng Bộ luật Lao động 2019 mặc định'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
