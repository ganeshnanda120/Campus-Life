import React from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Info,
  type LucideIcon
} from 'lucide-react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: LucideIcon | React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
  size = 'md',
  className = '',
  style,
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle size={12} aria-hidden="true" />;
      case 'warning':
        return <Clock size={12} aria-hidden="true" />;
      case 'danger':
        return <AlertCircle size={12} aria-hidden="true" />;
      case 'info':
        return <Info size={12} aria-hidden="true" />;
      default:
        return null;
    }
  };

  const renderIcon = () => {
    if (!icon && variant === 'neutral') return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return <IconComponent size={12} aria-hidden="true" />;
    }
    return getDefaultIcon();
  };

  return (
    <span
      className={`badge badge-${variant} ${size === 'sm' ? 'text-xs py-0.5 px-1.5' : ''} ${className}`.trim()}
      style={style}
    >
      {renderIcon()}
      <span>{children}</span>
    </span>
  );
};
