import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  History,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { auditService } from '../../services/auditService';
import type { AuditLog } from '../../types';

export const AuditLogsPage: React.FC = () => {
  const searchInputId = useId();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await auditService.getRecentLogs(150);
      setLogs(records);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) {
      return false;
    }
    if (roleFilter !== 'ALL' && log.actorRole !== roleFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = (log.actorName || '').toLowerCase().includes(q) || (log.actorId || '').toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      const matchEntity = (log.entityId || '').toLowerCase().includes(q) || (log.entityType || '').toLowerCase().includes(q);
      const matchChanges = (log.changes || '').toLowerCase().includes(q);
      return matchActor || matchAction || matchEntity || matchChanges;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATE') || action.includes('REACTIVATE')) return 'success';
    if (action.includes('UPDATE') || action.includes('ASSIGN')) return 'warning';
    if (action.includes('DELETE') || action.includes('DEACTIVATE') || action.includes('REVOKE')) return 'danger';
    return 'info';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Forensic Audit Trail</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Immutable, append-only administrative records capturing user actions, permissions, circulars, and operations.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
          onClick={loadLogs}
        >
          Refresh Logs
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <label htmlFor={searchInputId} style={{ display: 'none' }}>
              Search audit logs
            </label>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              id={searchInputId}
              type="text"
              className="form-input"
              placeholder="Search by actor, action, entity, changes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.5rem', width: '100%', height: '38px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              aria-label="Filter by administrative action"
              className="form-input"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '38px', width: '100%', paddingRight: '2rem' }}
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE_USER">CREATE_USER</option>
              <option value="UPDATE_USER">UPDATE_USER</option>
              <option value="DEACTIVATE_USER">DEACTIVATE_USER</option>
              <option value="REACTIVATE_USER">REACTIVATE_USER</option>
              <option value="ASSIGN_PERMISSION">ASSIGN_PERMISSION</option>
              <option value="REVOKE_PERMISSION">REVOKE_PERMISSION</option>
              <option value="NOTICE_CREATED">NOTICE_CREATED</option>
              <option value="CALENDAR_EVENT_CREATED">CALENDAR_EVENT_CREATED</option>
              <option value="POLL_CREATED">POLL_CREATED</option>
              <option value="LOST_FOUND_ITEM_REPORTED">LOST_FOUND_ITEM_REPORTED</option>
              <option value="SERVICE_DIRECTORY_ADDED">SERVICE_DIRECTORY_ADDED</option>
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              aria-label="Filter by actor role"
              className="form-input"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '38px', width: '100%', paddingRight: '2rem' }}
            >
              <option value="ALL">All Roles</option>
              <option value="MAIN_ADMIN">MAIN_ADMIN</option>
              <option value="SUB_ADMIN">SUB_ADMIN</option>
              <option value="FACULTY">FACULTY</option>
              <option value="STAFF">STAFF</option>
              <option value="STUDENT">STUDENT</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table & Content */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No Audit Records Found"
            description="No administrative logs match your current search or action filter."
            icon={<History size={40} />}
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="table-responsive hide-on-mobile">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor & Role</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.actorName || l.actorId || 'Administrator'}</div>
                        <Badge variant="info" style={{ fontSize: '0.7rem' }}>{l.actorRole}</Badge>
                      </td>
                      <td>
                        <Badge variant={getActionBadgeVariant(l.action)} style={{ fontSize: '0.75rem' }}>
                          {l.action}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {l.entityType}: {l.entityId}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          {l.changes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="show-on-mobile mobile-card-list">
              {paginatedLogs.map((l) => (
                <div
                  key={l.id}
                  style={{
                    padding: '0.85rem',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge variant={getActionBadgeVariant(l.action)} style={{ fontSize: '0.75rem' }}>
                      {l.action}
                    </Badge>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(l.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>{l.actorName || 'Admin'}</strong> ({l.actorRole})
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>Entity:</strong> {l.entityType} ({l.entityId})
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-default)', paddingTop: '0.35rem' }}>
                    {l.changes}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls (Section 18) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-default)',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} audit records
              </span>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronRight size={14} />}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
