/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  message: string;
  timestamp: number;
  sessionId: string;
  isError?: boolean;
  isStreaming?: boolean;
}

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export interface SuggestionTopic {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export interface LawDocumentFile {
  id: string;
  name: string;
  size: number; // bytes
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  extractedText: string;
  characterCount: number;
  wordCount: number;
  uploadedAt: number;
  status: 'ready' | 'processing' | 'error';
  errorMessage?: string;
  uploadedBy?: string;
}
