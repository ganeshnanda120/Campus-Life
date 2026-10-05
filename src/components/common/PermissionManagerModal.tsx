import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Shield,
  Check,
  X,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  type PermissionDefinition,
} from '../../services/permissionService';
import type { UserRecord, UserPermission } from '../../types';

interface PermissionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserRecord | null;
  onSavePermissions: (newPermissions: UserPermission[]) => Promise<boolean | void>;
}

export const PermissionManagerModal: React.FC<PermissionManagerModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSavePermissions,
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<UserPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when target user changes or modal opens
  useEffect(() => {
    if (targetUser) {
      setSelectedPermissions(targetUser.permissions || []);
      setSearchQuery('');
      setStatusFilter('ALL');
      setSelectedCategory('ALL');
      setErrorMessage(null);
    }
  }, [targetUser, isOpen]);

  // Toggle single permission
  const handleToggle = (permId: UserPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Select all permissions
  const handleSelectAll = () => {
    setSelectedPermissions(ALL_PERMISSIONS.map((p) => p.id));
  };

  // Clear all permissions
  const handleClearAll = () => {
    setSelectedPermissions([]);
  };

  // Select all permissions in category
  const handleSelectCategory = (category: string) => {
    const categoryPermIds = ALL_PERMISSIONS.filter((p) => p.category === category).map((p) => p.id);
    setSelectedPermissions((prev) => Array.from(new Set([...prev, ...categoryPermIds])));
  };

  // Clear all permissions in category
  const handleClearCategory = (category: string) => {
    const categoryPermIds = ALL_PERMISSIONS.filter((p) => p.category === category).map((p) => p.id);
    setSelectedPermissions((prev) => prev.filter((p) => !categoryPermIds.includes(p)));
  };

  // Filtered permissions list
  const filteredPermissions = useMemo(() => {
    return ALL_PERMISSIONS.filter((perm) => {
      const isAssigned = selectedPermissions.includes(perm.id);

      // Status Filter
      if (statusFilter === 'ASSIGNED' && !isAssigned) return false;
      if (statusFilter === 'UNASSIGNED' && isAssigned) return false;

      // Category Filter
      if (selectedCategory !== 'ALL' && perm.category !== selectedCategory) return false;

      // Search Query
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
  }, [selectedPermissions, statusFilter, selectedCategory, searchQuery]);

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

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSavePermissions(selectedPermissions);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!targetUser) return null;

  const totalAvailable = ALL_PERMISSIONS.length;
  const assignedCount = selectedPermissions.length;
  const unassignedCount = totalAvailable - assignedCount;
  const percentAssigned = Math.round((assignedCount / totalAvailable) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Permissions — ${targetUser.name}`}
      size="large"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-danger-light, #fef2f2)',
              border: '1px solid var(--color-danger, #ef4444)',
              borderRadius: 'var(--radius-md, 8px)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: '0.85rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* User Information Dossier Header */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary, #2563eb)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {targetUser.name.charAt(0)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main, #0f172a)' }}>
                    {targetUser.name}
                  </h3>
                  <Badge variant={targetUser.role === 'SUB_ADMIN' ? 'warning' : 'info'}>
                    {targetUser.role}
                  </Badge>
                  {targetUser.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="danger">Inactive</Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.15rem' }}>
                  {targetUser.email}
                  {targetUser.employeeId && ` • ID: ${targetUser.employeeId}`}
                  {targetUser.department && ` • ${targetUser.department}`}
                </div>
              </div>
            </div>

            {/* Permission Summary Metric Pill */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.2rem',
              }}
            >
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary, #2563eb)' }}>
                Assigned: {assignedCount} / {totalAvailable}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>
                {unassignedCount} unassigned ({percentAssigned}% coverage)
              </div>
            </div>
          </div>

          {/* Quick Select Actions and Coverage Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              paddingTop: '0.65rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--color-primary, #2563eb)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: 'var(--color-bg-surface, #ffffff)',
                }}
              >
                <CheckSquare size={13} />
                <span>Select All ({totalAvailable})</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted, #64748b)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: 'var(--color-bg-surface, #ffffff)',
                }}
              >
                <Square size={13} />
                <span>Clear All</span>
              </button>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: 'var(--color-border, #e2e8f0)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percentAssigned}%`,
                    height: '100%',
                    backgroundColor: assignedCount > 0 ? 'var(--color-primary, #2563eb)' : 'transparent',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted, #64748b)' }}>
                {percentAssigned}%
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
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
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                aria-label="Search permissions"
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
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Module Filter Select */}
            <div style={{ flex: '0 1 180px' }}>
              <select
                className="input-field"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by module"
              >
                <option value="ALL">All Modules</option>
                {PERMISSION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)', marginRight: '0.2rem' }}>
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'ALL' ? 600 : 500,
                border: statusFilter === 'ALL' ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: statusFilter === 'ALL' ? 'var(--color-primary-light, #eff6ff)' : 'var(--color-bg-surface, #ffffff)',
                color: statusFilter === 'ALL' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-main, #334155)',
                cursor: 'pointer',
              }}
            >
              All ({totalAvailable})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ASSIGNED')}
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'ASSIGNED' ? 600 : 500,
                border: statusFilter === 'ASSIGNED' ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: statusFilter === 'ASSIGNED' ? 'var(--color-primary-light, #eff6ff)' : 'var(--color-bg-surface, #ffffff)',
                color: statusFilter === 'ASSIGNED' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-main, #334155)',
                cursor: 'pointer',
              }}
            >
              Assigned ({assignedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNASSIGNED')}
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'UNASSIGNED' ? 600 : 500,
                border: statusFilter === 'UNASSIGNED' ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: statusFilter === 'UNASSIGNED' ? 'var(--color-primary-light, #eff6ff)' : 'var(--color-bg-surface, #ffffff)',
                color: statusFilter === 'UNASSIGNED' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-main, #334155)',
                cursor: 'pointer',
              }}
            >
              Not Assigned ({unassignedCount})
            </button>
          </div>
        </div>

        {/* Scrollable Permissions Matrix grouped by Module */}
        <div
          style={{
            maxHeight: '48vh',
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
                No permissions match the selected filter
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                Try switching the status filter to &quot;All&quot; or clearing the search query.
              </p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([category, items]) => {
              const catTotal = ALL_PERMISSIONS.filter((p) => p.category === category).length;
              const catAssigned = items.filter((p) => selectedPermissions.includes(p.id)).length;
              const isAllCatSelected = catAssigned === catTotal;

              return (
                <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Category Header with Bulk Category Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '0.35rem',
                      borderBottom: '1px solid var(--color-border, #e2e8f0)',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Shield size={15} style={{ color: 'var(--color-primary, #2563eb)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-main, #0f172a)' }}>
                        {category}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted, #64748b)' }}>
                        ({catAssigned} / {catTotal} assigned)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() =>
                          isAllCatSelected ? handleClearCategory(category) : handleSelectCategory(category)
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 6px',
                          color: 'var(--color-primary, #2563eb)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isAllCatSelected ? 'Deselect Module' : 'Select Module'}
                      </button>
                    </div>
                  </div>

                  {/* Grid of Permission Items */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '0.65rem',
                    }}
                  >
                    {items.map((perm) => {
                      const isAssigned = selectedPermissions.includes(perm.id);

                      return (
                        <div
                          key={perm.id}
                          onClick={() => handleToggle(perm.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleToggle(perm.id);
                            }
                          }}
                          tabIndex={0}
                          role="checkbox"
                          aria-checked={isAssigned}
                          aria-label={`Toggle permission ${perm.label}`}
                          style={{
                            padding: '0.85rem',
                            backgroundColor: isAssigned
                              ? 'var(--color-primary-light, #eff6ff)'
                              : 'var(--color-bg-surface, #ffffff)',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: isAssigned
                              ? '1px solid var(--color-primary, #2563eb)'
                              : '1px solid var(--color-border, #e2e8f0)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: isAssigned
                              ? '0 0 0 1px var(--color-primary, #2563eb)'
                              : '0 1px 2px rgba(0, 0, 0, 0.03)',
                            outline: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  border: isAssigned
                                    ? '1.5px solid var(--color-primary, #2563eb)'
                                    : '1.5px solid var(--color-border, #94a3b8)',
                                  backgroundColor: isAssigned ? 'var(--color-primary, #2563eb)' : '#ffffff',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isAssigned && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-main, #0f172a)' }}>
                                {perm.label}
                              </span>
                            </div>

                            <Badge variant={isAssigned ? 'success' : 'neutral'} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              {isAssigned ? 'Assigned' : 'Unassigned'}
                            </Badge>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '1.65rem' }}>
                            <code
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                backgroundColor: isAssigned ? '#ffffff' : 'var(--color-bg-secondary, #f1f5f9)',
                                color: isAssigned ? 'var(--color-primary, #2563eb)' : 'var(--color-text-muted, #64748b)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border, #cbd5e1)',
                              }}
                            >
                              {perm.id}
                            </code>
                          </div>

                          <p
                            style={{
                              margin: '0.15rem 0 0 1.65rem',
                              fontSize: '0.78rem',
                              color: 'var(--color-text-muted, #64748b)',
                              lineHeight: 1.4,
                            }}
                          >
                            {perm.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            paddingTop: '1rem',
            marginTop: '0.25rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)' }}>
            <strong>{assignedCount}</strong> permissions selected for {targetUser.name} ({targetUser.role})
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" type="button" onClick={handleSave} isLoading={isSaving}>
              Save Permissions
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
