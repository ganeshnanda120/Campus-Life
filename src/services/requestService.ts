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
import { certificateService } from './certificateService';
import type {
  StudentRequest,
  RequestStatus,
  RequestTimelineStep,
  AttachmentFile,
  UserRole,
} from '../types';

const REQUESTS_STORAGE_KEY = 'campus_life_student_requests';
type RequestListener = {
  studentId?: string;
  callback: (requests: StudentRequest[]) => void;
};
const activeRequestListeners = new Set<RequestListener>();

function notifyLocalRequestListeners() {
  activeRequestListeners.forEach((entry) => {
    if (entry.studentId) {
      requestService.getStudentRequests(entry.studentId).then(entry.callback).catch(() => {});
    } else {
      requestService.getAllRequests().then(entry.callback).catch(() => {});
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === REQUESTS_STORAGE_KEY) {
      notifyLocalRequestListeners();
    }
  });
}

const INITIAL_REQUESTS: StudentRequest[] = [
  {
    id: 'req_001',
    requestId: 'REQ-2026-089',
    studentId: 'STU2026001',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@campuslife.edu',
    department: 'Computer Science & Engineering',
    requestType: 'bonafide_certificate',
    title: 'Bonafide Certificate for State Scholarship',
    description: 'Required for submission to Odisha State Post-Matric Scholarship portal verification.',
    status: 'IN_PROGRESS',
    assignedDepartment: 'Academic Cell',
    assignedStaffName: 'Dr. Sanjeev Mohanty',
    submittedAt: '2026-02-08T09:30:00.000Z',
    updatedAt: '2026-02-09T14:15:00.000Z',
    timeline: [
      {
        id: 'tl_001_1',
        status: 'PENDING',
        date: '2026-02-08',
        time: '09:30 AM',
        actor: 'Aarav Sharma',
        actorRole: 'STUDENT',
        action: 'Application Submitted',
        message: 'Student submitted application with fee clearance certificate.',
      },
      {
        id: 'tl_001_2',
        status: 'UNDER_REVIEW',
        date: '2026-02-08',
        time: '02:00 PM',
        actor: 'Academic Cell Staff',
        actorRole: 'STAFF',
        action: 'Under Verification',
        message: 'Verifying student enrolment number, semester fee receipts, and branch records.',
      },
      {
        id: 'tl_001_3',
        status: 'IN_PROGRESS',
        date: '2026-02-09',
        time: '02:15 PM',
        actor: 'Dr. Sanjeev Mohanty',
        actorRole: 'FACULTY',
        action: 'Forwarded for HOD Signature',
        message: 'Eligibility confirmed. Forwarded to departmental authorities for digital certification.',
      }
    ],
  },
  {
    id: 'req_002',
    requestId: 'REQ-2026-042',
    studentId: 'STU2026001',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@campuslife.edu',
    department: 'Computer Science & Engineering',
    requestType: 'study_certificate',
    title: 'Study & Conduct Certificate for Bank Loan',
    description: 'Application for educational credit verification through SBI University Campus branch.',
    status: 'COMPLETED',
    assignedDepartment: 'Academic Affairs',
    assignedStaffName: 'Prof. Rajesh Swain',
    submittedAt: '2026-01-18T11:00:00.000Z',
    updatedAt: '2026-01-20T14:30:00.000Z',
    timeline: [
      {
        id: 'tl_002_1',
        status: 'PENDING',
        date: '2026-01-18',
        time: '11:00 AM',
        actor: 'Aarav Sharma',
        actorRole: 'STUDENT',
        action: 'Submitted Request',
      },
      {
        id: 'tl_002_2',
        status: 'APPROVED',
        date: '2026-01-20',
        time: '11:30 AM',
        actor: 'Prof. Rajesh Swain',
        actorRole: 'SUB_ADMIN',
        action: 'Authorized & Approved',
        message: 'Verified academic standing. Certificate generated.',
      },
      {
        id: 'tl_002_3',
        status: 'COMPLETED',
        date: '2026-01-20',
        time: '02:30 PM',
        actor: 'Chief Administrative Officer',
        actorRole: 'MAIN_ADMIN',
        action: 'Certificate Issued',
        message: 'Digital Certificate CERT-2026-0078 is ready for viewing and download.',
      }
    ],
  },
  {
    id: 'req_003',
    requestId: 'REQ-2026-114',
    studentId: 'STU2026001',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@campuslife.edu',
    department: 'Computer Science & Engineering',
    requestType: 'leave_request',
    title: 'Duty Leave for State Hackathon',
    description: 'Participating in Smart Odisha Hackathon 2026 grand finale representing the university.',
    status: 'PENDING',
    submittedAt: '2026-02-12T16:45:00.000Z',
    updatedAt: '2026-02-12T16:45:00.000Z',
    timeline: [
      {
        id: 'tl_003_1',
        status: 'PENDING',
        date: '2026-02-12',
        time: '04:45 PM',
        actor: 'Aarav Sharma',
        actorRole: 'STUDENT',
        action: 'Application Submitted',
        message: 'Official invitation letter attached for leave approval.',
      }
    ],
  }
];

function getLocalRequests(): StudentRequest[] {
  try {
    const raw = safeStorage.getItem(REQUESTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  try {
    safeStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(INITIAL_REQUESTS));
  } catch {
    // ignore
  }
  return INITIAL_REQUESTS;
}

function saveLocalRequests(requests: StudentRequest[]) {
  try {
    safeStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // ignore
  }
}

export const requestService = {
  async getAllRequests(): Promise<StudentRequest[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'requests');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StudentRequest, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore requests fetch fallback:', err);
      }
    }
    return getLocalRequests();
  },

  async getStudentRequests(studentId: string): Promise<StudentRequest[]> {
    const all = await this.getAllRequests();
    return all.filter((r) => r.studentId === studentId);
  },

  async createRequest(params: {
    studentId: string;
    studentName: string;
    studentEmail: string;
    department: string;
    requestType: StudentRequest['requestType'];
    title: string;
    description: string;
    attachments?: AttachmentFile[];
  }): Promise<{ success: boolean; request?: StudentRequest; error?: string }> {
    const all = getLocalRequests();
    const count = all.length + 1;
    const reqNum = String(count).padStart(3, '0');
    const requestId = `REQ-2026-${reqNum}`;
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newRequest: StudentRequest = {
      ...params,
      id,
      requestId,
      status: 'PENDING',
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      timeline: [
        {
          id: `tl_${id}_1`,
          status: 'PENDING',
          date: dateStr,
          time: timeStr,
          actor: params.studentName,
          actorRole: 'STUDENT',
          action: 'Request Submitted',
          message: params.description,
        }
      ],
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'requests', id);
        await setDoc(docRef, newRequest);
      } catch (err) {
        console.warn('Firestore request create fallback:', err);
      }
    }

    all.unshift(newRequest);
    saveLocalRequests(all);
    notifyLocalRequestListeners();

    // Activity log
    await activityService.logActivity({
      userId: params.studentId,
      title: 'Request Submitted',
      description: `Submitted ${params.title} (#${requestId}).`,
      entityType: 'request',
      entityId: requestId,
    });

    // In-app notification
    await notificationService.createNotification({
      userId: params.studentId,
      title: 'Request Registered',
      message: `Your request #${requestId} (${params.title}) was received and queued for review.`,
      type: 'request',
      entityId: requestId,
      link: '/student/requests',
    });

    return { success: true, request: newRequest };
  },

  async updateRequestStatus(params: {
    requestId: string;
    newStatus: RequestStatus;
    actor: { uid: string; name: string; role: UserRole };
    comment?: string;
    assignedStaffName?: string;
    assignedDepartment?: string;
  }): Promise<{ success: boolean; request?: StudentRequest; error?: string }> {
    const all = getLocalRequests();
    const idx = all.findIndex((r) => r.id === params.requestId || r.requestId === params.requestId);
    if (idx === -1) {
      return { success: false, error: 'Request not found.' };
    }

    const current = all[idx];
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newTimelineStep: RequestTimelineStep = {
      id: `tl_${current.id}_${current.timeline.length + 1}`,
      status: params.newStatus,
      date: dateStr,
      time: timeStr,
      actor: params.actor.name,
      actorRole: params.actor.role,
      action: `Status changed to ${params.newStatus.replace('_', ' ')}`,
      message: params.comment,
    };

    const updatedRequest: StudentRequest = {
      ...current,
      status: params.newStatus,
      assignedStaffName: params.assignedStaffName || current.assignedStaffName,
      assignedDepartment: params.assignedDepartment || current.assignedDepartment,
      updatedAt: now.toISOString(),
      timeline: [...current.timeline, newTimelineStep],
      rejectionReason: params.newStatus === 'REJECTED' ? params.comment : current.rejectionReason,
    };

    // If approved and request is a certificate, automatically generate formal Certificate record!
    if (
      params.newStatus === 'APPROVED' &&
      (current.requestType === 'bonafide_certificate' ||
        current.requestType === 'study_certificate' ||
        current.requestType === 'character_certificate')
    ) {
      let certName = 'Bonafide Certificate';
      if (current.requestType === 'study_certificate') certName = 'Study & Conduct Certificate';
      if (current.requestType === 'character_certificate') certName = 'Character Certificate';

      await certificateService.issueCertificate({
        requestId: current.requestId,
        studentId: current.studentId,
        studentName: current.studentName,
        studentRoll: '220101001',
        department: current.department,
        branch: 'CSE',
        year: 3,
        semester: 6,
        certificateType: certName,
        issuedBy: params.actor.name,
        issuedByRole: params.actor.role,
        purpose: current.description,
        institutionName: 'Biju Patnaik University of Technology — Campus Life',
      });

      // Notification specifically for certificate
      await notificationService.createNotification({
        userId: current.studentId,
        title: 'Certificate Issued!',
        message: `Your ${certName} has been approved and issued by ${params.actor.name}. You can view and download it now.`,
        type: 'certificate',
        link: '/student/requests',
      });
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'requests', current.id);
        await updateDoc(docRef, {
          status: params.newStatus,
          updatedAt: updatedRequest.updatedAt,
          timeline: updatedRequest.timeline,
          assignedStaffName: updatedRequest.assignedStaffName || null,
          assignedDepartment: updatedRequest.assignedDepartment || null,
        });
      } catch (err) {
        console.warn('Firestore request update fallback:', err);
      }
    }

    all[idx] = updatedRequest;
    saveLocalRequests(all);
    notifyLocalRequestListeners();

    // In-app notification to student
    await notificationService.createNotification({
      userId: current.studentId,
      title: `Request ${params.newStatus}: #${current.requestId}`,
      message: `Status updated to ${params.newStatus.replace('_', ' ')} by ${params.actor.name}.${params.comment ? ` Note: ${params.comment}` : ''}`,
      type: 'request',
      entityId: current.requestId,
      link: '/student/requests',
    });

    // Activity log
    await activityService.logActivity({
      userId: current.studentId,
      title: `Request ${params.newStatus}`,
      description: `Request #${current.requestId} status updated to ${params.newStatus} by ${params.actor.name}.`,
      entityType: 'request',
      entityId: current.requestId,
    });

    return { success: true, request: updatedRequest };
  },

  subscribeRequests(
    studentId?: string,
    callback?: (requests: StudentRequest[]) => void
  ): () => void {
    if (!callback) return () => {};
    const listenerEntry = { studentId, callback };
    activeRequestListeners.add(listenerEntry);

    // Initial immediate fetch
    if (studentId) {
      this.getStudentRequests(studentId).then(callback).catch(() => {});
    } else {
      this.getAllRequests().then(callback).catch(() => {});
    }

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'requests');
        const q = studentId
          ? query(colRef, where('studentId', '==', studentId))
          : colRef;
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            if (studentId) {
              this.getStudentRequests(studentId).then(callback).catch(() => {});
            } else {
              this.getAllRequests().then(callback).catch(() => {});
            }
          },
          (err) => {
            console.warn('Firestore requests subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore requests listener:', err);
      }
    }

    return () => {
      activeRequestListeners.delete(listenerEntry);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
