import type { UserPermission, UserRole } from '../types';

export interface PermissionDefinition {
  id: UserPermission;
  label: string;
  description: string;
  category: 'User Management' | 'Academics' | 'Requests & Approvals' | 'Grievances & Operations' | 'Administration & Reports';
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // User Management
  {
    id: 'MANAGE_STUDENTS',
    label: 'Manage Students',
    description: 'Add, edit, deactivate, and view student profiles and academic categories.',
    category: 'User Management',
  },
  {
    id: 'MANAGE_FACULTY',
    label: 'Manage Faculty',
    description: 'Add, edit, and deactivate faculty members and academic assignments.',
    category: 'User Management',
  },
  {
    id: 'MANAGE_STAFF',
    label: 'Manage Staff',
    description: 'Add, edit, and deactivate operational and maintenance staff records.',
    category: 'User Management',
  },
  {
    id: 'MANAGE_SUB_ADMINS',
    label: 'Manage Sub-Admins',
    description: 'Configure delegated sub-administrators and assign granular permissions.',
    category: 'User Management',
  },

  // Academics
  {
    id: 'MANAGE_ATTENDANCE',
    label: 'Manage Attendance',
    description: 'Record attendance percentages and monitor statutory examination eligibility.',
    category: 'Academics',
  },
  {
    id: 'MANAGE_TIMETABLE',
    label: 'Manage Timetable',
    description: 'Schedule daily lecture slots, assign classrooms, and post cancellation notices.',
    category: 'Academics',
  },

  // Requests & Approvals
  {
    id: 'MANAGE_REQUESTS',
    label: 'Manage Requests',
    description: 'Review and update official student campus service requests.',
    category: 'Requests & Approvals',
  },
  {
    id: 'APPROVE_REQUESTS',
    label: 'Approve Requests',
    description: 'Grant formal approval or rejection on formal student administrative requests.',
    category: 'Requests & Approvals',
  },
  {
    id: 'MANAGE_CERTIFICATES',
    label: 'Manage Certificates',
    description: 'Approve and issue bonafide, study, character, and fee certificates.',
    category: 'Requests & Approvals',
  },

  // Grievances & Operations
  {
    id: 'MANAGE_COMPLAINTS',
    label: 'Manage Complaints & SLA',
    description: 'Review student grievances, track ageing thresholds, and monitor SLAs.',
    category: 'Grievances & Operations',
  },
  {
    id: 'ASSIGN_COMPLAINTS',
    label: 'Assign Complaints',
    description: 'Delegate complaints to specific faculty, staff, or department supervisors.',
    category: 'Grievances & Operations',
  },
  {
    id: 'RESPOND_TO_COMPLAINTS',
    label: 'Respond to Complaints',
    description: 'Provide operational status updates and resolution notes on active complaints.',
    category: 'Grievances & Operations',
  },
  {
    id: 'MANAGE_GATE_PASS',
    label: 'Manage Gate Passes',
    description: 'Review student egress applications and log gate pass activity.',
    category: 'Grievances & Operations',
  },
  {
    id: 'APPROVE_GATE_PASS',
    label: 'Approve Gate Passes',
    description: 'Grant official authorization for hostel and campus egress gate passes.',
    category: 'Grievances & Operations',
  },
  {
    id: 'MANAGE_HOSTEL',
    label: 'Manage Hostel Operations',
    description: 'Oversee block room allocations, curfew rules, and hostel amenities.',
    category: 'Grievances & Operations',
  },
  {
    id: 'MANAGE_MESS',
    label: 'Manage Mess & Dining',
    description: 'Update daily dining menus and review student food and cleanliness feedback.',
    category: 'Grievances & Operations',
  },

  // Administration & Reports
  {
    id: 'MANAGE_NOTICES',
    label: 'Manage Notices',
    description: 'Publish targeted official announcements and track recipient acknowledgements.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_NOTIFICATIONS',
    label: 'Manage Notifications',
    description: 'Dispatch urgent in-app broadcast alerts to students and staff.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_CALENDAR',
    label: 'Manage Campus Calendar',
    description: 'Create and update university academic and event calendar entries.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_LOST_FOUND',
    label: 'Manage Lost & Found',
    description: 'Moderate items reported found or lost across campus facilities.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_POLLS',
    label: 'Manage Campus Polls',
    description: 'Create institutional polls and survey campus opinions.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_SERVICE_DIRECTORY',
    label: 'Manage Service Directory',
    description: 'Maintain emergency contacts, office numbers, and campus personnel directory.',
    category: 'Administration & Reports',
  },
  {
    id: 'VIEW_ANALYTICS',
    label: 'View Operational Analytics',
    description: 'Access resolution times, staff workloads, and SLA ageing telemetry.',
    category: 'Administration & Reports',
  },
  {
    id: 'VIEW_REPORTS',
    label: 'View Reports',
    description: 'Export structured operational and administrative reports.',
    category: 'Administration & Reports',
  },
  {
    id: 'VIEW_AUDIT_LOGS',
    label: 'View Audit Logs',
    description: 'Inspect immutable forensic security logs and administrative action history.',
    category: 'Administration & Reports',
  },
  {
    id: 'MANAGE_SETTINGS',
    label: 'Manage System Settings',
    description: 'Configure institutional parameters, working hours, and operational policies.',
    category: 'Administration & Reports',
  },
];

export const PERMISSION_CATEGORIES = [
  'User Management',
  'Academics',
  'Requests & Approvals',
  'Grievances & Operations',
  'Administration & Reports',
] as const;

export function getPermissionsByCategory(): Record<string, PermissionDefinition[]> {
  const grouped: Record<string, PermissionDefinition[]> = {};
  for (const cat of PERMISSION_CATEGORIES) {
    grouped[cat] = ALL_PERMISSIONS.filter((p) => p.category === cat);
  }
  return grouped;
}

/**
 * Deterministic permission checker:
 * - MAIN_ADMIN has complete access across all modules.
 * - SUB_ADMIN has access only if the specific permission is granted.
 * - Other roles do not have administrative access.
 */
export function hasPermission(
  role: UserRole | null | undefined,
  permissions: UserPermission[] | null | undefined,
  required: UserPermission
): boolean {
  if (role === 'MAIN_ADMIN') return true;
  if (role === 'SUB_ADMIN' && permissions) {
    return permissions.includes(required);
  }
  return false;
}
