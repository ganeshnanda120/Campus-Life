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
import type { Notice, NoticeRead, UserRecord } from '../types';

const NOTICES_STORAGE_KEY = 'campus_life_notices';
const NOTICE_READS_STORAGE_KEY = 'campus_life_notice_reads';

type NoticeListener = {
  user?: UserRecord | null;
  callback: (notices: Notice[]) => void;
};
const activeNoticeListeners = new Set<NoticeListener>();

function notifyLocalNoticeListeners() {
  activeNoticeListeners.forEach((entry) => {
    noticeService.getNotices(entry.user ?? null).then(entry.callback).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === NOTICES_STORAGE_KEY || e.key === NOTICE_READS_STORAGE_KEY) {
      notifyLocalNoticeListeners();
    }
  });
}

const INITIAL_NOTICES: Notice[] = [
  {
    id: 'notice_emg_001',
    title: 'EMERGENCY: Heavy Rainfall Alert & Campus Operations Advisory',
    description: 'Due to severe cyclone alert by IMD and state disaster management authority, all offline laboratory sessions and evening library hours are suspended for Oct 03–04, 2026. Students residing in low-lying hostel blocks are advised to follow safety protocols. Emergency power backups are active.',
    category: 'Emergency',
    priority: 'EMERGENCY',
    publishDate: '2026-10-03T08:00:00.000Z',
    targetAudience: { all: true },
    requiresAcknowledgement: true,
    createdBy: 'admin_uid_001',
    createdByName: 'Dr. Debabrata Roy (Registrar)',
    status: 'PUBLISHED',
    readCount: 1420,
    acknowledgedCount: 1210,
    createdAt: '2026-10-03T08:00:00.000Z',
  },
  {
    id: 'notice_exam_002',
    title: 'BPUT End-Semester Examination Registration Schedule 2026',
    description: 'All 3rd, 5th, and 7th semester B.Tech and M.Tech regular students are hereby notified that online form fill-up commences on Oct 05, 2026. Submit requisite exam fees through the ERP portal before the deadline. Strict debarment rules apply for shortage of 75% biometric attendance.',
    category: 'Examination',
    priority: 'URGENT',
    publishDate: '2026-10-02T10:30:00.000Z',
    expiryDate: '2026-10-18T23:59:59.000Z',
    targetAudience: {
      roles: ['STUDENT'],
      departments: ['Computer Science & Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering'],
      years: [2, 3, 4],
    },
    requiresAcknowledgement: true,
    attachments: [
      {
        name: 'bput_exam_circular_2026.pdf',
        url: '#',
        type: 'application/pdf',
        size: 1024 * 512,
      },
    ],
    createdBy: 'admin_uid_001',
    createdByName: 'Controller of Examinations',
    status: 'PUBLISHED',
    readCount: 980,
    acknowledgedCount: 740,
    createdAt: '2026-10-02T10:30:00.000Z',
  },
  {
    id: 'notice_hostel_003',
    title: 'Hostel Maintenance & Electrical Safety Audit',
    description: 'The estate management division will conduct routine high-voltage electrical safety checks in Hostel Blocks A, B, and C on Saturday between 10:00 AM and 02:00 PM. High power heating appliances (immersion rods, induction plates) remain strictly prohibited as per university safety guidelines.',
    category: 'Hostel',
    priority: 'IMPORTANT',
    publishDate: '2026-10-01T14:00:00.000Z',
    targetAudience: {
      studentCategories: ['HOSTELER'],
      hostels: ['Hostel Block A', 'Hostel Block B', 'Hostel Block C'],
    },
    requiresAcknowledgement: false,
    createdBy: 'subadmin_uid_002',
    createdByName: 'Chief Warden Office',
    status: 'PUBLISHED',
    readCount: 650,
    acknowledgedCount: 0,
    createdAt: '2026-10-01T14:00:00.000Z',
  },
  {
    id: 'notice_acad_004',
    title: 'Annual BPUT Inter-College Technical Hackathon Registration',
    description: 'Registrations are officially open for the flagship university hackathon. Teams comprising 3 to 4 students from any branch or semester can register their problem statement track before October 20, 2026. Grand cash prizes and incubation support will be awarded.',
    category: 'Events',
    priority: 'NORMAL',
    publishDate: '2026-09-28T09:00:00.000Z',
    targetAudience: { all: true },
    requiresAcknowledgement: false,
    createdBy: 'admin_uid_001',
    createdByName: 'Dean (Student Affairs)',
    status: 'PUBLISHED',
    readCount: 1850,
    acknowledgedCount: 0,
    createdAt: '2026-09-28T09:00:00.000Z',
  },
];

function getLocalNotices(): Notice[] {
  try {
    const raw = safeStorage.getItem(NOTICES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return INITIAL_NOTICES;
}

function saveLocalNotices(notices: Notice[]) {
  try {
    safeStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(notices));
  } catch {
    // ignore
  }
}

function getLocalNoticeReads(): NoticeRead[] {
  try {
    const raw = safeStorage.getItem(NOTICE_READS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalNoticeReads(reads: NoticeRead[]) {
  try {
    safeStorage.setItem(NOTICE_READS_STORAGE_KEY, JSON.stringify(reads));
  } catch {
    // ignore
  }
}

export const noticeService = {
  /**
   * Evaluates if a given notice targets the specific user
   */
  isNoticeVisibleToUser(notice: Notice, user: UserRecord | null): boolean {
    if (!user) return notice.targetAudience.all === true;
    // Admins and authorized staff can view all notices
    if (user.role === 'MAIN_ADMIN' || user.permissions?.includes('MANAGE_NOTICES')) {
      return true;
    }

    // Only published notices are visible to general audience
    if (notice.status !== 'PUBLISHED') {
      return false;
    }

    const { targetAudience } = notice;
    if (targetAudience.all) return true;

    // Check Role
    if (targetAudience.roles && targetAudience.roles.length > 0) {
      if (!targetAudience.roles.includes(user.role)) return false;
    }

    // Check Department
    if (targetAudience.departments && targetAudience.departments.length > 0) {
      if (!user.department || !targetAudience.departments.includes(user.department)) {
        return false;
      }
    }

    // Check Branch
    if (targetAudience.branches && targetAudience.branches.length > 0) {
      if (!user.branch || !targetAudience.branches.includes(user.branch)) {
        return false;
      }
    }

    // Check Year
    if (targetAudience.years && targetAudience.years.length > 0) {
      if (!user.year || !targetAudience.years.includes(user.year)) {
        return false;
      }
    }

    // Check Semester
    if (targetAudience.semesters && targetAudience.semesters.length > 0) {
      if (!user.semester || !targetAudience.semesters.includes(user.semester)) {
        return false;
      }
    }

    // Check Student Category (Hosteler vs Day Scholar)
    if (targetAudience.studentCategories && targetAudience.studentCategories.length > 0) {
      if (!user.studentCategory || !targetAudience.studentCategories.includes(user.studentCategory)) {
        return false;
      }
    }

    // Check Specific Hostel
    if (targetAudience.hostels && targetAudience.hostels.length > 0) {
      if (!user.hostelName || !targetAudience.hostels.includes(user.hostelName)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Fetches notices list with audience filtering
   */
  async getNotices(user: UserRecord | null): Promise<Notice[]> {
    let allNotices = getLocalNotices();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'notices');
        const q = query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          allNotices = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Notice, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore notices fetch fallback:', err);
      }
    }

    return allNotices.filter((n) => this.isNoticeVisibleToUser(n, user));
  },

  /**
   * Fetches emergency and urgent priority notices
   */
  async getEmergencyNotices(user: UserRecord | null): Promise<Notice[]> {
    const list = await this.getNotices(user);
    return list.filter((n) => n.priority === 'EMERGENCY' || n.priority === 'URGENT');
  },

  /**
   * Creates a new official notice
   */
  async createNotice(
    data: Omit<Notice, 'id' | 'createdAt' | 'readCount' | 'acknowledgedCount'>,
    author: UserRecord
  ): Promise<Notice> {
    const id = `notice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotice: Notice = {
      ...data,
      id,
      readCount: 0,
      acknowledgedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'notices', id);
        await setDoc(docRef, newNotice);
      } catch (err) {
        console.warn('Firestore notice create fallback:', err);
      }
    }

    const localList = getLocalNotices();
    localList.unshift(newNotice);
    saveLocalNotices(localList);
    notifyLocalNoticeListeners();

    // Create In-App Notification if published
    if (newNotice.status === 'PUBLISHED') {
      await notificationService.createNotification({
        userId: 'ALL',
        title: `${newNotice.priority === 'EMERGENCY' ? '[EMERGENCY NOTICE] ' : 'New Notice: '}${newNotice.title}`,
        message: newNotice.description.substring(0, 140) + '...',
        type: newNotice.priority === 'EMERGENCY' ? 'emergency' : 'notice',
        entityId: id,
        link: '/notices',
      });
    }

    // Log Audit
    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'NOTICE_CREATED',
      entityType: 'notice',
      entityId: id,
      newValue: JSON.stringify({ title: newNotice.title, priority: newNotice.priority }),
    });

    // Log User Activity
    await activityService.logActivity({
      userId: author.uid,
      title: 'Notice Created',
      description: `Created circular: ${newNotice.title} (${newNotice.priority})`,
      entityType: 'notice',
      entityId: id,
    });

    return newNotice;
  },

  /**
   * Updates existing notice
   */
  async updateNotice(id: string, updates: Partial<Notice>, actor: UserRecord): Promise<void> {
    const updatedAt = new Date().toISOString();
    const finalUpdates = { ...updates, updatedAt };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'notices', id);
        await updateDoc(docRef, finalUpdates);
      } catch (err) {
        console.warn('Firestore notice update fallback:', err);
      }
    }

    const localList = getLocalNotices();
    const idx = localList.findIndex((n) => n.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...finalUpdates };
      saveLocalNotices(localList);
    }
    notifyLocalNoticeListeners();

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'NOTICE_UPDATED',
      entityType: 'notice',
      entityId: id,
      changes: JSON.stringify(updates),
    });
  },

  /**
   * Deletes / archives notice
   */
  async deleteNotice(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'notices', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore notice delete fallback:', err);
      }
    }

    const localList = getLocalNotices().filter((n) => n.id !== id);
    saveLocalNotices(localList);
    notifyLocalNoticeListeners();

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'NOTICE_DELETED',
      entityType: 'notice',
      entityId: id,
    });
  },

  /**
   * Records that a user has opened/read a notice
   */
  async markNoticeRead(noticeId: string, user: UserRecord): Promise<void> {
    const reads = getLocalNoticeReads();
    const existing = reads.find((r) => r.noticeId === noticeId && r.userId === user.uid);

    if (existing) {
      return; // Already recorded read
    }

    const newRead: NoticeRead = {
      id: `nread_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      noticeId,
      userId: user.uid,
      userName: user.name,
      userRole: user.role,
      userDepartment: user.department,
      readAt: new Date().toISOString(),
      acknowledged: false,
    };

    reads.push(newRead);
    saveLocalNoticeReads(reads);

    // Increment read count on the notice
    const notices = getLocalNotices();
    const notice = notices.find((n) => n.id === noticeId);
    if (notice) {
      notice.readCount = (notice.readCount || 0) + 1;
      saveLocalNotices(notices);
      notifyLocalNoticeListeners();
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'noticeReads', `${noticeId}_${user.uid}`);
        await setDoc(docRef, newRead);
      } catch (err) {
        console.warn('Firestore noticeRead save fallback:', err);
      }
    }

    // Log Activity (once)
    await activityService.logActivity({
      userId: user.uid,
      title: 'Notice Viewed',
      description: `Viewed official circular: ${notice?.title || noticeId}`,
      entityType: 'notice',
      entityId: noticeId,
    });
  },

  /**
   * Acknowledges a notice
   */
  async acknowledgeNotice(noticeId: string, user: UserRecord): Promise<void> {
    const reads = getLocalNoticeReads();
    let record = reads.find((r) => r.noticeId === noticeId && r.userId === user.uid);

    const now = new Date().toISOString();
    if (record) {
      if (record.acknowledged) return; // already acknowledged
      record.acknowledged = true;
      record.acknowledgedAt = now;
    } else {
      record = {
        id: `nread_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        noticeId,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        userDepartment: user.department,
        readAt: now,
        acknowledged: true,
        acknowledgedAt: now,
      };
      reads.push(record);
    }
    saveLocalNoticeReads(reads);

    // Update Notice Acknowledged Count
    const notices = getLocalNotices();
    const notice = notices.find((n) => n.id === noticeId);
    if (notice) {
      notice.acknowledgedCount = (notice.acknowledgedCount || 0) + 1;
      saveLocalNotices(notices);
      notifyLocalNoticeListeners();
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'noticeReads', `${noticeId}_${user.uid}`);
        await setDoc(docRef, record);
      } catch (err) {
        console.warn('Firestore acknowledge save fallback:', err);
      }
    }

    // Log Activity
    await activityService.logActivity({
      userId: user.uid,
      title: 'Notice Acknowledged',
      description: `Acknowledged understanding of notice: ${notice?.title || noticeId}`,
      entityType: 'notice',
      entityId: noticeId,
    });
  },

  /**
   * Retrieves read and acknowledgement statistics for admin reporting
   */
  async getNoticeStats(noticeId: string): Promise<{
    totalRead: number;
    totalAcknowledged: number;
    reads: NoticeRead[];
  }> {
    const reads = getLocalNoticeReads().filter((r) => r.noticeId === noticeId);
    const totalRead = reads.length;
    const totalAcknowledged = reads.filter((r) => r.acknowledged).length;

    return {
      totalRead,
      totalAcknowledged,
      reads,
    };
  },

  /**
   * Checks if user has acknowledged a specific notice
   */
  hasUserAcknowledged(noticeId: string, userId: string): boolean {
    const reads = getLocalNoticeReads();
    return reads.some((r) => r.noticeId === noticeId && r.userId === userId && r.acknowledged);
  },

  subscribeNotices(
    user?: UserRecord | null,
    callback?: (notices: Notice[]) => void
  ): () => void {
    if (!callback) return () => {};
    const listenerEntry = { user, callback };
    activeNoticeListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getNotices(user ?? null).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'notices');
        const q = query(colRef, orderBy('publishDate', 'desc'), firestoreLimit(50));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getNotices(user ?? null).then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore notices subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore notices listener:', err);
      }
    }

    return () => {
      activeNoticeListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
