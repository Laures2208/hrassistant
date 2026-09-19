/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TRỢ LÝ TỰ ĐỘNG TƯ VẤN LUẬT LAO ĐỘNG CÔNG TY
 * Tối ưu hóa siêu tốc độ phản hồi với Gemini Flash Streaming, Context Trimming & Firebase Firestore
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ChatInput } from './components/ChatInput';
import { TopicSuggestions } from './components/TopicSuggestions';
import { FileManagerModal } from './components/FileManagerModal';
import { FirebaseModal } from './components/FirebaseModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AdminAuthModal } from './components/AdminAuthModal';
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
import { 
  subscribeToFirestoreDocuments, 
  saveBatchDocumentsToFirestore, 
  deleteDocumentFromFirestore, 
  clearAllDocumentsFromFirestore, 
  seedSampleDocumentsToFirestore,
  getCachedDocuments
} from './services/firebaseDocumentService';
import { getAdminSession, setAdminSession } from './config/adminConfig';
import { AlertTriangle, FolderOpen, Upload, Lock } from 'lucide-react';
import { streamLegalChatMessage } from './services/geminiService';

const LOCAL_STORAGE_SESSION_KEY = 'labor_law_current_session_id';
const LOCAL_STORAGE_USER_API_KEY = 'labor_law_user_gemini_api_key';

export default function App() {
  // Quản lý mã phiên hội thoại (Session ID)
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (saved) return saved;
    const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, newId);
    return newId;
  });

  // Quản lý trạng thái Quản trị viên (Admin Login)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return getAdminSession();
  });

  // Quản lý Gemini API Key do người dùng tự nhập
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_USER_API_KEY) || '';
    } catch {
      return '';
    }
  });

  // Danh sách tin nhắn trong phiên chat hiện tại
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Quản lý danh sách file tài liệu đã tải lên (.pdf, .docx, .txt, .md) - Đồng bộ Cloud Firestore
  const [uploadedFiles, setUploadedFiles] = useState<LawDocumentFile[]>(() => {
    const cached = getCachedDocuments();
    return cached.length > 0 ? cached : INITIAL_SAMPLE_FILES;
  });

  // Trạng thái đồng bộ Cloud Firestore
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Trạng thái modal
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<{
    type: 'file_manager' | 'firebase_modal' | 'api_key_modal';
    title: string;
  } | null>(null);

  // Trạng thái kết nối Firebase
  const [isFirebaseActive, setIsFirebaseActive] = useState(() => {
    return isRealFirebaseConfig(getActiveFirebaseConfig());
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const scrollRafId = useRef<number | null>(null);

  // =========================================================================
  // TỰ ĐỘNG CUỘN MƯỢT (SMOOTH SCROLL) THEO THỜI GIAN THỰC
  // =========================================================================
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollRafId.current) {
      cancelAnimationFrame(scrollRafId.current);
    }
    scrollRafId.current = requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  // =========================================================================
  // 1. ĐỒNG BỘ DỮ LIỆU TÀI LIỆU TOÀN HỆ THỐNG VỚI CLOUD FIRESTORE
  // =========================================================================
  useEffect(() => {
    console.log('[App] Khởi tạo lắng nghe đồng bộ tài liệu từ Firestore...');
    const unsubscribe = subscribeToFirestoreDocuments((docs, fromFirestore) => {
      if (docs.length > 0) {
        setUploadedFiles(docs);
      } else if (fromFirestore) {
        console.log('[App] Cloud Firestore chưa có tài liệu, tiến hành nạp tài liệu mẫu...');
        seedSampleDocumentsToFirestore().catch((err) => {
          console.warn('[App] Không thể nạp sample documents lên Cloud:', err);
        });
        setUploadedFiles(INITIAL_SAMPLE_FILES);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // =========================================================================
  // 2. BẢO VỆ MẬT KHẨU QUẢN TRỊ VIÊN (ADMIN AUTH)
  // =========================================================================
  const handleRequireAdmin = (
    type: 'file_manager' | 'firebase_modal' | 'api_key_modal',
    title: string
  ) => {
    if (isAdminLoggedIn) {
      if (type === 'file_manager') setIsFileManagerOpen(true);
      if (type === 'firebase_modal') setIsFirebaseModalOpen(true);
      if (type === 'api_key_modal') setIsApiKeyModalOpen(true);
    } else {
      setPendingAdminAction({ type, title });
      setIsAdminAuthModalOpen(true);
    }
  };

  const handleAdminAuthSuccess = () => {
    setIsAdminLoggedIn(true);
    if (pendingAdminAction) {
      if (pendingAdminAction.type === 'file_manager') setIsFileManagerOpen(true);
      if (pendingAdminAction.type === 'firebase_modal') setIsFirebaseModalOpen(true);
      if (pendingAdminAction.type === 'api_key_modal') setIsApiKeyModalOpen(true);
      setPendingAdminAction(null);
    }
  };

  const handleAdminLogout = () => {
    setAdminSession(false);
    setIsAdminLoggedIn(false);
    setIsFileManagerOpen(false);
    setIsFirebaseModalOpen(false);
    setIsApiKeyModalOpen(false);
  };

  // Quản lý API Key người dùng
  const handleSaveUserApiKey = (newKey: string) => {
    const trimmed = newKey.trim();
    setUserApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem(LOCAL_STORAGE_USER_API_KEY, trimmed);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_USER_API_KEY);
      }
    } catch (e) {
      console.error('Lỗi khi lưu user API key:', e);
    }
  };

  const handleClearUserApiKey = () => {
    setUserApiKey('');
    try {
      localStorage.removeItem(LOCAL_STORAGE_USER_API_KEY);
    } catch (e) {
      console.error('Lỗi khi xóa user API key:', e);
    }
  };

  // Hợp nhất nội dung các tài liệu thành Grounding Context cho Gemini AI
  const dynamicGroundingContext = useMemo(() => {
    const readyFiles = uploadedFiles.filter(
      (f) => f.status === 'ready' && f.extractedText && f.extractedText.trim().length > 0
    );

    if (readyFiles.length === 0) {
      return DEFAULT_KNOWLEDGE_BASE;
    }

    return readyFiles
      .map((file, index) => {
        const header = `=== TỆP TÀI LIỆU [${index + 1}/${readyFiles.length}]: "${file.name}" (Định dạng: ${file.type.toUpperCase()}, Dung lượng: ${Math.round(file.size / 1024)} KB, ${file.wordCount} từ, Người tải: ${file.uploadedBy || 'Admin'}) ===`;
        return `${header}\n${file.extractedText.trim()}`;
      })
      .join('\n\n=======================================================\n\n');
  }, [uploadedFiles]);

  // Tải lại lịch sử tin nhắn khi khởi động hoặc đổi session
  useEffect(() => {
    const fetchHistory = async () => {
      const history = await loadSessionMessages(sessionId);
      if (history.length > 0) {
        setMessages(history);
      } else {
        const activeFilesCount = uploadedFiles.filter((f) => f.status === 'ready').length;
        const filesNames = uploadedFiles
          .filter((f) => f.status === 'ready')
          .map((f) => `• \`${f.name}\``)
          .join('\n');

        const welcomeMessage: ChatMessage = {
          id: 'welcome_msg',
          sender: 'assistant',
          message: `Chào bạn! Tôi là **Trợ lý Pháp lý Lao Động** của công ty (chế độ phản hồi siêu tốc độ Flash).\n\nTôi đang đối chiếu và tra cứu trực tiếp từ **${activeFilesCount} tệp tài liệu** đã đồng bộ trên hệ thống:\n${filesNames}\n\nTôi có thể giải đáp chi tiết cho bạn về:\n- 📝 Hợp đồng lao động, thử việc và tiền lương.\n- ⏰ Giờ làm việc, làm việc từ xa (WFH), làm thêm giờ (OT).\n- 🏖️ Chế độ nghỉ phép năm, bảo lưu ngày phép và chế độ ốm đau/thai sản.\n- 🚪 Thủ tục, thời hạn báo trước và trợ cấp khi chấm dứt HĐLĐ.\n\nHãy gửi câu hỏi hoặc chọn các chủ đề gợi ý bên dưới để bắt đầu nhé!`,
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
  }, [messages.length, scrollToBottom]);

  const handleFirebaseConfigSaved = () => {
    setIsFirebaseActive(isRealFirebaseConfig(getActiveFirebaseConfig()));
  };

  // Thao tác với danh sách file trên Cloud Firestore
  const handleAddFiles = async (newFiles: LawDocumentFile[]) => {
    setIsCloudSyncing(true);
    try {
      await saveBatchDocumentsToFirestore(newFiles);
    } catch (err) {
      console.error('Lỗi khi lưu tài liệu lên Cloud Firestore:', err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    setIsCloudSyncing(true);
    try {
      await deleteDocumentFromFirestore(fileId);
    } catch (err) {
      console.error('Lỗi khi xóa tài liệu khỏi Cloud Firestore:', err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleClearAllFiles = async () => {
    setIsCloudSyncing(true);
    try {
      await clearAllDocumentsFromFirestore();
    } catch (err) {
      console.error('Lỗi khi xóa toàn bộ tài liệu trên Cloud Firestore:', err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleLoadSampleFiles = async () => {
    setIsCloudSyncing(true);
    try {
      await seedSampleDocumentsToFirestore();
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu mẫu lên Cloud Firestore:', err);
    } finally {
      setIsCloudSyncing(false);
    }
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
      sessionId,
    };
    setMessages([initialGreeting]);
    await saveMessage(initialGreeting);
    setIsConfirmClearOpen(false);
  };

  // =========================================================================
  // GỬI CÂU HỎI VỚI STREAMING GÕ CHỮ THỜI GIAN THỰC (FLASH SPEED)
  // =========================================================================
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if (!query || isLoading) return;

    // 1. Tạo tin nhắn của User
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      sender: 'user',
      message: query,
      timestamp: Date.now(),
      sessionId,
    };

    // 2. Tạo sẵn tin nhắn Assistant ở trạng thái Streaming để hiển thị ngay lập tức (0.1 giây)
    const aiMsgId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: 'assistant',
      message: '',
      timestamp: Date.now(),
      sessionId,
      isStreaming: true,
    };

    const updatedMessagesWithUser = [...messages, userMsg];
    setMessages([...updatedMessagesWithUser, initialAiMsg]);
    setInput('');
    setIsLoading(true);

    // Lưu tin nhắn User vào database
    saveMessage(userMsg);
    scrollToBottom('smooth');

    try {
      // 3. Khởi tạo luồng Streaming phản hồi
      const result = await streamLegalChatMessage({
        message: query,
        history: updatedMessagesWithUser,
        dynamicKnowledgeBase: dynamicGroundingContext,
        uploadedFiles,
        sessionId,
        userApiKey: userApiKey.trim() || undefined,
        onChunk: (accumulatedText) => {
          // Cập nhật từng từ / từng ký tự ngay lập tức (Typewriter effect)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, message: accumulatedText, isStreaming: true }
                : msg
            )
          );
          scrollToBottom('smooth');
        },
      });

      // 4. Khi luồng gõ chữ hoàn thành, đánh dấu isStreaming: false và lưu vào cơ sở dữ liệu
      const finalAiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        message: result.reply,
        timestamp: result.timestamp || Date.now(),
        sessionId,
        isStreaming: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMsgId ? finalAiMsg : msg))
      );
      saveMessage(finalAiMsg);
    } catch (error: any) {
      console.error('Lỗi khi trò chuyện với Trợ lý AI:', error);

      let cleanErrorText = error?.message || 'Đã có lỗi xảy ra.';
      if (error?.needsApiKey || cleanErrorText.includes('API_KEY') || cleanErrorText.includes('Chưa cấu hình API Key')) {
        handleRequireAdmin('api_key_modal', 'Cấu hình Gemini API Key');
      } else if (cleanErrorText.includes('503') || cleanErrorText.includes('high demand') || cleanErrorText.includes('UNAVAILABLE')) {
        cleanErrorText = 'Máy chủ AI hiện đang trong thời điểm quá tải yêu cầu tạm thời (503). Bạn vui lòng bấm nút "Thử lại" bên dưới sau vài giây.';
      } else if (cleanErrorText.includes('429') || cleanErrorText.includes('Quota exceeded') || cleanErrorText.includes('RESOURCE_EXHAUSTED')) {
        cleanErrorText = 'Hệ thống đã đạt giới hạn tần suất yêu cầu miễn phí (Rate Limit / Quota Exceeded). Bạn vui lòng đợi khoảng 15–20 giây rồi bấm nút **"Thử lại"** bên dưới, hoặc bấm nút **"⚙️ Cấu hình API Key"** để nhập mã API Key riêng từ Google AI Studio mà không bị gián đoạn.';
      }

      const errorMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        message: `⚠️ **Không thể kết nối đến Trợ lý AI:**\n\n${cleanErrorText}\n\n*Nếu vấn đề tiếp tục diễn ra, vui lòng liên hệ trực tiếp Phòng Nhân sự (HR).*`,
        timestamp: Date.now(),
        sessionId,
        isError: true,
        isStreaming: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMsgId ? errorMsg : msg))
      );
      saveMessage(errorMsg);
    } finally {
      setIsLoading(false);
      scrollToBottom('smooth');
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
      {/* Header Thanh công cụ */}
      <Header
        onNewChat={() => setIsConfirmClearOpen(true)}
        onOpenFileManager={() => handleRequireAdmin('file_manager', 'Quản lý File Luật & Nội quy')}
        onOpenFirebase={() => handleRequireAdmin('firebase_modal', 'Cơ sở dữ liệu Cloud Firestore')}
        onOpenApiKey={() => handleRequireAdmin('api_key_modal', 'Cấu hình Gemini API Key')}
        isFirebaseActive={isFirebaseActive}
        hasCustomApiKey={Boolean(userApiKey)}
        messageCount={messages.length}
        fileCount={readyFilesCount}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
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
              onClick={() => handleRequireAdmin('file_manager', 'Quản lý File Luật & Nội quy')}
              className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-xs hover:underline flex-shrink-0 cursor-pointer"
            >
              {isAdminLoggedIn ? (
                <>
                  <Upload className="w-3 h-3" />
                  <span>{readyFilesCount > 0 ? 'Thêm / Xem file' : 'Tải file lên'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Quản lý File</span>
                </>
              )}
            </button>
          </div>

          {/* Lịch sử tin nhắn (Hiển thị mượt mà khi đang Streaming gõ chữ) */}
          {messages.map((msg, index) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onRetry={msg.isError ? () => handleRetryMessage(index) : undefined}
              onOpenApiKey={() => handleRequireAdmin('api_key_modal', 'Cấu hình Gemini API Key')}
            />
          ))}

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
        onOpenFileUpload={() => handleRequireAdmin('file_manager', 'Quản lý File Luật & Nội quy')}
      />

      {/* Modal Quản lý và Tải file Tài liệu */}
      <FileManagerModal
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        files={uploadedFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        onClearAllFiles={handleClearAllFiles}
        onLoadSampleFiles={handleLoadSampleFiles}
        isCloudSyncing={isCloudSyncing}
      />

      {/* Modal Cấu hình Firebase Firestore */}
      <FirebaseModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onConfigSaved={handleFirebaseConfigSaved}
      />

      {/* Modal Cấu hình Gemini API Key & Đổi mật khẩu Admin */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        savedApiKey={userApiKey}
        onSaveApiKey={handleSaveUserApiKey}
        onClearApiKey={handleClearUserApiKey}
      />

      {/* Modal Xác thực Quản trị viên */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => {
          setIsAdminAuthModalOpen(false);
          setPendingAdminAction(null);
        }}
        onSuccess={handleAdminAuthSuccess}
        targetFeatureName={pendingAdminAction?.title || 'Quản trị hệ thống'}
      />

      {/* Modal Xác nhận Tạo hội thoại mới */}
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
              Thao tác này sẽ làm mới phiên làm việc hiện tại và bắt đầu một cuộc hội thoại mới với Trợ lý Luật Lao động. Dữ liệu các tệp tài liệu trên Cloud Firestore vẫn được bảo lưu an toàn.
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
