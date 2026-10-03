import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  AlertTriangle,
  DoorOpen,
  Award,
  Calendar,
  HelpCircle,
  Building,
  Vote,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/useAuth';
import { searchService, type SearchResultItem } from '../../services/searchService';

export const UniversalSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('ALL');
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await searchService.performUniversalSearch(searchTerm, userProfile);
        setResults(hits);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, userProfile]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'notice':
        return <FileText size={18} style={{ color: 'var(--brand-primary)' }} />;
      case 'request':
        return <FileText size={18} style={{ color: 'var(--status-info)' }} />;
      case 'complaint':
        return <AlertTriangle size={18} style={{ color: 'var(--status-warning)' }} />;
      case 'gate_pass':
        return <DoorOpen size={18} style={{ color: 'var(--status-success)' }} />;
      case 'certificate':
        return <Award size={18} style={{ color: 'var(--brand-secondary, #6366f1)' }} />;
      case 'calendar':
        return <Calendar size={18} style={{ color: 'var(--brand-primary)' }} />;
      case 'lost_found':
        return <Compass size={18} style={{ color: 'var(--status-warning)' }} />;
      case 'service':
        return <Building size={18} style={{ color: 'var(--status-info)' }} />;
      case 'faq':
        return <HelpCircle size={18} style={{ color: 'var(--status-success)' }} />;
      case 'poll':
        return <Vote size={18} style={{ color: 'var(--brand-primary)' }} />;
      default:
        return <Search size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const filteredResults = results.filter((r) => {
    if (activeTypeFilter !== 'ALL' && r.type !== activeTypeFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Universal Campus Search</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Permission-scoped lookup across notices, calendar, requests, complaints, gate passes, directory, and FAQs.
        </p>
      </div>

      {/* Main Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by keyword, circular title, pass ID, request number, or office..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          style={{
            paddingLeft: '2.85rem',
            height: '52px',
            fontSize: '1.05rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        />
        <Search
          size={22}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
      </div>

      {/* Type Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
        {[
          { key: 'ALL', label: 'All Results' },
          { key: 'notice', label: 'Notices' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'request', label: 'Requests' },
          { key: 'complaint', label: 'Complaints' },
          { key: 'gate_pass', label: 'Gate Passes' },
          { key: 'service', label: 'Directory' },
          { key: 'faq', label: 'Help FAQs' },
          { key: 'lost_found', label: 'Lost & Found' },
          { key: 'poll', label: 'Polls' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="btn-ghost"
            onClick={() => setActiveTypeFilter(tab.key)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.825rem',
              fontWeight: activeTypeFilter === tab.key ? 600 : 500,
              backgroundColor: activeTypeFilter === tab.key ? 'var(--brand-primary)' : 'var(--bg-subtle)',
              color: activeTypeFilter === tab.key ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Matching Campus Records</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isSearching ? 'Searching...' : `${filteredResults.length} records found`}
          </span>
        </div>

        <div className="card-body">
          {isSearching ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Searching across institutional records...
            </div>
          ) : !searchTerm.trim() ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <Search size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', opacity: 0.5 }} />
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.925rem' }}>
                Type in search terms above to query notices, academic deadlines, services, or personal campus records.
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.925rem' }}>
                No records found matching "{searchTerm}" under the selected filter.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredResults.map((item) => (
                <div
                  key={`${item.type}_${item.id}`}
                  onClick={() => navigate(item.link)}
                  className="card card-interactive"
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getResultIcon(item.type)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.925rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.2rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Badge variant="neutral" style={{ textTransform: 'capitalize' }}>
                      {item.type.replace('_', ' ')}
                    </Badge>
                    {item.status && (
                      <Badge variant="info" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        {item.status}
                      </Badge>
                    )}
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
