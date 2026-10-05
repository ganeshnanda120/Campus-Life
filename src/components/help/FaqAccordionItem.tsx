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
      className="bg-white rounded-xl border border-slate-200 shadow-sm mb-3 overflow-hidden transition-all duration-200 hover:border-slate-300"
      style={{
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-default, #e2e8f0)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        marginBottom: '0.75rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* 2. Header Container with clean spacing to prevent text collision */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 sm:px-5 sm:py-4 cursor-pointer select-none"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Horizontal flexbox with clean gap: Category badge + Question */}
        <div
          className="flex items-center gap-3 sm:gap-4 flex-1 pr-4"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flex: 1,
            paddingRight: '1rem',
            minWidth: 0,
          }}
        >
          {/* Category Badge Pill with distinct breathing room */}
          <span
            className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200"
            style={{
              flexShrink: 0,
              padding: '0.3rem 0.75rem',
              fontSize: '0.78rem',
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
            className="text-sm sm:text-base font-semibold text-slate-800 leading-snug m-0"
            style={{
              fontSize: '0.975rem',
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
          className="text-slate-400 shrink-0 transition-transform duration-200"
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

      {/* 3. Clean Expanded Answer View */}
      {isOpen && (
        <div
          className="border-t border-slate-100 px-5 pt-3 pb-4 bg-slate-50/50"
          style={{
            borderTop: '1px solid var(--border-subtle, #f1f5f9)',
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--bg-canvas, rgba(248, 250, 252, 0.5))',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step-by-step SOP Answer Body */}
          <p
            className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3"
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.65,
              margin: '0 0 1rem 0',
            }}
          >
            {faq.answer}
          </p>

          {/* Footer Actions Row */}
          <div
            className="flex items-center justify-between pt-2 border-t border-slate-100/80"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle, rgba(241, 245, 249, 0.8))',
              gap: '0.75rem',
            }}
          >
            {/* Left: Quick Portal Action Link */}
            {quickAction ? (
              <Link
                to={quickAction.to}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium inline-flex items-center gap-1"
                style={{
                  color: 'var(--brand-primary, #2563eb)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  textDecoration: 'none',
                }}
              >
                <span>{quickAction.label} →</span>
              </Link>
            ) : (
              <div />
            )}

            {/* Right: Neat Ghost Button for Real Helpful Feedback */}
            <button
              type="button"
              onClick={(e) => onMarkHelpful(faq.id, e)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.625rem',
                borderRadius: '0.375rem',
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
