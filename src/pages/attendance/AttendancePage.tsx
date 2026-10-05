import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  BookOpen,
  CheckCircle2,
  Plus,
  Save,
  RefreshCw,
  Search,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import {
  attendanceService,
  DEFAULT_SUBJECTS,
  type StudentAttendanceSummary,
} from '../../services/attendanceService';
import { userService } from '../../services/userService';

export const AttendancePage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();

  const isFacultyOrAdmin =
    role === 'FACULTY' ||
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && permissions.includes('MANAGE_ATTENDANCE'));

  // Student Attendance States
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 12;

  // Faculty Management Modal States
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentRoster, setStudentRoster] = useState<{ studentId: string; studentName: string; status: 'PRESENT' | 'ABSENT' }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const studentId = userProfile?.studentId || 'STU2026001';

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

  // Open Faculty Attendance Marking Modal
  const handleOpenMarkAttendance = async () => {
    try {
      const allUsers = await userService.getAllUsers();
      const students = allUsers.filter((u) => u.role === 'STUDENT' && u.isActive);

      setStudentRoster(
        students.map((s) => ({
          studentId: s.studentId || s.uid,
          studentName: s.name,
          status: 'PRESENT', // default present
        }))
      );
      setIsMarkModalOpen(true);
    } catch (err) {
      console.warn('Failed to load students roster for attendance:', err);
    }
  };

  // Toggle student status in faculty modal
  const handleToggleStatus = (index: number) => {
    setStudentRoster((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        status: copy[index].status === 'PRESENT' ? 'ABSENT' : 'PRESENT',
      };
      return copy;
    });
  };

  // Set all present / absent
  const handleSetAll = (status: 'PRESENT' | 'ABSENT') => {
    setStudentRoster((prev) => prev.map((s) => ({ ...s, status })));
  };

  // Save Faculty Attendance
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      await attendanceService.recordAttendance({
        subjectCode: selectedSubject.code,
        subjectName: selectedSubject.name,
        facultyName: userProfile?.name || selectedSubject.faculty,
        facultyUid: userProfile?.uid || 'faculty_001',
        date: attendanceDate,
        studentRecords: studentRoster,
      });

      setIsMarkModalOpen(false);
      setToastMessage(`Attendance successfully recorded for ${selectedSubject.code} on ${attendanceDate}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadAttendance();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance records.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter history log
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
        item.date.includes(q)
      );
    }
    return true;
  });

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);

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
            Subject-wise attendance tracking, present/absent logs, and 75% statutory examination eligibility monitoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadAttendance}
          >
            Refresh
          </Button>

          {/* Authorized Faculty Attendance Action (Section 9) */}
          {isFacultyOrAdmin && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={handleOpenMarkAttendance}
            >
              Mark Class Attendance
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats (Section 7 & 8) */}
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
          subtitle={`${summary?.missedClasses || 0} classes missed this semester`}
          icon={<BookOpen size={22} />}
        />

        <StatCard
          label="Subject Health"
          value={
            summary
              ? `${summary.subjects.filter((s) => s.percentage >= 75).length} of ${summary.subjects.length} Safe`
              : 'All Safe'
          }
          subtitle="Maintaining >= 75% statutory rule"
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
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Semester 6 Curricular Roster</span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton height="45px" />
            <Skeleton height="45px" />
            <Skeleton height="45px" />
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
                    <th>Attended / Total</th>
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
            <div className="show-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    Classes: <strong>{sub.attendedClasses}</strong> attended out of {sub.totalClasses} held
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Attendance History Log (Chronological Date-Wise Records) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Chronological Attendance Log</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Verified daily classroom entries</span>
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
                aria-label="Search attendance history by subject or faculty"
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
                {DEFAULT_SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
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
                <th>Course</th>
                <th>Faculty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                    No attendance records found matching filter.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{rec.date}</td>
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

      {/* ========================================================================= */}
      {/* FACULTY ATTENDANCE RECORDING MODAL (Section 9)                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isMarkModalOpen}
        onClose={() => setIsMarkModalOpen(false)}
        title="Mark Classroom Attendance"
        size="large"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Class and Date Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', padding: '0.85rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <label className="input-label" htmlFor="att-subj">Subject / Course *</label>
              <select
                id="att-subj"
                className="input-field"
                value={selectedSubject.code}
                onChange={(e) => {
                  const s = DEFAULT_SUBJECTS.find((sub) => sub.code === e.target.value);
                  if (s) setSelectedSubject(s);
                }}
              >
                {DEFAULT_SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}: {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="att-date">Lecture Date *</label>
              <input
                id="att-date"
                type="date"
                className="input-field"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Bulk Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Enrolled Students: <strong>{studentRoster.length}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => handleSetAll('PRESENT')}>
                Mark All Present
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSetAll('ABSENT')}>
                Mark All Absent
              </Button>
            </div>
          </div>

          {/* Student Roster Checkbox List */}
          <div style={{ maxHeight: '45vh', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>ID</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentRoster.map((stu, idx) => (
                  <tr key={stu.studentId}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{stu.studentName}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{stu.studentId}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(idx)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          backgroundColor: stu.status === 'PRESENT' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: stu.status === 'PRESENT' ? 'var(--color-success)' : 'var(--color-danger)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {stu.status} (Click to Toggle)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" onClick={() => setIsMarkModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={isSaving} leftIcon={<Save size={16} />} onClick={handleSaveAttendance}>
              Save Attendance Records
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
