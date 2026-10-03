import { complaintService, calculateAgeingDays, getAgeingBucket } from './complaintService';
import { requestService } from './requestService';
import { gatePassService } from './gatePassService';
import { hostelService } from './hostelService';
import { messService } from './messService';
import { lostFoundService } from './lostFoundService';
import type { Complaint, StudentRequest, GatePass } from '../types';

export interface ComplaintAnalytics {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  closed: number;
  rejected: number;
  ageing: {
    bucket0to1: number;
    bucket2to3: number;
    bucket4to7: number;
    bucket7plus: number;
  };
  priorityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryCounts: Record<string, number>;
  slaComplianceRate: number;
}

export interface RequestAnalytics {
  total: number;
  pending: number;
  underReview: number;
  assigned: number;
  inProgress: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  typeCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
}

export interface CertificateAnalytics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  averageProcessingDays: number | null;
}

export interface GatePassAnalytics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
  used: number;
}

export interface HostelAnalytics {
  totalHostelers: number;
  totalRooms: number;
  totalCapacity: number;
  totalOccupied: number;
  occupancyPercentage: number;
  hostelWise: { name: string; capacity: number; occupied: number }[];
  maintenanceComplaints: number;
  hostelRequests: number;
  hostelNoticesCount: number;
}

export interface MessAnalytics {
  totalMealRecords: number;
  takenCount: number;
  missedCount: number;
  feedbackCount: number;
  averageRating: number | null;
  categoryDistribution: Record<string, number>;
  mealTypeCounts: Record<string, number>;
}

export interface StaffWorkloadItem {
  staffId: string;
  staffName: string;
  department?: string;
  assignedComplaints: number;
  pendingComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  assignedRequests: number;
  pendingRequests: number;
  completedRequests: number;
  overdueItems: number;
}

export interface ResolutionTimeStats {
  averageDays: number | null;
  medianDays: number | null;
  minDays: number | null;
  maxDays: number | null;
  sampleCount: number;
}

export interface ActionCenterItem {
  id: string;
  title: string;
  description: string;
  count: number;
  priority: 'Critical' | 'High' | 'Attention Required' | 'Normal';
  link: string;
  category: string;
}

export const analyticsService = {
  async getComplaintAnalytics(filters?: {
    category?: string;
    priority?: string;
    status?: string;
    department?: string;
    staffId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ComplaintAnalytics> {
    const allComplaints: Complaint[] = await complaintService.getComplaints();

    const filtered = allComplaints.filter((c) => {
      if (filters?.category && filters.category !== 'ALL' && c.category !== filters.category) return false;
      if (filters?.priority && filters.priority !== 'ALL' && c.priority !== filters.priority) return false;
      if (filters?.status && filters.status !== 'ALL' && c.status !== filters.status) return false;
      if (filters?.staffId && filters.staffId !== 'ALL' && c.assignedStaffId !== filters.staffId) return false;
      if (filters?.startDate && new Date(c.submittedAt).getTime() < new Date(filters.startDate).getTime()) return false;
      if (filters?.endDate && new Date(c.submittedAt).getTime() > new Date(filters.endDate).getTime()) return false;
      return true;
    });

    const total = filtered.length;
    let open = 0;
    let assigned = 0;
    let inProgress = 0;
    let escalated = 0;
    let resolved = 0;
    let closed = 0;
    let rejected = 0;

    const ageing = {
      bucket0to1: 0,
      bucket2to3: 0,
      bucket4to7: 0,
      bucket7plus: 0,
    };

    const priorityDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const categoryCounts: Record<string, number> = {};
    let withinSlaCount = 0;

    filtered.forEach((c) => {
      // Status counting
      if (c.status === 'SUBMITTED') open++;
      else if (c.status === 'ASSIGNED') assigned++;
      else if (c.status === 'IN_PROGRESS') inProgress++;
      else if (c.status === 'ESCALATED') escalated++;
      else if (c.status === 'RESOLVED') resolved++;
      else if (c.status === 'CLOSED') closed++;
      else if (c.status === 'REJECTED') rejected++;

      // Ageing calculation
      const days = calculateAgeingDays(c.submittedAt);
      const bucket = getAgeingBucket(days);
      if (bucket === '0–1 days') ageing.bucket0to1++;
      else if (bucket === '2–3 days') ageing.bucket2to3++;
      else if (bucket === '4–7 days') ageing.bucket4to7++;
      else ageing.bucket7plus++;

      // Priority
      if (c.priority === 'CRITICAL') priorityDistribution.critical++;
      else if (c.priority === 'HIGH') priorityDistribution.high++;
      else if (c.priority === 'MEDIUM') priorityDistribution.medium++;
      else if (c.priority === 'LOW') priorityDistribution.low++;

      // Category
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;

      // SLA
      if (c.slaStatus === 'WITHIN_SLA' || c.status === 'RESOLVED' || c.status === 'CLOSED') {
        withinSlaCount++;
      }
    });

    const slaComplianceRate = total > 0 ? Math.round((withinSlaCount / total) * 1000) / 10 : 100;

    return {
      total,
      open,
      assigned,
      inProgress,
      escalated,
      resolved,
      closed,
      rejected,
      ageing,
      priorityDistribution,
      categoryCounts,
      slaComplianceRate,
    };
  },

  async getRequestAnalytics(filters?: {
    requestType?: string;
    department?: string;
    status?: string;
  }): Promise<RequestAnalytics> {
    const allRequests: StudentRequest[] = await requestService.getAllRequests();

    const filtered = allRequests.filter((r) => {
      if (filters?.requestType && filters.requestType !== 'ALL' && r.requestType !== filters.requestType) return false;
      if (filters?.department && filters.department !== 'ALL' && r.department !== filters.department) return false;
      if (filters?.status && filters.status !== 'ALL' && r.status !== filters.status) return false;
      return true;
    });

    const total = filtered.length;
    let pending = 0;
    let underReview = 0;
    let assigned = 0;
    let inProgress = 0;
    let approved = 0;
    let rejected = 0;
    let completed = 0;
    let cancelled = 0;

    const typeCounts: Record<string, number> = {};
    const departmentCounts: Record<string, number> = {};

    filtered.forEach((r) => {
      if (r.status === 'PENDING') pending++;
      else if (r.status === 'UNDER_REVIEW') underReview++;
      else if (r.status === 'ASSIGNED') assigned++;
      else if (r.status === 'IN_PROGRESS') inProgress++;
      else if (r.status === 'APPROVED') approved++;
      else if (r.status === 'REJECTED') rejected++;
      else if (r.status === 'COMPLETED') completed++;
      else if (r.status === 'CANCELLED') cancelled++;

      typeCounts[r.requestType] = (typeCounts[r.requestType] || 0) + 1;
      const dept = r.department || 'General';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });

    return {
      total,
      pending,
      underReview,
      assigned,
      inProgress,
      approved,
      rejected,
      completed,
      cancelled,
      typeCounts,
      departmentCounts,
    };
  },

  async getCertificateAnalytics(): Promise<CertificateAnalytics> {
    const allRequests: StudentRequest[] = await requestService.getAllRequests();
    const certRequests = allRequests.filter(
      (r) =>
        r.requestType === 'bonafide_certificate' ||
        r.requestType === 'study_certificate' ||
        r.requestType === 'character_certificate'
    );

    const total = certRequests.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let completed = 0;

    const durations: number[] = [];

    certRequests.forEach((r) => {
      if (r.status === 'PENDING' || r.status === 'UNDER_REVIEW') pending++;
      else if (r.status === 'APPROVED') approved++;
      else if (r.status === 'REJECTED') rejected++;
      else if (r.status === 'COMPLETED') completed++;

      if ((r.status === 'APPROVED' || r.status === 'COMPLETED') && r.updatedAt && r.submittedAt) {
        const diffDays =
          (new Date(r.updatedAt).getTime() - new Date(r.submittedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays >= 0) durations.push(diffDays);
      }
    });

    const averageProcessingDays =
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null;

    return {
      total,
      pending,
      approved,
      rejected,
      completed,
      averageProcessingDays,
    };
  },

  async getGatePassAnalytics(): Promise<GatePassAnalytics> {
    const allPasses: GatePass[] = await gatePassService.getPasses();

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;
    let expired = 0;
    let used = 0;

    allPasses.forEach((p) => {
      if (p.status === 'PENDING') pending++;
      else if (p.status === 'APPROVED') approved++;
      else if (p.status === 'REJECTED') rejected++;
      else if (p.status === 'CANCELLED') cancelled++;
      else if (p.status === 'EXPIRED') expired++;
      else if (p.status === 'USED') used++;
    });

    return {
      total: allPasses.length,
      pending,
      approved,
      rejected,
      cancelled,
      expired,
      used,
    };
  },

  async getHostelAnalytics(): Promise<HostelAnalytics> {
    const [rooms, allocations, allComplaints, allRequests, notices] = await Promise.all([
      hostelService.getAllRooms(),
      hostelService.getAllAllocations(),
      complaintService.getComplaints(),
      requestService.getAllRequests(),
      hostelService.getHostelNotices(),
    ]);

    // Only hosteler students
    const totalHostelers = allocations.filter((a) => a.status === 'ALLOCATED').length;
    const totalRooms = rooms.length;
    const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const totalOccupied = rooms.reduce((acc, r) => acc + (r.occupied || 0), 0);
    const occupancyPercentage =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 1000) / 10 : 0;

    const hostelWiseMap: Record<string, { capacity: number; occupied: number }> = {};
    rooms.forEach((r) => {
      if (!hostelWiseMap[r.hostelName]) {
        hostelWiseMap[r.hostelName] = { capacity: 0, occupied: 0 };
      }
      hostelWiseMap[r.hostelName].capacity += r.capacity;
      hostelWiseMap[r.hostelName].occupied += r.occupied;
    });

    const hostelWise = Object.entries(hostelWiseMap).map(([name, data]) => ({
      name,
      capacity: data.capacity,
      occupied: data.occupied,
    }));

    const maintenanceComplaints = allComplaints.filter(
      (c) => c.category === 'Hostel' || c.category === 'Electrical' || c.category === 'Plumbing'
    ).length;

    const hostelRequests = allRequests.filter((r) => r.requestType === 'campus_service').length;

    return {
      totalHostelers,
      totalRooms,
      totalCapacity,
      totalOccupied,
      occupancyPercentage,
      hostelWise,
      maintenanceComplaints,
      hostelRequests,
      hostelNoticesCount: notices.length,
    };
  },

  async getMessAnalytics(): Promise<MessAnalytics> {
    const [meals, feedbacks] = await Promise.all([
      messService.getAllMealRecords(),
      messService.getFeedbacks(),
    ]);

    const totalMealRecords = meals.length;
    let takenCount = 0;
    let missedCount = 0;
    const mealTypeCounts: Record<string, number> = {};

    meals.forEach((m) => {
      if (m.status === 'TAKEN') takenCount++;
      else if (m.status === 'NOT_TAKEN') missedCount++;
      mealTypeCounts[m.mealType] = (mealTypeCounts[m.mealType] || 0) + 1;
    });

    const feedbackCount = feedbacks.length;
    const categoryDistribution: Record<string, number> = {};
    let totalRating = 0;

    feedbacks.forEach((f) => {
      categoryDistribution[f.category] = (categoryDistribution[f.category] || 0) + 1;
      totalRating += f.rating;
    });

    const averageRating = feedbackCount > 0 ? Math.round((totalRating / feedbackCount) * 10) / 10 : null;

    return {
      totalMealRecords,
      takenCount,
      missedCount,
      feedbackCount,
      averageRating,
      categoryDistribution,
      mealTypeCounts,
    };
  },

  async getStaffWorkloadAnalytics(): Promise<StaffWorkloadItem[]> {
    const [complaints, requests] = await Promise.all([
      complaintService.getComplaints(),
      requestService.getAllRequests(),
    ]);

    const staffMap: Record<string, StaffWorkloadItem> = {};

    // Group complaints by staff
    complaints.forEach((c) => {
      if (c.assignedStaffId) {
        const id = c.assignedStaffId;
        if (!staffMap[id]) {
          staffMap[id] = {
            staffId: id,
            staffName: c.assignedStaffName || 'Campus Staff',
            department: c.category,
            assignedComplaints: 0,
            pendingComplaints: 0,
            inProgressComplaints: 0,
            resolvedComplaints: 0,
            assignedRequests: 0,
            pendingRequests: 0,
            completedRequests: 0,
            overdueItems: 0,
          };
        }

        staffMap[id].assignedComplaints++;
        if (c.status === 'SUBMITTED' || c.status === 'ASSIGNED') staffMap[id].pendingComplaints++;
        else if (c.status === 'IN_PROGRESS' || c.status === 'ESCALATED') staffMap[id].inProgressComplaints++;
        else if (c.status === 'RESOLVED' || c.status === 'CLOSED') staffMap[id].resolvedComplaints++;

        if (c.slaStatus === 'OVERDUE' || calculateAgeingDays(c.submittedAt) >= 7) {
          staffMap[id].overdueItems++;
        }
      }
    });

    // Group requests by staff
    requests.forEach((r) => {
      if (r.assignedStaffName) {
        const id = r.assignedStaffName;
        if (!staffMap[id]) {
          staffMap[id] = {
            staffId: id,
            staffName: r.assignedStaffName,
            department: r.assignedDepartment || r.department,
            assignedComplaints: 0,
            pendingComplaints: 0,
            inProgressComplaints: 0,
            resolvedComplaints: 0,
            assignedRequests: 0,
            pendingRequests: 0,
            completedRequests: 0,
            overdueItems: 0,
          };
        }

        staffMap[id].assignedRequests++;
        if (r.status === 'PENDING' || r.status === 'UNDER_REVIEW') staffMap[id].pendingRequests++;
        else if (r.status === 'COMPLETED' || r.status === 'APPROVED') staffMap[id].completedRequests++;
      }
    });

    return Object.values(staffMap);
  },

  async getResolutionTimeAnalytics(): Promise<ResolutionTimeStats> {
    const complaints = await complaintService.getComplaints();
    const durationsDays: number[] = [];

    complaints.forEach((c) => {
      if (c.resolvedAt && c.submittedAt) {
        const diffDays =
          (new Date(c.resolvedAt).getTime() - new Date(c.submittedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays >= 0) durationsDays.push(diffDays);
      } else if (c.actualResolutionHours && c.actualResolutionHours > 0) {
        durationsDays.push(c.actualResolutionHours / 24);
      }
    });

    if (durationsDays.length === 0) {
      return {
        averageDays: null,
        medianDays: null,
        minDays: null,
        maxDays: null,
        sampleCount: 0,
      };
    }

    durationsDays.sort((a, b) => a - b);
    const count = durationsDays.length;
    const sum = durationsDays.reduce((a, b) => a + b, 0);
    const averageDays = Math.round((sum / count) * 10) / 10;
    const medianDays =
      count % 2 === 0
        ? Math.round(((durationsDays[count / 2 - 1] + durationsDays[count / 2]) / 2) * 10) / 10
        : Math.round(durationsDays[Math.floor(count / 2)] * 10) / 10;
    const minDays = Math.round(durationsDays[0] * 10) / 10;
    const maxDays = Math.round(durationsDays[count - 1] * 10) / 10;

    return {
      averageDays,
      medianDays,
      minDays,
      maxDays,
      sampleCount: count,
    };
  },

  async getAdminActionCenterItems(): Promise<ActionCenterItem[]> {
    const [complaints, requests, passes, lostFoundItems] = await Promise.all([
      complaintService.getComplaints(),
      requestService.getAllRequests(),
      gatePassService.getPasses(),
      lostFoundService.getItems(),
    ]);

    const items: ActionCenterItem[] = [];

    // 1. Critical or Overdue Complaints
    const criticalComplaints = complaints.filter(
      (c) =>
        (c.priority === 'CRITICAL' || c.status === 'ESCALATED' || calculateAgeingDays(c.submittedAt) >= 7) &&
        c.status !== 'RESOLVED' &&
        c.status !== 'CLOSED'
    );
    if (criticalComplaints.length > 0) {
      items.push({
        id: 'act_crit_comp',
        title: 'Critical & Overdue Complaints',
        description: 'Hostel and academic grievances requiring emergency intervention or Dean escalation.',
        count: criticalComplaints.length,
        priority: 'Critical',
        link: '/complaints',
        category: 'Complaints',
      });
    }

    // 2. Unassigned Complaints
    const unassignedComplaints = complaints.filter(
      (c) => (c.status === 'SUBMITTED' || !c.assignedStaffId) && c.status !== 'RESOLVED' && c.status !== 'CLOSED'
    );
    if (unassignedComplaints.length > 0) {
      items.push({
        id: 'act_unassigned_comp',
        title: 'Unassigned Complaints',
        description: 'Fresh student grievances waiting for maintenance department or technician assignment.',
        count: unassignedComplaints.length,
        priority: 'High',
        link: '/complaints',
        category: 'Complaints',
      });
    }

    // 3. Pending Gate Passes
    const pendingGatePasses = passes.filter((p) => p.status === 'PENDING');
    if (pendingGatePasses.length > 0) {
      items.push({
        id: 'act_pend_pass',
        title: 'Pending Gate Pass Approvals',
        description: 'Hostel resident leave applications awaiting chief warden review and QR generation.',
        count: pendingGatePasses.length,
        priority: 'High',
        link: '/gate-pass',
        category: 'Gate Pass',
      });
    }

    // 4. Pending Certificate Requests
    const pendingCertRequests = requests.filter(
      (r) =>
        (r.requestType === 'bonafide_certificate' ||
          r.requestType === 'study_certificate' ||
          r.requestType === 'character_certificate') &&
        (r.status === 'PENDING' || r.status === 'UNDER_REVIEW')
    );
    if (pendingCertRequests.length > 0) {
      items.push({
        id: 'act_pend_certs',
        title: 'Pending Certificate Requests',
        description: 'Bonafide and study certificates pending fee clearance verification and signature.',
        count: pendingCertRequests.length,
        priority: 'Attention Required',
        link: '/requests',
        category: 'Certificates',
      });
    }

    // 5. Lost & Found Pending Claims
    const pendingClaims = lostFoundItems.filter((i) => i.status === 'CLAIM_PENDING');
    if (pendingClaims.length > 0) {
      items.push({
        id: 'act_pend_claims',
        title: 'Lost & Found Claim Approvals',
        description: 'Reported articles claimed by students awaiting estate office ownership verification.',
        count: pendingClaims.length,
        priority: 'Normal',
        link: '/lost-found',
        category: 'Lost & Found',
      });
    }

    return items;
  },
};
