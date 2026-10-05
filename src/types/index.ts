// ============================================================================
// Campus Life — Strongly Typed TypeScript Domain Models
// ============================================================================

export type UserRole = 'MAIN_ADMIN' | 'SUB_ADMIN' | 'FACULTY' | 'STAFF' | 'STUDENT';

export type StudentCategory = 'HOSTELER' | 'DAY_SCHOLAR';

export type UserPermission =
  | 'MANAGE_STUDENTS'
  | 'MANAGE_FACULTY'
  | 'MANAGE_STAFF'
  | 'MANAGE_SUB_ADMINS'
  | 'MANAGE_ATTENDANCE'
  | 'MANAGE_TIMETABLE'
  | 'MANAGE_REQUESTS'
  | 'APPROVE_REQUESTS'
  | 'MANAGE_CERTIFICATES'
  | 'MANAGE_COMPLAINTS'
  | 'ASSIGN_COMPLAINTS'
  | 'RESPOND_TO_COMPLAINTS'
  | 'MANAGE_GATE_PASS'
  | 'APPROVE_GATE_PASS'
  | 'MANAGE_HOSTEL'
  | 'MANAGE_MESS'
  | 'MANAGE_NOTICES'
  | 'MANAGE_NOTIFICATIONS'
  | 'MANAGE_CALENDAR'
  | 'MANAGE_LOST_FOUND'
  | 'MANAGE_POLLS'
  | 'MANAGE_SERVICE_DIRECTORY'
  | 'VIEW_ANALYTICS'
  | 'VIEW_REPORTS'
  | 'VIEW_AUDIT_LOGS'
  | 'MANAGE_SETTINGS';

export interface AcademicDegreeAssignment {
  degreeId?: string;
  degreeName: string;
  branchId?: string;
  branchName: string;
}

export interface UserRecord {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  department?: string;
  degree?: string;
  branch?: string;
  degreeAssignments?: AcademicDegreeAssignment[];
  specialSessionBranches?: string[];
  year?: number;
  semester?: number;
  studentId?: string;
  rollNumber?: string;
  studentCategory?: StudentCategory;
  gender?: string;
  designation?: string;
  permissions?: UserPermission[];
  hostelName?: string;
  hostelBlock?: string;
  roomNumber?: string;
  photoUrl?: string;
  employeeId?: string;
  officeLocation?: string;
  dob?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
  customFields?: Record<string, any>;
  isActivated: boolean;
  isActive: boolean;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'textarea'
  | 'dropdown';

export type CustomFieldScopeType = 'ALL' | 'SELECTED';

export interface FormFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  enabled: boolean;
  isCustom: boolean;
  isProtected?: boolean;
  protectedReason?: string;
  options?: string[];
  scope: CustomFieldScopeType;
  selectedUserIds?: string[];
  section?: string;
  placeholder?: string;
  order: number;
}

export type FormConfigType = 'STUDENT' | 'FACULTY' | 'SUB_ADMIN';

export interface FormConfiguration {
  id: string;
  formType: FormConfigType;
  fields: FormFieldDefinition[];
  updatedAt: string;
}

export type RequestStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RequestTimelineStep {
  id: string;
  status: RequestStatus;
  date: string;
  time: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  message?: string;
}

export interface AttachmentFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface StudentRequest {
  id: string;
  requestId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  department: string;
  requestType:
    | 'bonafide_certificate'
    | 'study_certificate'
    | 'character_certificate'
    | 'leave_request'
    | 'document_request'
    | 'campus_service'
    | 'other';
  title: string;
  description: string;
  attachments?: AttachmentFile[];
  status: RequestStatus;
  assignedDepartment?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  submittedAt: string;
  updatedAt: string;
  timeline: RequestTimelineStep[];
  rejectionReason?: string;
}

export type ComplaintCategory =
  | 'Hostel'
  | 'Mess'
  | 'Electrical'
  | 'Water'
  | 'Plumbing'
  | 'Cleanliness'
  | 'Classroom'
  | 'Laboratory'
  | 'Library'
  | 'IT'
  | 'Transport'
  | 'Academic'
  | 'Other';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'PENDING'
  | 'REOPENED';

export type EscalationLevel = 'STAFF' | 'DEPARTMENT' | 'SUB_ADMIN' | 'MAIN_ADMIN';

export interface ComplaintTimelineStep {
  id: string;
  status: ComplaintStatus;
  date: string;
  time: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  message?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'pdf';
}

export interface ComplaintFeedback {
  rating: number; // 1 to 5
  comment?: string;
  submittedAt: string;
}

export interface Complaint {
  id: string;
  complaintId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  location: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  attachments?: AttachmentFile[];
  assignedDepartment?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  submittedAt: string;
  updatedAt: string;
  expectedResolutionAt?: string;
  resolvedAt?: string;
  actualResolutionHours?: number;
  timeline: ComplaintTimelineStep[];
  feedback?: ComplaintFeedback;
  escalationLevel?: EscalationLevel;
  escalatedAt?: string;
  escalatedBy?: string;
  escalationReason?: string;
  slaStatus?: 'WITHIN_SLA' | 'DUE_SOON' | 'OVERDUE';
}

export type GatePassStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'USED';

export interface GatePass {
  id: string;
  gatePassId: string;
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
  status: GatePassStatus;
  token: string; // Safe reference token for QR code
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejectionAttachment?: {
    url: string;
    type: 'image' | 'video';
  };
  attachments?: AttachmentFile[];
  usedAt?: string;
  createdAt: string;
}

export interface VisitorExitLog {
  id: string;
  gatePassId: string;
  studentId: string;
  studentName: string;
  studentRoll?: string;
  exitTime: string;
  expectedReturn: string;
  actualReturn?: string;
  status: 'EXITED' | 'RETURNED' | 'OVERDUE';
  recordedBy: string;
  recordedByRole: UserRole;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Hostel Domain Types
// ----------------------------------------------------------------------------
export interface HostelRoom {
  id: string;
  hostelName: string;
  block: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  occupied: number;
  wardenName: string;
  wardenContact: string;
  caretakerName: string;
  caretakerContact: string;
  curfewTime: string;
}

export interface HostelAllocation {
  id: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  hostelName: string;
  block: string;
  roomNumber: string;
  bedNumber?: string;
  allocationDate: string;
  roommates?: { name: string; rollNumber: string; branch: string }[];
  status: 'ALLOCATED' | 'VACATED' | 'TRANSFERRED';
}

export interface HostelNotice {
  id: string;
  title: string;
  content: string;
  hostelName: string;
  block?: string;
  date: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
}

// ----------------------------------------------------------------------------
// Mess Domain Types
// ----------------------------------------------------------------------------
export type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';

export interface MessMenuItem {
  id: string;
  date: string;
  dayOfWeek: string;
  mealType: MealType;
  timing: string;
  menu: string;
  specialItem?: string;
  facility: string;
}

export interface MessAnnouncement {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'MENU_CHANGE' | 'TIMING_UPDATE' | 'CLOSURE' | 'SPECIAL_MEAL' | 'GENERAL';
  facility: string;
  postedBy: string;
}

export type MessFeedbackCategory = 'Food Quality' | 'Menu' | 'Cleanliness' | 'Timing' | 'General';

export interface MessFeedback {
  id: string;
  studentId: string;
  studentName: string;
  facility: string;
  category: MessFeedbackCategory;
  rating: number; // 1 to 5
  comment: string;
  submittedAt: string;
}

export type MealRecordStatus = 'TAKEN' | 'NOT_TAKEN' | 'EXCUSED';

export interface MealRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  mealType: MealType;
  status: MealRecordStatus;
  recordedBy?: string;
  timestamp: string;
}

export interface NoticeAudience {
  all?: boolean;
  roles?: UserRole[];
  departments?: string[];
  branches?: string[];
  years?: number[];
  semesters?: number[];
  studentCategories?: StudentCategory[];
  hostels?: string[];
}

export type NoticePriority = 'NORMAL' | 'IMPORTANT' | 'URGENT' | 'EMERGENCY';
export type NoticeStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';

export interface Notice {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: NoticePriority;
  publishDate: string;
  expiryDate?: string;
  targetAudience: NoticeAudience;
  requiresAcknowledgement: boolean;
  attachments?: AttachmentFile[];
  createdBy: string;
  createdByName: string;
  status: NoticeStatus;
  readCount?: number;
  acknowledgedCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface NoticeRead {
  id?: string;
  noticeId: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  userDepartment?: string;
  readAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'request' | 'complaint' | 'gate_pass' | 'notice' | 'system' | 'certificate' | 'attendance' | 'timetable' | 'poll' | 'lost_found' | 'calendar' | 'hostel' | 'mess' | 'emergency';
  entityId?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  title?: string;
  description: string;
  entityType: 'request' | 'complaint' | 'gate_pass' | 'notice' | 'certificate' | 'attendance' | 'timetable' | 'profile' | 'auth' | 'hostel' | 'mess' | string;
  entityId?: string;
  userName?: string;
  userRole?: UserRole;
  activityType?: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  previousValue?: string;
  newValue?: string;
  changes?: string;
  ipAddress?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  date: string;
  status: 'PRESENT' | 'ABSENT';
}

export interface AttendanceSubject {
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}

export interface TimetableEntry {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string;
  endTime: string;
  timeSlot: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  room: string;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  note?: string;
  department?: string;
  branch?: string;
  year?: number;
}

export interface Certificate {
  id: string;
  certificateId: string;
  requestId: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  department: string;
  branch: string;
  year?: number;
  semester?: number;
  certificateType: string;
  issueDate: string;
  issuedBy: string;
  issuedByRole: UserRole;
  purpose?: string;
  status: 'ACTIVE' | 'REVOKED';
  institutionName: string;
}

export interface MessMenu {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
  specialNotice?: string;
}

export interface ServiceDirectoryEntry {
  id: string;
  department: string;
  responsibleOffice: string;
  servicesProvided: string[];
  workingHours: string;
  location: string;
  contactEmail: string;
  contactPhone: string;
  instructions?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export type LostFoundStatus = 'OPEN' | 'CLAIM_PENDING' | 'CLAIMED' | 'CLOSED';

export interface LostFoundListing {
  id: string;
  type: 'LOST' | 'FOUND';
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  imageUrl?: string;
  contactInfo: string;
  status: LostFoundStatus;
  submittedBy: string;
  submittedByName: string;
  submittedByEmail?: string;
  claimedBy?: string;
  claimedByName?: string;
  moderatedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CalendarEventCategory = 'holiday' | 'examination' | 'event' | 'workshop' | 'deadline' | 'academic' | 'other';
export type CalendarEventStatus = 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | 'ARCHIVED';

export interface CampusCalendarEvent {
  id: string;
  title: string;
  category: CalendarEventCategory;
  startDate: string;
  endDate?: string;
  description: string;
  location?: string;
  organizer?: string;
  attachment?: AttachmentFile;
  targetAudience?: NoticeAudience;
  createdBy?: string;
  status?: CalendarEventStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampusPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface CampusPoll {
  id: string;
  title: string;
  question?: string;
  description: string;
  options: CampusPollOption[];
  votedUserIds: string[];
  userVotes?: Record<string, string[]>;
  allowMultiple?: boolean;
  startDate?: string;
  expiryDate: string;
  targetAudience?: NoticeAudience;
  status?: 'ACTIVE' | 'CLOSED';
  isActive: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface CampusFAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags?: string[];
  status?: 'ACTIVE' | 'ARCHIVED';
  updatedAt?: string;
  helpfulCount?: number;
}

export interface DegreeProgram {
  id: string;
  name: string;
  durationYears: number;
  branches: string[];
  createdAt?: string;
  updatedAt?: string;
}
