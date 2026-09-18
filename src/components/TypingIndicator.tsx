/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scale } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div id="typing-indicator" className="flex items-start gap-3 py-2 px-1">
      {/* Avatar AI */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
          <Scale className="w-4 h-4 animate-pulse" />
        </div>
      </div>

      {/* Bubble hiệu ứng đang suy nghĩ */}
      <div className="bg-white text-slate-700 border border-slate-200/90 rounded-2xl rounded-tl-xs p-3.5 shadow-xs flex items-center gap-3">
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
        </div>
        <span className="text-xs text-slate-500 font-medium tracking-tight">
          Đang đọc tài liệu và suy nghĩ...
        </span>
      </div>
    </div>
  );
};
