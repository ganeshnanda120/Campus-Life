import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import {
  DoorOpen,
  Plus,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Search,
  Printer,
  ShieldCheck,
  XCircle,
  Clock,
  Upload,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import { gatePassService } from '../../services/gatePassService';
import type {
  GatePass,
  GatePassStatus,
  VisitorExitLog,
  AttachmentFile,
} from '../../types';

export const GatePassPage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printPassRef = useRef<HTMLDivElement>(null);

  const destId = useId();
  const reasonId = useId();
  const leaveDateId = useId();
  const leaveTimeId = useId();
  const returnTimeId = useId();
  const descId = useId();

  const isWardenOrAdmin =
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && (permissions.includes('MANAGE_GATE_PASS') || permissions.includes('APPROVE_GATE_PASS')));

  const isSecurityOrStaff = role === 'STAFF' || isWardenOrAdmin;

  const [passes, setPasses] = useState<GatePass[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorExitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<GatePass | null>(null);
  const [isDigitalPassOpen, setIsDigitalPassOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // New Request Form State
  const [dest, setDest] = useState('');
  const [reason, setReason] = useState('');
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveTime, setLeaveTime] = useState('05:00 PM');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rejection Modal State
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionAttachment, setRejectionAttachment] = useState<{ url: string; type: 'image' | 'video' } | undefined>(undefined);
  const [isRejecting, setIsRejecting] = useState(false);

  // Security Verification State
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [scannedPass, setScannedPass] = useState<GatePass | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (role === 'STUDENT' && userProfile?.uid) {
        filters.studentId = userProfile.uid;
      }
      const passData = await gatePassService.getPasses(filters);
      setPasses(passData);

      if (isSecurityOrStaff) {
        const logs = await gatePassService.getVisitorLogs();
        setVisitorLogs(logs);
      }
    } catch (err) {
      console.warn('Failed to load gate pass data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role, userProfile?.uid, isSecurityOrStaff]);

  useEffect(() => {
    setIsLoading(true);
    const filters: any = {};
    if (role === 'STUDENT' && userProfile?.uid) {
      filters.studentId = userProfile.uid;
    }

    const unsubscribe = gatePassService.subscribePasses(filters, (passData) => {
      setPasses(passData);
      setIsLoading(false);
    });

    if (isSecurityOrStaff) {
      gatePassService.getVisitorLogs().then(setVisitorLogs).catch(() => {});
    }

    return () => {
      unsubscribe();
    };
  }, [role, userProfile?.uid, isSecurityOrStaff]);

  // Operational metrics
  const pendingCount = passes.filter((p) => p.status === 'PENDING').length;
  const approvedCount = passes.filter((p) => p.status === 'APPROVED').length;
  const rejectedCount = passes.filter((p) => p.status === 'REJECTED').length;

  // Filtered passes
  const filteredPasses = passes.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.gatePassId.toLowerCase().includes(q) ||
        p.destination.toLowerCase().includes(q) ||
        p.reason.toLowerCase().includes(q) ||
        p.studentName.toLowerCase().includes(q) ||
        p.studentRoll.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPasses.length / pageSize));
  const paginatedPasses = filteredPasses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Create gate pass
  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest.trim() || !reason.trim() || !leaveDate || !leaveTime || !expectedReturn.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await gatePassService.createPassRequest({
        studentId: userProfile?.uid || 'student_uid_001',
        studentName: userProfile?.name || 'Student Member',
        studentRoll: userProfile?.rollNumber || '220101001',
        studentCategory: userProfile?.studentCategory || 'HOSTELER',
        destination: dest.trim(),
        reason: reason.trim(),
        leavingDate: leaveDate,
        leavingTime: leaveTime,
        expectedReturn: expectedReturn.trim(),
        description: description.trim() || undefined,
        attachments,
      });

      setIsRequestModalOpen(false);
      setDest('');
      setReason('');
      setDescription('');
      setAttachments([]);
      setToastMessage(`Gate Pass Application #${created.gatePassId} submitted for warden clearance.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit gate pass.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve gate pass
  const handleApprove = async (pass: GatePass) => {
    try {
      await gatePassService.approvePass(pass.id, {
        approverId: userProfile?.uid || 'admin_001',
        approverName: userProfile?.name || 'Hostel Warden',
        approverRole: role || 'SUB_ADMIN',
      });
      setToastMessage(`Gate Pass #${pass.gatePassId} has been approved.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve gate pass.');
    }
  };

  // Open Rejection modal
  const openRejectModal = (pass: GatePass) => {
    setSelectedPass(pass);
    setRejectionReason('');
    setRejectionAttachment(undefined);
    setIsRejectModalOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!selectedPass) return;
    if (!rejectionReason.trim()) {
      alert('Please specify the reason for rejecting this gate pass.');
      return;
    }

    setIsRejecting(true);
    try {
      await gatePassService.rejectPass(selectedPass.id, {
        rejecterId: userProfile?.uid || 'admin_001',
        rejecterName: userProfile?.name || 'Hostel Warden',
        rejecterRole: role || 'SUB_ADMIN',
        reason: rejectionReason.trim(),
        attachment: rejectionAttachment,
      });

      setIsRejectModalOpen(false);
      setSelectedPass(null);
      setToastMessage(`Gate Pass #${selectedPass.gatePassId} has been rejected.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject gate pass.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Verify safe token for gate checkpoint
  const handleVerifyToken = async () => {
    setScanMessage(null);
    if (!verifyTokenInput.trim()) return;

    const pass = await gatePassService.getPassByToken(verifyTokenInput.trim());
    if (!pass) {
      setScanMessage({ type: 'danger', text: 'INVALID TOKEN: No matching gate pass record found.' });
      setScannedPass(null);
      return;
    }

    setScannedPass(pass);
    if (pass.status === 'APPROVED') {
      setScanMessage({ type: 'success', text: `VALID PASS: ${pass.studentName} (${pass.studentRoll}) authorized for exit.` });
    } else {
      setScanMessage({ type: 'danger', text: `DENIED: Pass #${pass.gatePassId} has status ${pass.status}. Egress not permitted.` });
    }
  };

  // Record exit / return
  const handleRecordLog = async (type: 'EXIT' | 'RETURN') => {
    if (!scannedPass) return;
    try {
      await gatePassService.recordExitOrReturn({
        passId: scannedPass.id,
        type,
        recordedBy: userProfile?.name || 'Security Gate In-Charge',
        recordedByRole: role || 'STAFF',
      });
      setToastMessage(`Successfully recorded ${type} for ${scannedPass.studentName}.`);
      setTimeout(() => setToastMessage(null), 5000);
      setScannedPass(null);
      setVerifyTokenInput('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record entry/exit.');
    }
  };

  const getStatusBadge = (status: GatePassStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success"><CheckCircle2 size={12} /> APPROVED</Badge>;
      case 'PENDING':
        return <Badge variant="warning"><Clock size={12} /> PENDING REVIEW</Badge>;
      case 'REJECTED':
        return <Badge variant="danger"><XCircle size={12} /> REJECTED</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">CANCELLED</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger">EXPIRED</Badge>;
      case 'USED':
        return <Badge variant="info">USED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
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
          <h1 style={{ marginBottom: '0.25rem' }}>Digital Gate Pass Clearance</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Biometric hostel egress authorization, encrypted QR verification tokens, and security checkpoint audit logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadData}
          >
            Refresh
          </Button>

          {role === 'STUDENT' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} />}
              onClick={() => setIsRequestModalOpen(true)}
            >
              Request Gate Pass
            </Button>
          )}
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="grid-cards">
        <StatCard
          label="Pending Clearance"
          value={String(pendingCount)}
          subtitle="Warden review required"
          icon={<DoorOpen size={22} style={{ color: 'var(--color-warning, #d97706)' }} />}
        />
        <StatCard
          label="Active Passes"
          value={String(approvedCount)}
          subtitle="Cleared for campus egress"
          icon={<CheckCircle2 size={22} style={{ color: 'var(--color-success, #16a34a)' }} />}
        />
        <StatCard
          label="Rejected Applications"
          value={String(rejectedCount)}
          subtitle="With formal justification"
          icon={<XCircle size={22} style={{ color: 'var(--color-danger, #dc2626)' }} />}
        />
      </div>

      {/* Security Checkpoint Verification Box (For Staff & Admin) */}
      {isSecurityOrStaff && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Security Gate Token Verification Checkpoint</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Scan QR code or enter student's safe digital pass token to authorize campus exit or return.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Enter Token (e.g., GP-TOKEN:GP-2026-441:...)"
                value={verifyTokenInput}
                onChange={(e) => setVerifyTokenInput(e.target.value)}
                style={{ flex: '1 1 300px', fontSize: '0.85rem' }}
                aria-label="Gate Pass Safe Token"
              />
              <Button variant="primary" size="sm" onClick={handleVerifyToken}>
                Verify Pass
              </Button>
            </div>

            {scanMessage && (
              <Alert variant={scanMessage.type}>{scanMessage.text}</Alert>
            )}

            {scannedPass && (
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{scannedPass.studentName} ({scannedPass.studentRoll})</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Destination: {scannedPass.destination} • Permitted Exit: {scannedPass.leavingDate} {scannedPass.leavingTime}
                  </div>
                </div>

                {scannedPass.status === 'APPROVED' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant="outline" size="sm" onClick={() => handleRecordLog('EXIT')}>
                      Log Student Exit
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleRecordLog('RETURN')}>
                      Log Student Return
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filter and Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search destination, student, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
              aria-label="Search gate passes"
            />
          </div>

          <div style={{ width: '160px' }}>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.85rem' }}
              aria-label="Filter status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : paginatedPasses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
            No gate pass records found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pass ID & Student</th>
                  <th>Destination & Reason</th>
                  <th>Exit & Return Schedule</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPasses.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>#{p.gatePassId}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {p.studentName} ({p.studentRoll})
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.destination}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{p.reason}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem' }}>Exit: {p.leavingDate} at {p.leavingTime}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Return: {p.expectedReturn}</div>
                    </td>
                    <td>{getStatusBadge(p.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {p.status === 'APPROVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<QrCode size={14} />}
                            onClick={() => {
                              setSelectedPass(p);
                              setIsDigitalPassOpen(true);
                            }}
                          >
                            Digital Pass
                          </Button>
                        )}

                        {isWardenOrAdmin && p.status === 'PENDING' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(p)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRejectModal(p)}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {p.status === 'REJECTED' && p.rejectionReason && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              alert(`Rejection Justification for #${p.gatePassId}:\n\n${p.rejectionReason}`);
                            }}
                          >
                            View Reason
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
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

      {/* Visitor / Exit Log Table (For Security Staff) */}
      {isSecurityOrStaff && visitorLogs.length > 0 && (
        <Card>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Checkpoint Egress / Ingress Audit History</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Verified biometric security gate logs
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pass Reference</th>
                  <th>Student Name</th>
                  <th>Departure Time</th>
                  <th>Return Time</th>
                  <th>Status</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {visitorLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>#{log.gatePassId}</td>
                    <td>{log.studentName} ({log.studentRoll})</td>
                    <td>{new Date(log.exitTime).toLocaleString()}</td>
                    <td>{log.actualReturn ? new Date(log.actualReturn).toLocaleString() : 'Not returned yet'}</td>
                    <td>
                      <Badge variant={log.status === 'RETURNED' ? 'success' : 'warning'}>
                        {log.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{log.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Request Gate Pass Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => !isSubmitting && setIsRequestModalOpen(false)}
        title="Apply for Campus Gate Pass"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePass} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreatePass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert variant="danger">{formError}</Alert>}

          <div>
            <label htmlFor={destId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Destination *
            </label>
            <input
              id={destId}
              type="text"
              className="input-field"
              placeholder="e.g. Cuttack (Home), Bhubaneswar Station"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={reasonId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Reason for Leaving Campus *
            </label>
            <input
              id={reasonId}
              type="text"
              className="input-field"
              placeholder="e.g. Festival Vacation, Medical Appointment, Project Hardware"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor={leaveDateId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Departure Date *
              </label>
              <input
                id={leaveDateId}
                type="date"
                className="input-field"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor={leaveTimeId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Departure Time *
              </label>
              <input
                id={leaveTimeId}
                type="text"
                className="input-field"
                placeholder="05:00 PM"
                value={leaveTime}
                onChange={(e) => setLeaveTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor={returnTimeId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Expected Return Date & Time *
            </label>
            <input
              id={returnTimeId}
              type="text"
              className="input-field"
              placeholder="e.g. 2026-10-08 08:00 PM"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={descId} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Additional Information / Travel Tickets
            </label>
            <textarea
              id={descId}
              className="input-field"
              rows={2}
              placeholder="Train ticket PNR, parent confirmation, or contact phone..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Digital Gate Pass Modal with QR (Section 20 & 21) */}
      {selectedPass && (
        <Modal
          isOpen={isDigitalPassOpen}
          onClose={() => setIsDigitalPassOpen(false)}
          title="Digital Campus Gate Pass"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer size={15} />}
                onClick={() => window.print()}
              >
                Print Pass
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsDigitalPassOpen(false)}>
                Done
              </Button>
            </div>
          }
        >
          <div ref={printPassRef} style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-subtle)',
                display: 'inline-block',
                marginBottom: '1rem',
              }}
            >
              <QRCodeSVG value={selectedPass.token} size={180} />
            </div>

            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {selectedPass.studentName}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Roll: {selectedPass.studentRoll} • Pass #{selectedPass.gatePassId}
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <Badge variant="success">AUTHORIZED FOR EXIT</Badge>
            </div>

            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-subtle)',
                fontSize: '0.85rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div><strong>Destination:</strong> {selectedPass.destination}</div>
              <div><strong>Reason:</strong> {selectedPass.reason}</div>
              <div><strong>Permitted Exit:</strong> {selectedPass.leavingDate} at {selectedPass.leavingTime}</div>
              <div><strong>Expected Return:</strong> {selectedPass.expectedReturn}</div>
              <div><strong>Approved By:</strong> {selectedPass.approvedBy || 'Hostel Warden'}</div>
              <div><strong>Verification Token:</strong> <code style={{ fontSize: '0.75rem' }}>{selectedPass.token}</code></div>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Modal with Mandatory Justification (Section 19) */}
      {selectedPass && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => !isRejecting && setIsRejectModalOpen(false)}
          title={`Reject Gate Pass Application #${selectedPass.gatePassId}`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
              <Button
                variant="outline"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isRejecting}
              >
                Cancel Reject
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReject}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Alert variant="danger">
              Please provide clear institutional justification for declining this gate pass. The student will be notified immediately.
            </Alert>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Rejection Reason *
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="e.g., Parent confirmation not provided, impending semester examination attendance deficiency..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Optional Attachment (Parent SMS screenshot / Circular)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setRejectionAttachment({
                      url: URL.createObjectURL(f),
                      type: f.type.startsWith('video/') ? 'video' : 'image',
                    });
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach File
              </Button>
              {rejectionAttachment && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  📎 Attachment ready for upload.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
