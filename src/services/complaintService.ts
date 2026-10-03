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
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintTimelineStep,
  AttachmentFile,
  UserRole,
} from '../types';

const COMPLAINTS_STORAGE_KEY = 'campus_life_complaints';
type ComplaintListener = {
  filters?: {
    studentId?: string;
    staffId?: string;
    status?: string;
    category?: string;
    priority?: string;
    searchQuery?: string;
  };
  callback: (complaints: Complaint[]) => void;
};
const activeComplaintListeners = new Set<ComplaintListener>();

function notifyLocalComplaintListeners() {
  activeComplaintListeners.forEach((entry) => {
    complaintService.getComplaints(entry.filters).then((data) => {
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

  const now = Date.now();
  return [
    {
      id: 'cmp_mock_001',
      complaintId: 'CMP-2026-1024',
      studentId: 'student_uid_001',
      studentName: 'Aarav Sharma',
      studentEmail: 'aarav.sharma@bput.ac.in',
      category: 'Electrical',
      title: 'Corridor Light Fixture Sparking',
      description: 'The ceiling fixture outside Room 204 emits intermittent sparks and buzzing sound when switched on.',
      location: 'Hostel Block B, 2nd Floor Corridor',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      assignedDepartment: 'Maintenance',
      assignedStaffId: 'staff_001',
      assignedStaffName: 'Binod Rout (Maintenance)',
      submittedAt: new Date(now - 7 * 86400000).toISOString(),
      updatedAt: new Date(now - 86400000).toISOString(),
      expectedResolutionAt: new Date(now - 6 * 86400000).toISOString(),
      slaStatus: 'OVERDUE',
      timeline: [
        {
          id: 'step_1',
          status: 'SUBMITTED',
          date: new Date(now - 7 * 86400000).toLocaleDateString(),
          time: '10:00 AM',
          actor: 'Aarav Sharma',
          actorRole: 'STUDENT',
          action: 'Complaint Submitted',
          message: 'Student reported sparking fixture.',
        },
        {
          id: 'step_2',
          status: 'UNDER_REVIEW',
          date: new Date(now - 6 * 86400000).toLocaleDateString(),
          time: '11:30 AM',
          actor: 'Chief Warden',
          actorRole: 'SUB_ADMIN',
          action: 'Reviewed and Prioritized',
          message: 'Elevated to Critical priority due to fire risk.',
        },
        {
          id: 'step_3',
          status: 'ASSIGNED',
          date: new Date(now - 5 * 86400000).toLocaleDateString(),
          time: '02:00 PM',
          actor: 'Estate Officer',
          actorRole: 'SUB_ADMIN',
          action: 'Assigned to Staff',
          message: 'Assigned to Binod Rout for urgent wiring replacement.',
        },
        {
          id: 'step_4',
          status: 'IN_PROGRESS',
          date: new Date(now - 86400000).toLocaleDateString(),
          time: '09:00 AM',
          actor: 'Binod Rout',
          actorRole: 'STAFF',
          action: 'Work Started',
          message: 'Inspection completed. Awaiting replacement MCB and cable harness.',
        },
      ],
    },
    {
      id: 'cmp_mock_002',
      complaintId: 'CMP-2026-1028',
      studentId: 'student_uid_001',
      studentName: 'Aarav Sharma',
      studentEmail: 'aarav.sharma@bput.ac.in',
      category: 'Water',
      title: 'Low Pressure in Washroom 3',
      description: 'Very weak water flow in the washrooms on the east wing of the department building.',
      location: 'Academic Block 1, Ground Floor East',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      assignedDepartment: 'Plumbing & Water Works',
      assignedStaffId: 'staff_002',
      assignedStaffName: 'Estate Team',
      submittedAt: new Date(now - 4 * 86400000).toISOString(),
      updatedAt: new Date(now - 2 * 86400000).toISOString(),
      expectedResolutionAt: new Date(now).toISOString(),
      slaStatus: 'DUE_SOON',
      timeline: [
        {
          id: 'step_w1',
          status: 'SUBMITTED',
          date: new Date(now - 4 * 86400000).toLocaleDateString(),
          time: '08:30 AM',
          actor: 'Aarav Sharma',
          actorRole: 'STUDENT',
          action: 'Complaint Submitted',
          message: 'Water pressure issue registered.',
        },
        {
          id: 'step_w2',
          status: 'ASSIGNED',
          date: new Date(now - 2 * 86400000).toLocaleDateString(),
          time: '11:00 AM',
          actor: 'Estate Officer',
          actorRole: 'SUB_ADMIN',
          action: 'Assigned to Plumbing Team',
        },
      ],
    },
    {
      id: 'cmp_mock_003',
      complaintId: 'CMP-2026-1010',
      studentId: 'student_uid_001',
      studentName: 'Aarav Sharma',
      studentEmail: 'aarav.sharma@bput.ac.in',
      category: 'Hostel',
      title: 'Window Latch Damaged in Room 204',
      description: 'The latch mechanism on the window frame broke during storm winds.',
      location: 'Hostel Block A, Room 204',
      priority: 'LOW',
      status: 'RESOLVED',
      assignedDepartment: 'Carpentry',
      assignedStaffId: 'staff_003',
      assignedStaffName: 'Maheswar Jena',
      submittedAt: new Date(now - 10 * 86400000).toISOString(),
      updatedAt: new Date(now - 8 * 86400000).toISOString(),
      resolvedAt: new Date(now - 8 * 86400000).toISOString(),
      expectedResolutionAt: new Date(now - 3 * 86400000).toISOString(),
      slaStatus: 'WITHIN_SLA',
      actualResolutionHours: 48,
      feedback: {
        rating: 5,
        comment: 'Fixed promptly on the second day. Excellent work!',
        submittedAt: new Date(now - 7 * 86400000).toISOString(),
      },
      timeline: [
        {
          id: 'step_h1',
          status: 'SUBMITTED',
          date: new Date(now - 10 * 86400000).toLocaleDateString(),
          time: '04:00 PM',
          actor: 'Aarav Sharma',
          actorRole: 'STUDENT',
          action: 'Complaint Submitted',
        },
        {
          id: 'step_h2',
          status: 'RESOLVED',
          date: new Date(now - 8 * 86400000).toLocaleDateString(),
          time: '04:00 PM',
          actor: 'Maheswar Jena',
          actorRole: 'STAFF',
          action: 'Resolved',
          message: 'Installed heavy-duty brass latch and tested frame closure.',
        },
      ],
    },
  ];
}

function saveLocalComplaints(complaints: Complaint[]) {
  try {
    safeStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
  } catch {
    // ignore
  }
}

export const complaintService = {
  async getComplaints(filters?: {
    studentId?: string;
    staffId?: string;
    status?: string;
    category?: string;
    priority?: string;
    searchQuery?: string;
  }): Promise<Complaint[]> {
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
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        list = list.filter(
          (c) =>
            c.complaintId.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.location.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q)
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
    attachments?: AttachmentFile[];
  }): Promise<Complaint> {
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
      message: `Issue reported in ${data.category} under location: ${data.location}`,
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

    // Notify student
    await notificationService.createNotification({
      userId: data.studentId,
      title: 'Complaint Registered',
      message: `Your grievance #${complaintId} has been registered under ${data.category}.`,
      type: 'complaint',
      link: '/student/complaints',
    });

    // Record activity
    await activityService.logActivity({
      userId: data.studentId,
      userName: data.studentName,
      userRole: 'STUDENT',
      activityType: 'COMPLAINT_SUBMITTED',
      description: `Reported issue: ${data.title} (#${complaintId})`,
      entityType: 'COMPLAINT',
      entityId: complaintId,
    });

    // Audit log
    await auditService.logAction({
      actorUid: data.studentId,
      actorName: data.studentName,
      actorRole: 'STUDENT',
      action: 'CREATE_COMPLAINT',
      entityType: 'COMPLAINT',
      entityId: complaintId,
      changes: `Created complaint for ${data.category} at ${data.location}`,
    });

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

  subscribeComplaints(
    filters?: {
      studentId?: string;
      staffId?: string;
      status?: string;
      category?: string;
      priority?: string;
      searchQuery?: string;
    },
    callback?: (complaints: Complaint[]) => void
  ): () => void {
    if (!callback) return () => {};
    const listenerEntry = { filters, callback };
    activeComplaintListeners.add(listenerEntry);

    // Initial immediate invocation
    this.getComplaints(filters).then(callback).catch(() => {});

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
            this.getComplaints(filters).then(callback).catch(() => {});
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
