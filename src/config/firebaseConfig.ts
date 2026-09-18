/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * =========================================================================
 * CẤU HÌNH FIREBASE FIRESTORE (LƯU TRỮ LỊCH SỬ CHAT)
 * =========================================================================
 * Bạn có thể điền trực tiếp thông tin Firebase của dự án vào bên dưới,
 * hoặc cấu hình qua các biến môi trường VITE_FIREBASE_* trong file .env.
 * 
 * Hướng dẫn lấy cấu hình Firebase:
 * 1. Truy cập: https://console.firebase.google.com
 * 2. Tạo dự án mới hoặc chọn dự án hiện có.
 * 3. Thêm Web App (biểu tượng </>) và copy firebaseConfig vào đây.
 * 4. Vào Cloud Firestore > Create Database (ở chế độ Test mode hoặc Production).
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
 * CẤU HÌNH MẪU CỦA BẠN - ĐIỀN CÁC THÔNG SỐ THẬT VÀO ĐÂY:
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigType = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyYOUR_SAMPLE_API_KEY_HERE",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "your-company-labor-assistant.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "your-company-labor-assistant",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "your-company-labor-assistant.appspot.com",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "123456789012",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:123456789012:web:abcdef1234567890"
};

const LOCAL_STORAGE_FIREBASE_KEY = 'labor_law_firebase_custom_config';
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
      return JSON.parse(saved);
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
    firestoreDb = getFirestore(firebaseApp);
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
