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


function getLocalTimetable(): TimetableEntry[] {
  try {
    const raw = safeStorage.getItem(TIMETABLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
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
