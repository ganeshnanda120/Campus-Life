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
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import type { ServiceDirectoryEntry, UserRecord } from '../types';

const DIRECTORY_STORAGE_KEY = 'campus_life_service_directory';

function getLocalServices(): ServiceDirectoryEntry[] {
  try {
    const raw = safeStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalServices(services: ServiceDirectoryEntry[]) {
  try {
    safeStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(services));
  } catch {
    // ignore
  }
}

export const directoryService = {
  async getServices(filters?: { department?: string; search?: string }): Promise<ServiceDirectoryEntry[]> {
    let services = getLocalServices();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'serviceDirectory');
        const q = query(colRef, orderBy('department', 'asc'), firestoreLimit(50));
        const snap = await getDocs(q);
        if (!snap.empty) {
          services = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ServiceDirectoryEntry, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore serviceDirectory fetch fallback:', err);
      }
    }

    return services.filter((s) => {
      if (s.status === 'INACTIVE') return false;
      if (filters?.department && filters.department !== 'ALL' && s.department !== filters.department) {
        return false;
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matches =
          s.department.toLowerCase().includes(q) ||
          s.responsibleOffice.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.servicesProvided.some((srv) => srv.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  },

  async addService(
    data: Omit<ServiceDirectoryEntry, 'id' | 'createdAt' | 'status'>,
    author: UserRecord
  ): Promise<ServiceDirectoryEntry> {
    const id = `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: ServiceDirectoryEntry = {
      ...data,
      id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await setDoc(docRef, newEntry);
      } catch (err) {
        console.warn('Firestore serviceDirectory add fallback:', err);
      }
    }

    const localList = getLocalServices();
    localList.push(newEntry);
    saveLocalServices(localList);

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'SERVICE_DIRECTORY_ADDED',
      entityType: 'service_directory',
      entityId: id,
      newValue: JSON.stringify({ office: newEntry.responsibleOffice }),
    });

    return newEntry;
  },

  async updateService(
    id: string,
    updates: Partial<ServiceDirectoryEntry>,
    actor: UserRecord
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const finalUpdates = { ...updates, updatedAt };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await updateDoc(docRef, finalUpdates);
      } catch (err) {
        console.warn('Firestore serviceDirectory update fallback:', err);
      }
    }

    const localList = getLocalServices();
    const idx = localList.findIndex((s) => s.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...finalUpdates };
      saveLocalServices(localList);
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'SERVICE_DIRECTORY_UPDATED',
      entityType: 'service_directory',
      entityId: id,
      changes: JSON.stringify(updates),
    });
  },

  async deleteService(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore serviceDirectory delete fallback:', err);
      }
    }

    const localList = getLocalServices().filter((s) => s.id !== id);
    saveLocalServices(localList);

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'SERVICE_DIRECTORY_DELETED',
      entityType: 'service_directory',
      entityId: id,
    });
  },
};
