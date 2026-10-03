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
import type { LostFoundListing, LostFoundStatus, UserRecord } from '../types';

const LOST_FOUND_STORAGE_KEY = 'campus_life_lost_found';
const activeLostFoundListeners = new Set<(items: LostFoundListing[]) => void>();

function notifyLocalLostFoundListeners() {
  lostFoundService.getItems().then((items) => {
    activeLostFoundListeners.forEach((cb) => cb(items));
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOST_FOUND_STORAGE_KEY) {
      notifyLocalLostFoundListeners();
    }
  });
}

const INITIAL_ITEMS: LostFoundListing[] = [
  {
    id: 'lf_001',
    type: 'FOUND',
    title: 'Scientific Calculator (Casio fx-991EX ClassWiz)',
    description: 'Found on the 3rd row desk of Seminar Hall 2 following the Computer Networks morning lecture. Has a white protective case.',
    category: 'Electronics',
    location: 'Seminar Hall 2, Dept of CSE',
    date: '2026-10-03',
    contactInfo: 'Deposited with Security Post 1 / Contact Estate Desk',
    status: 'OPEN',
    submittedBy: 'student_uid_001',
    submittedByName: 'Aarav Sharma',
    createdAt: '2026-10-03T11:00:00.000Z',
  },
  {
    id: 'lf_002',
    type: 'LOST',
    title: 'Blue Water Bottle (Milton Thermosteel 1000ml)',
    description: 'Misplaced in Central Library 2nd floor reading hall near Section B reference shelves. Features university robotics club sticker.',
    category: 'Personal Belongings',
    location: 'Central Library, 2nd Floor',
    date: '2026-10-02',
    contactInfo: 'Library Help Desk or message Aarav Sharma',
    status: 'OPEN',
    submittedBy: 'student_uid_001',
    submittedByName: 'Aarav Sharma',
    createdAt: '2026-10-02T16:30:00.000Z',
  },
  {
    id: 'lf_003',
    type: 'FOUND',
    title: 'Boat Rockerz Wireless Earbuds Case',
    description: 'Found on bench near Hostel Block B cafeteria walkway around 08:30 PM. Case is black with small scratch on hinge.',
    category: 'Electronics',
    location: 'Hostel Block B Pathway',
    date: '2026-10-01',
    contactInfo: 'Available with Hostel B Caretaker Office',
    status: 'CLAIM_PENDING',
    submittedBy: 'staff_uid_001',
    submittedByName: 'Estate Supervisor',
    createdAt: '2026-10-01T21:00:00.000Z',
  },
  {
    id: 'lf_004',
    type: 'FOUND',
    title: 'College ID Card & Metro Pass Holder',
    description: 'Recovered outside Main Auditorium steps during orientation program. Contains identity card belonging to Mechanical Engineering student.',
    category: 'Documents & Cards',
    location: 'Main Auditorium Steps',
    date: '2026-09-29',
    contactInfo: 'Security Control Room, Gate 1',
    status: 'CLAIMED',
    submittedBy: 'staff_uid_001',
    submittedByName: 'Chief Security Officer',
    claimedBy: 'student_uid_005',
    claimedByName: 'Rohan Verma',
    createdAt: '2026-09-29T14:15:00.000Z',
  },
];

function getLocalItems(): LostFoundListing[] {
  try {
    const raw = safeStorage.getItem(LOST_FOUND_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return INITIAL_ITEMS;
}

function saveLocalItems(items: LostFoundListing[]) {
  try {
    safeStorage.setItem(LOST_FOUND_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export const lostFoundService = {
  async getItems(filters?: {
    type?: 'LOST' | 'FOUND';
    category?: string;
    status?: LostFoundStatus;
    search?: string;
  }): Promise<LostFoundListing[]> {
    let items = getLocalItems();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'lostFound');
        const q = query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<LostFoundListing, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore lostFound fetch fallback:', err);
      }
    }

    return items.filter((item) => {
      if (filters?.type && item.type !== filters.type) return false;
      if (filters?.category && filters.category !== 'ALL' && item.category !== filters.category) return false;
      if (filters?.status && item.status !== filters.status) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const match =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  },

  async reportItem(
    data: Omit<LostFoundListing, 'id' | 'createdAt' | 'status' | 'submittedBy' | 'submittedByName' | 'submittedByEmail'>,
    author: UserRecord
  ): Promise<LostFoundListing> {
    const id = `lf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newItem: LostFoundListing = {
      ...data,
      id,
      status: 'OPEN',
      submittedBy: author.uid,
      submittedByName: author.name,
      submittedByEmail: author.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'lostFound', id);
        await setDoc(docRef, newItem);
      } catch (err) {
        console.warn('Firestore lostFound create fallback:', err);
      }
    }

    const localList = getLocalItems();
    localList.unshift(newItem);
    saveLocalItems(localList);
    notifyLocalLostFoundListeners();

    // Notify moderation & users
    await notificationService.createNotification({
      userId: 'ALL',
      title: `${newItem.type === 'FOUND' ? 'Found Item Reported' : 'Lost Item Notice'}: ${newItem.title}`,
      message: `${newItem.description.substring(0, 100)}... Location: ${newItem.location}`,
      type: 'lost_found',
      entityId: id,
      link: '/lost-found',
    });

    await activityService.logActivity({
      userId: author.uid,
      title: `${newItem.type === 'LOST' ? 'Lost Item Reported' : 'Found Item Registered'}`,
      description: `Reported: ${newItem.title} at ${newItem.location}`,
      entityType: 'lost_found',
      entityId: id,
    });

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'LOST_FOUND_ITEM_REPORTED',
      entityType: 'lost_found',
      entityId: id,
      newValue: JSON.stringify({ type: newItem.type, title: newItem.title }),
    });

    return newItem;
  },

  async updateItemStatus(
    id: string,
    status: LostFoundStatus,
    actor: UserRecord,
    claimedByUserId?: string,
    claimedByUserName?: string
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updates: Partial<LostFoundListing> = {
      status,
      updatedAt,
      moderatedBy: actor.name,
    };

    if (claimedByUserId) {
      updates.claimedBy = claimedByUserId;
      updates.claimedByName = claimedByUserName || 'Campus User';
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'lostFound', id);
        await updateDoc(docRef, updates);
      } catch (err) {
        console.warn('Firestore lostFound update fallback:', err);
      }
    }

    const localList = getLocalItems();
    const idx = localList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...updates };
      saveLocalItems(localList);
      notifyLocalLostFoundListeners();
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'LOST_FOUND_STATUS_CHANGED',
      entityType: 'lost_found',
      entityId: id,
      changes: JSON.stringify({ newStatus: status, claimedBy: claimedByUserName }),
    });
  },

  async deleteItem(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'lostFound', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore lostFound delete fallback:', err);
      }
    }

    const localList = getLocalItems().filter((item) => item.id !== id);
    saveLocalItems(localList);
    notifyLocalLostFoundListeners();

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'LOST_FOUND_DELETED',
      entityType: 'lost_found',
      entityId: id,
    });
  },

  subscribeItems(callback: (items: LostFoundListing[]) => void): () => void {
    activeLostFoundListeners.add(callback);

    // Initial immediate invocation
    this.getItems().then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'lostFound');
        const q = query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(50));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getItems().then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore lostFound subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore lostFound listener:', err);
      }
    }

    return () => {
      activeLostFoundListeners.delete(callback);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
