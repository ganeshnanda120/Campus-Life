import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  CheckCircle,
  Eye,
  AlertTriangle,
  Filter,
  Users,
  X,
  Paperclip,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/useAuth';
import { noticeService } from '../../services/noticeService';
import type { Notice, NoticePriority, NoticeStatus, UserRole, StudentCategory } from '../../types';

export const NoticesPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Notice for stats or detail modal
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsData, setStatsData] = useState<{ totalRead: number; totalAcknowledged: number; reads: any[] } | null>(null);

  // Create Notice Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    priority: 'NORMAL' as NoticePriority,
    publishDate: new Date().toISOString().substring(0, 16),
    expiryDate: '',
    requiresAcknowledgement: false,
    status: 'PUBLISHED' as NoticeStatus,
    targetAll: true,
    targetRoles: [] as UserRole[],
    targetDepartments: [] as string[],
    targetYears: [] as number[],
    targetStudentCategory: '' as '' | StudentCategory,
    attachmentName: '',
  });

  const canManageNotices =
    role === 'MAIN_ADMIN' ||
    userProfile?.permissions?.includes('MANAGE_NOTICES');

  const loadNotices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await noticeService.getNotices(userProfile);
      setNotices(data);
    } catch (err) {
      console.warn('Failed to load notices:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = noticeService.subscribeNotices(userProfile, (data) => {
      setNotices(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [userProfile]);

  const handleOpenNotice = async (notice: Notice) => {
    setSelectedNotice(notice);
    if (userProfile) {
      await noticeService.markNoticeRead(notice.id, userProfile);
    }
  };

  const handleAcknowledge = async (noticeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    try {
      await noticeService.acknowledgeNotice(noticeId, userProfile);
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId
            ? { ...n, acknowledgedCount: (n.acknowledgedCount || 0) + 1 }
            : n
        )
      );
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  const handleOpenStats = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNotice(notice);
    const data = await noticeService.getNoticeStats(notice.id);
    setStatsData(data);
    setStatsModalOpen(true);
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSubmitting(true);
    try {
      await noticeService.createNotice(
        {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          priority: formData.priority,
          publishDate: formData.publishDate ? new Date(formData.publishDate).toISOString() : new Date().toISOString(),
          expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
          targetAudience: {
            all: formData.targetAll,
            roles: formData.targetRoles.length ? formData.targetRoles : undefined,
            departments: formData.targetDepartments.length ? formData.targetDepartments : undefined,
            years: formData.targetYears.length ? formData.targetYears : undefined,
            studentCategories: formData.targetStudentCategory ? [formData.targetStudentCategory] : undefined,
          },
          requiresAcknowledgement: formData.requiresAcknowledgement,
          attachments: formData.attachmentName
            ? [
                {
                  name: formData.attachmentName,
                  url: '#',
                  type: 'application/pdf',
                  size: 1024 * 350,
                },
              ]
            : undefined,
          createdBy: userProfile.uid,
          createdByName: `${userProfile.name} (${userProfile.role})`,
          status: formData.status,
        },
        userProfile
      );

      setCreateModalOpen(false);
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'General',
        priority: 'NORMAL',
        publishDate: new Date().toISOString().substring(0, 16),
        expiryDate: '',
        requiresAcknowledgement: false,
        status: 'PUBLISHED',
        targetAll: true,
        targetRoles: [],
        targetDepartments: [],
        targetYears: [],
        targetStudentCategory: '',
        attachmentName: '',
      });
      await loadNotices();
    } catch (err) {
      console.error('Failed to create notice:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered list
  const filteredNotices = notices.filter((n) => {
    if (filterCategory !== 'ALL' && n.category !== filterCategory) return false;
    if (filterPriority !== 'ALL' && n.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const emergencyNotices = filteredNotices.filter(
    (n) => n.priority === 'EMERGENCY' || n.priority === 'URGENT'
  );
  const standardNotices = filteredNotices.filter(
    (n) => n.priority !== 'EMERGENCY' && n.priority !== 'URGENT'
  );

  const totalPublished = notices.filter((n) => n.status === 'PUBLISHED').length;
  const totalReadCount = notices.reduce((acc, curr) => acc + (curr.readCount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Notices & Circulars</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Official university communications, circulars, and emergency advisories.
          </p>
        </div>
        {canManageNotices && (
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Notice
          </Button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid-cards-3">
        <StatCard
          label="Active Published Notices"
          value={totalPublished.toString()}
          subtitle="Targeted by role, department & year"
          icon={<Megaphone size={22} />}
        />
        <StatCard
          label="Total Notice Reads"
          value={totalReadCount.toLocaleString()}
          subtitle="Tracked with read timestamp telemetry"
          icon={<Eye size={22} />}
        />
        <StatCard
          label="Emergency Mode"
          value={emergencyNotices.length.toString()}
          subtitle="Priority advisories requiring immediate attention"
          icon={<ShieldAlert size={22} />}
        />
      </div>

      {/* Filters & Search Toolbar */}
      <div
        className="card"
        style={{
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search circulars by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.9rem' }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-input"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ height: '38px', width: 'auto', paddingRight: '2rem' }}
            >
              <option value="ALL">All Categories</option>
              <option value="Emergency">Emergency</option>
              <option value="Academic">Academic</option>
              <option value="Examination">Examination</option>
              <option value="Hostel">Hostel</option>
              <option value="Mess">Mess</option>
              <option value="Events">Events</option>
              <option value="General">General</option>
            </select>

            <select
              className="form-input"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ height: '38px', width: 'auto', paddingRight: '2rem' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="EMERGENCY">Emergency Only</option>
              <option value="URGENT">Urgent</option>
              <option value="IMPORTANT">Important</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: EMERGENCY / IMPORTANT NOTICE MODE (Section 10) */}
      {emergencyNotices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--status-danger)' }} />
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--status-danger)' }}>
              URGENT & EMERGENCY ADVISORIES
            </h2>
          </div>

          {emergencyNotices.map((n) => {
            const hasAcknowledged = userProfile
              ? noticeService.hasUserAcknowledged(n.id, userProfile.uid)
              : false;

            return (
              <div
                key={n.id}
                className="card"
                onClick={() => handleOpenNotice(n)}
                style={{
                  borderLeft: '6px solid var(--status-danger)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Badge variant="danger" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                      [EMERGENCY NOTICE] {n.priority}
                    </Badge>
                    <Badge variant="neutral">{n.category}</Badge>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{n.title}</h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Published: {new Date(n.publishDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="card-body">
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    {n.description}
                  </p>

                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-subtle)',
                      fontSize: '0.825rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <strong>Target:</strong>{' '}
                      {n.targetAudience.all
                        ? 'All Campus Members'
                        : `${n.targetAudience.roles?.join(', ') || ''} ${n.targetAudience.departments?.join(', ') || ''}`}
                    </div>
                    <div>
                      <strong>Read Telemetry:</strong> {n.readCount || 0} Read • {n.acknowledgedCount || 0} Acknowledged
                    </div>
                  </div>
                </div>

                <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Issued by: {n.createdByName}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canManageNotices && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Users size={14} />}
                        onClick={(e) => handleOpenStats(n, e)}
                      >
                        Audience Stats
                      </Button>
                    )}

                    {n.requiresAcknowledgement && (
                      <Button
                        variant={hasAcknowledged ? 'secondary' : 'primary'}
                        size="sm"
                        leftIcon={<CheckCircle size={15} />}
                        onClick={(e) => handleAcknowledge(n.id, e)}
                        disabled={hasAcknowledged}
                      >
                        {hasAcknowledged ? 'Acknowledged & Confirmed' : 'I have read & understand'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 2: STANDARD NOTICES */}
      <div>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>General Campus Circulars</h2>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading campus notices...
          </div>
        ) : standardNotices.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              No notices found matching the selected filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {standardNotices.map((n) => {
              const hasAcknowledged = userProfile
                ? noticeService.hasUserAcknowledged(n.id, userProfile.uid)
                : false;

              return (
                <div
                  key={n.id}
                  className="card"
                  onClick={() => handleOpenNotice(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Badge variant={n.priority === 'IMPORTANT' ? 'warning' : 'neutral'}>
                        {n.priority}
                      </Badge>
                      <Badge variant="neutral">{n.category}</Badge>
                      <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{n.title}</h3>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Published: {new Date(n.publishDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="card-body">
                    <p style={{ fontSize: '0.925rem', lineHeight: 1.6, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                      {n.description}
                    </p>

                    {n.attachments && n.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        {n.attachments.map((att) => (
                          <span
                            key={att.name}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-subtle)',
                              fontSize: '0.8rem',
                              color: 'var(--brand-primary)',
                            }}
                          >
                            <Paperclip size={14} /> {att.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <strong>Target:</strong>{' '}
                        {n.targetAudience.all
                          ? 'Everyone'
                          : `${n.targetAudience.roles?.join(', ') || ''} ${n.targetAudience.departments?.join(', ') || ''} ${n.targetAudience.studentCategories?.join(', ') || ''}`}
                      </div>
                      <div>
                        <strong>Reads:</strong> {n.readCount || 0} read
                        {n.requiresAcknowledgement && ` • ${n.acknowledgedCount || 0} acknowledged`}
                      </div>
                    </div>
                  </div>

                  <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Issuer: {n.createdByName}
                    </span>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {canManageNotices && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Users size={14} />}
                          onClick={(e) => handleOpenStats(n, e)}
                        >
                          Stats
                        </Button>
                      )}

                      {n.requiresAcknowledgement && (
                        <Button
                          variant={hasAcknowledged ? 'secondary' : 'primary'}
                          size="sm"
                          leftIcon={<CheckCircle size={14} />}
                          onClick={(e) => handleAcknowledge(n.id, e)}
                          disabled={hasAcknowledged}
                        >
                          {hasAcknowledged ? 'Acknowledged' : 'Acknowledge Notice'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE NOTICE MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '92%' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Publish New Campus Notice</h3>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Notice Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. End Semester Exam Timetable or Weather Alert"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="General">General</option>
                      <option value="Academic">Academic</option>
                      <option value="Examination">Examination</option>
                      <option value="Hostel">Hostel</option>
                      <option value="Mess">Mess</option>
                      <option value="Events">Events</option>
                      <option value="Holiday">Holiday</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Administrative">Administrative</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Library">Library</option>
                      <option value="Transport">Transport</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Priority Level *</label>
                    <select
                      className="form-input"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as NoticePriority })}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Important</option>
                      <option value="URGENT">Urgent</option>
                      <option value="EMERGENCY">Emergency (Prominent Alert)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Full Circular Description *</label>
                  <textarea
                    required
                    rows={4}
                    className="form-input"
                    placeholder="Enter complete circular text, instructions, and deadlines..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Target Audience Controls (Section 5) */}
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Audience Targeting</div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.targetAll}
                      onChange={(e) => setFormData({ ...formData, targetAll: e.target.checked })}
                    />
                    <span>Broadcast to Everyone (All Students, Faculty & Staff)</span>
                  </label>

                  {!formData.targetAll && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Target Student Category</label>
                        <select
                          className="form-input"
                          value={formData.targetStudentCategory}
                          onChange={(e) => setFormData({ ...formData, targetStudentCategory: e.target.value as any })}
                          style={{ fontSize: '0.85rem' }}
                        >
                          <option value="">Both Hosteler & Day Scholar</option>
                          <option value="HOSTELER">Hostel Residents Only</option>
                          <option value="DAY_SCHOLAR">Day Scholars Only</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachment & Acknowledge Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.requiresAcknowledgement}
                      onChange={(e) => setFormData({ ...formData, requiresAcknowledgement: e.target.checked })}
                    />
                    <span><strong>Require Mandatory Acknowledgement</strong> ("I have read and understood")</span>
                  </label>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>PDF / Document Attachment Name (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. bput_notification_2026.pdf"
                      value={formData.attachmentName}
                      onChange={(e) => setFormData({ ...formData, attachmentName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting}>
                  Publish Notice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATS & ACKNOWLEDGEMENT AUDIENCE MODAL (Section 8, 9) */}
      {statsModalOpen && selectedNotice && (
        <div className="modal-backdrop" onClick={() => setStatsModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', width: '92%' }}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Read & Acknowledgement Telemetry</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedNotice.title}</span>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setStatsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                    {selectedNotice.readCount || 0}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Reads Tracked</div>
                </div>

                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--status-success)' }}>
                    {selectedNotice.acknowledgedCount || 0}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Digital Acknowledgements</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Recent Read Records</h4>
                {statsData?.reads && statsData.reads.length > 0 ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {statsData.reads.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div>
                          <strong>{r.userName || r.userId}</strong> ({r.userRole || 'STUDENT'})
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {r.acknowledged ? '✓ Acknowledged' : 'Read only'} • {new Date(r.readAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    Audience telemetry active. Records are written in real-time as users open this circular.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="primary" onClick={() => setStatsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
