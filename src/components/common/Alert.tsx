import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'danger';
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  variant = 'info',
  title,
  children,
  onClose,
  onDismiss,
  dismissible,
  className = '',
}) => {
  const alertType = type || variant;
  const handleDismiss = onDismiss || onClose;
  const getIcon = () => {
    switch (alertType) {
      case 'success':
        return <CheckCircle2 size={20} aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle size={20} aria-hidden="true" />;
      case 'danger':
        return <AlertCircle size={20} aria-hidden="true" />;
      case 'info':
      default:
        return <Info size={20} aria-hidden="true" />;
    }
  };

  return (
    <div className={`alert alert-${alertType} ${className}`.trim()} role="alert">
      <div style={{ flexShrink: 0, marginTop: title ? 2 : 0 }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{title}</div>}
        <div style={{ fontSize: '0.9rem' }}>{children}</div>
      </div>
      {(handleDismiss || dismissible) && (
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          style={{ width: 28, height: 28, padding: 4 }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
