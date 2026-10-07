import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage, getLocalUsers } from '../firebase/authService';
import { notificationService } from './notificationService';
import { activityService } from './activityService';
import { auditService } from './auditService';
import {
  getUserAssignedBranches,
  areBranchesEqual,
  canPerformAction,
} from './permissionService';
import { doesBranchMatch } from './degreeProgramService';
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintTimelineStep,
  AttachmentFile,
  UserRole,
  UserRecord,
} from '../types';

const COMPLAINTS_STORAGE_KEY = 'campus_life_complaints';
type ComplaintListener = {
  filters?: {
    studentId?: string;
    staffId?: string;
    status?: string;
    category?: string;
    priority?: string;
    branch?: string;
    searchQuery?: string;
  };
  currentUser?: Partial<UserRecord> | null;
  callback: (complaints: Complaint[]) => void;
};
const activeComplaintListeners = new Set<ComplaintListener>();

function notifyLocalComplaintListeners() {
  activeComplaintListeners.forEach((entry) => {
    complaintService.getComplaints(entry.filters, entry.currentUser).then((data) => {
      entry.callback(data);
    }).catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === COMPLAINTS_STORAGE_KEY) {
      notifyLocalComplaintListeners();
    }
  });
}

// SLA configurations in hours
export const SLA_HOURS: Record<ComplaintPriority, number> = {
  CRITICAL: 24,   // 1 day
  HIGH: 48,       // 2 days
  MEDIUM: 96,     // 4 days
  LOW: 168,       // 7 days
};

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'Hostel',
  'Mess',
  'Electrical',
  'Water',
  'Plumbing',
  'Cleanliness',
  'Classroom',
  'Laboratory',
  'Library',
  'IT',
  'Transport',
  'Academic',
  'Other',
];

export function calculateAgeingDays(submittedAt: string): number {
  const diffMs = Date.now() - new Date(submittedAt).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getAgeingBucket(days: number): '0–1 days' | '2–3 days' | '4–7 days' | '7+ days' {
  if (days <= 1) return '0–1 days';
  if (days <= 3) return '2–3 days';
  if (days <= 7) return '4–7 days';
  return '7+ days';
}

export function computeSlaStatus(
  submittedAt: string,
  priority: ComplaintPriority,
  resolvedAt?: string
): { slaStatus: 'WITHIN_SLA' | 'DUE_SOON' | 'OVERDUE'; expectedResolutionAt: string } {
  const startMs = new Date(submittedAt).getTime();
  const slaDurationMs = SLA_HOURS[priority] * 60 * 60 * 1000;
  const expectedResolutionAt = new Date(startMs + slaDurationMs).toISOString();

  const comparisonMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const remainingMs = startMs + slaDurationMs - comparisonMs;

  if (remainingMs < 0) {
    return { slaStatus: 'OVERDUE', expectedResolutionAt };
  }
  // If less than 25% of SLA window is remaining, flag as DUE_SOON
  if (remainingMs < slaDurationMs * 0.25) {
    return { slaStatus: 'DUE_SOON', expectedResolutionAt };
  }
  return { slaStatus: 'WITHIN_SLA', expectedResolutionAt };
}

function getLocalComplaints(): Complaint[] {
  try {
    const raw = safeStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return [];
}

function saveLocalComplaints(complaints: Complaint[]) {
  try {
    safeStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
  } catch {
    // ignore
  }
}

/**
 * Evaluates whether a target member (FACULTY, STAFF, or SUB_ADMIN)
 * belongs to the authoritative branch and department/program scope of the student
 * specifically for Complaint Box member tagging (Section 2, 5, 6, 7, 9, 10, 24, 25, 26, 27, 36).
 */
export function isMemberEligibleForStudentComplaint(
  student: Partial<UserRecord> | null | undefined,
  member: Partial<UserRecord> | null | undefined
): boolean {
  if (!student || !member) return false;
  if (member.isActive === false) return false;

  // 1. Members must have role FACULTY, STAFF, or SUB_ADMIN (Section 1, 27)
  const allowedRoles: UserRole[] = ['FACULTY', 'STAFF', 'SUB_ADMIN'];
  if (!member.role || !allowedRoles.includes(member.role)) {
    return false;
  }

  // 2. Authoritative student branch
  const studentBranch = (student.branch || student.department || '').trim();
  if (!studentBranch) return false;

  // 3. Member's assigned branches
  const memberBranches = getUserAssignedBranches(member);
  if (memberBranches.length === 0) return false;

  // 4. Branch match: Member must be assigned to student's branch
  const matchesBranch = memberBranches.some(
    (b) =>
      areBranchesEqual(b, studentBranch) ||
      doesBranchMatch(b, member.department, studentBranch) ||
      doesBranchMatch(member.branch, member.department, studentBranch)
  );

  if (!matchesBranch) return false;

  // 5. Department & Program scope check (Section 9 & 10)
  // For Faculty: if both student and faculty have distinct academic departments specified
  if (member.role === 'FACULTY' && student.department && member.department) {
    const sDept = student.department.trim().toLowerCase();
    const mDept = member.department.trim().toLowerCase();

    // If both have explicit non-empty departments
    if (sDept && mDept && sDept !== mDept) {
      // Check if departments are aliases of each other (e.g. "Computer Science" vs "Computer Science & Engineering")
      const isAliasMatch =
        doesBranchMatch(student.branch, student.department, member.department) ||
        doesBranchMatch(member.branch, member.department, student.department);

      if (!isAliasMatch) {
        // Check if faculty has degree assignments covering student's department or branch
        const hasCoveringAssignment = (member.degreeAssignments || []).some((da) => {
          const daBranch = (da.branchName || '').toLowerCase();
          const daDegree = (da.degreeName || '').toLowerCase();
          return (
            daBranch === sDept ||
            daDegree === sDept ||
            doesBranchMatch(daBranch, undefined, student.department) ||
            areBranchesEqual(da.branchName, studentBranch)
          );
        });

        if (!hasCoveringAssignment) {
          return false;
        }
      }
    }
  }

  return true;
}

export const complaintService = {
  /**
   * Retrieves all members (FACULTY, STAFF, SUB_ADMIN) eligible to be tagged
   * in a complaint created by the student, filtered strictly to the student's authorized branch/scope.
   */
  async getEligibleTagMembers(student: Partial<UserRecord>): Promise<UserRecord[]> {
    if (!student) return [];

    let allUsers: UserRecord[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty) {
          allUsers = snap.docs.map((d) => d.data() as UserRecord);
        }
      } catch (err) {
        console.warn('Firestore getEligibleTagMembers fallback:', err);
      }
    }
    if (allUsers.length === 0) {
      allUsers = getLocalUsers();
    }

    return allUsers.filter((member) => isMemberEligibleForStudentComplaint(student, member));
  },

  async getComplaints(
    filters?: {
      studentId?: string;
      staffId?: string;
      status?: string;
      category?: string;
      priority?: string;
      branch?: string;
      searchQuery?: string;
    },
    currentUser?: Partial<UserRecord> | null
  ): Promise<Complaint[]> {
    let list: Complaint[] = [];

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'complaints');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Complaint, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore complaints fetch fallback:', err);
      }
    }

    if (list.length === 0) {
      list = getLocalComplaints();
    }

    // Refresh dynamic SLA status and ageing for all active complaints
    list = list.map((c) => {
      const { slaStatus, expectedResolutionAt } = computeSlaStatus(
        c.submittedAt,
        c.priority,
        c.resolvedAt
      );
      return {
        ...c,
        slaStatus: c.status === 'RESOLVED' || c.status === 'CLOSED' ? (c.slaStatus || 'WITHIN_SLA') : slaStatus,
        expectedResolutionAt: c.expectedResolutionAt || expectedResolutionAt,
      };
    });

    // Enforce branch isolation and member visibility (Section 15, 16, 17, 18)
    if (currentUser) {
      if (currentUser.role === 'STUDENT') {
        list = list.filter((c) => c.studentId === currentUser.uid);
      } else if (currentUser.role !== 'MAIN_ADMIN') {
        const userBranches = getUserAssignedBranches(currentUser);
        list = list.filter((c) => {
          // 1. User is directly tagged or assigned
          if (
            (c.taggedUserIds && c.taggedUserIds.includes(currentUser.uid || '')) ||
            c.assignedStaffId === currentUser.uid
          ) {
            return true;
          }
          // 2. Complaint is within user's assigned branch scope AND user has complaint permissions
          const cBranch = c.branch;
          if (!cBranch) return true;
          const isAssignedBranch = userBranches.some((b) => areBranchesEqual(b, cBranch));
          if (!isAssignedBranch) return false;

          return (
            canPerformAction(currentUser, 'MANAGE_COMPLAINTS', cBranch, 'view') ||
            canPerformAction(currentUser, 'RESPOND_TO_COMPLAINTS', cBranch, 'view') ||
            canPerformAction(currentUser, 'ASSIGN_COMPLAINTS', cBranch, 'view')
          );
        });
      }
    }

    if (filters) {
      if (filters.studentId) {
        list = list.filter((c) => c.studentId === filters.studentId);
      }
      if (filters.staffId) {
        list = list.filter((c) => c.assignedStaffId === filters.staffId);
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter((c) => c.status === filters.status);
      }
      if (filters.category && filters.category !== 'ALL') {
        list = list.filter((c) => c.category === filters.category);
      }
      if (filters.priority && filters.priority !== 'ALL') {
        list = list.filter((c) => c.priority === filters.priority);
      }
      if (filters.branch && filters.branch !== 'ALL') {
        list = list.filter((c) => areBranchesEqual(c.branch, filters.branch));
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        list = list.filter(
          (c) =>
            c.complaintId.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.location.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            (c.branch && c.branch.toLowerCase().includes(q))
        );
      }
    }

    // Sort by submittedAt descending
    return list.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  },

  async getComplaintById(id: string): Promise<Complaint | null> {
    const all = await this.getComplaints();
    return all.find((c) => c.id === id || c.complaintId === id) || null;
  },

  async createComplaint(data: {
    studentId: string;
    studentName: string;
    studentEmail: string;
    category: ComplaintCategory;
    title: string;
    description: string;
    location: string;
    branch?: string;
    department?: string;
    degree?: string;
    taggedUserIds?: string[];
    taggedUsers?: {
      uid: string;
      name: string;
      role: UserRole;
      email?: string;
      branch?: string;
      department?: string;
    }[];
    attachments?: AttachmentFile[];
  }): Promise<Complaint> {
    // 1. Authoritative Student Branch Verification (Section 8 & 21)
    let studentUser: UserRecord | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const uDoc = await getDoc(doc(db, 'users', data.studentId));
        if (uDoc.exists()) {
          studentUser = uDoc.data() as UserRecord;
        }
      } catch (err) {
        console.warn('Firestore load student for complaint fallback:', err);
      }
    }
    if (!studentUser) {
      studentUser = getLocalUsers().find((u) => u.uid === data.studentId) || null;
    }

    const authoritativeBranch = (
      studentUser?.branch ||
      studentUser?.department ||
      data.branch ||
      ''
    ).trim();

    if (!authoritativeBranch) {
      throw new Error('Invalid complaint: Student profile has no assigned academic branch.');
    }

    // 2. Load all users to validate tagged members (Section 19, 20, 30)
    let allUsers: UserRecord[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        if (!uSnap.empty) {
          allUsers = uSnap.docs.map((d) => d.data() as UserRecord);
        }
      } catch (err) {
        console.warn('Firestore load users for tagging validation fallback:', err);
      }
    }
    if (allUsers.length === 0) {
      allUsers = getLocalUsers();
    }

    const studentContext: Partial<UserRecord> = studentUser || {
      uid: data.studentId,
      branch: authoritativeBranch,
      department: data.department,
      degree: data.degree,
      role: 'STUDENT',
    };

    const validatedTaggedUsers: {
      uid: string;
      name: string;
      role: UserRole;
      email?: string;
      branch?: string;
      department?: string;
    }[] = [];

    if (data.taggedUserIds && data.taggedUserIds.length > 0) {
      for (const taggedId of data.taggedUserIds) {
        const member = allUsers.find((u) => u.uid === taggedId);
        if (!member) {
          throw new Error('You cannot tag an unknown or invalid user.');
        }

        const isEligible = isMemberEligibleForStudentComplaint(studentContext, member);
        if (!isEligible) {
          throw new Error(
            `You cannot tag a member outside your authorized branch (${authoritativeBranch}).`
          );
        }

        validatedTaggedUsers.push({
          uid: member.uid,
          name: member.name,
          role: member.role,
          email: member.email,
          branch: authoritativeBranch,
          department: member.department,
        });
      }
    }

    const serial = Math.floor(1000 + Math.random() * 9000);
    const complaintId = `CMP-${new Date().getFullYear()}-${serial}`;
    const id = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const priority: ComplaintPriority =
      data.category === 'Electrical' || data.category === 'Water' ? 'HIGH' : 'MEDIUM';

    const { slaStatus, expectedResolutionAt } = computeSlaStatus(now, priority);

    const initialStep: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: 'SUBMITTED',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: data.studentName,
      actorRole: 'STUDENT',
      action: 'Complaint Registered',
      message: `Issue reported in ${data.category} under location: ${data.location}. Scope: ${authoritativeBranch}`,
    };

    const newComplaint: Complaint = {
      id,
      complaintId,
      studentId: data.studentId,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      category: data.category,
      title: data.title.trim(),
      description: data.description.trim(),
      location: data.location.trim(),
      branch: authoritativeBranch,
      department: studentUser?.department || data.department || '',
      degree: studentUser?.degree || data.degree || '',
      creatorRole: 'STUDENT',
      taggedUserIds: data.taggedUserIds || [],
      taggedUsers: validatedTaggedUsers,
      priority,
      status: 'SUBMITTED',
      attachments: data.attachments || [],
      submittedAt: now,
      updatedAt: now,
      expectedResolutionAt,
      slaStatus,
      timeline: [initialStep],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', id);
        await setDoc(docRef, newComplaint);
      } catch (err) {
        console.warn('Firestore complaint create fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    localList.unshift(newComplaint);
    saveLocalComplaints(localList);
    notifyLocalComplaintListeners();

    // In-app notification for student
    await notificationService.createNotification({
      userId: data.studentId,
      title: 'Complaint Registered',
      message: `Your grievance #${complaintId} has been registered under ${data.category}.`,
      type: 'complaint',
      link: '/complaints',
    }).catch(() => {});

    // In-app notifications for tagged members (Section 33)
    if (data.taggedUserIds && data.taggedUserIds.length > 0) {
      for (const taggedId of data.taggedUserIds) {
        notificationService.createNotification({
          userId: taggedId,
          title: 'Tagged in Complaint',
          message: `You have been tagged in a complaint (#${complaintId}) from a ${authoritativeBranch} student.`,
          type: 'complaint',
          link: '/complaints',
        }).catch(() => {});
      }
    }

    // Record activity
    await activityService.logActivity({
      userId: data.studentId,
      userName: data.studentName,
      userRole: 'STUDENT',
      activityType: 'COMPLAINT_SUBMITTED',
      description: `Reported issue: ${data.title} (#${complaintId}) [${authoritativeBranch}]`,
      entityType: 'COMPLAINT',
      entityId: complaintId,
    }).catch(() => {});

    // Audit log
    await auditService.logAction({
      actorUid: data.studentId,
      actorName: data.studentName,
      actorRole: 'STUDENT',
      action: 'CREATE_COMPLAINT',
      entityType: 'COMPLAINT',
      entityId: complaintId,
      changes: `Created complaint for ${data.category} at ${data.location} (${authoritativeBranch}) with ${validatedTaggedUsers.length} tagged members.`,
    }).catch(() => {});

    return newComplaint;
  },

  async assignComplaint(
    complaintId: string,
    params: {
      department: string;
      staffId: string;
      staffName: string;
      assignedBy: string;
      assignedByName: string;
      actorRole: UserRole;
      priority?: ComplaintPriority;
    }
  ): Promise<Complaint> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    const now = new Date().toISOString();
    const updatedPriority = params.priority || complaint.priority;
    const { slaStatus, expectedResolutionAt } = computeSlaStatus(
      complaint.submittedAt,
      updatedPriority,
      complaint.resolvedAt
    );

    const step: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: 'ASSIGNED',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: params.assignedByName,
      actorRole: params.actorRole,
      action: `Assigned to ${params.staffName}`,
      message: `Department: ${params.department}. Priority: ${updatedPriority}.`,
    };

    const updated: Complaint = {
      ...complaint,
      status: 'ASSIGNED',
      priority: updatedPriority,
      assignedDepartment: params.department,
      assignedStaffId: params.staffId,
      assignedStaffName: params.staffName,
      expectedResolutionAt,
      slaStatus,
      updatedAt: now,
      timeline: [...complaint.timeline, step],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', complaint.id);
        await updateDoc(docRef, {
          status: 'ASSIGNED',
          priority: updatedPriority,
          assignedDepartment: params.department,
          assignedStaffId: params.staffId,
          assignedStaffName: params.staffName,
          expectedResolutionAt,
          slaStatus,
          updatedAt: now,
          timeline: updated.timeline,
        });
      } catch (err) {
        console.warn('Firestore assign complaint fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    const idx = localList.findIndex((c) => c.id === complaint.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalComplaints(localList);
    }
    notifyLocalComplaintListeners();

    // Notify student
    await notificationService.createNotification({
      userId: complaint.studentId,
      title: `Complaint #${complaint.complaintId} Assigned`,
      message: `Your complaint was assigned to ${params.staffName} (${params.department}).`,
      type: 'complaint',
      link: '/student/complaints',
    });

    // Notify assigned staff member
    if (params.staffId) {
      await notificationService.createNotification({
        userId: params.staffId,
        title: 'New Complaint Assignment',
        message: `You were assigned complaint #${complaint.complaintId}: ${complaint.title}.`,
        type: 'complaint',
        link: '/student/complaints',
      });
    }

    // Audit log
    await auditService.logAction({
      actorUid: params.assignedBy,
      actorName: params.assignedByName,
      actorRole: params.actorRole,
      action: 'ASSIGN_COMPLAINT',
      entityType: 'COMPLAINT',
      entityId: complaint.complaintId,
      changes: `Assigned to ${params.staffName} (${params.department}), Priority ${updatedPriority}`,
    });

    return updated;
  },

  async updateStatus(
    complaintId: string,
    params: {
      status: ComplaintStatus;
      actorId: string;
      actorName: string;
      actorRole: UserRole;
      message?: string;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'video' | 'pdf';
    }
  ): Promise<Complaint> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    const now = new Date().toISOString();
    let resolvedAt = complaint.resolvedAt;
    let actualResolutionHours = complaint.actualResolutionHours;

    if (params.status === 'RESOLVED' && !resolvedAt) {
      resolvedAt = now;
      const hours = (new Date(now).getTime() - new Date(complaint.submittedAt).getTime()) / (1000 * 60 * 60);
      actualResolutionHours = Number(hours.toFixed(1));
    }

    const step: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: params.status,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: params.actorName,
      actorRole: params.actorRole,
      action: `Status changed to ${params.status.replace('_', ' ')}`,
      message: params.message,
      attachmentUrl: params.attachmentUrl,
      attachmentType: params.attachmentType,
    };

    const updated: Complaint = {
      ...complaint,
      status: params.status,
      resolvedAt,
      actualResolutionHours,
      updatedAt: now,
      timeline: [...complaint.timeline, step],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', complaint.id);
        await updateDoc(docRef, {
          status: params.status,
          resolvedAt: resolvedAt || null,
          actualResolutionHours: actualResolutionHours || null,
          updatedAt: now,
          timeline: updated.timeline,
        });
      } catch (err) {
        console.warn('Firestore update complaint status fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    const idx = localList.findIndex((c) => c.id === complaint.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalComplaints(localList);
    }
    notifyLocalComplaintListeners();

    // Notify student
    await notificationService.createNotification({
      userId: complaint.studentId,
      title: `Complaint #${complaint.complaintId} Update`,
      message: `Status is now ${params.status.replace('_', ' ')}. ${params.message ? `Note: "${params.message}"` : ''}`,
      type: 'complaint',
      link: '/student/complaints',
    });

    // Audit log
    await auditService.logAction({
      actorUid: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'UPDATE_COMPLAINT_STATUS',
      entityType: 'COMPLAINT',
      entityId: complaint.complaintId,
      changes: `Status changed to ${params.status}. Comment: ${params.message || 'None'}`,
    });

    return updated;
  },

  async escalateComplaint(
    complaintId: string,
    params: {
      escalatedBy: string;
      escalatedByName: string;
      actorRole: UserRole;
      reason: string;
      newPriority?: ComplaintPriority;
    }
  ): Promise<Complaint> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    const now = new Date().toISOString();
    const priority = params.newPriority || 'CRITICAL';

    const step: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: 'ESCALATED',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: params.escalatedByName,
      actorRole: params.actorRole,
      action: 'Complaint Escalated',
      message: `Escalation Reason: ${params.reason}. Priority raised to ${priority}.`,
    };

    const updated: Complaint = {
      ...complaint,
      status: 'ESCALATED',
      priority,
      escalatedAt: now,
      escalatedBy: params.escalatedByName,
      escalationReason: params.reason,
      slaStatus: 'OVERDUE',
      updatedAt: now,
      timeline: [...complaint.timeline, step],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', complaint.id);
        await updateDoc(docRef, {
          status: 'ESCALATED',
          priority,
          escalatedAt: now,
          escalatedBy: params.escalatedByName,
          escalationReason: params.reason,
          slaStatus: 'OVERDUE',
          updatedAt: now,
          timeline: updated.timeline,
        });
      } catch (err) {
        console.warn('Firestore escalate complaint fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    const idx = localList.findIndex((c) => c.id === complaint.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalComplaints(localList);
    }
    notifyLocalComplaintListeners();

    // Notify student
    await notificationService.createNotification({
      userId: complaint.studentId,
      title: `Complaint #${complaint.complaintId} Escalated`,
      message: `Your complaint has been escalated to higher authority. Reason: ${params.reason}`,
      type: 'complaint',
      link: '/student/complaints',
    });

    // Audit log
    await auditService.logAction({
      actorUid: params.escalatedBy,
      actorName: params.escalatedByName,
      actorRole: params.actorRole,
      action: 'ESCALATE_COMPLAINT',
      entityType: 'COMPLAINT',
      entityId: complaint.complaintId,
      changes: `Escalated by ${params.escalatedByName}. Reason: ${params.reason}. Priority ${priority}`,
    });

    return updated;
  },

  async submitFeedback(
    complaintId: string,
    params: {
      studentId: string;
      studentName: string;
      rating: number;
      comment?: string;
    }
  ): Promise<Complaint> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    if (complaint.studentId !== params.studentId) {
      throw new Error('You are not authorized to submit feedback for another student.');
    }

    if (complaint.feedback) {
      throw new Error('Feedback has already been submitted for this resolution.');
    }

    const now = new Date().toISOString();
    const feedback = {
      rating: Math.max(1, Math.min(5, params.rating)),
      comment: params.comment?.trim(),
      submittedAt: now,
    };

    const step: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: complaint.status,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: params.studentName,
      actorRole: 'STUDENT',
      action: 'Student Feedback Recorded',
      message: `Rating: ${feedback.rating}/5 stars. "${feedback.comment || 'No additional comment'}"`,
    };

    const updated: Complaint = {
      ...complaint,
      feedback,
      updatedAt: now,
      timeline: [...complaint.timeline, step],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', complaint.id);
        await updateDoc(docRef, {
          feedback,
          updatedAt: now,
          timeline: updated.timeline,
        });
      } catch (err) {
        console.warn('Firestore feedback submit fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    const idx = localList.findIndex((c) => c.id === complaint.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalComplaints(localList);
    }

    // Activity log
    await activityService.logActivity({
      userId: params.studentId,
      userName: params.studentName,
      userRole: 'STUDENT',
      activityType: 'COMPLAINT_FEEDBACK',
      description: `Submitted ${feedback.rating}-star feedback for #${complaint.complaintId}`,
      entityType: 'COMPLAINT',
      entityId: complaint.complaintId,
    });

    notifyLocalComplaintListeners();

    return updated;
  },

  async respondToComplaint(
    complaintId: string,
    params: {
      actorId: string;
      actorName: string;
      actorRole: UserRole;
      message: string;
      newStatus?: ComplaintStatus;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'video' | 'pdf';
    }
  ): Promise<Complaint> {
    const complaint = await this.getComplaintById(complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    const now = new Date().toISOString();
    const updatedStatus = params.newStatus || complaint.status;

    let resolvedAt = complaint.resolvedAt;
    let actualResolutionHours = complaint.actualResolutionHours;
    if (updatedStatus === 'RESOLVED' && !resolvedAt) {
      resolvedAt = now;
      const hours = (new Date(now).getTime() - new Date(complaint.submittedAt).getTime()) / (1000 * 60 * 60);
      actualResolutionHours = Number(hours.toFixed(1));
    }

    const step: ComplaintTimelineStep = {
      id: `step_${Date.now()}`,
      status: updatedStatus,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: params.actorName,
      actorRole: params.actorRole,
      action: params.newStatus ? `Status updated to ${params.newStatus.replace('_', ' ')}` : 'Official Response Added',
      message: params.message,
      attachmentUrl: params.attachmentUrl,
      attachmentType: params.attachmentType,
    };

    const updated: Complaint = {
      ...complaint,
      status: updatedStatus,
      resolvedAt,
      actualResolutionHours,
      updatedAt: now,
      timeline: [...complaint.timeline, step],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'complaints', complaint.id);
        await updateDoc(docRef, {
          status: updatedStatus,
          resolvedAt: resolvedAt || null,
          actualResolutionHours: actualResolutionHours || null,
          updatedAt: now,
          timeline: updated.timeline,
        });
      } catch (err) {
        console.warn('Firestore response fallback:', err);
      }
    }

    const localList = getLocalComplaints();
    const idx = localList.findIndex((c) => c.id === complaint.id);
    if (idx !== -1) {
      localList[idx] = updated;
      saveLocalComplaints(localList);
    }
    notifyLocalComplaintListeners();

    // Notify student
    await notificationService.createNotification({
      userId: complaint.studentId,
      title: `Response on Complaint #${complaint.complaintId}`,
      message: `${params.actorName} (${params.actorRole}) responded: "${params.message}"`,
      type: 'complaint',
      link: '/complaints',
    }).catch(() => {});

    return updated;
  },

  subscribeComplaints(
    filters?: {
      studentId?: string;
      staffId?: string;
      status?: string;
      category?: string;
      priority?: string;
      branch?: string;
      searchQuery?: string;
    },
    callback?: (complaints: Complaint[]) => void,
    currentUser?: Partial<UserRecord> | null
  ): () => void {
    if (!callback) return () => {};
    const listenerEntry = { filters, currentUser, callback };
    activeComplaintListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getComplaints(filters, currentUser).then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'complaints');
        const constraints = [];
        if (filters?.studentId) {
          constraints.push(where('studentId', '==', filters.studentId));
        } else if (filters?.staffId) {
          constraints.push(where('assignedStaffId', '==', filters.staffId));
        }
        const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getComplaints(filters, currentUser).then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore complaints subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore complaints listener:', err);
      }
    }

    return () => {
      activeComplaintListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
