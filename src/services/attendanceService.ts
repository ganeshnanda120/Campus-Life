import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceSubject,
} from '../types';
import { areBranchesEqual } from './permissionService';

const ATTENDANCE_RECORDS_KEY = 'campus_life_attendance_records';
const ATTENDANCE_SESSIONS_KEY = 'campus_life_attendance_sessions';

type AttendanceListener = {
  studentId: string;
  callback: (summary: StudentAttendanceSummary) => void;
};
const activeAttendanceListeners = new Set<AttendanceListener>();

type SessionsListener = {
  branch?: string;
  callback: (sessions: AttendanceSession[]) => void;
};
const activeSessionsListeners = new Set<SessionsListener>();

function notifyLocalAttendanceListeners() {
  activeAttendanceListeners.forEach((entry) => {
    attendanceService.getStudentAttendance(entry.studentId).then(entry.callback).catch(() => {});
  });
}

function notifyLocalSessionsListeners() {
  activeSessionsListeners.forEach((entry) => {
    attendanceService.getAttendanceSessions(entry.branch ? { branch: entry.branch } : undefined).then(entry.callback).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === ATTENDANCE_RECORDS_KEY) {
      notifyLocalAttendanceListeners();
    }
    if (e.key === ATTENDANCE_SESSIONS_KEY) {
      notifyLocalSessionsListeners();
    }
  });
}

export interface StudentAttendanceSummary {
  overallPercentage: number;
  totalClasses: number;
  attendedClasses: number;
  missedClasses: number;
  isEligible: boolean; // >= 75%
  subjects: AttendanceSubject[];
  history: AttendanceRecord[];
}

export const DEFAULT_SUBJECTS: { code: string; name: string; faculty: string }[] = [
  { code: 'CS301', name: 'Database Management Systems', faculty: 'Dr. Sanjeev Mohanty' },
  { code: 'CS302', name: 'Operating Systems & System Software', faculty: 'Prof. K. Nayak' },
  { code: 'CS303', name: 'Computer Networks & Protocols', faculty: 'Prof. M. K. Panda' },
  { code: 'CS304', name: 'Design & Analysis of Algorithms', faculty: 'Dr. A. K. Behera' },
  { code: 'CS305', name: 'Software Engineering & Agile', faculty: 'Prof. S. R. Sahoo' },
];

function getLocalRecords(): AttendanceRecord[] {
  try {
    const raw = safeStorage.getItem(ATTENDANCE_RECORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalRecords(records: AttendanceRecord[]) {
  try {
    safeStorage.setItem(ATTENDANCE_RECORDS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

function getLocalSessions(): AttendanceSession[] {
  try {
    const raw = safeStorage.getItem(ATTENDANCE_SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalSessions(sessions: AttendanceSession[]) {
  try {
    safeStorage.setItem(ATTENDANCE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export const attendanceService = {
  /**
   * Generates a normalized unique composite session key to guarantee period/class uniqueness
   */
  generateSessionKey(params: {
    branch: string;
    department: string;
    degree: string;
    semester: number;
    section: string;
    subjectCode: string;
    date: string;
    period: string;
  }): string {
    const { branch, department, degree, semester, section, subjectCode, date, period } = params;
    const clean = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `sess_${clean(date)}_${clean(branch)}_${clean(department)}_${clean(degree)}_sem${semester}_sec${clean(section)}_${clean(subjectCode)}_${clean(period)}`;
  },

  /**
   * Duplicate Session Check:
   * Checks whether attendance has already been submitted for the EXACT SAME:
   * (Branch, Department, Degree/Program, Semester, Section, Subject, Date, Period)
   */
  async checkDuplicateSession(params: {
    branch: string;
    department: string;
    degree: string;
    semester: number;
    section: string;
    subjectCode: string;
    date: string;
    period: string;
  }): Promise<AttendanceSession | null> {
    const expectedKey = this.generateSessionKey(params);

    if (isFirebaseConfigured && db) {
      try {
        const sessionRef = doc(db, 'attendanceSessions', expectedKey);
        const snap = await getDoc(sessionRef);
        if (snap.exists()) {
          return { id: snap.id, ...(snap.data() as Omit<AttendanceSession, 'id'>) };
        }
      } catch (err) {
        console.warn('Firestore duplicate session check fallback:', err);
      }
    }

    // Check local storage
    const local = getLocalSessions();
    const found = local.find((s) => s.id === expectedKey);
    if (found) return found;

    // Check by field equivalence
    const alt = local.find(
      (s) =>
        areBranchesEqual(s.branch, params.branch) &&
        s.department.toLowerCase().trim() === params.department.toLowerCase().trim() &&
        s.degree.toLowerCase().trim() === params.degree.toLowerCase().trim() &&
        s.semester === params.semester &&
        s.section.toUpperCase().trim() === params.section.toUpperCase().trim() &&
        s.subjectCode.toUpperCase().trim() === params.subjectCode.toUpperCase().trim() &&
        s.date === params.date &&
        s.period.toLowerCase().trim() === params.period.toLowerCase().trim()
    );

    return alt || null;
  },

  /**
   * Retrieves all attendance sessions optionally filtered by branch, date, or faculty
   */
  async getAttendanceSessions(filter?: {
    branch?: string;
    date?: string;
    facultyUid?: string;
  }): Promise<AttendanceSession[]> {
    let sessions: AttendanceSession[] = [];

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'attendanceSessions');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          sessions = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttendanceSession, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore attendance sessions fetch fallback:', err);
      }
    }

    if (sessions.length === 0) {
      sessions = getLocalSessions();
    }

    // Filter
    if (filter) {
      if (filter.branch && filter.branch !== 'ALL') {
        sessions = sessions.filter((s) => areBranchesEqual(s.branch, filter.branch));
      }
      if (filter.date) {
        sessions = sessions.filter((s) => s.date === filter.date);
      }
      if (filter.facultyUid) {
        sessions = sessions.filter((s) => s.facultyUid === filter.facultyUid);
      }
    }

    // Sort descending by date and createdAt
    sessions.sort((a, b) => {
      const cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (cmp !== 0) return cmp;
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });

    return sessions;
  },

  /**
   * Retrieves an attendance session by its ID and its student roster
   */
  async getAttendanceSessionDetails(sessionId: string): Promise<{
    session: AttendanceSession | null;
    records: AttendanceRecord[];
  }> {
    let session: AttendanceSession | null = null;
    let records: AttendanceRecord[] = [];

    if (isFirebaseConfigured && db) {
      try {
        const sDoc = await getDoc(doc(db, 'attendanceSessions', sessionId));
        if (sDoc.exists()) {
          session = { id: sDoc.id, ...(sDoc.data() as Omit<AttendanceSession, 'id'>) };
        }
        const rQuery = query(collection(db, 'attendanceRecords'), where('sessionId', '==', sessionId));
        const rSnap = await getDocs(rQuery);
        if (!rSnap.empty) {
          records = rSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttendanceRecord, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore session details fetch fallback:', err);
      }
    }

    if (!session) {
      session = getLocalSessions().find((s) => s.id === sessionId) || null;
    }
    if (records.length === 0) {
      records = getLocalRecords().filter((r) => r.sessionId === sessionId);
    }

    return { session, records };
  },

  /**
   * Submits a new Attendance Session with student records.
   * Associates attendance with full academic context.
   */
  async submitAttendanceSession(params: {
    branch: string;
    department: string;
    degree: string;
    semester: number;
    section: string;
    subjectCode: string;
    subjectName: string;
    period: string;
    date: string;
    studentRoster: { studentId: string; studentName: string; status: 'PRESENT' | 'ABSENT' }[];
    actor: { uid: string; name: string; role: string };
  }): Promise<{ success: boolean; session?: AttendanceSession; error?: string }> {
    const {
      branch,
      department,
      degree,
      semester,
      section,
      subjectCode,
      subjectName,
      period,
      date,
      studentRoster,
      actor,
    } = params;

    const sessionId = this.generateSessionKey({
      branch,
      department,
      degree,
      semester,
      section,
      subjectCode,
      date,
      period,
    });

    const now = new Date().toISOString();
    const presentCount = studentRoster.filter((s) => s.status === 'PRESENT').length;
    const absentCount = studentRoster.filter((s) => s.status === 'ABSENT').length;

    const session: AttendanceSession = {
      id: sessionId,
      date,
      branch,
      department,
      degree,
      semester,
      section,
      subjectCode,
      subjectName,
      period,
      facultyUid: actor.uid,
      facultyName: actor.name,
      totalStudents: studentRoster.length,
      presentCount,
      absentCount,
      createdAt: now,
      updatedAt: now,
    };

    // Save Session to Firestore
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'attendanceSessions', sessionId), session);
      } catch (err) {
        console.warn('Firestore session write fallback:', err);
      }
    }

    // Save Session to local storage
    const allSessions = getLocalSessions();
    const sIdx = allSessions.findIndex((s) => s.id === sessionId);
    if (sIdx !== -1) {
      allSessions[sIdx] = session;
    } else {
      allSessions.unshift(session);
    }
    saveLocalSessions(allSessions);

    // Save individual student AttendanceRecords
    const allRecords = getLocalRecords();

    for (const item of studentRoster) {
      const recordId = `att_${sessionId}_${item.studentId}`;
      const record: AttendanceRecord = {
        id: recordId,
        sessionId,
        studentId: item.studentId,
        studentName: item.studentName,
        branch,
        department,
        degree,
        semester,
        section,
        subjectCode,
        subjectName,
        facultyName: actor.name,
        facultyUid: actor.uid,
        date,
        period,
        status: item.status,
        createdAt: now,
        updatedAt: now,
      };

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'attendanceRecords', recordId), record);
        } catch (err) {
          console.warn('Firestore attendance record write fallback:', err);
        }
      }

      const rIdx = allRecords.findIndex((r) => r.id === recordId);
      if (rIdx !== -1) {
        allRecords[rIdx] = record;
      } else {
        allRecords.unshift(record);
      }

      // Notify student
      notificationService.createNotification({
        userId: item.studentId,
        title: `Attendance Marked: ${subjectCode}`,
        message: `Marked ${item.status} for ${subjectName} (${period}) on ${date}.`,
        type: 'attendance',
        link: '/student/attendance',
      }).catch(() => {});
    }

    saveLocalRecords(allRecords);

    // Log Activity
    activityService.logActivity({
      userId: actor.uid,
      title: 'Attendance Session Recorded',
      description: `Submitted attendance for ${subjectCode} (${period}) on ${date} with ${presentCount} present, ${absentCount} absent.`,
      entityType: 'attendance',
      entityId: sessionId,
    }).catch(() => {});

    // Notify listeners in real time
    notifyLocalAttendanceListeners();
    notifyLocalSessionsListeners();

    return { success: true, session };
  },

  /**
   * Updates an existing attendance session's student statuses (requires Edit Attendance permission)
   */
  async updateAttendanceSession(params: {
    sessionId: string;
    studentRoster: { studentId: string; status: 'PRESENT' | 'ABSENT' }[];
    actor: { uid: string; name: string; role: string };
  }): Promise<{ success: boolean; error?: string }> {
    const { sessionId, studentRoster, actor } = params;

    const allSessions = getLocalSessions();
    const session = allSessions.find((s) => s.id === sessionId);
    if (!session) {
      return { success: false, error: 'Attendance session not found.' };
    }

    const now = new Date().toISOString();
    const allRecords = getLocalRecords();

    let newPresentCount = 0;
    let newAbsentCount = 0;

    for (const update of studentRoster) {
      const recordId = `att_${sessionId}_${update.studentId}`;
      const existing = allRecords.find((r) => r.id === recordId);

      if (update.status === 'PRESENT') newPresentCount++;
      else newAbsentCount++;

      if (existing) {
        existing.status = update.status;
        existing.updatedAt = now;
      } else {
        allRecords.unshift({
          id: recordId,
          sessionId,
          studentId: update.studentId,
          studentName: 'Student',
          branch: session.branch,
          department: session.department,
          degree: session.degree,
          semester: session.semester,
          section: session.section,
          subjectCode: session.subjectCode,
          subjectName: session.subjectName,
          facultyName: session.facultyName,
          date: session.date,
          period: session.period,
          status: update.status,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'attendanceRecords', recordId), {
            status: update.status,
            updatedAt: now,
          }, { merge: true });
        } catch (err) {
          console.warn('Firestore update record fallback:', err);
        }
      }
    }

    session.presentCount = newPresentCount;
    session.absentCount = newAbsentCount;
    session.updatedAt = now;

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'attendanceSessions', sessionId), {
          presentCount: newPresentCount,
          absentCount: newAbsentCount,
          updatedAt: now,
        });
      } catch (err) {
        console.warn('Firestore session update fallback:', err);
      }
    }

    saveLocalSessions(allSessions);
    saveLocalRecords(allRecords);

    activityService.logActivity({
      userId: actor.uid,
      title: 'Attendance Session Updated',
      description: `Updated attendance records for session ${sessionId}.`,
      entityType: 'attendance',
      entityId: sessionId,
    }).catch(() => {});

    notifyLocalAttendanceListeners();
    notifyLocalSessionsListeners();

    return { success: true };
  },

  /**
   * Backwards compatible recording helper
   */
  async recordAttendance(params: {
    subjectCode: string;
    subjectName: string;
    facultyName: string;
    facultyUid: string;
    date: string;
    studentRecords: { studentId: string; studentName: string; status: 'PRESENT' | 'ABSENT' }[];
  }): Promise<{ success: boolean; count: number; error?: string }> {
    const res = await this.submitAttendanceSession({
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 6,
      section: 'A',
      subjectCode: params.subjectCode,
      subjectName: params.subjectName,
      period: 'Period 1 (09:00 - 10:00)',
      date: params.date,
      studentRoster: params.studentRecords,
      actor: { uid: params.facultyUid, name: params.facultyName, role: 'FACULTY' },
    });
    return { success: res.success, count: params.studentRecords.length, error: res.error };
  },

  /**
   * Calculate summary metrics and history for a given student.
   * Section 20, 21, 23, 27, 45:
   * Overall Attendance % = (Total Present Classes / Total Conducted Classes) * 100
   * Unconducted classes are NOT counted as absent or in denominator.
   */
  async getStudentAttendance(studentId: string): Promise<StudentAttendanceSummary> {
    let allRecords: AttendanceRecord[] = [];

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'attendanceRecords');
        const q = query(colRef, where('studentId', '==', studentId), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          allRecords = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttendanceRecord, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore attendance fetch fallback:', err);
      }
    }

    if (allRecords.length === 0) {
      const local = getLocalRecords();
      allRecords = local.filter((r) => r.studentId === studentId);
    }

    // Sort history chronologically descending
    allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Aggregate by subject
    const subjectMap = new Map<string, { total: number; attended: number; faculty: string; name: string }>();

    let totalClasses = 0;
    let attendedClasses = 0;

    for (const rec of allRecords) {
      totalClasses++;
      if (rec.status === 'PRESENT') {
        attendedClasses++;
      }

      const existing = subjectMap.get(rec.subjectCode) || {
        total: 0,
        attended: 0,
        faculty: rec.facultyName,
        name: rec.subjectName,
      };

      existing.total++;
      if (rec.status === 'PRESENT') {
        existing.attended++;
      }
      subjectMap.set(rec.subjectCode, existing);
    }

    const missedClasses = Math.max(0, totalClasses - attendedClasses);

    // Section 21 & 45: Strict Overall Attendance Percentage Calculation
    const overallPercentage =
      totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 1000) / 10 : 0;

    const subjects: AttendanceSubject[] = [];
    subjectMap.forEach((val, code) => {
      const percentage = val.total > 0 ? Math.round((val.attended / val.total) * 1000) / 10 : 0;
      subjects.push({
        subjectCode: code,
        subjectName: val.name,
        facultyName: val.faculty,
        totalClasses: val.total,
        attendedClasses: val.attended,
        percentage,
      });
    });

    return {
      overallPercentage,
      totalClasses,
      attendedClasses,
      missedClasses,
      isEligible: overallPercentage >= 75,
      subjects,
      history: allRecords,
    };
  },

  /**
   * Realtime listener for student attendance updates (Section 19 & 36)
   */
  subscribeStudentAttendance(
    studentId: string,
    callback: (summary: StudentAttendanceSummary) => void
  ): () => void {
    const listenerEntry = { studentId, callback };
    activeAttendanceListeners.add(listenerEntry);

    // Immediate calculation
    this.getStudentAttendance(studentId).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'attendanceRecords');
        const q = query(colRef, where('studentId', '==', studentId), orderBy('date', 'desc'));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getStudentAttendance(studentId).then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore attendance subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore attendance listener:', err);
      }
    }

    return () => {
      activeAttendanceListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },

  /**
   * Realtime listener for attendance sessions (faculty/staff history)
   */
  subscribeAttendanceSessions(
    branch: string | undefined,
    callback: (sessions: AttendanceSession[]) => void
  ): () => void {
    const listenerEntry = { branch, callback };
    activeSessionsListeners.add(listenerEntry);

    this.getAttendanceSessions(branch ? { branch } : undefined).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'attendanceSessions');
        unsubscribeFirestore = onSnapshot(
          colRef,
          () => {
            this.getAttendanceSessions(branch ? { branch } : undefined).then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore attendance sessions subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore attendance sessions listener:', err);
      }
    }

    return () => {
      activeSessionsListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
