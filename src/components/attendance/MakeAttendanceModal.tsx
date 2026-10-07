import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Eye,
  Edit3,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';
import { useAuth } from '../../context/useAuth';
import { userService } from '../../services/userService';
import {
  academicHierarchyService,
  STANDARD_PERIODS,
  STANDARD_SECTIONS,
} from '../../services/academicHierarchyService';
import {
  attendanceService,
} from '../../services/attendanceService';
import {
  canPerformAction,
  getUserAssignedBranches,
} from '../../services/permissionService';
import type { AttendanceSession } from '../../types';

interface MakeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttendanceSubmitted?: (session: AttendanceSession) => void;
  initialSessionId?: string | null;
  initialMode?: 'CREATE' | 'EDIT' | 'VIEW';
}

export const MakeAttendanceModal: React.FC<MakeAttendanceModalProps> = ({
  isOpen,
  onClose,
  onAttendanceSubmitted,
  initialSessionId,
  initialMode = 'CREATE',
}) => {
  const { userProfile, role } = useAuth();

  // Mode: CREATE, EDIT, VIEW
  const [mode, setMode] = useState<'CREATE' | 'EDIT' | 'VIEW'>(initialMode);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);

  // Hierarchy Selection States
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<{ code: string; name: string; durationYears: number } | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number>(3);
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(STANDARD_PERIODS[0]);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Student Roster & Marking States
  const [roster, setRoster] = useState<{ studentId: string; studentName: string; rollNumber?: string; status: 'PRESENT' | 'ABSENT' }[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Duplicate Modal Sub-state
  const [duplicateSession, setDuplicateSession] = useState<AttendanceSession | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<boolean>(false);

  // Authorized Branches for Attendance Action (Section 8, 9, 29)
  const authorizedBranches = useMemo(() => {
    if (!userProfile) return [];
    if (role === 'MAIN_ADMIN') {
      return academicHierarchyService.getTakeAttendanceBranches(userProfile);
    }
    const assigned = getUserAssignedBranches(userProfile);
    return assigned.filter(
      (b) =>
        canPerformAction(userProfile, 'MANAGE_ATTENDANCE', b, 'take_attendance') ||
        canPerformAction(userProfile, 'MANAGE_ATTENDANCE', b, 'add')
    );
  }, [userProfile, role]);

  // Can current user edit attendance for the selected branch? (Section 25, 37)
  const canEditAttendance = useMemo(() => {
    if (!userProfile) return false;
    if (role === 'MAIN_ADMIN') return true;
    if (!selectedBranch) return false;
    return (
      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', selectedBranch, 'edit_attendance') ||
      canPerformAction(userProfile, 'MANAGE_ATTENDANCE', selectedBranch, 'edit')
    );
  }, [userProfile, role, selectedBranch]);

  // Available Departments under current branch (Section 10)
  const availableDepartments = useMemo(() => {
    if (!selectedBranch) return [];
    return academicHierarchyService.getDepartmentsForBranch(selectedBranch);
  }, [selectedBranch]);

  // Available Programs under current department (Section 11)
  const availablePrograms = useMemo(() => {
    if (!selectedBranch || !selectedDepartment) return [];
    return academicHierarchyService.getProgramsForDepartment(selectedBranch, selectedDepartment);
  }, [selectedBranch, selectedDepartment]);

  // Available Semesters for current program (Section 12)
  const availableSemesters = useMemo(() => {
    const duration = selectedProgram?.durationYears || 4;
    return academicHierarchyService.getSemestersForDuration(duration);
  }, [selectedProgram]);

  // Available Subjects for current program & semester (Section 13)
  const availableSubjects = useMemo(() => {
    if (!selectedProgram) return [];
    return academicHierarchyService.getSubjectsForProgram(selectedProgram.code, selectedSemester);
  }, [selectedProgram, selectedSemester]);

  // Reset or initialize fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setShowDuplicateDialog(false);
      setDuplicateSession(null);

      if (initialSessionId) {
        // Load existing session details for edit or view
        loadExistingSession(initialSessionId, initialMode === 'VIEW' ? 'VIEW' : 'EDIT');
      } else {
        setMode('CREATE');
        setActiveSessionId(null);
        if (authorizedBranches.length > 0) {
          const branch = authorizedBranches[0];
          setSelectedBranch(branch);
          const depts = academicHierarchyService.getDepartmentsForBranch(branch);
          if (depts.length > 0) {
            setSelectedDepartment(depts[0]);
            const progs = academicHierarchyService.getProgramsForDepartment(branch, depts[0]);
            if (progs.length > 0) {
              setSelectedProgram(progs[0]);
              setSelectedSemester(1);
              setSelectedSection('A');
              const subs = academicHierarchyService.getSubjectsForProgram(progs[0].code, 1);
              if (subs.length > 0) {
                setSelectedSubjectCode(subs[0].code);
              }
            }
          }
        }
      }
    }
  }, [isOpen, initialSessionId, initialMode, authorizedBranches]);

  // Load existing session details
  const loadExistingSession = async (sessId: string, targetMode: 'EDIT' | 'VIEW') => {
    setIsLoadingStudents(true);
    try {
      const { session, records } = await attendanceService.getAttendanceSessionDetails(sessId);
      if (session) {
        setSelectedBranch(session.branch);
        setSelectedDepartment(session.department);
        setSelectedProgram({
          code: session.degree.toUpperCase().replace(/\s+/g, '_'),
          name: session.degree,
          durationYears: 4,
        });
        setSelectedSemester(session.semester);
        setSelectedSection(session.section);
        setSelectedSubjectCode(session.subjectCode);
        setSelectedPeriod(session.period);
        setAttendanceDate(session.date);
        setActiveSessionId(session.id);
        setMode(targetMode);

        setRoster(
          records.map((r) => ({
            studentId: r.studentId,
            studentName: r.studentName,
            status: r.status,
          }))
        );
      }
    } catch (err: any) {
      setErrorMsg('Failed to load attendance session details.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // When branch changes, auto-select first department
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    const depts = academicHierarchyService.getDepartmentsForBranch(branch);
    const firstDept = depts[0] || '';
    setSelectedDepartment(firstDept);

    const progs = academicHierarchyService.getProgramsForDepartment(branch, firstDept);
    const firstProg = progs[0] || null;
    setSelectedProgram(firstProg);
    setSelectedSemester(1);
    setSelectedSection('A');

    if (firstProg) {
      const subs = academicHierarchyService.getSubjectsForProgram(firstProg.code, 1);
      setSelectedSubjectCode(subs[0]?.code || '');
    }
  };

  // When department changes, auto-select first program
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    const progs = academicHierarchyService.getProgramsForDepartment(selectedBranch, dept);
    const firstProg = progs[0] || null;
    setSelectedProgram(firstProg);
    setSelectedSemester(1);
    setSelectedSection('A');

    if (firstProg) {
      const subs = academicHierarchyService.getSubjectsForProgram(firstProg.code, 1);
      setSelectedSubjectCode(subs[0]?.code || '');
    }
  };

  // When program changes, auto-select subjects
  const handleProgramChange = (progCode: string) => {
    const prog = availablePrograms.find((p) => p.code === progCode) || null;
    setSelectedProgram(prog);
    if (prog) {
      const subs = academicHierarchyService.getSubjectsForProgram(prog.code, selectedSemester);
      setSelectedSubjectCode(subs[0]?.code || '');
    }
  };

  // When semester changes, refresh available subjects
  const handleSemesterChange = (sem: number) => {
    setSelectedSemester(sem);
    if (selectedProgram) {
      const subs = academicHierarchyService.getSubjectsForProgram(selectedProgram.code, sem);
      setSelectedSubjectCode(subs[0]?.code || '');
    }
  };

  // Load matching students strictly by academic hierarchy (Section 14 & 32)
  useEffect(() => {
    if (!isOpen || mode !== 'CREATE' || !selectedBranch) return;

    let isMounted = true;
    setIsLoadingStudents(true);
    setErrorMsg(null);

    userService
      .getAllUsers()
      .then((users) => {
        if (!isMounted) return;
        const matchingStudents = academicHierarchyService.filterStudentsByAcademicHierarchy(
          users,
          {
            branch: selectedBranch,
            department: selectedDepartment,
            degree: selectedProgram?.name,
            semester: selectedSemester,
            section: selectedSection,
          }
        );

        setRoster(
          matchingStudents.map((s) => ({
            studentId: s.studentId || s.uid,
            studentName: s.name,
            rollNumber: s.rollNumber,
            status: 'PRESENT', // default present
          }))
        );
      })
      .catch(() => {
        if (isMounted) setErrorMsg('Failed to load student roster for class.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingStudents(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    mode,
    selectedBranch,
    selectedDepartment,
    selectedProgram,
    selectedSemester,
    selectedSection,
  ]);

  // Toggle single student status
  const handleToggleStudent = (index: number) => {
    if (mode === 'VIEW') return;
    setRoster((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        status: copy[index].status === 'PRESENT' ? 'ABSENT' : 'PRESENT',
      };
      return copy;
    });
  };

  // Mark all students Present or Absent (Section 16)
  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    if (mode === 'VIEW') return;
    setRoster((prev) => prev.map((s) => ({ ...s, status })));
  };

  // Pre-submission check for duplicates (Section 25)
  const handleInitiateSubmit = async () => {
    if (roster.length === 0) {
      setErrorMsg('No students found in the selected academic scope to record attendance.');
      return;
    }
    if (!selectedSubjectCode) {
      setErrorMsg('Please select a subject before submitting attendance.');
      return;
    }

    // In EDIT mode on an existing session, directly save update
    if (mode === 'EDIT' && activeSessionId) {
      await executeUpdateSession();
      return;
    }

    // Duplicate session check
    try {
      const existing = await attendanceService.checkDuplicateSession({
        branch: selectedBranch,
        department: selectedDepartment,
        degree: selectedProgram?.name || selectedBranch,
        semester: selectedSemester,
        section: selectedSection,
        subjectCode: selectedSubjectCode,
        date: attendanceDate,
        period: selectedPeriod,
      });

      if (existing) {
        setDuplicateSession(existing);
        setShowDuplicateDialog(true);
        return;
      }
    } catch (err) {
      console.warn('Duplicate check warning:', err);
    }

    // No duplicate found, proceed to save new session
    await executeSaveSession();
  };

  // Execute Save New Session
  const executeSaveSession = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const subjectObj = availableSubjects.find((s) => s.code === selectedSubjectCode);
      const subjectName = subjectObj?.name || selectedSubjectCode;

      const actor = {
        uid: userProfile?.uid || 'user_faculty',
        name: userProfile?.name || 'Faculty Member',
        role: role || 'FACULTY',
      };

      const res = await attendanceService.submitAttendanceSession({
        branch: selectedBranch,
        department: selectedDepartment,
        degree: selectedProgram?.name || selectedBranch,
        semester: selectedSemester,
        section: selectedSection,
        subjectCode: selectedSubjectCode,
        subjectName,
        period: selectedPeriod,
        date: attendanceDate,
        studentRoster: roster,
        actor,
      });

      if (res.success && res.session) {
        if (onAttendanceSubmitted) {
          onAttendanceSubmitted(res.session);
        }
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to record attendance session.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred while saving attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Update Existing Session (Section 37)
  const executeUpdateSession = async () => {
    if (!activeSessionId) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const actor = {
        uid: userProfile?.uid || 'user_faculty',
        name: userProfile?.name || 'Faculty Member',
        role: role || 'FACULTY',
      };

      const res = await attendanceService.updateAttendanceSession({
        sessionId: activeSessionId,
        studentRoster: roster.map((r) => ({ studentId: r.studentId, status: r.status })),
        actor,
      });

      if (res.success) {
        const { session } = await attendanceService.getAttendanceSessionDetails(activeSessionId);
        if (session && onAttendanceSubmitted) {
          onAttendanceSubmitted(session);
        }
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update attendance session.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred while updating attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch to Edit Mode from duplicate dialog
  const handleEditDuplicate = () => {
    if (!duplicateSession) return;
    setShowDuplicateDialog(false);
    loadExistingSession(duplicateSession.id, 'EDIT');
  };

  // Switch to View Mode from duplicate dialog
  const handleViewDuplicate = () => {
    if (!duplicateSession) return;
    setShowDuplicateDialog(false);
    loadExistingSession(duplicateSession.id, 'VIEW');
  };

  // Counts for summary
  const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
  const absentCount = roster.filter((r) => r.status === 'ABSENT').length;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          mode === 'VIEW'
            ? 'View Attendance Session'
            : mode === 'EDIT'
            ? 'Edit Attendance Session'
            : 'Make Attendance'
        }
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
              <span>Total: <strong>{roster.length}</strong></span>
              <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>Present: {presentCount}</span>
              <span style={{ color: 'var(--status-danger)', fontWeight: 600 }}>Absent: {absentCount}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              {mode !== 'VIEW' && (
                <Button
                  variant="primary"
                  isLoading={isSubmitting}
                  leftIcon={<Save size={16} />}
                  onClick={handleInitiateSubmit}
                  disabled={roster.length === 0}
                >
                  {mode === 'EDIT' ? 'Update Attendance' : 'Submit Attendance'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <Alert variant="danger" title="Error" dismissible onDismiss={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* ========================================================================= */}
          {/* STEP 1 - 5 CASCADE HIERARCHY SELECTORS (Section 9 - 13)                    */}
          {/* ========================================================================= */}
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Step 1: Branch Selection */}
              <div>
                <label className="input-label" htmlFor="att-branch">
                  1. Branch *
                </label>
                <select
                  id="att-branch"
                  className="input-field"
                  value={selectedBranch}
                  disabled={mode !== 'CREATE' || authorizedBranches.length <= 1}
                  onChange={(e) => handleBranchChange(e.target.value)}
                >
                  {authorizedBranches.length === 0 ? (
                    <option value="">No authorized branches</option>
                  ) : (
                    authorizedBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Step 2: Department Selection */}
              <div>
                <label className="input-label" htmlFor="att-dept">
                  2. Department *
                </label>
                <select
                  id="att-dept"
                  className="input-field"
                  value={selectedDepartment}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Degree/Program Selection */}
              <div>
                <label className="input-label" htmlFor="att-prog">
                  3. Degree / Program *
                </label>
                <select
                  id="att-prog"
                  className="input-field"
                  value={selectedProgram?.code || ''}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => handleProgramChange(e.target.value)}
                >
                  {availablePrograms.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              {/* Step 4: Semester Selection */}
              <div>
                <label className="input-label" htmlFor="att-sem">
                  4. Semester *
                </label>
                <select
                  id="att-sem"
                  className="input-field"
                  value={selectedSemester}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                >
                  {availableSemesters.map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4b: Section Selection */}
              <div>
                <label className="input-label" htmlFor="att-sec">
                  Section *
                </label>
                <select
                  id="att-sec"
                  className="input-field"
                  value={selectedSection}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  {STANDARD_SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 5: Subject Selection */}
              <div>
                <label className="input-label" htmlFor="att-sub">
                  5. Subject *
                </label>
                <select
                  id="att-sub"
                  className="input-field"
                  value={selectedSubjectCode}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code}: {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 6: Period Selection (Section 24) */}
              <div>
                <label className="input-label" htmlFor="att-period">
                  Period / Session *
                </label>
                <select
                  id="att-period"
                  className="input-field"
                  value={selectedPeriod}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  {STANDARD_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 6b: Date Picker */}
              <div>
                <label className="input-label" htmlFor="att-date-input">
                  Date *
                </label>
                <input
                  id="att-date-input"
                  type="date"
                  className="input-field"
                  value={attendanceDate}
                  disabled={mode !== 'CREATE'}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 17: ATTENDANCE SUMMARY BEFORE SUBMIT                              */}
          {/* ========================================================================= */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <Badge variant="info">{selectedBranch}</Badge>
              <Badge variant="neutral">{selectedDepartment}</Badge>
              <Badge variant="neutral">{selectedProgram?.name}</Badge>
              <Badge variant="neutral">Sem {selectedSemester} - Sec {selectedSection}</Badge>
              <Badge variant="warning">{selectedSubjectCode}</Badge>
              <Badge variant="neutral">{selectedPeriod.split(' ')[0]}</Badge>
              <span style={{ color: 'var(--text-muted)' }}>Date: {attendanceDate}</span>
            </div>

            {mode !== 'VIEW' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => handleMarkAll('PRESENT')}>
                  Mark All Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleMarkAll('ABSENT')}>
                  Mark All Absent
                </Button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 14 & 15: STUDENT LIST & PRESENT/ABSENT TOGGLES                     */}
          {/* ========================================================================= */}
          <div
            style={{
              maxHeight: '40vh',
              overflowY: 'auto',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {isLoadingStudents ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading verified student roster...
              </div>
            ) : roster.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 500 }}>
                  No students found matching this academic scope.
                </p>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem' }}>
                  Verify branch, department, semester, and section criteria.
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((stu, idx) => (
                    <tr key={stu.studentId}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{stu.studentName}</div>
                        {stu.rollNumber && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Roll: {stu.rollNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{stu.studentId}</td>
                      <td style={{ textAlign: 'right' }}>
                        {mode === 'VIEW' ? (
                          <Badge variant={stu.status === 'PRESENT' ? 'success' : 'danger'}>
                            {stu.status}
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(idx)}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.825rem',
                              borderColor:
                                stu.status === 'PRESENT'
                                  ? 'rgba(34, 197, 94, 0.4)'
                                  : 'rgba(239, 68, 68, 0.4)',
                              backgroundColor:
                                stu.status === 'PRESENT'
                                  ? 'rgba(34, 197, 94, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                stu.status === 'PRESENT'
                                  ? 'var(--status-success)'
                                  : 'var(--status-danger)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {stu.status === 'PRESENT' ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                            {stu.status}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* SECTION 25: DUPLICATE ATTENDANCE DIALOG                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showDuplicateDialog}
        onClose={() => setShowDuplicateDialog(false)}
        title="Attendance Already Submitted"
        size="normal"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <Button variant="ghost" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" leftIcon={<Eye size={15} />} onClick={handleViewDuplicate}>
              View Attendance
            </Button>
            {canEditAttendance && (
              <Button
                variant="primary"
                leftIcon={<Edit3 size={15} />}
                onClick={handleEditDuplicate}
              >
                Edit Attendance
              </Button>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--status-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Session Conflict Detected</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Attendance for this exact academic schedule has already been recorded:
              </p>
            </div>
          </div>

          {duplicateSession && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              }}
            >
              <div><strong>Branch:</strong> {duplicateSession.branch}</div>
              <div><strong>Department:</strong> {duplicateSession.department}</div>
              <div><strong>Program:</strong> {duplicateSession.degree}</div>
              <div><strong>Semester:</strong> {duplicateSession.semester}th Semester</div>
              <div><strong>Section:</strong> Section {duplicateSession.section}</div>
              <div><strong>Subject:</strong> {duplicateSession.subjectCode} - {duplicateSession.subjectName}</div>
              <div><strong>Period:</strong> {duplicateSession.period}</div>
              <div><strong>Date:</strong> {duplicateSession.date}</div>
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-default)' }}>
                <strong>Submitted By:</strong> {duplicateSession.facultyName}
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Do you want to view the submitted records or modify attendance?
            {!canEditAttendance && (
              <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--status-warning)', fontSize: '0.8rem' }}>
                Note: You only have View permission. Edit Attendance is restricted.
              </span>
            )}
          </p>
        </div>
      </Modal>
    </>
  );
};
