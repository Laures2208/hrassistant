/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * =========================================================================
 * CẤU HÌNH FIREBASE FIRESTORE (LƯU TRỮ VÀ ĐỒNG BỘ TÀI LIỆU & LỊCH SỬ CHAT)
 * =========================================================================
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  Firestore 
} from 'firebase/firestore';
import { ChatMessage, FirebaseConfigType } from '../types';

/**
 * CẤU HÌNH FIREBASE ĐƯỢC CẤP PHÁT CHO DỰ ÁN
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigType = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyCciWWvtEJ1lMCn-c7y7LoEouMoH7UVYLQ",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "celtic-mystery-89pl1.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "celtic-mystery-89pl1",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "celtic-mystery-89pl1.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "465768180437",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:465768180437:web:4f94f6915f2d1415f1905c",
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || "ai-studio-trllutlaong-017f8753-3417-482c-b7ca-d48715c17cff",
};

const LOCAL_STORAGE_FIREBASE_KEY = 'labor_law_firebase_custom_config_v2';
const LOCAL_STORAGE_CHAT_KEY = 'labor_law_chat_history_backup_';

// Kiểm tra xem cấu hình có phải là key thực hay là placeholder mẫu
export function isRealFirebaseConfig(config: FirebaseConfigType): boolean {
  if (!config || !config.apiKey || !config.projectId) return false;
  const isPlaceholder = 
    config.apiKey.includes("YOUR_SAMPLE_API_KEY") ||
    config.projectId.includes("your-company-labor") ||
    config.apiKey.length < 15;
  return !isPlaceholder;
}

// Lấy cấu hình hiện tại (ưu tiên cấu hình người dùng đã lưu nếu có)
export function getActiveFirebaseConfig(): FirebaseConfigType {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_FIREBASE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// Lưu cấu hình tùy chỉnh vào localStorage
export function saveActiveFirebaseConfig(config: FirebaseConfigType) {
  try {
    localStorage.setItem(LOCAL_STORAGE_FIREBASE_KEY, JSON.stringify(config));
    // Reset cached instance
    firestoreDb = null;
    firebaseApp = null;
  } catch (err) {
    console.error("Không thể lưu cấu hình Firebase vào LocalStorage:", err);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function getFirestoreInstance(): Firestore | null {
  const config = getActiveFirebaseConfig();
  if (!isRealFirebaseConfig(config)) {
    return null;
  }

  if (firestoreDb) return firestoreDb;

  try {
    const apps = getApps();
    firebaseApp = apps.length > 0 ? apps[0] : initializeApp(config);
    
    // Nếu có firestoreDatabaseId tùy chỉnh, sử dụng databaseId đó
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId);
    } else {
      firestoreDb = getFirestore(firebaseApp);
    }
    return firestoreDb;
  } catch (error) {
    console.warn("Khởi tạo Firebase thất bại (sử dụng chế độ lưu cục bộ):", error);
    return null;
  }
}

/**
 * Lưu tin nhắn vào Firestore (kèm sao lưu LocalStorage)
 */
export async function saveMessage(message: ChatMessage): Promise<{ success: boolean; firestore: boolean }> {
  // Luôn luôn sao lưu cục bộ vào LocalStorage để người dùng không bị mất dữ liệu
  try {
    const localKey = LOCAL_STORAGE_CHAT_KEY + message.sessionId;
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    existing.push(message);
    localStorage.setItem(localKey, JSON.stringify(existing));
  } catch (err) {
    console.warn("Lỗi sao lưu LocalStorage:", err);
  }

  // Nếu có Firestore hợp lệ, đồng bộ lên Cloud
  const db = getFirestoreInstance();
  if (!db) {
    return { success: true, firestore: false };
  }

  try {
    const chatCollection = collection(db, 'chat_messages');
    await addDoc(chatCollection, {
      id: message.id,
      sender: message.sender,
      message: message.message,
      timestamp: message.timestamp,
      sessionId: message.sessionId,
      createdAt: new Date(message.timestamp)
    });
    return { success: true, firestore: true };
  } catch (error) {
    console.error("Lỗi khi ghi dữ liệu lên Firestore:", error);
    return { success: true, firestore: false };
  }
}

/**
 * Lấy lịch sử tin nhắn của phiên làm việc
 */
export async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const db = getFirestoreInstance();
  if (db) {
    try {
      const chatCollection = collection(db, 'chat_messages');
      const q = query(
        chatCollection,
        where('sessionId', '==', sessionId),
        orderBy('timestamp', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const messages: ChatMessage[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        messages.push({
          id: data.id || docSnap.id,
          sender: data.sender,
          message: data.message,
          timestamp: data.timestamp,
          sessionId: data.sessionId
        });
      });

      if (messages.length > 0) {
        return messages;
      }
    } catch (error) {
      console.warn("Không thể tải từ Firestore, chuyển sang đọc từ LocalStorage:", error);
    }
  }

  // Fallback về LocalStorage
  try {
    const localKey = LOCAL_STORAGE_CHAT_KEY + sessionId;
    const stored = localStorage.getItem(localKey);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Lỗi đọc LocalStorage:", err);
  }

  return [];
}

/**
 * Xóa lịch sử phiên trò chuyện
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  // Xóa LocalStorage
  try {
    localStorage.removeItem(LOCAL_STORAGE_CHAT_KEY + sessionId);
  } catch (err) {
    console.warn("Lỗi xóa LocalStorage:", err);
  }

  // Xóa Firestore
  const db = getFirestoreInstance();
  if (!db) return;

  try {
    const chatCollection = collection(db, 'chat_messages');
    const q = query(chatCollection, where('sessionId', '==', sessionId));
    const querySnapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'chat_messages', docSnap.id)));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Lỗi xóa phiên chat trên Firestore:", error);
  }
}
