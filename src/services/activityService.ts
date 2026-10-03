import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import type { UserActivity } from '../types';

const ACTIVITY_STORAGE_KEY = 'campus_life_user_activities';

function getLocalActivities(): UserActivity[] {
  try {
    const raw = safeStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [
    {
      id: 'act_init_001',
      userId: 'student_uid_001',
      title: 'Request Submitted',
      description: 'Submitted Bonafide Certificate request (#REQ-2026-089) for state scholarship verification.',
      entityType: 'request',
      entityId: 'REQ-2026-089',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'act_init_002',
      userId: 'student_uid_001',
      title: 'Attendance Recorded',
      description: 'Marked PRESENT in CS301 (Database Management Systems) by Dr. Sanjeev Mohanty.',
      entityType: 'attendance',
      entityId: 'CS301',
      timestamp: new Date(Date.now() - 18000000).toISOString(),
    },
    {
      id: 'act_init_003',
      userId: 'student_uid_001',
      title: 'Timetable Checked',
      description: 'Viewed weekly lecture and lab schedule for Semester 6.',
      entityType: 'timetable',
      timestamp: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: 'act_init_004',
      userId: 'student_uid_001',
      title: 'Account Activated',
      description: 'Completed first-time email verification and established campus password credentials.',
      entityType: 'auth',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    }
  ];
}

function saveLocalActivities(activities: UserActivity[]) {
  try {
    safeStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
  } catch {
    // ignore
  }
}

export const activityService = {
  async getUserActivities(userId: string, limitCount = 20): Promise<UserActivity[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'activities');
        const q = query(
          colRef,
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          firestoreLimit(limitCount)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<UserActivity, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore activities query fallback:', err);
      }
    }

    const all = getLocalActivities();
    return all
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  },

  async logActivity(data: Omit<UserActivity, 'id' | 'timestamp'>): Promise<UserActivity> {
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAct: UserActivity = {
      ...data,
      id,
      timestamp: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'activities', id);
        await setDoc(docRef, newAct);
      } catch (err) {
        console.warn('Firestore activity create fallback:', err);
      }
    }

    const localList = getLocalActivities();
    localList.unshift(newAct);
    saveLocalActivities(localList);

    return newAct;
  },
};
