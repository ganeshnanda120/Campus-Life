import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  BookOpen,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Eye,
  Edit3,
  Layers,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import {
  attendanceService,
  type StudentAttendanceSummary,
} from '../../services/attendanceService';
import {
  canPerformAction,
  getAccessibleBranches,
  areBranchesEqual,
} from '../../services/permissionService';
import { MakeAttendanceModal } from '../../components/attendance/MakeAttendanceModal';
import type { AttendanceSession } from '../../types';

export const AttendancePage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [searchParams] = useSearchParams();
  const urlBranch = searchParams.get('branch');

  const canTakeAttendance =
    role === 'MAIN_ADMIN' ||
    canPerformAction(userProfile, 'MANAGE_ATTENDANCE', urlBranch || undefined, 'take_attendance') ||
    canPerformAction(userProfile, 'MANAGE_ATTENDANCE', urlBranch || undefined, 'add');

  const isUrlBranchUnauthorized = Boolean(
    urlBranch &&
      urlBranch.trim() &&
      urlBranch !== 'ALL' &&
      role !== 'MAIN_ADMIN' &&
      !canPerformAction(userProfile, 'MANAGE_ATTENDANCE', urlBranch, 'view')
  );

  // Active view tab for Faculty/Admin: 'STUDENT_VIEW' or 'SESSIONS'
  const isFacultyOrAdmin = role === 'MAIN_ADMIN' || role === 'SUB_ADMIN' || role === 'FACULTY' || role === 'STAFF';
  const [activeTab, setActiveTab] = useState<'STUDENT_VIEW' | 'SESSIONS'>(
    isFacultyOrAdmin && canTakeAttendance ? 'SESSIONS' : 'STUDENT_VIEW'
  );

  // Student Attendance States
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 12;

  // Faculty Attendance Sessions List States
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionBranchFilter, setSessionBranchFilter] = useState('ALL');
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  // Make Attendance Modal States (Section 9)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [modalSessionId, setModalSessionId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | 'VIEW'>('CREATE');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const studentId = userProfile?.studentId || 'STU2026001';

  // Load student summary
  const loadAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await attendanceService.getStudentAttendance(studentId);
      setSummary(data);
    } catch (err) {
      console.warn('Failed to load student attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  // Real-time subscription for student attendance (Section 19 & 36)
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = attendanceService.subscribeStudentAttendance(studentId, (data) => {
      setSummary(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [studentId]);

  // Real-time subscription for attendance sessions (faculty/admin history)
  useEffect(() => {
    if (!isFacultyOrAdmin) return;
    setIsSessionsLoading(true);
    const branchToListen = urlBranch && urlBranch !== 'ALL' ? urlBranch : undefined;
    const unsubscribe = attendanceService.subscribeAttendanceSessions(branchToListen, (list) => {
      setSessions(list);
      setIsSessionsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [isFacultyOrAdmin, urlBranch]);

  // Handle open Make Attendance Modal
  const handleOpenCreateAttendance = () => {
    if (!canTakeAttendance) {
      alert("You don't have permission to take attendance.");
      return;
    }
    setModalSessionId(null);
    setModalMode('CREATE');
    setIsAttendanceModalOpen(true);
  };

  // Handle open existing session in View mode
  const handleViewSession = (session: AttendanceSession) => {
    setModalSessionId(session.id);
    setModalMode('VIEW');
    setIsAttendanceModalOpen(true);
  };

  // Handle open existing session in Edit mode (Section 37)
  const handleEditSession = (session: AttendanceSession) => {
    const hasEditPermission =
      role === 'MAIN_ADMIN' ||
      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', session.branch, 'edit_attendance') ||
      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', session.branch, 'edit');

    if (!hasEditPermission) {
      alert('Unauthorized: You do not have permission to edit attendance for this branch.');
      return;
    }

    setModalSessionId(session.id);
    setModalMode('EDIT');
    setIsAttendanceModalOpen(true);
  };

  // Filter history log for student view
  const filteredHistory = (summary?.history || []).filter((item) => {
    if (historyFilter !== 'ALL' && item.subjectCode !== historyFilter) {
      return false;
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      return (
        item.subjectCode.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        item.facultyName.toLowerCase().includes(q) ||
        (item.period && item.period.toLowerCase().includes(q)) ||
        item.date.includes(q)
      );
    }
    return true;
  });

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  // Filter sessions for faculty/admin view
  const accessibleViewBranches = useMemo(() => {
    if (role === 'MAIN_ADMIN') return ['ALL'];
    return getAccessibleBranches(userProfile, 'MANAGE_ATTENDANCE', 'view');
  }, [userProfile, role]);

  const filteredSessions = sessions.filter((s) => {
    // Branch scope filter
    if (role !== 'MAIN_ADMIN') {
      const isAllowed = accessibleViewBranches.some((ab) => areBranchesEqual(ab, s.branch));
      if (!isAllowed) return false;
    }

    if (sessionBranchFilter !== 'ALL' && !areBranchesEqual(s.branch, sessionBranchFilter)) {
      return false;
    }

    if (sessionSearch.trim()) {
      const q = sessionSearch.toLowerCase();
      return (
        s.branch.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.subjectName.toLowerCase().includes(q) ||
        s.facultyName.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        (s.period && s.period.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (isUrlBranchUnauthorized) {
    return (
      <div style={{ padding: '2.5rem 1.5rem', maxWidth: '560px', margin: '2rem auto', textAlign: 'center' }}>
        <div className="card">
          <div className="card-body" style={{ padding: '2rem' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--status-danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ShieldAlert size={30} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Branch Access Denied</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              You don't have permission to access this branch ({urlBranch}).
            </p>
            <Button variant="primary" onClick={() => window.history.back()}>
              Return
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 style={{ marginBottom: '0.25rem' }}>Academic Attendance</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Subject-wise attendance tracking, period-level session management, and statutory 75% eligibility monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading || isSessionsLoading ? 'spin' : ''} />}
            onClick={() => {
              loadAttendance();
              if (isFacultyOrAdmin) {
                attendanceService.getAttendanceSessions().then(setSessions).catch(() => {});
              }
            }}
          >
            Refresh
          </Button>

          {/* Authorized Attendance Action (Section 8, 9) */}
          {canTakeAttendance && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={handleOpenCreateAttendance}
            >
              Make Attendance
            </Button>
          )}
        </div>
      </div>

      {/* View Switcher for Faculty/Admin */}
      {isFacultyOrAdmin && (
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'SESSIONS' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('SESSIONS')}
          >
            <Layers size={14} style={{ marginRight: '6px' }} />
            Attendance Sessions ({filteredSessions.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'STUDENT_VIEW' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('STUDENT_VIEW')}
          >
            <BookOpen size={14} style={{ marginRight: '6px' }} />
            Student Attendance Details
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: FACULTY / ADMIN SESSIONS HISTORY (Section 28)                      */}
      {/* ========================================================================= */}
      {isFacultyOrAdmin && activeTab === 'SESSIONS' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Recorded Attendance Sessions</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Sessions conducted within your authorized branch scope
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search sessions..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
                />
              </div>

              {accessibleViewBranches.length > 1 && (
                <div style={{ width: '160px' }}>
                  <select
                    className="input-field"
                    value={sessionBranchFilter}
                    onChange={(e) => setSessionBranchFilter(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                  >
                    <option value="ALL">All Branches</option>
                    {accessibleViewBranches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Period</th>
                  <th>Academic Context</th>
                  <th>Course & Faculty</th>
                  <th>Present / Total</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isSessionsLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading verified attendance sessions...
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No attendance sessions recorded matching criteria. Click "Make Attendance" to record a new session.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((sess) => {
                    const canEditThis =
                      role === 'MAIN_ADMIN' ||
                      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', sess.branch, 'edit_attendance') ||
                      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', sess.branch, 'edit');

                    const percentage = sess.totalStudents > 0
                      ? Math.round((sess.presentCount / sess.totalStudents) * 100)
                      : 0;

                    return (
                      <tr key={sess.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                            {sess.date}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sess.period || 'Period 1'}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Badge variant="info">{sess.branch}</Badge>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Sem {sess.semester} - Sec {sess.section}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sess.department}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {sess.subjectCode}: {sess.subjectName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            By {sess.facultyName}
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{sess.presentCount}</strong> / {sess.totalStudents} ({percentage}%)
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>
                            {sess.absentCount} Absent
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Eye size={13} />}
                              onClick={() => handleViewSession(sess)}
                            >
                              View
                            </Button>
                            {canEditThis && (
                              <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<Edit3 size={13} />}
                                onClick={() => handleEditSession(sess)}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED STUDENT ATTENDANCE VIEW (Section 20, 21, 22, 45, 47)      */}
      {/* ========================================================================= */}
      {(!isFacultyOrAdmin || activeTab === 'STUDENT_VIEW') && (
        <>
          {/* Section 20, 21, 45, 47: KPI Stats */}
          <div className="grid-cards-3">
            <StatCard
              label="Overall Attendance"
              value={summary ? `${summary.overallPercentage}%` : '0%'}
              subtitle={
                <Badge variant={summary?.isEligible ? 'success' : 'danger'}>
                  {summary?.isEligible ? 'Eligible for Exams (>= 75%)' : 'Shortage Alert (< 75%)'}
                </Badge>
              }
              icon={<CalendarCheck size={22} />}
            />

            <StatCard
              label="Total Classes Attended"
              value={summary ? `${summary.attendedClasses} / ${summary.totalClasses}` : '0 / 0'}
              subtitle={`Conducted: ${summary?.totalClasses || 0} | Present: ${summary?.attendedClasses || 0} | Absent: ${summary?.missedClasses || 0}`}
              icon={<BookOpen size={22} />}
            />

            <StatCard
              label="Subject Health"
              value={
                summary
                  ? `${summary.subjects.filter((s) => s.percentage >= 75).length} of ${summary.subjects.length} Safe`
                  : 'All Safe'
              }
              subtitle="Strict ratio: total present / conducted"
              icon={<CheckCircle2 size={22} />}
            />
          </div>

          {/* Subject-Wise Attendance Breakdown Table */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Subject-Wise Attendance Details</h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Verified Roster Breakdown</span>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton height="45px" />
                <Skeleton height="45px" />
                <Skeleton height="45px" />
              </div>
            ) : summary?.subjects.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No conducted subject attendance records found for this student.
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="table-responsive hide-on-mobile">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course Code & Title</th>
                        <th>Faculty Instructor</th>
                        <th>Present / Conducted</th>
                        <th>Percentage</th>
                        <th>Eligibility Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.subjects.map((sub) => {
                        let badge = <Badge variant="success">Eligible</Badge>;
                        if (sub.percentage < 65) {
                          badge = <Badge variant="danger">Critical Shortage</Badge>;
                        } else if (sub.percentage < 75) {
                          badge = <Badge variant="warning">Warning (&lt;75%)</Badge>;
                        }

                        return (
                          <tr key={sub.subjectCode}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{sub.subjectCode}: {sub.subjectName}</div>
                            </td>
                            <td>{sub.facultyName}</td>
                            <td>
                              <strong>{sub.attendedClasses}</strong> / {sub.totalClasses}
                            </td>
                            <td>
                              <strong style={{ fontSize: '0.95rem' }}>{sub.percentage}%</strong>
                            </td>
                            <td>{badge}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="show-on-mobile mobile-card-list">
                  {summary?.subjects.map((sub) => (
                    <div
                      key={sub.subjectCode}
                      style={{
                        padding: '0.85rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {sub.subjectCode}: {sub.subjectName}
                        </div>
                        <Badge variant={sub.percentage >= 75 ? 'success' : 'danger'}>
                          {sub.percentage}%
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Instructor: {sub.facultyName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Present: <strong>{sub.attendedClasses}</strong> / Conducted: {sub.totalClasses}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Section 47: Chronological Date/Period-Wise Records */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Chronological Attendance Log</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Verified date and period classroom entries</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '200px' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
                    aria-label="Search attendance history"
                  />
                </div>
                <div style={{ width: '180px' }}>
                  <select
                    aria-label="Filter attendance history by subject"
                    className="input-field"
                    value={historyFilter}
                    onChange={(e) => {
                      setHistoryFilter(e.target.value);
                      setHistoryPage(1);
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                  >
                    <option value="ALL">All Subjects</option>
                    {summary?.subjects.map((s) => (
                      <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Period</th>
                    <th>Course</th>
                    <th>Faculty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                        No attendance records found matching filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{rec.date}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rec.period || 'Period 1'}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{rec.subjectCode}</span>: {rec.subjectName}
                        </td>
                        <td>{rec.facultyName}</td>
                        <td>
                          <Badge variant={rec.status === 'PRESENT' ? 'success' : 'danger'}>
                            {rec.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* History Pagination */}
            {totalHistoryPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Showing {paginatedHistory.length} of {filteredHistory.length} entries (Page {historyPage} of {totalHistoryPages})
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ========================================================================= */}
      {/* MAKE ATTENDANCE MODAL (Section 9 - 18, 25, 37)                            */}
      {/* ========================================================================= */}
      <MakeAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        initialSessionId={modalSessionId}
        initialMode={modalMode}
        onAttendanceSubmitted={(session) => {
          setToastMessage(
            `Attendance session successfully ${
              modalMode === 'EDIT' ? 'updated' : 'recorded'
            } for ${session.subjectCode} (${session.period}) on ${session.date}.`
          );
          setTimeout(() => setToastMessage(null), 5000);
          loadAttendance();
        }}
      />
    </div>
  );
};
