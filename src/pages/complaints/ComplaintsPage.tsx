import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import {
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Upload,
  UserCheck,
  TrendingUp,
  Star,
  Check,
  Flame,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import {
  complaintService,
  COMPLAINT_CATEGORIES,
  calculateAgeingDays,
  getAgeingBucket,
} from '../../services/complaintService';
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  AttachmentFile,
} from '../../types';

export const ComplaintsPage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleId = useId();
  const catId = useId();
  const locId = useId();
  const descId = useId();

  const isStaffOrAdmin =
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && (permissions.includes('MANAGE_COMPLAINTS') || permissions.includes('ASSIGN_COMPLAINTS'))) ||
    role === 'STAFF';

  // Complaint list state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected complaint for Detail/Timeline modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // New Complaint Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ComplaintCategory>('Hostel');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAttachments, setNewAttachments] = useState<AttachmentFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Admin action modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignDept, setAssignDept] = useState('Maintenance');
  const [assignStaff, setAssignStaff] = useState('Binod Rout (Maintenance)');
  const [assignStaffId, setAssignStaffId] = useState('staff_001');
  const [assignPriority, setAssignPriority] = useState<ComplaintPriority>('HIGH');

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');

  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  // Student feedback state
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (role === 'STUDENT' && userProfile?.uid) {
        filters.studentId = userProfile.uid;
      } else if (role === 'STAFF' && userProfile?.uid) {
        filters.staffId = userProfile.uid;
      }
      const data = await complaintService.getComplaints(filters);
      setComplaints(data);
    } catch (err) {
      console.warn('Failed to load complaints:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role, userProfile?.uid]);

  useEffect(() => {
    setIsLoading(true);
    const filters: any = {};
    if (role === 'STUDENT' && userProfile?.uid) {
      filters.studentId = userProfile.uid;
    } else if (role === 'STAFF' && userProfile?.uid) {
      // Staff members see complaints assigned to them or unassigned
      filters.staffId = userProfile.uid;
    }

    const unsubscribe = complaintService.subscribeComplaints(filters, (data) => {
      setComplaints(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [role, userProfile?.uid]);

  // Operational metrics
  const onTimeCount = complaints.filter((c) => c.slaStatus === 'WITHIN_SLA' && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
  const dueSoonCount = complaints.filter((c) => c.slaStatus === 'DUE_SOON' && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
  const overdueCount = complaints.filter((c) => c.slaStatus === 'OVERDUE' && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
  const escalatedCount = complaints.filter((c) => c.status === 'ESCALATED').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.complaintId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.studentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredComplaints.length / pageSize));
  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Attachment file size must be less than 10MB.');
      return;
    }

    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 30;
      });
    }, 150);

    setTimeout(() => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const newAtt: AttachmentFile = {
        name: file.name,
        size: file.size,
        type: isImg ? 'image' : isVid ? 'video' : 'pdf',
        url: URL.createObjectURL(file),
      };
      setNewAttachments((prev) => [...prev, newAtt]);
      setUploadProgress(null);
    }, 600);
  };

  // Submit new complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim() || !newDescription.trim()) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await complaintService.createComplaint({
        studentId: userProfile?.uid || 'student_uid_001',
        studentName: userProfile?.name || 'Student Member',
        studentEmail: userProfile?.email || 'student@bput.ac.in',
        category: newCategory,
        title: newTitle.trim(),
        location: newLocation.trim(),
        description: newDescription.trim(),
        attachments: newAttachments,
      });

      setIsNewModalOpen(false);
      setNewTitle('');
      setNewLocation('');
      setNewDescription('');
      setNewAttachments([]);
      setToastMessage(`Complaint #${created.complaintId} has been successfully registered.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadComplaints();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign complaint
  const handleAssignSubmit = async () => {
    if (!selectedComplaint) return;
    try {
      const updated = await complaintService.assignComplaint(selectedComplaint.id, {
        department: assignDept,
        staffId: assignStaffId,
        staffName: assignStaff,
        priority: assignPriority,
        assignedBy: userProfile?.uid || 'admin_001',
        assignedByName: userProfile?.name || 'Administrator',
        actorRole: role || 'SUB_ADMIN',
      });
      setSelectedComplaint(updated);
      setIsAssignModalOpen(false);
      setToastMessage(`Complaint #${updated.complaintId} assigned to ${assignStaff}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to assign complaint.');
    }
  };

  // Update status
  const handleStatusSubmit = async () => {
    if (!selectedComplaint) return;
    try {
      const updated = await complaintService.updateStatus(selectedComplaint.id, {
        status: newStatus,
        actorId: userProfile?.uid || 'admin_001',
        actorName: userProfile?.name || 'Staff Member',
        actorRole: role || 'STAFF',
        message: statusNote.trim() || undefined,
      });
      setSelectedComplaint(updated);
      setIsStatusModalOpen(false);
      setStatusNote('');
      setToastMessage(`Complaint #${updated.complaintId} updated to ${newStatus.replace('_', ' ')}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint status.');
    }
  };

  // Escalate
  const handleEscalateSubmit = async () => {
    if (!selectedComplaint) return;
    if (!escalateReason.trim()) {
      alert('Please enter an escalation rationale.');
      return;
    }
    try {
      const updated = await complaintService.escalateComplaint(selectedComplaint.id, {
        escalatedBy: userProfile?.uid || 'admin_001',
        escalatedByName: userProfile?.name || 'Authority',
        actorRole: role || 'SUB_ADMIN',
        reason: escalateReason.trim(),
      });
      setSelectedComplaint(updated);
      setIsEscalateModalOpen(false);
      setEscalateReason('');
      setToastMessage(`Complaint #${updated.complaintId} escalated to higher authorities.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to escalate complaint.');
    }
  };

  // Feedback submit
  const handleFeedbackSubmit = async () => {
    if (!selectedComplaint || !userProfile?.uid) return;
    setIsSubmittingFeedback(true);
    try {
      const updated = await complaintService.submitFeedback(selectedComplaint.id, {
        studentId: userProfile.uid,
        studentName: userProfile.name,
        rating: feedbackRating,
        comment: feedbackComment.trim() || undefined,
      });
      setSelectedComplaint(updated);
      setFeedbackComment('');
      setToastMessage('Thank you! Your resolution feedback was recorded.');
      setTimeout(() => setToastMessage(null), 5000);
      loadComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getPriorityBadge = (priority: ComplaintPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="danger"><Flame size={12} /> Critical (24h SLA)</Badge>;
      case 'HIGH':
        return <Badge variant="danger">High (48h SLA)</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium (96h SLA)</Badge>;
      case 'LOW':
      default:
        return <Badge variant="info">Low (7d SLA)</Badge>;
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="success"><Check size={12} /> {status}</Badge>;
      case 'ESCALATED':
        return <Badge variant="danger"><Flame size={12} /> ESCALATED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning"><Clock size={12} /> IN PROGRESS</Badge>;
      case 'ASSIGNED':
        return <Badge variant="info"><UserCheck size={12} /> ASSIGNED</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="info">UNDER REVIEW</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'SUBMITTED':
      case 'PENDING':
      default:
        return <Badge variant="neutral">SUBMITTED</Badge>;
    }
  };

  const getSlaBadge = (c: Complaint) => {
    const ageDays = calculateAgeingDays(c.submittedAt);
    const bucket = getAgeingBucket(ageDays);

    if (c.status === 'RESOLVED' || c.status === 'CLOSED') {
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>
          Resolved in {c.actualResolutionHours ? `${c.actualResolutionHours}h` : `${ageDays}d`}
        </span>
      );
    }

    if (c.slaStatus === 'OVERDUE') {
      return <Badge variant="danger">{ageDays}d ({bucket} • Overdue)</Badge>;
    }
    if (c.slaStatus === 'DUE_SOON') {
      return <Badge variant="warning">{ageDays}d ({bucket} • Due Soon)</Badge>;
    }
    return <Badge variant="success">{ageDays}d ({bucket} • On Time)</Badge>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Complaints & Maintenance</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Deterministic grievance tracking, SLA resolution timers, automated ageing, and verified student feedback.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadComplaints}
          >
            Refresh
          </Button>

          {role === 'STUDENT' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} />}
              onClick={() => setIsNewModalOpen(true)}
            >
              Report Grievance / Maintenance
            </Button>
          )}
        </div>
      </div>

      {/* Operational SLA & Ageing Matrix */}
      <div className="grid-cards-4">
        <StatCard
          label="On-Time SLA (0–2 Days)"
          value={String(onTimeCount)}
          subtitle="Within expected SLA window"
          icon={<CheckCircle2 size={22} style={{ color: 'var(--color-success, #16a34a)' }} />}
        />
        <StatCard
          label="Due Soon (3–5 Days)"
          value={String(dueSoonCount)}
          subtitle="Requires staff expediting"
          icon={<Clock size={22} style={{ color: 'var(--color-warning, #d97706)' }} />}
        />
        <StatCard
          label="Overdue SLA (6+ Days)"
          value={String(overdueCount)}
          subtitle="Subject to administrative escalation"
          icon={<AlertTriangle size={22} style={{ color: 'var(--color-danger, #dc2626)' }} />}
        />
        <StatCard
          label="Escalated / Resolved"
          value={`${escalatedCount} / ${resolvedCount}`}
          subtitle="Active escalations vs completed"
          icon={<TrendingUp size={22} style={{ color: 'var(--brand-primary)' }} />}
        />
      </div>

      {/* Search & Filter Controls */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by ID, keyword, location, or student..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.1rem', fontSize: '0.85rem' }}
              aria-label="Search complaints"
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.85rem', width: 'auto' }}
              aria-label="Filter by Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.85rem', width: 'auto' }}
              aria-label="Filter by Category"
            >
              <option value="ALL">All Categories</option>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="input-field"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.85rem', width: 'auto' }}
              aria-label="Filter by Priority"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Complaints Table (Controlled Horizontal Scroll) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            {role === 'STUDENT' ? 'My Reported Grievances' : 'Operational Campus Grievances'}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Showing {paginatedComplaints.length} of {filteredComplaints.length} records
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : paginatedComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>No complaints found matching current criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID & Category</th>
                  <th>Title & Location</th>
                  <th>Priority</th>
                  <th>Ageing / SLA</th>
                  <th>Assigned Staff</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>#{c.complaintId}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.category}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.location}</div>
                    </td>
                    <td>{getPriorityBadge(c.priority)}</td>
                    <td>{getSlaBadge(c)}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{c.assignedStaffName || 'Unassigned'}</div>
                      {c.assignedDepartment && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{c.assignedDepartment}</div>
                      )}
                    </td>
                    <td>{getStatusBadge(c.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComplaint(c)}
                      >
                        Timeline / Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', padding: '0 0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* New Complaint Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => !isSubmitting && setIsNewModalOpen(false)}
        title="Report Campus Issue / Maintenance Complaint"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateComplaint} disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Submit Complaint'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert variant="danger">{formError}</Alert>}

          <div>
            <label htmlFor={catId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Category *
            </label>
            <select
              id={catId}
              className="input-field"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ComplaintCategory)}
              required
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={titleId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Complaint Title *
            </label>
            <input
              id={titleId}
              type="text"
              className="input-field"
              placeholder="e.g., Corridor Light Sparking, Water Leakage"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={locId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Exact Location / Room *
            </label>
            <input
              id={locId}
              type="text"
              className="input-field"
              placeholder="e.g., Hostel Block A, Room 204 or Academic Block 2 Lab 3"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={descId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Detailed Description *
            </label>
            <textarea
              id={descId}
              className="input-field"
              rows={4}
              placeholder="Describe the issue, urgency, and any safety hazards..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Optional Attachment (Image / Video / Document)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*,video/*,application/pdf"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Attachment (&lt; 10MB)
            </Button>

            {uploadProgress !== null && (
              <div style={{ marginTop: '0.5rem', width: '100%', height: 4, backgroundColor: 'var(--bg-subtle)' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--brand-primary)' }} />
              </div>
            )}

            {newAttachments.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {newAttachments.map((att, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    📎 {att.name} ({(att.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Complaint Detail & Chronological Timeline Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={Boolean(selectedComplaint)}
          onClose={() => setSelectedComplaint(null)}
          title={`Complaint #${selectedComplaint.complaintId} Details & Timeline`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {isStaffOrAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
                      Assign Staff
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(true)}>
                      Update Status
                    </Button>
                    {selectedComplaint.status !== 'ESCALATED' && selectedComplaint.status !== 'RESOLVED' && (
                      <Button variant="outline" size="sm" onClick={() => setIsEscalateModalOpen(true)}>
                        Escalate
                      </Button>
                    )}
                  </>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={() => setSelectedComplaint(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Card */}
            <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{selectedComplaint.title}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Location: <strong>{selectedComplaint.location}</strong> • Category: <strong>{selectedComplaint.category}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {getStatusBadge(selectedComplaint.status)}
                  {getPriorityBadge(selectedComplaint.priority)}
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {selectedComplaint.description}
              </div>

              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <div>Reported by: <strong>{selectedComplaint.studentName}</strong></div>
                <div>Submitted: {new Date(selectedComplaint.submittedAt).toLocaleString()}</div>
                <div>Assigned: <strong>{selectedComplaint.assignedStaffName || 'Unassigned'}</strong></div>
                <div>SLA Target: {selectedComplaint.expectedResolutionAt ? new Date(selectedComplaint.expectedResolutionAt).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>

            {/* Attachments preview */}
            {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Attached Evidence</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedComplaint.attachments.map((att, i) => (
                    <div key={i} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.5rem', maxWidth: '240px' }}>
                      {att.type === 'image' ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                      ) : (
                        <div style={{ fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
                          📄 {att.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Feedback Section (For Student) */}
            {(selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED') && (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Student Resolution Feedback</h4>
                {selectedComplaint.feedback ? (
                  <div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={18}
                          fill={s <= selectedComplaint.feedback!.rating ? '#f59e0b' : 'none'}
                          color="#f59e0b"
                        />
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      "{selectedComplaint.feedback.comment || 'No written review'}"
                    </p>
                  </div>
                ) : role === 'STUDENT' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem' }}>Rate Resolution:</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="btn-ghost"
                            onClick={() => setFeedbackRating(star)}
                            style={{ padding: '2px' }}
                            aria-label={`Rate ${star} stars`}
                          >
                            <Star
                              size={20}
                              fill={star <= feedbackRating ? '#f59e0b' : 'none'}
                              color="#f59e0b"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Was the issue fixed to your satisfaction? Add comments..."
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                    />
                    <div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleFeedbackSubmit}
                        disabled={isSubmittingFeedback}
                      >
                        {isSubmittingFeedback ? 'Submitting...' : 'Submit Resolution Feedback'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Awaiting student feedback verification.
                  </div>
                )}
              </div>
            )}

            {/* Chronological Timeline */}
            <div>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Chronological Action Timeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid var(--border-default)' }}>
                {selectedComplaint.timeline.map((step) => (
                  <div key={step.id} style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-1.45rem',
                        top: 2,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: 'var(--brand-primary)',
                        border: '2px solid var(--bg-surface)',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {step.action}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {step.date} at {step.time}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      By: {step.actor} ({step.actorRole})
                    </div>
                    {step.message && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)' }}>
                        {step.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Assign Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Assign Complaint #${selectedComplaint.complaintId}`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAssignSubmit}>Confirm Assignment</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Operational Department
              </label>
              <select
                className="input-field"
                value={assignDept}
                onChange={(e) => setAssignDept(e.target.value)}
              >
                <option value="Maintenance">Maintenance & Electrical</option>
                <option value="Plumbing & Water Works">Plumbing & Water Works</option>
                <option value="Carpentry & Estate">Carpentry & Estate</option>
                <option value="Hostel Operations">Hostel Operations</option>
                <option value="Mess & Catering">Mess & Catering</option>
                <option value="IT Support">IT & Networking</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Assigned Staff Member
              </label>
              <select
                className="input-field"
                value={assignStaffId}
                onChange={(e) => {
                  setAssignStaffId(e.target.value);
                  const sel = e.target.options[e.target.selectedIndex].text;
                  setAssignStaff(sel);
                }}
              >
                <option value="staff_001">Binod Rout (Maintenance)</option>
                <option value="staff_002">Estate Team (Plumbing)</option>
                <option value="staff_003">Maheswar Jena (Carpentry)</option>
                <option value="staff_004">P. Nayak (Security / Warden)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Priority Level (Sets Resolution SLA)
              </label>
              <select
                className="input-field"
                value={assignPriority}
                onChange={(e) => setAssignPriority(e.target.value as ComplaintPriority)}
              >
                <option value="CRITICAL">Critical (24h SLA)</option>
                <option value="HIGH">High (48h SLA)</option>
                <option value="MEDIUM">Medium (96h SLA)</option>
                <option value="LOW">Low (7d SLA)</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Update Status Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title={`Update Status: #${selectedComplaint.complaintId}`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleStatusSubmit}>Save Status</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Target Status
              </label>
              <select
                className="input-field"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
              >
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Operational Note / Resolution Summary
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Details of work executed, replaced components, or reason..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Escalate Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={isEscalateModalOpen}
          onClose={() => setIsEscalateModalOpen(false)}
          title={`Escalate Grievance #${selectedComplaint.complaintId}`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setIsEscalateModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleEscalateSubmit}>Confirm Escalation</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Alert variant="warning">
              Escalation flags this complaint as CRITICAL and notifies higher administrative authorities for urgent intervention.
            </Alert>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Escalation Rationale *
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Reason for escalation (e.g. repeated failure, overdue by 7 days, safety emergency)..."
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                required
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
