import {
  collection,
  doc,
  getDocs,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { notificationService } from './notificationService';
import { activityService } from './activityService';
import type { TimetableEntry, UserRole } from '../types';

const TIMETABLE_STORAGE_KEY = 'campus_life_timetable_entries';
type TimetableListener = {
  branch?: string;
  year?: number;
  callback: (grouped: Record<string, TimetableEntry[]>) => void;
};
const activeTimetableListeners = new Set<TimetableListener>();

function notifyLocalTimetableListeners() {
  activeTimetableListeners.forEach((entry) => {
    timetableService.getWeeklyTimetable().then(entry.callback).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TIMETABLE_STORAGE_KEY) {
      notifyLocalTimetableListeners();
    }
  });
}

export const DAYS_OF_WEEK: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const INITIAL_TIMETABLE: TimetableEntry[] = [
  // Monday
  {
    id: 'tt_mon_01',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS301',
    subjectName: 'Database Management Systems',
    facultyName: 'Dr. Sanjeev Mohanty',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_mon_02',
    day: 'Monday',
    startTime: '10:15',
    endTime: '11:15',
    timeSlot: '10:15 AM – 11:15 AM',
    subjectCode: 'CS302',
    subjectName: 'Operating Systems & System Software',
    facultyName: 'Prof. K. Nayak',
    room: 'LH-203',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_mon_03',
    day: 'Monday',
    startTime: '11:30',
    endTime: '12:30',
    timeSlot: '11:30 AM – 12:30 PM',
    subjectCode: 'CS303',
    subjectName: 'Computer Networks & Protocols',
    facultyName: 'Prof. M. K. Panda',
    room: 'LH-105',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_mon_04',
    day: 'Monday',
    startTime: '14:00',
    endTime: '16:00',
    timeSlot: '02:00 PM – 04:00 PM',
    subjectCode: 'CS301P',
    subjectName: 'Database Systems Laboratory (Lab 2)',
    facultyName: 'Dr. Sanjeev Mohanty & Teaching Assistants',
    room: 'Computer Lab 3',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },

  // Tuesday
  {
    id: 'tt_tue_01',
    day: 'Tuesday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS304',
    subjectName: 'Design & Analysis of Algorithms',
    facultyName: 'Dr. A. K. Behera',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_tue_02',
    day: 'Tuesday',
    startTime: '10:15',
    endTime: '11:15',
    timeSlot: '10:15 AM – 11:15 AM',
    subjectCode: 'CS305',
    subjectName: 'Software Engineering & Agile',
    facultyName: 'Prof. S. R. Sahoo',
    room: 'LH-204',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_tue_03',
    day: 'Tuesday',
    startTime: '11:30',
    endTime: '12:30',
    timeSlot: '11:30 AM – 12:30 PM',
    subjectCode: 'CS301',
    subjectName: 'Database Management Systems',
    facultyName: 'Dr. Sanjeev Mohanty',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },

  // Wednesday
  {
    id: 'tt_wed_01',
    day: 'Wednesday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS303',
    subjectName: 'Computer Networks & Protocols',
    facultyName: 'Prof. M. K. Panda',
    room: 'LH-105',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_wed_02',
    day: 'Wednesday',
    startTime: '10:15',
    endTime: '11:15',
    timeSlot: '10:15 AM – 11:15 AM',
    subjectCode: 'CS304',
    subjectName: 'Design & Analysis of Algorithms',
    facultyName: 'Dr. A. K. Behera',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_wed_03',
    day: 'Wednesday',
    startTime: '14:00',
    endTime: '16:00',
    timeSlot: '02:00 PM – 04:00 PM',
    subjectCode: 'CS302P',
    subjectName: 'Operating Systems Laboratory',
    facultyName: 'Prof. K. Nayak',
    room: 'Linux Lab 1',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },

  // Thursday
  {
    id: 'tt_thu_01',
    day: 'Thursday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS302',
    subjectName: 'Operating Systems & System Software',
    facultyName: 'Prof. K. Nayak',
    room: 'LH-203',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_thu_02',
    day: 'Thursday',
    startTime: '10:15',
    endTime: '11:15',
    timeSlot: '10:15 AM – 11:15 AM',
    subjectCode: 'CS305',
    subjectName: 'Software Engineering & Agile',
    facultyName: 'Prof. S. R. Sahoo',
    room: 'LH-204',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },

  // Friday
  {
    id: 'tt_fri_01',
    day: 'Friday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS301',
    subjectName: 'Database Management Systems',
    facultyName: 'Dr. Sanjeev Mohanty',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_fri_02',
    day: 'Friday',
    startTime: '10:15',
    endTime: '11:15',
    timeSlot: '10:15 AM – 11:15 AM',
    subjectCode: 'CS303',
    subjectName: 'Computer Networks & Protocols',
    facultyName: 'Prof. M. K. Panda',
    room: 'LH-105',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },

  // Saturday
  {
    id: 'tt_sat_01',
    day: 'Saturday',
    startTime: '09:00',
    endTime: '10:00',
    timeSlot: '09:00 AM – 10:00 AM',
    subjectCode: 'CS304',
    subjectName: 'Design & Analysis of Algorithms Tutorial',
    facultyName: 'Dr. A. K. Behera',
    room: 'LH-201',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
  {
    id: 'tt_sat_02',
    day: 'Saturday',
    startTime: '10:15',
    endTime: '12:15',
    timeSlot: '10:15 AM – 12:15 PM',
    subjectCode: 'CS309',
    subjectName: 'Mini Project Seminar & Presentation',
    facultyName: 'Department Faculty Committee',
    room: 'Seminar Hall 1',
    status: 'SCHEDULED',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
  },
];

function getLocalTimetable(): TimetableEntry[] {
  try {
    const raw = safeStorage.getItem(TIMETABLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  try {
    safeStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(INITIAL_TIMETABLE));
  } catch {
    // ignore
  }
  return INITIAL_TIMETABLE;
}

function saveLocalTimetable(entries: TimetableEntry[]) {
  try {
    safeStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/**
 * Compute real-time status based on current time
 */
export function computeRealtimeClassStatus(entry: TimetableEntry, targetDay: string): TimetableEntry['status'] {
  if (entry.status === 'CANCELLED' || entry.status === 'RESCHEDULED') {
    return entry.status;
  }

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

  if (targetDay !== currentDayName) {
    return 'SCHEDULED';
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = entry.startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = entry.endTime.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  if (currentMinutes < startMinutes) {
    return 'SCHEDULED';
  } else if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return 'ONGOING';
  } else {
    return 'COMPLETED';
  }
}

export const timetableService = {
  async getAllEntries(): Promise<TimetableEntry[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'timetables');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<TimetableEntry, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore timetable fetch fallback:', err);
      }
    }
    return getLocalTimetable();
  },

  async getTodayClasses(): Promise<TimetableEntry[]> {
    const all = await this.getAllEntries();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()] as TimetableEntry['day'];

    // If today is Sunday, show Monday schedule as preview
    const queryDay = todayName === 'Sunday' as any ? 'Monday' : todayName;

    const todayClasses = all.filter((e) => e.day === queryDay);
    return todayClasses.map((entry) => ({
      ...entry,
      status: computeRealtimeClassStatus(entry, queryDay),
    }));
  },

  async getWeeklyTimetable(): Promise<Record<string, TimetableEntry[]>> {
    const all = await this.getAllEntries();
    const grouped: Record<string, TimetableEntry[]> = {};

    for (const d of DAYS_OF_WEEK) {
      grouped[d] = all
        .filter((e) => e.day === d)
        .map((entry) => ({
          ...entry,
          status: computeRealtimeClassStatus(entry, d),
        }));
    }

    return grouped;
  },

  async updateClassStatus(
    classId: string,
    status: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED',
    note?: string,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; entry?: TimetableEntry; error?: string }> {
    const all = getLocalTimetable();
    const idx = all.findIndex((e) => e.id === classId);
    if (idx === -1) {
      return { success: false, error: 'Timetable entry not found.' };
    }

    all[idx] = {
      ...all[idx],
      status,
      note: note || all[idx].note,
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'timetables', classId);
        await updateDoc(docRef, { status, note: note || null });
      } catch (err) {
        console.warn('Firestore timetable update fallback:', err);
      }
    }

    saveLocalTimetable(all);
    notifyLocalTimetableListeners();

    // Dispatch broadcast in-app notification to students
    await notificationService.createNotification({
      userId: 'ALL',
      title: `Class Status Update: ${all[idx].subjectCode}`,
      message: `${all[idx].subjectName} (${all[idx].day} ${all[idx].timeSlot}) is now ${status}.${note ? ` Note: ${note}` : ''}`,
      type: 'timetable',
      link: '/student/timetable',
    });

    if (actor) {
      await activityService.logActivity({
        userId: actor.uid,
        title: `Class ${status}`,
        description: `Updated status of ${all[idx].subjectCode} to ${status}.`,
        entityType: 'timetable',
        entityId: all[idx].id,
      });
    }

    return { success: true, entry: all[idx] };
  },

  subscribeTimetable(
    callback: (grouped: Record<string, TimetableEntry[]>) => void
  ): () => void {
    const listenerEntry = { callback };
    activeTimetableListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getWeeklyTimetable().then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'timetables');
        unsubscribeFirestore = onSnapshot(
          colRef,
          () => {
            this.getWeeklyTimetable().then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore timetable subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore timetable listener:', err);
      }
    }

    return () => {
      activeTimetableListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
