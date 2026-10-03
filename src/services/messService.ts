import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import type {
  MessMenuItem,
  MessAnnouncement,
  MessFeedback,
  MealRecord,
  MealType,
  MealRecordStatus,
  UserRole,
} from '../types';

const MESS_MENU_STORAGE_KEY = 'campus_life_mess_menu';
const MESS_ANNOUNCEMENTS_STORAGE_KEY = 'campus_life_mess_announcements';
const MESS_FEEDBACK_STORAGE_KEY = 'campus_life_mess_feedback';
const MEAL_RECORDS_STORAGE_KEY = 'campus_life_meal_records';

export const MEAL_TIMINGS: Record<MealType, { label: string; timing: string }> = {
  BREAKFAST: { label: 'Breakfast', timing: '07:30 AM – 09:30 AM' },
  LUNCH: { label: 'Lunch', timing: '12:30 PM – 02:30 PM' },
  SNACKS: { label: 'Evening Snacks', timing: '05:00 PM – 06:00 PM' },
  DINNER: { label: 'Dinner', timing: '08:00 PM – 10:00 PM' },
};

function getLocalMenu(): MessMenuItem[] {
  try {
    const raw = safeStorage.getItem(MESS_MENU_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalMenu(menu: MessMenuItem[]) {
  try {
    safeStorage.setItem(MESS_MENU_STORAGE_KEY, JSON.stringify(menu));
  } catch {
    // ignore
  }
}

function getLocalAnnouncements(): MessAnnouncement[] {
  try {
    const raw = safeStorage.getItem(MESS_ANNOUNCEMENTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalAnnouncements(announcements: MessAnnouncement[]) {
  try {
    safeStorage.setItem(MESS_ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
  } catch {
    // ignore
  }
}

function getLocalFeedback(): MessFeedback[] {
  try {
    const raw = safeStorage.getItem(MESS_FEEDBACK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalFeedback(feedbacks: MessFeedback[]) {
  try {
    safeStorage.setItem(MESS_FEEDBACK_STORAGE_KEY, JSON.stringify(feedbacks));
  } catch {
    // ignore
  }
}

function getLocalMealRecords(): MealRecord[] {
  try {
    const raw = safeStorage.getItem(MEAL_RECORDS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalMealRecords(records: MealRecord[]) {
  try {
    safeStorage.setItem(MEAL_RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export const messService = {
  async getMenu(): Promise<MessMenuItem[]> {
    let list: MessMenuItem[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'messMenu'));
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessMenuItem, 'id'>) }));
        }
      } catch (err) {
        console.warn('Firestore mess menu fallback:', err);
      }
    }
    if (list.length === 0) list = getLocalMenu();
    return list;
  },

  async getAnnouncements(): Promise<MessAnnouncement[]> {
    let list: MessAnnouncement[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'messAnnouncements'));
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessAnnouncement, 'id'>) }));
        }
      } catch (err) {
        console.warn('Firestore mess announcements fallback:', err);
      }
    }
    if (list.length === 0) list = getLocalAnnouncements();
    return list;
  },

  async getFeedbacks(): Promise<MessFeedback[]> {
    return getLocalFeedback();
  },

  async submitFeedback(data: {
    studentId: string;
    studentName: string;
    facility: string;
    category: MessFeedback['category'];
    rating: number;
    comment: string;
  }): Promise<MessFeedback> {
    const id = `mfb_${Date.now()}`;
    const now = new Date().toISOString();

    const newFeedback: MessFeedback = {
      id,
      studentId: data.studentId,
      studentName: data.studentName,
      facility: data.facility,
      category: data.category,
      rating: Math.max(1, Math.min(5, data.rating)),
      comment: data.comment.trim(),
      submittedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'messFeedback', id);
        await setDoc(docRef, newFeedback);
      } catch (err) {
        console.warn('Firestore mess feedback fallback:', err);
      }
    }

    const localFeedbacks = getLocalFeedback();
    localFeedbacks.unshift(newFeedback);
    saveLocalFeedback(localFeedbacks);

    // Activity log
    await activityService.logActivity({
      userId: data.studentId,
      userName: data.studentName,
      userRole: 'STUDENT',
      activityType: 'MESS_FEEDBACK_SUBMITTED',
      description: `Submitted ${newFeedback.rating}-star feedback for ${data.category} in ${data.facility}`,
      entityType: 'MESS',
      entityId: id,
    });

    return newFeedback;
  },

  async updateMenuItem(
    menuItem: MessMenuItem,
    adminActor: { uid: string; name: string; role: UserRole }
  ): Promise<void> {
    const list = getLocalMenu();
    const idx = list.findIndex((m) => m.id === menuItem.id || (m.dayOfWeek === menuItem.dayOfWeek && m.mealType === menuItem.mealType));
    if (idx !== -1) {
      list[idx] = menuItem;
    } else {
      list.push(menuItem);
    }
    saveLocalMenu(list);

    await auditService.logAction({
      actorUid: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      action: 'UPDATE_MESS_MENU',
      entityType: 'MESS_MENU',
      entityId: menuItem.id,
      changes: `Updated ${menuItem.dayOfWeek} ${menuItem.mealType} menu`,
    });
  },

  async addAnnouncement(
    ann: Omit<MessAnnouncement, 'id' | 'date'>,
    adminActor: { uid: string; name: string; role: UserRole }
  ): Promise<MessAnnouncement> {
    const id = `mann_${Date.now()}`;
    const newAnn: MessAnnouncement = {
      ...ann,
      id,
      date: new Date().toISOString().split('T')[0],
    };

    const localList = getLocalAnnouncements();
    localList.unshift(newAnn);
    saveLocalAnnouncements(localList);

    await notificationService.createNotification({
      userId: 'ALL',
      title: 'Mess Announcement: ' + ann.title,
      message: ann.message,
      type: 'notice',
      link: '/student/mess',
    });

    await auditService.logAction({
      actorUid: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      action: 'CREATE_MESS_ANNOUNCEMENT',
      entityType: 'MESS_ANNOUNCEMENT',
      entityId: id,
      changes: `Posted: "${ann.title}"`,
    });

    return newAnn;
  },

  async recordMealStatus(params: {
    studentId: string;
    studentName: string;
    mealType: MealType;
    status: MealRecordStatus;
    recordedBy: string;
  }): Promise<MealRecord> {
    const today = new Date().toISOString().split('T')[0];
    const localRecords = getLocalMealRecords();

    // Prevent duplicate records for the same student/date/meal type
    const existing = localRecords.find(
      (r) => r.studentId === params.studentId && r.date === today && r.mealType === params.mealType
    );

    if (existing) {
      existing.status = params.status;
      existing.recordedBy = params.recordedBy;
      existing.timestamp = new Date().toISOString();
      saveLocalMealRecords(localRecords);
      return existing;
    }

    const newRecord: MealRecord = {
      id: `meal_${Date.now()}`,
      studentId: params.studentId,
      studentName: params.studentName,
      date: today,
      mealType: params.mealType,
      status: params.status,
      recordedBy: params.recordedBy,
      timestamp: new Date().toISOString(),
    };

    localRecords.unshift(newRecord);
    saveLocalMealRecords(localRecords);
    return newRecord;
  },

  async getStudentMealRecords(studentId: string): Promise<MealRecord[]> {
    const records = getLocalMealRecords();
    return records.filter((r) => r.studentId === studentId);
  },

  async getAllMealRecords(): Promise<MealRecord[]> {
    return getLocalMealRecords();
  },
};
