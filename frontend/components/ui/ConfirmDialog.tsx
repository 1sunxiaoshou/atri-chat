import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, X, CheckCircle2, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: React.ReactNode; // 允许传入组件或HTML
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success'; // 新增 success 类型
  isLoading?: boolean; // 外部控制 loading 状态
  closeOnOverlayClick?: boolean; // 是否允许点击遮罩关闭
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
  closeOnOverlayClick = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // 处理动画挂载/卸载
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 锁定背景滚动
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200); // 等待动画结束
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 监听 ESC 键
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isLoading]);

  if (!isVisible && !isOpen) return null;

  // 样式配置
  const typeStyles = {
    danger: {
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-500/30',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 shadow-lg shadow-amber-500/30',
    },
    info: {
      icon: Info,
      color: 'text-blue-600 dark:text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-lg shadow-blue-500/30',
    },
    success: {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 shadow-lg shadow-emerald-500/30',
    }
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isOpen ? 'bg-black/40 backdrop-blur-sm opacity-100' : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
      }`}
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all duration-200 ease-out ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* 内容区 - 居中布局 */}
        <div className="p-6 text-center relative">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>

          {/* 图标 - 居中 */}
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${style.bg}`}>
            <Icon className={`w-7 h-7 ${style.color}`} strokeWidth={2} />
          </div>

          {/* 标题 */}
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
          )}

          {/* 描述 */}
          <div className="text-gray-600 dark:text-gray-400 text-[15px] leading-relaxed mb-6 px-2">
            {description}
          </div>

          {/* 按钮区 - 网格布局 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98] ${style.button}`}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};