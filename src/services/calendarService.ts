import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import type { CampusCalendarEvent, UserRecord } from '../types';

const CALENDAR_STORAGE_KEY = 'campus_life_calendar_events';
const activeCalendarListeners = new Set<(events: CampusCalendarEvent[]) => void>();

function notifyLocalCalendarListeners() {
  calendarService.getEvents().then((evts) => {
    activeCalendarListeners.forEach((cb) => cb(evts));
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CALENDAR_STORAGE_KEY) {
      notifyLocalCalendarListeners();
    }
  });
}


function getLocalEvents(): CampusCalendarEvent[] {
  try {
    const raw = safeStorage.getItem(CALENDAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalEvents(events: CampusCalendarEvent[]) {
  try {
    safeStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export const calendarService = {
  async getEvents(): Promise<CampusCalendarEvent[]> {
    let events = getLocalEvents();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'calendar');
        const q = query(colRef, orderBy('startDate', 'asc'), firestoreLimit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          events = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CampusCalendarEvent, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore calendar fetch fallback:', err);
      }
    }

    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  },

  async createEvent(
    data: Omit<CampusCalendarEvent, 'id' | 'createdAt'>,
    author: UserRecord
  ): Promise<CampusCalendarEvent> {
    const id = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEvent: CampusCalendarEvent = {
      ...data,
      id,
      status: data.status || 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await setDoc(docRef, newEvent);
      } catch (err) {
        console.warn('Firestore event create fallback:', err);
      }
    }

    const localList = getLocalEvents();
    localList.push(newEvent);
    saveLocalEvents(localList);
    notifyLocalCalendarListeners();

    // Notify users
    await notificationService.createNotification({
      userId: 'ALL',
      title: `Calendar Event: ${newEvent.title}`,
      message: `${newEvent.category.toUpperCase()} scheduled for ${new Date(newEvent.startDate).toLocaleDateString()}. Location: ${newEvent.location || 'Campus'}`,
      type: 'calendar',
      entityId: id,
      link: '/calendar',
    });

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'CALENDAR_EVENT_CREATED',
      entityType: 'calendar',
      entityId: id,
      newValue: JSON.stringify({ title: newEvent.title, date: newEvent.startDate }),
    });

    await activityService.logActivity({
      userId: author.uid,
      title: 'Event Scheduled',
      description: `Created campus calendar event: ${newEvent.title}`,
      entityType: 'calendar',
      entityId: id,
    });

    return newEvent;
  },

  async updateEvent(id: string, updates: Partial<CampusCalendarEvent>, actor: UserRecord): Promise<void> {
    const updatedAt = new Date().toISOString();
    const finalUpdates = { ...updates, updatedAt };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await updateDoc(docRef, finalUpdates);
      } catch (err) {
        console.warn('Firestore event update fallback:', err);
      }
    }

    const localList = getLocalEvents();
    const idx = localList.findIndex((e) => e.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...finalUpdates };
      saveLocalEvents(localList);
      notifyLocalCalendarListeners();
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CALENDAR_EVENT_UPDATED',
      entityType: 'calendar',
      entityId: id,
      changes: JSON.stringify(updates),
    });
  },

  async deleteEvent(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore event delete fallback:', err);
      }
    }

    const localList = getLocalEvents().filter((e) => e.id !== id);
    saveLocalEvents(localList);
    notifyLocalCalendarListeners();

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CALENDAR_EVENT_DELETED',
      entityType: 'calendar',
      entityId: id,
    });
  },

  subscribeEvents(callback: (events: CampusCalendarEvent[]) => void): () => void {
    activeCalendarListeners.add(callback);

    // Initial immediate invocation
    this.getEvents().then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'calendar');
        const q = query(colRef, orderBy('startDate', 'asc'), firestoreLimit(100));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getEvents().then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore calendar subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore calendar listener:', err);
      }
    }

    return () => {
      activeCalendarListeners.delete(callback);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
