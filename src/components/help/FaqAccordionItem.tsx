import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ThumbsUp } from 'lucide-react';
import type { CampusFAQ } from '../../types';

export interface FaqAccordionItemProps {
  faq: CampusFAQ;
  isOpen: boolean;
  onToggle: () => void;
  isHelpful?: boolean;
  onMarkHelpful: (faqId: string, e: React.MouseEvent) => void;
}

export const getQuickAction = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('request') || cat.includes('certificate')) {
    return { label: 'Go to Request Portal', to: '/student/requests' };
  }
  if (cat.includes('gate') || cat.includes('pass')) {
    return { label: 'Go to Gate Pass Module', to: '/student/gate-pass' };
  }
  if (cat.includes('attend')) {
    return { label: 'Check Attendance Portal', to: '/student/attendance' };
  }
  if (cat.includes('complaint')) {
    return { label: 'Report an Issue / SLA', to: '/student/complaints' };
  }
  if (cat.includes('mess')) {
    return { label: 'View Dining Menu', to: '/student/mess' };
  }
  if (cat.includes('hostel')) {
    return { label: 'Hostel Operations Portal', to: '/student/hostel' };
  }
  if (cat.includes('notice')) {
    return { label: 'View Notices & Circulars', to: '/notices' };
  }
  return null;
};

export const FaqAccordionItem: React.FC<FaqAccordionItemProps> = ({
  faq,
  isOpen,
  onToggle,
  isHelpful = false,
  onMarkHelpful,
}) => {
  const quickAction = getQuickAction(faq.category);

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderRadius: 'var(--radius-md, 0.75rem)',
        border: '1px solid var(--border-default, #e2e8f0)',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '0.75rem',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
        padding: 0,
      }}
    >
      {/* Header Container with clean spacing to prevent text collision */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.15rem 1.35rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Horizontal flexbox with clean gap: Category badge + Question */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flex: 1,
            paddingRight: '1rem',
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          {/* Category Badge Pill with distinct breathing room */}
          <span
            style={{
              flexShrink: 0,
              padding: '0.25rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '9999px',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              color: 'var(--text-secondary, #334155)',
              border: '1px solid var(--border-default, #e2e8f0)',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
            }}
          >
            {faq.category}
          </span>

          {/* Question Text */}
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary, #1e293b)',
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            {faq.question}
          </h3>
        </div>

        {/* Chevron Icon with 180° rotation on expansion */}
        <div
          style={{
            color: 'var(--text-muted, #94a3b8)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <ChevronDown size={20} />
        </div>
      </div>

      {/* Clean Expanded Answer View */}
      {isOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle, #f1f5f9)',
            padding: '1.15rem 1.35rem',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step-by-step SOP Answer Body */}
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.65,
              margin: '0 0 1rem 0',
            }}
          >
            {faq.answer}
          </p>

          {/* Footer Actions Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle, rgba(241, 245, 249, 0.8))',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Left: Quick Portal Action Link */}
            {quickAction ? (
              <Link
                to={quickAction.to}
                style={{
                  color: 'var(--brand-primary, #2563eb)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  textDecoration: 'none',
                }}
              >
                <span>{quickAction.label} &rarr;</span>
              </Link>
            ) : (
              <div />
            )}

            {/* Right: Helpful feedback button */}
            <button
              type="button"
              onClick={(e) => onMarkHelpful(faq.id, e)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: isHelpful ? 'var(--brand-primary, #1d4ed8)' : 'var(--text-muted, #64748b)',
                backgroundColor: isHelpful ? 'var(--brand-primary-light, #eff6ff)' : 'transparent',
                border: isHelpful ? '1px solid var(--border-default, #bfdbfe)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ThumbsUp size={13} className={isHelpful ? 'fill-current' : ''} />
              <span>
                {isHelpful ? 'Marked helpful' : 'Helpful'}
                {faq.helpfulCount && faq.helpfulCount > 0 ? ` (${faq.helpfulCount})` : ''}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
