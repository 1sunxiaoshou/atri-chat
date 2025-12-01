import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  success: boolean;
  message: string;
}

interface ToastProps {
  message: ToastMessage | null;
  title?: { success: string; error: string };
}

const Toast: React.FC<ToastProps> = ({ message, title }) => {
  if (!message) return null;

  const defaultTitle = title || { success: '成功', error: '失败' };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`min-w-[300px] max-w-[400px] p-4 rounded-lg border shadow-lg backdrop-blur-sm flex items-start gap-3 ${
        message.success
          ? 'bg-green-500/90 border-green-400/50 text-white'
          : 'bg-red-500/90 border-red-400/50 text-white'
      }`}>
        {message.success ? (
          <Check size={20} className="flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold">
            {message.success ? defaultTitle.success : defaultTitle.error}
          </div>
          <div className="text-sm opacity-90 mt-1 break-words">{message.message}</div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
