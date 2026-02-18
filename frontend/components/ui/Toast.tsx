import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from "../../utils/cn";

export interface ToastMessage {
  success: boolean;
  message: string;
}

interface ToastProps {
  message: ToastMessage | null;
  title?: { success: string; error: string };
}

const Toast: React.FC<ToastProps> = ({ message, title }) => {
  if (!message) {
    return null;
  }

  const defaultTitle = title || { success: 'Success', error: 'Error' };

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={cn(
        "min-w-[300px] max-w-[400px] p-4 rounded-lg border shadow-lg backdrop-blur-sm flex items-start gap-3",
        message.success
          ? "bg-emerald-500 border-emerald-400/50 text-white"
          : "bg-destructive border-destructive/50 text-destructive-foreground"
      )}>
        {message.success ? (
          <Check size={20} className="flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            {message.success ? defaultTitle.success : defaultTitle.error}
          </div>
          <div className="text-xs opacity-90 mt-1 break-words">{message.message}</div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
