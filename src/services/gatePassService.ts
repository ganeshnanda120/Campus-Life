import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { notificationService } from './notificationService';
import { activityService } from './activityService';
import { auditService } from './auditService';
import type {
  GatePass,
  GatePassStatus,
  VisitorExitLog,
  AttachmentFile,
  StudentCategory,
  UserRole,
} from '../types';

const GATE_PASS_STORAGE_KEY = 'campus_life_gate_passes';
const VISITOR_LOGS_STORAGE_KEY = 'campus_life_visitor_logs';

type PassListener = {
  filters?: {
    studentId?: string;
    status?: GatePassStatus | 'ALL';
    searchQuery?: string;
  };
  callback: (passes: GatePass[]) => void;
};
const activePassListeners = new Set<PassListener>();

function notifyLocalPassListeners() {
  activePassListeners.forEach((entry) => {
    gatePassService.getPasses(entry.filters).then(entry.callback).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === GATE_PASS_STORAGE_KEY) {
      notifyLocalPassListeners();
    }
  });
}

function generateSafeToken(passId: string, studentId: string): string {
  const salt = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `GP-TOKEN:${passId}:${studentId.substring(0, 6)}:${salt}`;
}

function getLocalPasses(): GatePass[] {
  try {
    const raw = safeStorage.getItem(GATE_PASS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalPasses(passes: GatePass[]) {
  try {
    safeStorage.setItem(GATE_PASS_STORAGE_KEY, JSON.stringify(passes));
  } catch {
    // ignore
  }
}

function getLocalVisitorLogs(): VisitorExitLog[] {
  try {
    const raw = safeStorage.getItem(VISITOR_LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalVisitorLogs(logs: VisitorExitLog[]) {
  try {
    safeStorage.setItem(VISITOR_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

export const gatePassService = {
  async getPasses(filters?: {
    studentId?: string;
    status?: GatePassStatus | 'ALL';
    searchQuery?: string;
  }): Promise<GatePass[]> {
    let list: GatePass[] = [];

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'gatePassRequests');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GatePass, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore gate passes fetch fallback:', err);
      }
    }

    if (list.length === 0) {
      list = getLocalPasses();
    }

    if (filters) {
      if (filters.studentId) {
        list = list.filter((p) => p.studentId === filters.studentId);
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter((p) => p.status === filters.status);
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        list = list.filter(
          (p) =>
            p.gatePassId.toLowerCase().includes(q) ||
            p.destination.toLowerCase().includes(q) ||
            p.reason.toLowerCase().includes(q) ||
            p.studentName.toLowerCase().includes(q)
        );
      }
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getPassById(id: string): Promise<GatePass | null> {
    const list = await this.getPasses();
    return list.find((p) => p.id === id || p.gatePassId === id) || null;
  },

  async getPassByToken(token: string): Promise<GatePass | null> {
    const list = await this.getPasses();
    return list.find((p) => p.token === token) || null;
  },

  async createPassRequest(data: {
    studentId: string;
    studentName: string;
    studentRoll: string;
    studentCategory: StudentCategory;
    destination: string;
    reason: string;
    leavingDate: string;
    leavingTime: string;
    expectedReturn: string;
    description?: string;
    attachments?: AttachmentFile[];
  }): Promise<GatePass> {
    // Validate leaving vs return
    const leaveTimestamp = new Date(`${data.leavingDate} ${data.leavingTime}`).getTime();
    const returnTimestamp = new Date(data.expectedReturn).getTime();

    if (!isNaN(leaveTimestamp) && !isNaN(returnTimestamp) && returnTimestamp <= leaveTimestamp) {
      throw new Error('Expected return date and time must be after the departure date and time.');
    }

    const serial = Math.floor(100 + Math.random() * 900);
    const gatePassId = `GP-${new Date().getFullYear()}-${serial}`;
    const id = `gp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const token = generateSafeToken(gatePassId, data.studentId);

    const newPass: GatePass = {
      id,
      gatePassId,
      studentId: data.studentId,
      studentName: data.studentName,
      studentRoll: data.studentRoll,
      studentCategory: data.studentCategory,
      destination: data.destination.trim(),
      reason: data.reason.trim(),
      leavingDate: data.leavingDate,
      leavingTime: data.leavingTime,
      expectedReturn: data.expectedReturn,
      description: data.description?.trim(),
      status: 'PENDING',
      token,
      attachments: data.attachments || [],
      createdAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'gatePassRequests', id);
        await setDoc(docRef, newPass);
      } catch (err) {
        console.warn('Firestore gate pass create fallback:', err);
      }
    }

    const localList = getLocalPasses();
    localList.unshift(newPass);
    saveLocalPasses(localList);
    notifyLocalPassListeners();

    // Notify student
    await notificationService.createNotification({
      userId: data.studentId,
      title: 'Gate Pass Requested',
      message: `Your gate pass application #${gatePassId} for ${data.destination} has been submitted for approval.`,
      type: 'gate_pass',
      link: '/student/gate-pass',
    });

    // Activity log
    await activityService.logActivity({
      userId: data.studentId,
      userName: data.studentName,
      userRole: 'STUDENT',
      activityType: 'GATE_PASS_REQUESTED',
      description: `Applied for Gate Pass #${gatePassId} to ${data.destination}`,
      entityType: 'GATE_PASS',
      entityId: gatePassId,
    });

    // Audit log
    await auditService.logAction({
      actorUid: data.studentId,
      actorName: data.studentName,
      actorRole: 'STUDENT',
      action: 'REQUEST_GATE_PASS',
      entityType: 'GATE_PASS',
      entityId: gatePassId,
      changes: `Requested pass for ${data.destination} (${data.leavingDate})`,
    });

    return newPass;
  },

  async approvePass(
    passId: string,
    params: {
      approverId: string;
      approverName: string;
      approverRole: UserRole;
    }
  ): Promise<GatePass> {
    const pass = await this.getPassById(passId);
    if (!pass) throw new Error('Gate pass not found.');

    const now = new Date().toISOString();
    const updated: GatePass = {
      ...pass,
      status: 'APPROVED',
      approvedBy: `${params.approverName} (${params.approverRole})`,
      approvedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'gatePassRequests', pass.id);
        await updateDoc(docRef, {
          status: 'APPROVED',
          approvedBy: updated.approvedBy,
          approvedAt: now,
        });
      } catch (err) {
        console.warn('Firestore approve gate pass fallback:', err);
      }
    }

    const localList = getLocalPasses();
    const idx = localList.findIndex((p) => p.id === pass.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalPasses(localList);
    }
    notifyLocalPassListeners();

    // Notify student
    await notificationService.createNotification({
      userId: pass.studentId,
      title: 'Gate Pass Approved',
      message: `Your gate pass #${pass.gatePassId} has been approved by ${params.approverName}. Digital QR pass is now active.`,
      type: 'gate_pass',
      link: '/student/gate-pass',
    });

    // Activity log
    await activityService.logActivity({
      userId: pass.studentId,
      userName: pass.studentName,
      userRole: 'STUDENT',
      activityType: 'GATE_PASS_APPROVED',
      description: `Gate Pass #${pass.gatePassId} approved by ${params.approverName}`,
      entityType: 'GATE_PASS',
      entityId: pass.gatePassId,
    });

    // Audit log
    await auditService.logAction({
      actorUid: params.approverId,
      actorName: params.approverName,
      actorRole: params.approverRole,
      action: 'APPROVE_GATE_PASS',
      entityType: 'GATE_PASS',
      entityId: pass.gatePassId,
      changes: `Approved gate pass for ${pass.studentName}`,
    });

    return updated;
  },

  async rejectPass(
    passId: string,
    params: {
      rejecterId: string;
      rejecterName: string;
      rejecterRole: UserRole;
      reason: string;
      attachment?: {
        url: string;
        type: 'image' | 'video';
      };
    }
  ): Promise<GatePass> {
    const pass = await this.getPassById(passId);
    if (!pass) throw new Error('Gate pass not found.');

    const updated: GatePass = {
      ...pass,
      status: 'REJECTED',
      rejectionReason: params.reason.trim(),
      rejectionAttachment: params.attachment,
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'gatePassRequests', pass.id);
        await updateDoc(docRef, {
          status: 'REJECTED',
          rejectionReason: updated.rejectionReason,
          rejectionAttachment: updated.rejectionAttachment || null,
        });
      } catch (err) {
        console.warn('Firestore reject gate pass fallback:', err);
      }
    }

    const localList = getLocalPasses();
    const idx = localList.findIndex((p) => p.id === pass.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalPasses(localList);
    }
    notifyLocalPassListeners();

    // Notify student
    await notificationService.createNotification({
      userId: pass.studentId,
      title: 'Gate Pass Rejected',
      message: `Your gate pass #${pass.gatePassId} was rejected. Reason: ${params.reason}`,
      type: 'gate_pass',
      link: '/student/gate-pass',
    });

    // Activity log
    await activityService.logActivity({
      userId: pass.studentId,
      userName: pass.studentName,
      userRole: 'STUDENT',
      activityType: 'GATE_PASS_REJECTED',
      description: `Gate Pass #${pass.gatePassId} rejected. Reason: ${params.reason}`,
      entityType: 'GATE_PASS',
      entityId: pass.gatePassId,
    });

    // Audit log
    await auditService.logAction({
      actorUid: params.rejecterId,
      actorName: params.rejecterName,
      actorRole: params.rejecterRole,
      action: 'REJECT_GATE_PASS',
      entityType: 'GATE_PASS',
      entityId: pass.gatePassId,
      changes: `Rejected gate pass. Reason: ${params.reason}`,
    });

    return updated;
  },

  async recordExitOrReturn(params: {
    passId: string;
    type: 'EXIT' | 'RETURN';
    recordedBy: string;
    recordedByRole: UserRole;
  }): Promise<VisitorExitLog> {
    const pass = await this.getPassById(params.passId);
    if (!pass) throw new Error('Gate pass not found.');

    if (pass.status !== 'APPROVED') {
      throw new Error(`Gate pass is not active (Status: ${pass.status}). Egress/ingress denied.`);
    }

    const now = new Date().toISOString();
    const localLogs = getLocalVisitorLogs();

    if (params.type === 'EXIT') {
      const newLog: VisitorExitLog = {
        id: `exit_${Date.now()}`,
        gatePassId: pass.gatePassId,
        studentId: pass.studentId,
        studentName: pass.studentName,
        studentRoll: pass.studentRoll,
        exitTime: now,
        expectedReturn: pass.expectedReturn,
        status: 'EXITED',
        recordedBy: params.recordedBy,
        recordedByRole: params.recordedByRole,
        timestamp: now,
      };

      localLogs.unshift(newLog);
      saveLocalVisitorLogs(localLogs);
      return newLog;
    } else {
      // Return log
      const existing = localLogs.find((l) => l.gatePassId === pass.gatePassId && l.status === 'EXITED');
      if (existing) {
        existing.status = 'RETURNED';
        existing.actualReturn = now;
        saveLocalVisitorLogs(localLogs);
        return existing;
      }

      const returnLog: VisitorExitLog = {
        id: `return_${Date.now()}`,
        gatePassId: pass.gatePassId,
        studentId: pass.studentId,
        studentName: pass.studentName,
        studentRoll: pass.studentRoll,
        exitTime: pass.leavingDate + ' ' + pass.leavingTime,
        expectedReturn: pass.expectedReturn,
        actualReturn: now,
        status: 'RETURNED',
        recordedBy: params.recordedBy,
        recordedByRole: params.recordedByRole,
        timestamp: now,
      };
      localLogs.unshift(returnLog);
      saveLocalVisitorLogs(localLogs);
      return returnLog;
    }
  },

  async getVisitorLogs(): Promise<VisitorExitLog[]> {
    return getLocalVisitorLogs();
  },

  subscribePasses(
    filters?: {
      studentId?: string;
      status?: GatePassStatus | 'ALL';
      searchQuery?: string;
    },
    callback?: (passes: GatePass[]) => void
  ): () => void {
    if (!callback) return () => {};
    const listenerEntry = { filters, callback };
    activePassListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getPasses(filters).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'gatePassRequests');
        const q = filters?.studentId
          ? query(colRef, where('studentId', '==', filters.studentId))
          : colRef;
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getPasses(filters).then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore gatePass subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore gatePass listener:', err);
      }
    }

    return () => {
      activePassListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
