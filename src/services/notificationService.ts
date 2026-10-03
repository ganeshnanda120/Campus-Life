import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import type { InAppNotification } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'campus_life_notifications';
type NotificationListener = (notifications: InAppNotification[]) => void;
const activeListeners = new Set<{ userId: string; callback: NotificationListener }>();

function notifyLocalListeners(userId: string) {
  const all = getLocalNotifications();
  const userNotifs = all
    .filter((n) => n.userId === userId || n.userId === 'ALL')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  activeListeners.forEach((entry) => {
    if (entry.userId === userId || entry.userId === 'ALL') {
      entry.callback(userNotifs);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === NOTIFICATIONS_STORAGE_KEY) {
      activeListeners.forEach((entry) => {
        notifyLocalListeners(entry.userId);
      });
    }
  });
}

function getLocalNotifications(): InAppNotification[] {
  try {
    const raw = safeStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalNotifications(notifications: InAppNotification[]) {
  try {
    safeStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore
  }
}

export const notificationService = {
  async getNotifications(userId: string): Promise<InAppNotification[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'notifications');
        const q = query(
          colRef,
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          firestoreLimit(50)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<InAppNotification, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore notifications query fallback:', err);
      }
    }
    const all = getLocalNotifications();
    return all
      .filter((n) => n.userId === userId || n.userId === 'ALL')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createNotification(
    data: Omit<InAppNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<InAppNotification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotif: InAppNotification = {
      ...data,
      id,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'notifications', id);
        await setDoc(docRef, newNotif);
      } catch (err) {
        console.warn('Firestore notification create fallback:', err);
      }
    }

    const localList = getLocalNotifications();
    localList.unshift(newNotif);
    saveLocalNotifications(localList);
    notifyLocalListeners(data.userId);

    return newNotif;
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'notifications', notificationId);
        await updateDoc(docRef, { isRead: true });
      } catch (err) {
        console.warn('Firestore notification markAsRead fallback:', err);
      }
    }

    const localList = getLocalNotifications();
    const item = localList.find((n) => n.id === notificationId);
    if (item) {
      item.isRead = true;
      saveLocalNotifications(localList);
      notifyLocalListeners(item.userId);
    }
  },

  async getUserNotifications(userId: string): Promise<InAppNotification[]> {
    return this.getNotifications(userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const list = await this.getNotifications(userId);
    return list.filter((n) => !n.isRead).length;
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'notifications');
        const q = query(colRef, where('userId', '==', userId), where('isRead', '==', false));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
          await batch.commit();
        }
      } catch (err) {
        console.warn('Firestore markAllAsRead fallback:', err);
      }
    }

    const localList = getLocalNotifications();
    localList.forEach((n) => {
      if (n.userId === userId) n.isRead = true;
    });
    saveLocalNotifications(localList);
    notifyLocalListeners(userId);
  },

  subscribeNotifications(userId: string, callback: (notifications: InAppNotification[]) => void): () => void {
    const listenerEntry = { userId, callback };
    activeListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getNotifications(userId).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'notifications');
        const q = query(
          colRef,
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          firestoreLimit(50)
        );
        unsubscribeFirestore = onSnapshot(
          q,
          (snap) => {
            if (!snap.empty) {
              const notifs = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<InAppNotification, 'id'>),
              }));
              callback(notifs);
            }
          },
          (err) => {
            console.warn('Firestore notification subscription error:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore notification listener:', err);
      }
    }

    return () => {
      activeListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
