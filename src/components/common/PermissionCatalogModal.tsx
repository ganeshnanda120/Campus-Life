import React, { useState, useMemo } from 'react';
import { Search, Shield, Key, Layers, X } from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  type PermissionDefinition,
} from '../../services/permissionService';

interface PermissionCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionCatalogModal: React.FC<PermissionCatalogModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredPermissions = useMemo(() => {
    return ALL_PERMISSIONS.filter((perm) => {
      if (selectedCategory !== 'ALL' && perm.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          perm.label.toLowerCase().includes(q) ||
          perm.id.toLowerCase().includes(q) ||
          perm.category.toLowerCase().includes(q) ||
          perm.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  // Group filtered results by category
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionDefinition[]> = {};
    for (const cat of PERMISSION_CATEGORIES) {
      const items = filteredPermissions.filter((p) => p.category === cat);
      if (items.length > 0) {
        groups[cat] = items;
      }
    }
    return groups;
  }, [filteredPermissions]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Granular Permissions Catalog"
      size="large"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header Overview Banner */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary-light, #eff6ff)',
                color: 'var(--color-primary, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Key size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main, #0f172a)' }}>
                  Institutional Permission Registry
                </span>
                <Badge variant="info">
                  {ALL_PERMISSIONS.length} Permissions Available
                </Badge>
              </div>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                System-defined module-level capabilities delegable to Sub-Admins, Faculty, and Staff.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Category Filter Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search permissions by name, key, module, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
              aria-label="Search permissions catalog"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
                aria-label="Clear search query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ flex: '0 1 200px' }}>
            <select
              className="input-field"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter permissions by module"
            >
              <option value="ALL">All Modules ({ALL_PERMISSIONS.length})</option>
              {PERMISSION_CATEGORIES.map((cat) => {
                const count = ALL_PERMISSIONS.filter((p) => p.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Filter Summary Results count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
          <span>
            Showing <strong>{filteredPermissions.length}</strong> of <strong>{ALL_PERMISSIONS.length}</strong> permissions
          </span>
          {selectedCategory !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary, #2563eb)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              Reset Module Filter
            </button>
          )}
        </div>

        {/* Permissions List container */}
        <div
          style={{
            maxHeight: '52vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            paddingRight: '0.35rem',
          }}
        >
          {filteredPermissions.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px dashed var(--color-border, #cbd5e1)',
              }}
            >
              <Layers size={32} style={{ color: 'var(--color-text-muted, #94a3b8)', margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontWeight: 600, color: 'var(--color-text-main, #334155)', fontSize: '0.95rem' }}>
                No permissions matched your query
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                Try adjusting your search keywords or reset the module filter.
              </p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([category, items]) => (
              <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Category Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '0.35rem',
                    borderBottom: '1px solid var(--color-border, #e2e8f0)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={15} style={{ color: 'var(--color-primary, #2563eb)' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-main, #0f172a)' }}>
                      {category}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted, #64748b)' }}>
                    {items.length} {items.length === 1 ? 'capability' : 'capabilities'}
                  </span>
                </div>

                {/* Grid of Permission Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  {items.map((perm) => (
                    <div
                      key={perm.id}
                      style={{
                        padding: '0.85rem',
                        backgroundColor: 'var(--color-bg-surface, #ffffff)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main, #0f172a)' }}>
                          {perm.label}
                        </span>
                        <Badge variant="neutral" style={{ fontSize: '0.68rem', padding: '1px 6px', flexShrink: 0 }}>
                          {perm.category}
                        </Badge>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <code
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            backgroundColor: 'var(--color-bg-secondary, #f1f5f9)',
                            color: 'var(--color-primary, #2563eb)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border, #e2e8f0)',
                          }}
                        >
                          {perm.id}
                        </code>
                      </div>

                      <p
                        style={{
                          margin: '0.15rem 0 0 0',
                          fontSize: '0.78rem',
                          color: 'var(--color-text-muted, #64748b)',
                          lineHeight: 1.45,
                        }}
                      >
                        {perm.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            paddingTop: '0.85rem',
            marginTop: '0.25rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)' }}>
            Permissions can be assigned individually via Sub-Admin, Faculty, and Staff management.
          </span>
          <Button variant="outline" onClick={onClose}>
            Close Catalog
          </Button>
        </div>
      </div>
    </Modal>
  );
};
