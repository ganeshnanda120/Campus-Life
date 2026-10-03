import {
  collection,
  doc,
  getDocs,
  setDoc,
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
  AttendanceSubject,
} from '../types';

const ATTENDANCE_STORAGE_KEY = 'campus_life_attendance_records';
type AttendanceListener = {
  studentId: string;
  callback: (summary: StudentAttendanceSummary) => void;
};
const activeAttendanceListeners = new Set<AttendanceListener>();

function notifyLocalAttendanceListeners() {
  activeAttendanceListeners.forEach((entry) => {
    attendanceService.getStudentAttendance(entry.studentId).then(entry.callback).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === ATTENDANCE_STORAGE_KEY) {
      notifyLocalAttendanceListeners();
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

// Initial demo subjects for CSE semester 6
export const DEFAULT_SUBJECTS: { code: string; name: string; faculty: string }[] = [
  { code: 'CS301', name: 'Database Management Systems', faculty: 'Dr. Sanjeev Mohanty' },
  { code: 'CS302', name: 'Operating Systems & System Software', faculty: 'Prof. K. Nayak' },
  { code: 'CS303', name: 'Computer Networks & Protocols', faculty: 'Prof. M. K. Panda' },
  { code: 'CS304', name: 'Design & Analysis of Algorithms', faculty: 'Dr. A. K. Behera' },
  { code: 'CS305', name: 'Software Engineering & Agile', faculty: 'Prof. S. R. Sahoo' },
];

function getLocalAttendance(): AttendanceRecord[] {
  try {
    const raw = safeStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalAttendance(records: AttendanceRecord[]) {
  try {
    safeStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export const attendanceService = {
  /**
   * Calculate summary metrics and history for a given student
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
      const local = getLocalAttendance();
      allRecords = local.filter((r) => r.studentId === studentId);
      // Fallback: if user is not STU2026001, generate default baseline for current student
      if (allRecords.length === 0) {
        allRecords = local.slice(0, 50).map((r) => ({ ...r, studentId }));
      }
    }

    // Sort history chronologically descending
    allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Aggregate by subject
    const subjectMap = new Map<string, { total: number; attended: number; faculty: string; name: string }>();

    for (const subj of DEFAULT_SUBJECTS) {
      subjectMap.set(subj.code, {
        total: 0,
        attended: 0,
        faculty: subj.faculty,
        name: subj.name,
      });
    }

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
   * Faculty authorized attendance recording
   */
  async recordAttendance(params: {
    subjectCode: string;
    subjectName: string;
    facultyName: string;
    facultyUid: string;
    date: string;
    studentRecords: { studentId: string; studentName: string; status: 'PRESENT' | 'ABSENT' }[];
  }): Promise<{ success: boolean; count: number; error?: string }> {
    const { subjectCode, subjectName, facultyName, date, studentRecords } = params;

    const localList = getLocalAttendance();

    for (const item of studentRecords) {
      const id = `att_${item.studentId}_${subjectCode}_${date}`;
      const record: AttendanceRecord = {
        id,
        studentId: item.studentId,
        studentName: item.studentName,
        subjectCode,
        subjectName,
        facultyName,
        date,
        status: item.status,
      };

      if (isFirebaseConfigured && db) {
        try {
          const docRef = doc(db, 'attendanceRecords', id);
          await setDoc(docRef, record);
        } catch (err) {
          console.warn('Firestore attendance record fallback:', err);
        }
      }

      // Upsert into local storage to prevent duplicate records
      const idx = localList.findIndex((r) => r.id === id);
      if (idx !== -1) {
        localList[idx] = record;
      } else {
        localList.unshift(record);
      }

      // Dispatch in-app notification and activity log for student
      await notificationService.createNotification({
        userId: item.studentId,
        title: `Attendance Marked: ${subjectCode}`,
        message: `Marked ${item.status} for ${subjectName} on ${date}.`,
        type: 'attendance',
        link: '/student/attendance',
      });

      await activityService.logActivity({
        userId: item.studentId,
        title: 'Attendance Recorded',
        description: `Marked ${item.status} in ${subjectCode} (${subjectName}) by ${facultyName}.`,
        entityType: 'attendance',
        entityId: subjectCode,
      });
    }

    saveLocalAttendance(localList);
    notifyLocalAttendanceListeners();

    return { success: true, count: studentRecords.length };
  },

  subscribeStudentAttendance(
    studentId: string,
    callback: (summary: StudentAttendanceSummary) => void
  ): () => void {
    const listenerEntry = { studentId, callback };
    activeAttendanceListeners.add(listenerEntry);

    // Initial immediate invocation
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
};
