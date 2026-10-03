import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { faqService } from '../../services/faqService';
import type { CampusFAQ } from '../../types';

export const HelpCenterPage: React.FC = () => {
  const [faqs, setFaqs] = useState<CampusFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [helpfulMap, setHelpfulMap] = useState<Record<string, boolean>>({});

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await faqService.getFAQs(categoryFilter, searchTerm);
      setFaqs(data);
      if (data.length > 0 && !openId) {
        setOpenId(data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchTerm]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  const handleMarkHelpful = async (faqId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (helpfulMap[faqId]) return;

    await faqService.markHelpful(faqId);
    setHelpfulMap((prev) => ({ ...prev, [faqId]: true }));
    setFaqs((prev) =>
      prev.map((f) => (f.id === faqId ? { ...f, helpfulCount: (f.helpfulCount || 0) + 1 } : f))
    );
  };

  const categories = [
    'ALL',
    'Login & Account',
    'Attendance',
    'Requests',
    'Certificates',
    'Complaints',
    'Gate Pass',
    'Hostel',
    'Mess',
    'Notices',
    'Exams',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Campus Help Center & FAQs</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Standard Operating Procedures (SOPs) and institutional guidelines for student and staff workflows.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search frequently asked questions, certificate requirements, or gate pass rules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            paddingLeft: '2.75rem',
            height: '50px',
            fontSize: '1rem',
            borderRadius: 'var(--radius-lg)',
          }}
        />
        <Search
          size={20}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className="btn-ghost"
            onClick={() => setCategoryFilter(cat)}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.825rem',
              fontWeight: categoryFilter === cat ? 600 : 500,
              backgroundColor: categoryFilter === cat ? 'var(--brand-primary)' : 'var(--bg-subtle)',
              color: categoryFilter === cat ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat === 'ALL' ? 'All Questions' : cat}
          </button>
        ))}
      </div>

      {/* Accordion FAQ List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading help center articles...
          </div>
        ) : faqs.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              No help articles found matching your query. Check the Service Directory for office contact details.
            </p>
          </div>
        ) : (
          faqs.map((faq) => {
            const isOpen = openId === faq.id;
            const isHelpful = helpfulMap[faq.id];

            return (
              <div key={faq.id} className="card" style={{ overflow: 'hidden' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => toggleAccordion(faq.id)}
                  style={{
                    width: '100%',
                    padding: '1.15rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    borderRadius: 0,
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <Badge variant="neutral" style={{ flexShrink: 0 }}>
                      {faq.category}
                    </Badge>
                    <span style={{ fontWeight: 600, fontSize: '0.975rem', color: 'var(--text-primary)' }}>
                      {faq.question}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp size={18} style={{ flexShrink: 0 }} /> : <ChevronDown size={18} style={{ flexShrink: 0 }} />}
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 1.25rem 1.25rem 1.25rem',
                      borderTop: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.925rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.65,
                        margin: '1rem 0 0.75rem 0',
                      }}
                    >
                      {faq.answer}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {faq.tags?.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg-subtle)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={(e) => handleMarkHelpful(faq.id, e)}
                        style={{
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: isHelpful ? 'var(--brand-primary)' : 'var(--text-muted)',
                          padding: '0.2rem 0.5rem',
                        }}
                      >
                        <ThumbsUp size={14} />
                        <span>{isHelpful ? 'Marked helpful' : 'Helpful'} ({faq.helpfulCount || 0})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
