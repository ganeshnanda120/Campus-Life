import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Upload,
  Printer,
  X,
  FileCheck,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/useAuth';
import { requestService } from '../../services/requestService';
import { certificateService } from '../../services/certificateService';
import type {
  StudentRequest,
  RequestStatus,
  Certificate,
  AttachmentFile,
} from '../../types';

export const RequestsPage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();
  const searchInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminOrAuthorized =
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && permissions.includes('MANAGE_REQUESTS'));

  // Active view tab: 'my_requests' for student, 'all_requests' for admin
  const [activeTab, setActiveTab] = useState<'my_requests' | 'all_requests'>(
    role === 'STUDENT' ? 'my_requests' : 'all_requests'
  );

  // Data States
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isAdminActionModalOpen, setIsAdminActionModalOpen] = useState(false);

  // Selected records
  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
  const [viewCertificate, setViewCertificate] = useState<Certificate | null>(null);

  // New Request Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<StudentRequest['requestType']>('bonafide_certificate');
  const [newDesc, setNewDesc] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachmentFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Action Form State
  const [actionStatus, setActionStatus] = useState<RequestStatus>('APPROVED');
  const [actionComment, setActionComment] = useState('');
  const [assignedDept, setAssignedDept] = useState('Academic Cell');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my_requests' && role === 'STUDENT') {
        const studentId = userProfile?.studentId || 'STU2026001';
        const data = await requestService.getStudentRequests(studentId);
        setRequests(data);
      } else {
        const data = await requestService.getAllRequests();
        setRequests(data);
      }
    } catch (err) {
      console.warn('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, role, userProfile?.studentId]);

  // Realtime Requests Subscription
  useEffect(() => {
    setIsLoading(true);
    const studentId = (activeTab === 'my_requests' && role === 'STUDENT')
      ? (userProfile?.studentId || 'STU2026001')
      : undefined;

    const unsubscribe = requestService.subscribeRequests(studentId, (data) => {
      setRequests(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [activeTab, role, userProfile?.studentId]);

  // Handle Attachment Upload
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Attachment file size exceeds 5MB limit.');
      return;
    }

    setUploadProgress(25);
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    reader.onload = () => {
      setUploadProgress(null);
      setAttachedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          url: reader.result as string,
          type: file.type,
          size: file.size,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Submit New Request
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newTitle.trim()) {
      setFormError('Request Title is required.');
      return;
    }
    if (!newDesc.trim()) {
      setFormError('Description and purpose are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestService.createRequest({
        studentId: userProfile?.studentId || 'STU2026001',
        studentName: userProfile?.name || 'Aarav Sharma',
        studentEmail: userProfile?.email || 'student@campuslife.edu',
        department: userProfile?.department || 'Computer Science & Engineering',
        requestType: newType,
        title: newTitle.trim(),
        description: newDesc.trim(),
        attachments: attachedFiles,
      });

      if (!res.success) {
        setFormError(res.error || 'Failed to submit request.');
        setIsSubmitting(false);
        return;
      }

      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setAttachedFiles([]);
      setToastMessage('Your request has been successfully submitted and queued for verification.');
      setTimeout(() => setToastMessage(null), 5000);
      loadRequests();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Detail / Timeline Modal
  const handleOpenDetail = (req: StudentRequest) => {
    setSelectedRequest(req);
    setIsDetailModalOpen(true);
  };

  // Open Certificate Viewer Modal
  const handleOpenCertificate = async (req: StudentRequest) => {
    try {
      const certs = await certificateService.getStudentCertificates(req.studentId);
      const matched = certs.find((c) => c.requestId === req.requestId);

      if (matched) {
        setViewCertificate(matched);
      } else {
        // Fallback realistic certificate view if matched record is generating
        setViewCertificate({
          id: 'cert_temp',
          certificateId: `CERT-2026-${req.requestId.replace('REQ-2026-', '')}`,
          requestId: req.requestId,
          studentId: req.studentId,
          studentName: req.studentName,
          studentRoll: userProfile?.rollNumber || '220101001',
          department: req.department,
          branch: userProfile?.branch || 'CSE',
          year: userProfile?.year || 3,
          semester: userProfile?.semester || 6,
          certificateType: req.title,
          issueDate: req.updatedAt,
          issuedBy: req.assignedStaffName || 'Prof. Rajesh Swain',
          issuedByRole: 'SUB_ADMIN',
          purpose: req.description,
          status: 'ACTIVE',
          institutionName: 'Biju Patnaik University of Technology — Campus Life',
        });
      }
      setIsCertModalOpen(true);
    } catch (err) {
      console.warn('Failed to open certificate viewer:', err);
    }
  };

  // Open Admin Action Modal
  const handleOpenAdminAction = (req: StudentRequest) => {
    setSelectedRequest(req);
    setActionStatus('APPROVED');
    setActionComment('');
    setAssignedDept(req.assignedDepartment || 'Academic Affairs');
    setIsAdminActionModalOpen(true);
  };

  // Submit Admin Action
  const handleSubmitAdminAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsProcessingAction(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin_001',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await requestService.updateRequestStatus({
        requestId: selectedRequest.id,
        newStatus: actionStatus,
        actor,
        comment: actionComment.trim() || undefined,
        assignedDepartment: assignedDept,
        assignedStaffName: userProfile?.name || 'Authorized Officer',
      });

      if (!res.success) {
        alert(res.error || 'Failed to update request.');
        setIsProcessingAction(false);
        return;
      }

      setIsAdminActionModalOpen(false);
      setToastMessage(`Request #${selectedRequest.requestId} marked as ${actionStatus.replace('_', ' ')}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Error occurred while processing request.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filter Requests
  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && r.requestType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.requestId.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING' || r.status === 'UNDER_REVIEW' || r.status === 'IN_PROGRESS').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED').length;

  const renderStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="info">Under Review</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="info">Pending</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Student Requests & Certificates</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Digital issuance for Bonafide, Study, Character certificates, leave applications, and administrative verifications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadRequests}
          >
            Refresh
          </Button>

          {(role === 'STUDENT' || activeTab === 'my_requests') && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormError(null);
                setIsCreateModalOpen(true);
              }}
            >
              New Certificate Request
            </Button>
          )}
        </div>
      </div>

      {/* Role Navigation Switcher (for Admins) */}
      {isAdminOrAuthorized && (
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--color-border)', paddingBottom: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('all_requests')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'all_requests' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'all_requests' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'all_requests' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            All Student Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my_requests')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'my_requests' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'my_requests' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'my_requests' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            My Submissions
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid-cards-3">
        <StatCard
          label="Pending Review"
          value={pendingCount}
          subtitle="In pipeline or under verification"
          icon={<Clock size={22} />}
        />
        <StatCard
          label="Approved / Issued"
          value={approvedCount}
          subtitle="Certificates available for viewing"
          icon={<CheckCircle2 size={22} />}
        />
        <StatCard
          label="Total Submissions"
          value={requests.length}
          subtitle="Academic year 2025–2026"
          icon={<FileText size={22} />}
        />
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <label htmlFor={searchInputId} style={{ display: 'none' }}>
              Search requests
            </label>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              id={searchInputId}
              type="text"
              className="input-field"
              placeholder="Search by title, ID, applicant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>

          <div style={{ width: '170px' }}>
            <select
              aria-label="Filter by request status"
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="APPROVED">Approved</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div style={{ width: '190px' }}>
            <select
              aria-label="Filter by certificate or request type"
              className="input-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="bonafide_certificate">Bonafide Certificate</option>
              <option value="study_certificate">Study Certificate</option>
              <option value="character_certificate">Character Certificate</option>
              <option value="leave_request">Duty / Leave Request</option>
              <option value="document_request">Document Verification</option>
              <option value="campus_service">Campus Service</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Requests Table / Cards */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
            <Skeleton height="45px" />
            <Skeleton height="45px" />
            <Skeleton height="45px" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No Requests Found"
            description={
              role === 'STUDENT' || activeTab === 'my_requests'
                ? "No applications match your filter criteria. Click 'New Certificate Request' to apply."
                : 'No student applications match your filter criteria.'
            }
            icon={<FileText size={40} />}
          />
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="table-responsive hide-on-mobile">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Request Title & ID</th>
                    <th>Applicant</th>
                    <th>Type</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{req.title}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            {req.requestId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{req.studentName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{req.studentId}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {req.requestType.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </td>
                      <td>{renderStatusBadge(req.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Clock size={13} />}
                            onClick={() => handleOpenDetail(req)}
                          >
                            Timeline
                          </Button>

                          {(req.status === 'APPROVED' || req.status === 'COMPLETED') && (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<FileCheck size={13} />}
                              onClick={() => handleOpenCertificate(req)}
                            >
                              Certificate
                            </Button>
                          )}

                          {isAdminOrAuthorized && (
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: 'var(--color-primary)' }}
                              onClick={() => handleOpenAdminAction(req)}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="show-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{req.title}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        #{req.requestId} • {new Date(req.submittedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {renderStatusBadge(req.status)}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Type: <strong style={{ textTransform: 'capitalize' }}>{req.requestType.replace('_', ' ')}</strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'flex-end',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button variant="outline" size="sm" leftIcon={<Clock size={13} />} onClick={() => handleOpenDetail(req)}>
                      Timeline
                    </Button>
                    {(req.status === 'APPROVED' || req.status === 'COMPLETED') && (
                      <Button variant="primary" size="sm" leftIcon={<FileCheck size={13} />} onClick={() => handleOpenCertificate(req)}>
                        Certificate
                      </Button>
                    )}
                    {isAdminOrAuthorized && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenAdminAction(req)}>
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* NEW REQUEST MODAL (Section 13 & 14)                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Submit New Request / Certificate"
        size="large"
      >
        <form onSubmit={handleSubmitCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <div>
            <label className="input-label" htmlFor="req-type">Request Type *</label>
            <select
              id="req-type"
              className="input-field"
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
            >
              <option value="bonafide_certificate">Bonafide Certificate (Scholarship, Visa, Bank)</option>
              <option value="study_certificate">Study & Conduct Certificate</option>
              <option value="character_certificate">Character & Moral Certificate</option>
              <option value="leave_request">Duty / Leave Application (Events, Medical)</option>
              <option value="document_request">Academic Transcript / Document Verification</option>
              <option value="campus_service">Campus Service Request</option>
              <option value="other">Other Official Request</option>
            </select>
          </div>

          <div>
            <label className="input-label" htmlFor="req-title">Application Subject / Title *</label>
            <input
              id="req-title"
              type="text"
              required
              className="input-field"
              placeholder="e.g. Bonafide Certificate for National Scholarship Portal 2026"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="input-label" htmlFor="req-desc">Purpose & Justification *</label>
            <textarea
              id="req-desc"
              required
              className="input-field"
              rows={3}
              placeholder="Provide context, required submission authority, and relevant details..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>

          {/* Optional Attachment Upload (Section 14 & 32) */}
          <div>
            <label className="input-label" htmlFor="req-file-input">
              Supporting Documentation (Optional, Max 5MB)
            </label>
            <input
              ref={fileInputRef}
              id="req-file-input"
              type="file"
              onChange={handleFileAttach}
              style={{ display: 'none' }}
              aria-label="Upload supporting document"
            />
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach File / Receipt
              </Button>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                PDF, JPG, PNG accepted
              </span>
            </div>

            {uploadProgress !== null && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Attaching file... {uploadProgress}%
              </div>
            )}

            {attachedFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                {attachedFiles.map((file, idx) => (
                  <div
                    key={file.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0.6rem',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* REQUEST DETAIL & TRACKING TIMELINE MODAL (Section 16 & 17)                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Request Tracking: #${selectedRequest?.requestId}`}
        size="large"
      >
        {selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedRequest.title}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Applicant: <strong>{selectedRequest.studentName}</strong> ({selectedRequest.studentId})
                </div>
              </div>
              {renderStatusBadge(selectedRequest.status)}
            </div>

            {/* Description & Metadata */}
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div><strong>Description:</strong> {selectedRequest.description}</div>
              <div><strong>Department:</strong> {selectedRequest.department}</div>
              {selectedRequest.assignedDepartment && (
                <div><strong>Handling Cell:</strong> {selectedRequest.assignedDepartment} ({selectedRequest.assignedStaffName || 'Officer'})</div>
              )}
            </div>

            {/* Visual Tracking Timeline (Section 16) */}
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Processing History & Timeline</h4>
              <div className="timeline">
                {selectedRequest.timeline.map((step, idx) => (
                  <div key={step.id} className="timeline-step">
                    <div
                      className={`timeline-dot ${
                        idx === selectedRequest.timeline.length - 1 ? 'active' : 'completed'
                      }`}
                    />
                    <div className="timeline-step-title">{step.action}</div>
                    <div className="timeline-step-meta">
                      {step.date} • {step.time} • {step.actor} ({step.actorRole})
                    </div>
                    {step.message && (
                      <div className="timeline-step-desc">{step.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* DIGITAL CERTIFICATE VIEWER MODAL (Section 21 & 22)                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        title="Official Digital Certificate"
        size="large"
      >
        {viewCertificate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Certificate Canvas / Card */}
            <div
              id="printable-certificate"
              style={{
                border: '3px double var(--color-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem 1.5rem',
                backgroundColor: 'var(--color-bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '1.25rem',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Institution Seal */}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.04em', color: 'var(--color-primary)' }}>
                  BIJU PATNAIK UNIVERSITY OF TECHNOLOGY
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.2rem' }}>
                  CENTRAL ACADEMIC AFFAIRS & CERTIFICATION REGISTRY
                </div>
              </div>

              {/* Certificate Title */}
              <div style={{ margin: '0.5rem 0' }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem', textDecoration: 'underline', textUnderlineOffset: '6px' }}>
                  {viewCertificate.certificateType}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '0.35rem' }}>
                  Reference No.: <strong>{viewCertificate.certificateId}</strong>
                </div>
              </div>

              {/* Certificate Body Text */}
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '640px', color: 'var(--color-text-main)' }}>
                This is to officially certify that <strong>{viewCertificate.studentName}</strong>, bearing University Roll Number <strong>{viewCertificate.studentRoll}</strong> and Student ID <strong>{viewCertificate.studentId}</strong>, is a bonafide student of this institution pursuing <strong>Bachelor of Technology ({viewCertificate.branch})</strong> in the Department of <strong>{viewCertificate.department}</strong> during Academic Session 2025–26.
              </p>

              {viewCertificate.purpose && (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', maxWidth: '600px' }}>
                  Certified for official use: "{viewCertificate.purpose}"
                </div>
              )}

              {/* Signatures & Issue Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Date of Issuance:</span>
                  <strong>{new Date(viewCertificate.issueDate).toLocaleDateString()}</strong>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{viewCertificate.issuedBy}</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>Authorized Administrative Officer</div>
                  <Badge variant="success" style={{ marginTop: '0.2rem' }}>Digitally Verified</Badge>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Certificate Reference: {viewCertificate.certificateId}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" leftIcon={<Printer size={15} />} onClick={() => window.print()}>
                  Print Certificate
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsCertModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* ADMIN ACTION / PROCESS MODAL (Section 18 & 19)                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAdminActionModalOpen}
        onClose={() => setIsAdminActionModalOpen(false)}
        title={`Process Request: #${selectedRequest?.requestId}`}
        size="normal"
      >
        {selectedRequest && (
          <form onSubmit={handleSubmitAdminAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              <div><strong>Application:</strong> {selectedRequest.title}</div>
              <div><strong>Student:</strong> {selectedRequest.studentName} ({selectedRequest.studentId})</div>
              <div><strong>Current Status:</strong> {selectedRequest.status}</div>
            </div>

            <div>
              <label className="input-label" htmlFor="adm-status">Update Status *</label>
              <select
                id="adm-status"
                className="input-field"
                value={actionStatus}
                onChange={(e) => setActionStatus(e.target.value as any)}
              >
                <option value="UNDER_REVIEW">UNDER_REVIEW (Verify Records)</option>
                <option value="IN_PROGRESS">IN_PROGRESS (Forward to HOD / Dean)</option>
                <option value="APPROVED">APPROVED (Authorize & Issue Certificate)</option>
                <option value="COMPLETED">COMPLETED (Closed / Delivered)</option>
                <option value="REJECTED">REJECTED (Decline Application)</option>
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="adm-dept">Assigned Handling Department</label>
              <input
                id="adm-dept"
                type="text"
                className="input-field"
                value={assignedDept}
                onChange={(e) => setAssignedDept(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="adm-comment">Officer Comment / Resolution Note</label>
              <textarea
                id="adm-comment"
                className="input-field"
                rows={2}
                placeholder="e.g. Verified semester fee clearances and scholarship portal prerequisites. Approved."
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <Button variant="ghost" type="button" onClick={() => setIsAdminActionModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isProcessingAction}>
                Confirm Status Update
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
