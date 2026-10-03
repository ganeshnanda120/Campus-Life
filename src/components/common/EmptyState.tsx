import React from 'react';
import { FolderSearch } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state-icon">
        {icon || <FolderSearch size={28} />}
      </div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
};
