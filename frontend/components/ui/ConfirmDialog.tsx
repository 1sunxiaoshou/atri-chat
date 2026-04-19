import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from "../../utils/cn"
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  closeOnOverlayClick?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  type = 'warning',
  isLoading = false,
  closeOnOverlayClick = true,
}) => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const resolvedConfirmText = confirmText ?? t('ui.confirm');
  const resolvedCancelText = cancelText ?? t('ui.cancel');

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      return undefined;
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) {
    return null;
  }

  const typeStyles = {
    danger: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      variant: 'destructive' as const,
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      variant: 'default' as const,
    },
    info: {
      icon: Info,
      color: 'text-blue-600 dark:text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      variant: 'default' as const,
    },
    success: {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      variant: 'default' as const,
    }
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && !isLoading) {
      onClose();
    }
  };

  const dialogContent = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200",
        isOpen ? "bg-background/80 backdrop-blur-sm opacity-100" : "bg-background/0 backdrop-blur-none opacity-0 pointer-events-none"
      )}
      onClick={handleOverlayClick}
    >
      <div
        className={cn(
          "w-full max-w-sm bg-background border border-border rounded-lg shadow-lg transform transition-all duration-200 ease-out",
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        )}
      >
        <div className="p-6 text-center relative">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-accent rounded-md disabled:opacity-50"
          >
            <X size={16} />
          </button>

          <div className={cn("mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4", style.bg)}>
            <Icon className={cn("w-6 h-6", style.color)} strokeWidth={2} />
          </div>

          {title && (
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {title}
            </h3>
          )}

          <div className="text-muted-foreground text-sm leading-relaxed mb-6 px-2">
            {description}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {resolvedCancelText}
            </Button>
            <Button
              variant={style.variant}
              onClick={async () => {
                await onConfirm();
                onClose();
              }}
              loading={isLoading}
            >
              {resolvedConfirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};
