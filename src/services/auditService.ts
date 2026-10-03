import { collection, addDoc, getDocs, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import type { AuditLog, UserRole } from '../types';

const AUDIT_STORAGE_KEY = 'campus_life_audit_logs';

function getLocalAuditLogs(): AuditLog[] {
  try {
    const raw = safeStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [
    {
      id: 'log_init_001',
      actorId: 'admin_uid_001',
      actorName: 'Chief Administrative Officer',
      actorRole: 'MAIN_ADMIN',
      action: 'CREATE_USER',
      entityType: 'STUDENT',
      entityId: 'STU2026001',
      timestamp: '2026-02-01T10:00:00.000Z',
      changes: 'Created student record: Aarav Sharma (Hosteler, CSE 3rd Year)',
    },
    {
      id: 'log_init_002',
      actorId: 'admin_uid_001',
      actorName: 'Chief Administrative Officer',
      actorRole: 'MAIN_ADMIN',
      action: 'ASSIGN_PERMISSION',
      entityType: 'SUB_ADMIN',
      entityId: 'subadmin_uid_001',
      timestamp: '2026-02-05T14:30:00.000Z',
      changes: 'Assigned permissions: MANAGE_HOSTEL, MANAGE_GATE_PASS, MANAGE_COMPLAINTS',
    }
  ];
}

function saveLocalAuditLog(log: AuditLog) {
  try {
    const logs = getLocalAuditLogs();
    logs.unshift(log);
    safeStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch {
    // ignore
  }
}

export interface LogAuditParams {
  actorUid?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  changes?: string;
  newValue?: string;
}

export const auditService = {
  async logAction(params: LogAuditParams): Promise<void> {
    const newLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorId: params.actorId || params.actorUid || 'admin_system',
      actorName: params.actorName || 'Administrator',
      actorRole: params.actorRole || 'MAIN_ADMIN',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      timestamp: new Date().toISOString(),
      changes: params.changes || params.newValue || '',
    };

    if (isFirebaseConfigured && db) {
      try {
        const auditCol = collection(db, 'auditLogs');
        await addDoc(auditCol, newLog);
        return;
      } catch (err) {
        console.warn('Firestore audit logging fallback:', err);
      }
    }

    saveLocalAuditLog(newLog);
  },

  async getRecentLogs(maxResults = 25): Promise<AuditLog[]> {
    if (isFirebaseConfigured && db) {
      try {
        const auditCol = collection(db, 'auditLogs');
        const q = query(auditCol, orderBy('timestamp', 'desc'), firestoreLimit(maxResults));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AuditLog, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore audit fetch fallback:', err);
      }
    }

    return getLocalAuditLogs().slice(0, maxResults);
  },
};
