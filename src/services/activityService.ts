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
  return [];
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
