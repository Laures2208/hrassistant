/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TRỢ LÝ TỰ ĐỘNG TƯ VẤN LUẬT LAO ĐỘNG CÔNG TY
 * Ứng dụng tin nhắn AI tích hợp Google Gemini, Dynamic File Grounding (.pdf, .docx, .txt, .md) & Firebase Firestore
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { ChatMessageItem } from './components/ChatMessageItem';
import { TypingIndicator } from './components/TypingIndicator';
import { ChatInput } from './components/ChatInput';
import { TopicSuggestions } from './components/TopicSuggestions';
import { FileManagerModal } from './components/FileManagerModal';
import { FirebaseModal } from './components/FirebaseModal';
import { ChatMessage, LawDocumentFile } from './types';
import { DEFAULT_KNOWLEDGE_BASE } from './config/knowledgeBase';
import { INITIAL_SAMPLE_FILES } from './data/sampleLawFiles';
import { 
  saveMessage, 
  loadSessionMessages, 
  clearSessionMessages, 
  getActiveFirebaseConfig, 
  isRealFirebaseConfig 
} from './config/firebaseConfig';
import { AlertTriangle, FolderOpen, FileText, Sparkles, Upload } from 'lucide-react';
import { sendLegalChatMessage } from './services/geminiService';

const LOCAL_STORAGE_FILES_KEY = 'labor_law_uploaded_documents_v2';
const LOCAL_STORAGE_SESSION_KEY = 'labor_law_current_session_id';

export default function App() {
  // Quản lý mã phiên hội thoại (Session ID)
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (saved) return saved;
    const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, newId);
    return newId;
  });

  // Danh sách tin nhắn trong phiên chat hiện tại
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Quản lý danh sách file tài liệu đã tải lên (.pdf, .docx, .txt, .md)
  const [uploadedFiles, setUploadedFiles] = useState<LawDocumentFile[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Lỗi khi đọc danh sách file từ localStorage:', e);
    }
    return INITIAL_SAMPLE_FILES;
  });

  // Trạng thái modal
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Trạng thái kết nối Firebase
  const [isFirebaseActive, setIsFirebaseActive] = useState(() => {
    return isRealFirebaseConfig(getActiveFirebaseConfig());
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Tự động lưu danh sách file vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_FILES_KEY, JSON.stringify(uploadedFiles));
    } catch (e) {
      console.error('Lỗi khi lưu danh sách file vào localStorage:', e);
    }
  }, [uploadedFiles]);

  // Hợp nhất nội dung các tài liệu thành Dynamic Grounding Context
  const dynamicGroundingContext = useMemo(() => {
    const readyFiles = uploadedFiles.filter(
      (f) => f.status === 'ready' && f.extractedText && f.extractedText.trim().length > 0
    );

    if (readyFiles.length === 0) {
      return DEFAULT_KNOWLEDGE_BASE;
    }

    return readyFiles
      .map((file, index) => {
        const header = `=== TỆP TÀI LIỆU [${index + 1}/${readyFiles.length}]: "${file.name}" (Định dạng: ${file.type.toUpperCase()}, Dung lượng: ${Math.round(file.size / 1024)} KB, ${file.wordCount} từ) ===`;
        return `${header}\n${file.extractedText.trim()}`;
      })
      .join('\n\n=======================================================\n\n');
  }, [uploadedFiles]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    chatBottomRef.current?.scrollIntoView({ behavior });
  };

  // Tải lại lịch sử tin nhắn khi khởi động hoặc đổi session
  useEffect(() => {
    const fetchHistory = async () => {
      const history = await loadSessionMessages(sessionId);
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Tin nhắn chào mừng ban đầu từ Chuyên gia Pháp lý
        const activeFilesCount = uploadedFiles.filter((f) => f.status === 'ready').length;
        const filesNames = uploadedFiles
          .filter((f) => f.status === 'ready')
          .map((f) => `• \`${f.name}\``)
          .join('\n');

        const welcomeMessage: ChatMessage = {
          id: 'welcome_msg',
          sender: 'assistant',
          message: `Chào bạn! Tôi là **Trợ lý Pháp lý Lao Động** của công ty.\n\nTôi đang đối chiếu và tra cứu trực tiếp từ **${activeFilesCount} tệp tài liệu** được cung cấp:\n${filesNames}\n\nTôi có thể giải đáp chi tiết cho bạn về:\n- 📝 Hợp đồng lao động, thử việc và tiền lương.\n- ⏰ Giờ làm việc, làm việc từ xa (WFH), làm thêm giờ (OT).\n- 🏖️ Chế độ nghỉ phép năm, bảo lưu ngày phép và chế độ ốm đau/thai sản.\n- 🚪 Thủ tục, thời hạn báo trước và trợ cấp khi chấm dứt HĐLĐ.\n- 📁 Bạn cũng có thể nhấn nút **"Quản lý File Luật & Nội quy"** ở góc trên để tải thêm tài liệu công ty (.pdf, .docx, .txt, .md) bất cứ lúc nào!\n\nHãy gửi câu hỏi hoặc chọn các chủ đề gợi ý bên dưới để bắt đầu nhé!`,
          timestamp: Date.now(),
          sessionId,
        };
        setMessages([welcomeMessage]);
        saveMessage(welcomeMessage);
      }
    };
    fetchHistory();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  // Cập nhật trạng thái Firebase khi người dùng lưu config
  const handleFirebaseConfigSaved = () => {
    setIsFirebaseActive(isRealFirebaseConfig(getActiveFirebaseConfig()));
  };

  // Thao tác với danh sách file
  const handleAddFiles = (newFiles: LawDocumentFile[]) => {
    setUploadedFiles((prev) => {
      // Tránh trùng lặp tên file hoặc id
      const existingNames = new Set(prev.map((f) => f.name.toLowerCase()));
      const filtered = newFiles.filter((f) => !existingNames.has(f.name.toLowerCase()));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
  };

  const handleLoadSampleFiles = () => {
    setUploadedFiles(INITIAL_SAMPLE_FILES);
  };

  // Tạo hội thoại mới / Xóa lịch sử
  const handleConfirmClear = async () => {
    await clearSessionMessages(sessionId);
    const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, newId);
    setSessionId(newId);

    const activeFilesCount = uploadedFiles.filter((f) => f.status === 'ready').length;
    const initialGreeting: ChatMessage = {
      id: 'greeting_' + Date.now(),
      sender: 'assistant',
      message: `Đã làm mới phiên tư vấn. Tôi đang sẵn sàng tra cứu dữ liệu từ **${activeFilesCount} tệp tài liệu luật & nội quy** của bạn. Bạn muốn tìm hiểu quy định nào hôm nay?`,
      timestamp: Date.now(),
      sessionId: newId,
    };
    setMessages([initialGreeting]);
    await saveMessage(initialGreeting);
    setIsConfirmClearOpen(false);
  };

  // Gửi câu hỏi đến Gemini API
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if (!query || isLoading) return;

    // 1. Thêm tin nhắn của User
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      sender: 'user',
      message: query,
      timestamp: Date.now(),
      sessionId,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Lưu tin nhắn User vào Firestore / LocalStorage
    saveMessage(userMsg);

    try {
      // 2. Gửi yêu cầu với cơ chế dự phòng đa tầng (Server -> Client Fallback)
      const result = await sendLegalChatMessage({
        message: query,
        history: updatedMessages,
        dynamicKnowledgeBase: dynamicGroundingContext,
        uploadedFiles,
        sessionId,
      });

      // 3. Thêm tin nhắn phản hồi từ AI
      const aiMsg: ChatMessage = {
        id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        sender: 'assistant',
        message: result.reply,
        timestamp: result.timestamp || Date.now(),
        sessionId,
      };

      setMessages((prev) => [...prev, aiMsg]);
      saveMessage(aiMsg);
    } catch (error: any) {
      console.error('Lỗi khi trò chuyện với Trợ lý AI:', error);

      let cleanErrorText = error?.message || 'Đã có lỗi xảy ra.';
      if (cleanErrorText.includes('503') || cleanErrorText.includes('high demand') || cleanErrorText.includes('UNAVAILABLE')) {
        cleanErrorText = 'Máy chủ AI hiện đang trong thời điểm quá tải yêu cầu tạm thời (High demand 503). Hệ thống đã tự động thử lại nhưng chưa thành công. Bạn vui lòng bấm nút "Thử lại" bên dưới sau vài giây.';
      } else if (cleanErrorText.includes('429')) {
        cleanErrorText = 'Hệ thống đã đạt giới hạn tần suất yêu cầu tạm thời. Vui lòng đợi khoảng 30 giây rồi bấm "Thử lại".';
      } else if (cleanErrorText.includes('API_KEY') || cleanErrorText.includes('Chưa cấu hình API Key')) {
        cleanErrorText = cleanErrorText;
      }

      const errorMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        sender: 'assistant',
        message: `⚠️ **Không thể kết nối đến Trợ lý AI:**\n\n${cleanErrorText}\n\n*Nếu vấn đề tiếp tục diễn ra hoặc cần giải quyết chế độ khẩn cấp, vui lòng liên hệ trực tiếp Phòng Nhân sự (HR).*`,
        timestamp: Date.now(),
        sessionId,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
      saveMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm thử lại câu hỏi trước đó khi gặp lỗi kết nối
  const handleRetryMessage = (errorIndex: number) => {
    let lastUserQuery = '';
    for (let i = errorIndex - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        lastUserQuery = messages[i].message;
        break;
      }
    }

    if (lastUserQuery) {
      setMessages((prev) => prev.filter((_, idx) => idx !== errorIndex));
      handleSendMessage(lastUserQuery);
    }
  };

  const readyFilesCount = uploadedFiles.filter((f) => f.status === 'ready').length;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden">
      {/* Header Thanh công cụ với Nút Quản lý File */}
      <Header
        onNewChat={() => setIsConfirmClearOpen(true)}
        onOpenFileManager={() => setIsFileManagerOpen(true)}
        onOpenFirebase={() => setIsFirebaseModalOpen(true)}
        isFirebaseActive={isFirebaseActive}
        messageCount={messages.length}
        fileCount={readyFilesCount}
      />

      {/* Vùng Khung Tin Nhắn (Chat Window) */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col justify-between">
        <div className="max-w-4xl w-full mx-auto space-y-3">
          
          {/* Thanh hiển thị trạng thái File Tài liệu đang áp dụng */}
          <div className="bg-white/90 backdrop-blur-xs border border-blue-100 rounded-xl p-2.5 px-3.5 flex items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                {readyFilesCount > 0 ? (
                  <span className="text-slate-700">
                    Đang tra cứu từ <strong className="text-blue-800 font-semibold">{readyFilesCount} tệp tài liệu</strong>: {uploadedFiles.filter(f => f.status === 'ready').map(f => f.name).slice(0, 2).join(', ')}
                    {readyFilesCount > 2 ? ` và +${readyFilesCount - 2} tệp khác` : ''}
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium">
                    Chưa có file nào: Hệ thống đang dùng Bộ luật Lao động 2019 mặc định.
                  </span>
                )}
              </div>
            </div>
            
            <button
              id="banner-manage-files-button"
              type="button"
              onClick={() => setIsFileManagerOpen(true)}
              className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-xs hover:underline flex-shrink-0 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>{readyFilesCount > 0 ? 'Thêm / Xem file' : 'Tải file lên'}</span>
            </button>
          </div>

          {/* Lịch sử tin nhắn */}
          {messages.map((msg, index) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onRetry={msg.isError ? () => handleRetryMessage(index) : undefined}
            />
          ))}

          {/* Hiệu ứng đang soạn thảo / tra cứu: "Đang đọc tài liệu và suy nghĩ..." */}
          {isLoading && <TypingIndicator />}

          {/* Gợi ý câu hỏi khi mới bắt đầu hội thoại */}
          {messages.length <= 2 && !isLoading && (
            <div className="mt-4">
              <TopicSuggestions onSelectTopic={(prompt) => handleSendMessage(prompt)} />
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </main>

      {/* Thanh Nhập Liệu (Input Area) */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={() => handleSendMessage()}
        isLoading={isLoading}
        onOpenFileUpload={() => setIsFileManagerOpen(true)}
      />

      {/* Modal Quản lý và Tải file Tài liệu Luật & Nội quy (.pdf, .docx, .txt, .md) */}
      <FileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        files={uploadedFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        onClearAllFiles={handleClearAllFiles}
        onLoadSampleFiles={handleLoadSampleFiles}
      />

      {/* Modal Cấu hình Firebase Firestore */}
      <FirebaseModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onConfigSaved={handleFirebaseConfigSaved}
      />

      {/* Modal Xác nhận Tạo hội thoại mới / Xóa lịch sử */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-center font-bold text-slate-900 text-base mb-1">
              Tạo cuộc hội thoại mới?
            </h3>
            <p className="text-center text-xs text-slate-500 mb-6 leading-relaxed">
              Thao tác này sẽ làm mới phiên làm việc hiện tại và bắt đầu một cuộc hội thoại mới với Trợ lý Luật Lao động. Dữ liệu các tệp tài liệu đã tải lên vẫn được bảo lưu.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="flex-1 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                id="confirm-new-chat-button"
                type="button"
                onClick={handleConfirmClear}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Xóa & Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
