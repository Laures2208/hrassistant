/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Database, Check, ExternalLink, ShieldAlert, Key } from 'lucide-react';
import { FirebaseConfigType } from '../types';
import { 
  getActiveFirebaseConfig, 
  saveActiveFirebaseConfig, 
  isRealFirebaseConfig,
  DEFAULT_FIREBASE_CONFIG
} from '../config/firebaseConfig';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<FirebaseConfigType>(getActiveFirebaseConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const isReal = isRealFirebaseConfig(config);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveActiveFirebaseConfig(config);
    setSavedSuccess(true);
    onConfigSaved();
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  const handleResetToDefault = () => {
    setConfig(DEFAULT_FIREBASE_CONFIG);
    saveActiveFirebaseConfig(DEFAULT_FIREBASE_CONFIG);
    onConfigSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isReal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Cấu Hình Firebase Firestore
              </h3>
              <p className="text-xs text-slate-500">
                Lưu trữ vĩnh viễn nhật ký tin nhắn ({`sender, message, timestamp, sessionId`})
              </p>
            </div>
          </div>
          <button
            id="close-fb-modal-button"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trạng thái hiện tại */}
        <div className={`px-6 py-3 border-b flex items-start gap-3 ${
          isReal 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
            : 'bg-amber-50 border-amber-100 text-amber-900'
        }`}>
          {isReal ? (
            <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-semibold">
              {isReal 
                ? 'Đã cấu hình Firebase thành công!' 
                : 'Đang dùng bộ lưu trữ Cục bộ (Local Storage)'}
            </p>
            <p className="text-slate-600 mt-0.5">
              {isReal
                ? 'Các tin nhắn mới sẽ được đồng bộ trực tiếp lên Cloud Firestore collection `chat_messages`.'
                : 'Dữ liệu trò chuyện đang được lưu an toàn trong trình duyệt của bạn. Để đồng bộ lên Cloud Firestore, bạn chỉ cần điền cấu hình Firebase thật vào form bên dưới.'}
            </p>
          </div>
        </div>

        {/* Form nhập cấu hình */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              Thông số cấu hình Firebase (firebaseConfig)
            </span>
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Mở Firebase Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="font-medium text-slate-700 block mb-1">apiKey:</label>
              <input
                id="fb-input-apiKey"
                type="text"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">projectId:</label>
              <input
                id="fb-input-projectId"
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                placeholder="my-company-project"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">authDomain:</label>
              <input
                id="fb-input-authDomain"
                type="text"
                value={config.authDomain}
                onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
                placeholder="my-project.firebaseapp.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">storageBucket:</label>
              <input
                id="fb-input-storageBucket"
                type="text"
                value={config.storageBucket}
                onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
                placeholder="my-project.appspot.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">messagingSenderId:</label>
              <input
                id="fb-input-messagingSenderId"
                type="text"
                value={config.messagingSenderId}
                onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
                placeholder="123456789012"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">appId:</label>
              <input
                id="fb-input-appId"
                type="text"
                value={config.appId}
                onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                placeholder="1:123456789012:web:..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">💡 Lưu ý:</span> Bạn cũng có thể điền thông số này trực tiếp vào file cấu hình tách biệt <code className="px-1 py-0.5 bg-slate-200 rounded font-mono text-slate-800">src/config/firebaseConfig.ts</code> hoặc file môi trường <code className="px-1 py-0.5 bg-slate-200 rounded font-mono text-slate-800">.env</code>.
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2 border border-emerald-200">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Đã lưu cấu hình Firebase! Hệ thống sẽ thử kết nối khi có tin nhắn mới.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Khôi phục mẫu mặc định
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer font-medium"
              >
                Hủy
              </button>
              <button
                id="save-firebase-config-btn"
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
