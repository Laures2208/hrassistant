/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DỊCH VỤ ĐỒNG BỘ TÀI LIỆU TOÀN HỆ THỐNG QUA FIREBASE FIRESTORE
 * Quản lý thêm, sửa, xóa, và lắng nghe dữ liệu tài liệu (Dynamic Grounding Context)
 * đồng bộ real-time giữa tất cả các máy tính và thiết bị người dùng.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { LawDocumentFile } from '../types';
import { getFirestoreInstance } from '../config/firebaseConfig';
import { INITIAL_SAMPLE_FILES } from '../data/sampleLawFiles';

const COLLECTION_NAME = 'documents';
const LOCAL_STORAGE_CACHE_KEY = 'labor_law_firestore_documents_cache_v2';

/**
 * Đọc danh sách tài liệu từ cache LocalStorage (Dự phòng khi offline / mạng chậm)
 */
export function getCachedDocuments(): LawDocumentFile[] {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc cache tài liệu:', err);
  }
  return [];
}

/**
 * Lưu cache tài liệu vào LocalStorage
 */
export function setCachedDocuments(docs: LawDocumentFile[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.warn('Lỗi ghi cache tài liệu:', err);
  }
}

/**
 * Lắng nghe thay đổi tài liệu Real-time từ Firestore (Đồng bộ tức thì cho tất cả máy truy cập)
 */
export function subscribeToFirestoreDocuments(
  onUpdate: (docs: LawDocumentFile[], fromFirestore: boolean) => void,
  onError?: (error: any) => void
): () => void {
  const db = getFirestoreInstance();

  if (!db) {
    console.warn('[Firestore] Chưa khởi tạo Firestore, sử dụng bộ nhớ cục bộ.');
    const localDocs = getCachedDocuments();
    onUpdate(localDocs.length > 0 ? localDocs : INITIAL_SAMPLE_FILES, false);
    return () => {};
  }

  try {
    const docsRef = collection(db, COLLECTION_NAME);
    const q = query(docsRef, orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents: LawDocumentFile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LawDocumentFile;
          documents.push({
            ...data,
            id: docSnap.id,
          });
        });

        console.log(`[Firestore] Đã đồng bộ ${documents.length} tài liệu từ Cloud.`);
        setCachedDocuments(documents);

        if (documents.length > 0) {
          onUpdate(documents, true);
        } else {
          // Khi trên Firestore chưa có file nào, trả về mảng rỗng để App quyết định dùng Sample Data
          onUpdate([], true);
        }
      },
      (error) => {
        console.error('[Firestore] Lỗi lắng nghe Real-time documents:', error);
        if (onError) onError(error);
        const cached = getCachedDocuments();
        onUpdate(cached.length > 0 ? cached : INITIAL_SAMPLE_FILES, false);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('[Firestore] Không thể đăng ký Real-time listener:', error);
    const cached = getCachedDocuments();
    onUpdate(cached.length > 0 ? cached : INITIAL_SAMPLE_FILES, false);
    return () => {};
  }
}

/**
 * Tải danh sách tài liệu từ Firestore 1 lần
 */
export async function fetchFirestoreDocuments(): Promise<LawDocumentFile[]> {
  const db = getFirestoreInstance();
  if (!db) {
    const cached = getCachedDocuments();
    return cached.length > 0 ? cached : INITIAL_SAMPLE_FILES;
  }

  try {
    const docsRef = collection(db, COLLECTION_NAME);
    const q = query(docsRef, orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);
    const documents: LawDocumentFile[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as LawDocumentFile;
      documents.push({
        ...data,
        id: docSnap.id,
      });
    });

    if (documents.length > 0) {
      setCachedDocuments(documents);
      return documents;
    }
    return [];
  } catch (err) {
    console.error('[Firestore] Lỗi fetch documents:', err);
    const cached = getCachedDocuments();
    return cached.length > 0 ? cached : INITIAL_SAMPLE_FILES;
  }
}

/**
 * Lưu 1 tài liệu vào Firestore
 */
export async function saveDocumentToFirestore(documentFile: LawDocumentFile): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) {
    console.warn('[Firestore] Lưu tạm tài liệu vào LocalStorage do chưa kết nối Firestore.');
    const current = getCachedDocuments();
    const updated = [documentFile, ...current.filter((d) => d.id !== documentFile.id)];
    setCachedDocuments(updated);
    return;
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, documentFile.id);
    await setDoc(docRef, {
      id: documentFile.id,
      name: documentFile.name,
      size: documentFile.size,
      type: documentFile.type,
      extractedText: documentFile.extractedText,
      characterCount: documentFile.characterCount,
      wordCount: documentFile.wordCount,
      uploadedAt: documentFile.uploadedAt,
      status: documentFile.status,
      errorMessage: documentFile.errorMessage || '',
      uploadedBy: documentFile.uploadedBy || 'Admin',
    });
    console.log(`[Firestore] Đã lưu thành công file "${documentFile.name}" lên Cloud.`);
  } catch (error) {
    console.error(`[Firestore] Lỗi khi lưu file "${documentFile.name}":`, error);
    throw error;
  }
}

/**
 * Lưu nhiều tài liệu vào Firestore cùng lúc
 */
export async function saveBatchDocumentsToFirestore(documents: LawDocumentFile[]): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) {
    const current = getCachedDocuments();
    const existingIds = new Set(documents.map((d) => d.id));
    const merged = [...documents, ...current.filter((d) => !existingIds.has(d.id))];
    setCachedDocuments(merged);
    return;
  }

  try {
    const batch = writeBatch(db);
    for (const d of documents) {
      const docRef = doc(db, COLLECTION_NAME, d.id);
      batch.set(docRef, {
        id: d.id,
        name: d.name,
        size: d.size,
        type: d.type,
        extractedText: d.extractedText,
        characterCount: d.characterCount,
        wordCount: d.wordCount,
        uploadedAt: d.uploadedAt,
        status: d.status,
        errorMessage: d.errorMessage || '',
        uploadedBy: d.uploadedBy || 'Admin',
      });
    }
    await batch.commit();
    console.log(`[Firestore] Đã lưu ${documents.length} tài liệu lên Cloud.`);
  } catch (error) {
    console.error('[Firestore] Lỗi lưu batch documents:', error);
    throw error;
  }
}

/**
 * Xóa 1 tài liệu khỏi Firestore
 */
export async function deleteDocumentFromFirestore(documentId: string): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) {
    const current = getCachedDocuments();
    setCachedDocuments(current.filter((d) => d.id !== documentId));
    return;
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, documentId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Đã xóa tài liệu ${documentId} khỏi Cloud.`);
  } catch (error) {
    console.error(`[Firestore] Lỗi khi xóa tài liệu ${documentId}:`, error);
    throw error;
  }
}

/**
 * Xóa toàn bộ tài liệu khỏi Firestore
 */
export async function clearAllDocumentsFromFirestore(): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) {
    setCachedDocuments([]);
    return;
  }

  try {
    const docsRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(docsRef);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    setCachedDocuments([]);
    console.log('[Firestore] Đã xóa toàn bộ tài liệu trên Cloud.');
  } catch (error) {
    console.error('[Firestore] Lỗi khi xóa toàn bộ tài liệu:', error);
    throw error;
  }
}

/**
 * Nạp dữ liệu tài liệu mẫu (Bộ luật Lao động 2019 & Nội quy mẫu) lên Firestore
 */
export async function seedSampleDocumentsToFirestore(): Promise<void> {
  await saveBatchDocumentsToFirestore(INITIAL_SAMPLE_FILES);
}
