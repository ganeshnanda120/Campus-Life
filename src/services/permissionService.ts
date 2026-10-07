import type { UserPermission, UserRole, UserRecord, ScopedPermission, PermissionScopeType } from '../types';
import { BRANCH_ALIASES } from './degreeProgramService';

export interface PermissionDefinition {
  id: UserPermission;
  key: string;
  label: string;
  description: string;
  category: 'User Management' | 'Academics' | 'Requests & Approvals' | 'Grievances & Operations' | 'Administration & Reports';
  supportedActions: string[];
  defaultActions: string[];
  route?: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // User Management
  {
    id: 'MANAGE_STUDENTS',
    key: 'student_records',
    label: 'Student Records',
    description: 'Add, edit, deactivate, and view student profiles and academic categories.',
    category: 'User Management',
    supportedActions: ['view', 'add', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/admin/students',
  },
  {
    id: 'MANAGE_FACULTY',
    key: 'faculty_records',
    label: 'Faculty Records',
    description: 'Add, edit, and deactivate faculty members and academic assignments.',
    category: 'User Management',
    supportedActions: ['view', 'add', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/admin/faculty',
  },
  {
    id: 'MANAGE_STAFF',
    key: 'staff_records',
    label: 'Staff Records',
    description: 'Add, edit, and deactivate operational and maintenance staff records.',
    category: 'User Management',
    supportedActions: ['view', 'add', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/admin/staff',
  },
  {
    id: 'MANAGE_SUB_ADMINS',
    key: 'sub_admin_records',
    label: 'Manage Sub-Admins',
    description: 'Configure delegated sub-administrators and assign granular permissions.',
    category: 'User Management',
    supportedActions: ['view', 'add', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/admin/sub-admins',
  },

  // Academics
  {
    id: 'MANAGE_ATTENDANCE',
    key: 'attendance',
    label: 'Attendance',
    description: 'Record attendance percentages, view rosters, and monitor exam eligibility.',
    category: 'Academics',
    supportedActions: ['view', 'take_attendance', 'add', 'edit', 'export'],
    defaultActions: ['view'],
    route: '/attendance',
  },
  {
    id: 'MANAGE_TIMETABLE',
    key: 'courses',
    label: 'Courses & Timetable',
    description: 'Schedule daily lecture slots, assign classrooms, and manage student course enrolments.',
    category: 'Academics',
    supportedActions: ['view', 'add', 'edit', 'delete', 'assign_students', 'remove_students'],
    defaultActions: ['view'],
    route: '/timetable',
  },

  // Requests & Approvals
  {
    id: 'MANAGE_REQUESTS',
    key: 'requests',
    label: 'Student Requests',
    description: 'Review and update official student campus service requests.',
    category: 'Requests & Approvals',
    supportedActions: ['view', 'create', 'approve', 'reject'],
    defaultActions: ['view'],
    route: '/requests',
  },
  {
    id: 'APPROVE_REQUESTS',
    key: 'approve_requests',
    label: 'Approve Requests',
    description: 'Grant formal approval or rejection on formal student administrative requests.',
    category: 'Requests & Approvals',
    supportedActions: ['view', 'approve', 'reject'],
    defaultActions: ['view'],
    route: '/requests',
  },
  {
    id: 'MANAGE_CERTIFICATES',
    key: 'certificates',
    label: 'Certificates',
    description: 'Approve and issue bonafide, study, character, and fee certificates.',
    category: 'Requests & Approvals',
    supportedActions: ['view', 'create', 'approve', 'reject'],
    defaultActions: ['view'],
    route: '/requests',
  },

  // Grievances & Operations
  {
    id: 'MANAGE_COMPLAINTS',
    key: 'complaints',
    label: 'Complaints & Grievances',
    description: 'Review student grievances, assign supervisors, and monitor SLAs.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'create', 'assign', 'update', 'resolve', 'delete'],
    defaultActions: ['view'],
    route: '/complaints',
  },
  {
    id: 'ASSIGN_COMPLAINTS',
    key: 'assign_complaints',
    label: 'Assign Complaints',
    description: 'Delegate complaints to specific faculty, staff, or department supervisors.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'assign'],
    defaultActions: ['view'],
    route: '/complaints',
  },
  {
    id: 'RESPOND_TO_COMPLAINTS',
    key: 'respond_to_complaints',
    label: 'Respond to Complaints',
    description: 'Provide operational status updates and resolution notes on active complaints.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'update', 'resolve'],
    defaultActions: ['view'],
    route: '/complaints',
  },
  {
    id: 'MANAGE_GATE_PASS',
    key: 'gate_pass',
    label: 'Gate Pass Management',
    description: 'Review student egress applications and log gate pass activity.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'create', 'approve'],
    defaultActions: ['view'],
    route: '/gate-pass',
  },
  {
    id: 'APPROVE_GATE_PASS',
    key: 'approve_gate_pass',
    label: 'Approve Gate Pass',
    description: 'Grant official authorization for hostel and campus egress gate passes.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'approve'],
    defaultActions: ['view'],
    route: '/gate-pass',
  },
  {
    id: 'MANAGE_HOSTEL',
    key: 'hostel',
    label: 'Hostel Operations',
    description: 'Oversee block room allocations, curfew rules, and hostel amenities.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'add', 'edit'],
    defaultActions: ['view'],
    route: '/hostel',
  },
  {
    id: 'MANAGE_MESS',
    key: 'mess',
    label: 'Mess & Dining',
    description: 'Update daily dining menus and review student food and cleanliness feedback.',
    category: 'Grievances & Operations',
    supportedActions: ['view', 'add', 'edit'],
    defaultActions: ['view'],
    route: '/mess',
  },

  // Administration & Reports
  {
    id: 'MANAGE_NOTICES',
    key: 'notices',
    label: 'Notice Management',
    description: 'Publish targeted official announcements and track recipient acknowledgements.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'create', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/notices',
  },
  {
    id: 'MANAGE_NOTIFICATIONS',
    key: 'notifications',
    label: 'Campus Notifications',
    description: 'Dispatch urgent in-app broadcast alerts to students and staff.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'create'],
    defaultActions: ['view'],
    route: '/notifications',
  },
  {
    id: 'MANAGE_CALENDAR',
    key: 'calendar',
    label: 'Campus Calendar',
    description: 'Create and update university academic and event calendar entries.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'create', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/calendar',
  },
  {
    id: 'MANAGE_LOST_FOUND',
    key: 'lost_found',
    label: 'Lost & Found',
    description: 'Moderate items reported found or lost across campus facilities.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'create', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/lost-found',
  },
  {
    id: 'MANAGE_POLLS',
    key: 'polls',
    label: 'Campus Polls',
    description: 'Create institutional polls and survey campus opinions.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'create', 'edit', 'delete'],
    defaultActions: ['view'],
    route: '/polls',
  },
  {
    id: 'MANAGE_SERVICE_DIRECTORY',
    key: 'service_directory',
    label: 'Service Directory',
    description: 'Maintain emergency contacts, office numbers, and campus personnel directory.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'edit'],
    defaultActions: ['view'],
    route: '/service-directory',
  },
  {
    id: 'VIEW_ANALYTICS',
    key: 'analytics',
    label: 'Operational Analytics',
    description: 'Access resolution times, staff workloads, and SLA ageing telemetry.',
    category: 'Administration & Reports',
    supportedActions: ['view'],
    defaultActions: ['view'],
    route: '/admin/reports',
  },
  {
    id: 'VIEW_REPORTS',
    key: 'reports',
    label: 'Administrative Reports',
    description: 'Export structured operational and administrative reports.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'export'],
    defaultActions: ['view'],
    route: '/admin/reports',
  },
  {
    id: 'VIEW_AUDIT_LOGS',
    key: 'audit_logs',
    label: 'Audit Trail Logs',
    description: 'Inspect immutable forensic security logs and administrative action history.',
    category: 'Administration & Reports',
    supportedActions: ['view'],
    defaultActions: ['view'],
    route: '/admin/audit-logs',
  },
  {
    id: 'MANAGE_SETTINGS',
    key: 'settings',
    label: 'System Settings',
    description: 'Configure institutional parameters, working hours, and operational policies.',
    category: 'Administration & Reports',
    supportedActions: ['view', 'edit'],
    defaultActions: ['view'],
    route: '/help',
  },
  {
    id: 'CAN_GRANT_PERMISSIONS',
    key: 'grant_permissions',
    label: 'Can Grant Permissions',
    description: 'Delegate and grant scoped permissions to other eligible users within assigned branch scope.',
    category: 'Administration & Reports',
    supportedActions: ['grant', 'revoke', 'view'],
    defaultActions: ['grant'],
    route: '/admin/sub-admins',
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
 * Normalizes branch strings and aliases (e.g. CSE -> Computer Science & Engineering, etc.)
 */
export function normalizeBranchName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim();
  const lower = clean.toLowerCase();

  for (const [canonical, aliases] of Object.entries(BRANCH_ALIASES)) {
    if (canonical.toLowerCase() === lower || aliases.includes(lower)) {
      return canonical;
    }
  }
  return clean;
}

/**
 * Checks if two branch strings refer to the same branch
 */
export function areBranchesEqual(a?: string | null, b?: string | null): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const normA = normalizeBranchName(a).toLowerCase();
  const normB = normalizeBranchName(b).toLowerCase();
  return normA === normB;
}

/**
 * Resolves all assigned branches for a given user record.
 * Handles primary assignedBranches, degreeAssignments, specialSessionBranches, and legacy fields.
 */
export function getUserAssignedBranches(user: Partial<UserRecord> | null | undefined): string[] {
  if (!user) return [];

  const branchesSet = new Set<string>();

  // 1. Primary explicit assignedBranches field
  if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
    user.assignedBranches.forEach((b) => {
      if (b && typeof b === 'string' && b.trim()) {
        branchesSet.add(b.trim());
      }
    });
  }

  // 2. Academic degree assignments fallback
  if (Array.isArray(user.degreeAssignments) && user.degreeAssignments.length > 0) {
    user.degreeAssignments.forEach((a) => {
      if (a.branchName && a.branchName.trim() && a.branchName !== 'General') {
        branchesSet.add(a.branchName.trim());
      } else if (a.degreeName && a.degreeName.trim()) {
        branchesSet.add(a.degreeName.trim());
      }
    });
  }

  // 3. Special session branches fallback
  if (Array.isArray(user.specialSessionBranches)) {
    user.specialSessionBranches.forEach((b) => {
      if (b && typeof b === 'string' && b.trim()) {
        branchesSet.add(b.trim());
      }
    });
  }

  // 4. Legacy branch / degree fields
  if (user.branch && user.branch.trim()) {
    branchesSet.add(user.branch.trim());
  } else if (user.degree && user.degree.trim()) {
    branchesSet.add(user.degree.trim());
  }

  return Array.from(branchesSet);
}

/**
 * Checks if a user has a specific branch assigned to them
 */
export function doesUserHaveBranch(user: Partial<UserRecord> | null | undefined, branch: string): boolean {
  if (!user || !branch) return false;
  if (user.role === 'MAIN_ADMIN') return true;

  const assigned = getUserAssignedBranches(user);
  return assigned.some((b) => areBranchesEqual(b, branch));
}

/**
 * Finds permission definition by either its canonical key (e.g. 'student_records') or UserPermission ID ('MANAGE_STUDENTS').
 */
export function findPermissionDefinition(idOrKey: string): PermissionDefinition | undefined {
  const target = idOrKey.trim().toLowerCase();
  return ALL_PERMISSIONS.find(
    (p) =>
      p.id.toLowerCase() === target ||
      p.key.toLowerCase() === target ||
      p.id.replace(/_/g, '').toLowerCase() === target.replace(/_/g, '') ||
      p.key.replace(/_/g, '').toLowerCase() === target.replace(/_/g, '')
  );
}

/**
 * Resolves the effective scoped permissions for a user, automatically pruning
 * any branches that are no longer in the user's assigned branches.
 */
export function getEffectiveScopedPermissions(user: Partial<UserRecord> | null | undefined): ScopedPermission[] {
  if (!user || !user.isActive) return [];

  const assignedBranches = getUserAssignedBranches(user);

  // If the user has explicit scopedPermissions configured:
  if (Array.isArray(user.scopedPermissions) && user.scopedPermissions.length > 0) {
    return user.scopedPermissions
      .map((sp) => {
        const def = findPermissionDefinition(sp.permissionId);
        const permId = def ? def.key : sp.permissionId;
        const normActions = (sp.actions || []).map((a) => a.toLowerCase().trim());

        if (sp.scopeType === 'ALL_ASSIGNED_BRANCHES') {
          return {
            permissionId: permId,
            actions: normActions,
            scopeType: 'ALL_ASSIGNED_BRANCHES' as PermissionScopeType,
            branchIds: [...assignedBranches],
          };
        } else {
          // SELECTED_BRANCHES: Strictly filter against currently assigned branches!
          const validBranches = (sp.branchIds || []).filter((b) =>
            assignedBranches.some((ab) => areBranchesEqual(ab, b))
          );
          return {
            permissionId: permId,
            actions: normActions,
            scopeType: 'SELECTED_BRANCHES' as PermissionScopeType,
            branchIds: validBranches,
          };
        }
      })
      .filter((sp) => sp.scopeType === 'ALL_ASSIGNED_BRANCHES' || sp.branchIds.length > 0);
  }

  // Backward compatibility: If user only has legacy string permissions
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions
      .map((p) => {
        const def = findPermissionDefinition(p);
        if (!def) return null;
        return {
          permissionId: def.key,
          actions: def.supportedActions.map((a) => a.toLowerCase()),
          scopeType: 'ALL_ASSIGNED_BRANCHES' as PermissionScopeType,
          branchIds: [...assignedBranches],
        };
      })
      .filter((sp): sp is ScopedPermission => sp !== null);
  }

  return [];
}

/**
 * Core centralized permission checker.
 * Checks role, assigned branches, granted permission, actions, and branch scope.
 */
export function canPerformAction(
  user: Partial<UserRecord> | null | undefined,
  permissionIdOrKey: string,
  branchId?: string,
  action: string = 'view'
): boolean {
  if (!user || user.isActive === false) return false;

  // 1. MAIN_ADMIN has complete system control across all modules, branches, and actions
  if (user.role === 'MAIN_ADMIN') return true;

  // 2. STUDENTS do not possess administrative branch permissions
  if (user.role === 'STUDENT') return false;

  // 3. For SUB_ADMIN, FACULTY, STAFF: Must be assigned to branches
  const assignedBranches = getUserAssignedBranches(user);
  if (assignedBranches.length === 0) return false;

  // If a branch is specified, the user MUST be currently assigned to that branch
  if (branchId && !doesUserHaveBranch(user, branchId)) {
    return false;
  }

  const def = findPermissionDefinition(permissionIdOrKey);
  const targetKey = def ? def.key : permissionIdOrKey.toLowerCase().trim();
  const targetLegacyId = def ? def.id : undefined;
  const targetAction = action.toLowerCase().trim();

  const effectivePermissions = getEffectiveScopedPermissions(user);

  for (const perm of effectivePermissions) {
    const isKeyMatch =
      perm.permissionId.toLowerCase() === targetKey ||
      (targetLegacyId && perm.permissionId.toUpperCase() === targetLegacyId);

    if (!isKeyMatch) continue;

    // Check if the requested action is granted
    const hasAction = perm.actions.some((a) => {
      const aLower = a.toLowerCase();
      if (aLower === targetAction) return true;
      if (
        (targetAction === 'take_attendance' && aLower === 'add') ||
        (targetAction === 'add' && aLower === 'take_attendance')
      ) {
        return true;
      }
      if (
        (targetAction === 'edit_attendance' && aLower === 'edit') ||
        (targetAction === 'edit' && aLower === 'edit_attendance')
      ) {
        return true;
      }
      return false;
    });
    if (!hasAction) continue;

    // Check branch scope
    if (!branchId) {
      // If no branch was specified, permission is valid if it applies to at least one assigned branch
      if (perm.scopeType === 'ALL_ASSIGNED_BRANCHES' && assignedBranches.length > 0) return true;
      if (perm.scopeType === 'SELECTED_BRANCHES' && perm.branchIds.length > 0) return true;
    } else {
      if (perm.scopeType === 'ALL_ASSIGNED_BRANCHES') {
        if (doesUserHaveBranch(user, branchId)) return true;
      } else if (perm.scopeType === 'SELECTED_BRANCHES') {
        const coversBranch = perm.branchIds.some((b) => areBranchesEqual(b, branchId));
        if (coversBranch && doesUserHaveBranch(user, branchId)) return true;
      }
    }
  }

  return false;
}

/**
 * Returns all branch names where this user is authorized to perform the specified action on the permission.
 */
export function getAccessibleBranches(
  user: Partial<UserRecord> | null | undefined,
  permissionIdOrKey: string,
  action: string = 'view',
  allUniversityBranches: string[] = []
): string[] {
  if (!user || user.isActive === false) return [];

  // MAIN_ADMIN has access to all branches in the university
  if (user.role === 'MAIN_ADMIN') {
    return allUniversityBranches.length > 0 ? allUniversityBranches : getUserAssignedBranches(user);
  }

  const assigned = getUserAssignedBranches(user);
  return assigned.filter((branch) => canPerformAction(user, permissionIdOrKey, branch, action));
}

/**
 * Returns a dictionary of branch -> authorized modules for this user to render their dashboard.
 * Branches with no active modules are omitted.
 */
export function getAuthorizedBranchModules(
  user: Partial<UserRecord> | null | undefined
): Record<string, { definition: PermissionDefinition; actions: string[] }[]> {
  if (!user || user.isActive === false) return {};

  const assigned = getUserAssignedBranches(user);
  const result: Record<string, { definition: PermissionDefinition; actions: string[] }[]> = {};

  for (const branch of assigned) {
    const modulesForBranch: { definition: PermissionDefinition; actions: string[] }[] = [];

    for (const def of ALL_PERMISSIONS) {
      const allowedActions: string[] = [];

      for (const act of def.supportedActions) {
        if (canPerformAction(user, def.key, branch, act)) {
          allowedActions.push(act);
        }
      }

      if (allowedActions.length > 0) {
        modulesForBranch.push({
          definition: def,
          actions: allowedActions,
        });
      }
    }

    if (modulesForBranch.length > 0) {
      result[branch] = modulesForBranch;
    }
  }

  return result;
}

/**
 * Delegation restriction checker:
 * A user who has "CAN_GRANT_PERMISSIONS" must NEVER be able to grant more access than they themselves possess.
 * Delegated Permission Scope must be a strict subset of Grantor's Permission Scope.
 */
export function canUserDelegatePermission(
  grantor: Partial<UserRecord> | null | undefined,
  targetBranchIdOrScopedPerm: string | ScopedPermission,
  permissionIdOrKey?: string,
  actionsToGrant?: string[]
): { allowed: boolean; reason?: string } {
  if (!grantor || grantor.isActive === false) {
    return { allowed: false, reason: 'Grantor is not active or authenticated.' };
  }

  // MAIN_ADMIN has complete delegation rights
  if (grantor.role === 'MAIN_ADMIN') {
    return { allowed: true };
  }

  // Support case where 2nd argument is a ScopedPermission object
  if (typeof targetBranchIdOrScopedPerm === 'object' && targetBranchIdOrScopedPerm !== null) {
    const perm = targetBranchIdOrScopedPerm as ScopedPermission;
    const branchesToCheck =
      perm.scopeType === 'ALL_ASSIGNED_BRANCHES'
        ? getUserAssignedBranches(grantor)
        : perm.branchIds || [];

    if (branchesToCheck.length === 0) {
      return { allowed: false, reason: 'No valid branches specified for delegation check.' };
    }

    for (const b of branchesToCheck) {
      const res = canUserDelegatePermission(grantor, b, perm.permissionId, perm.actions);
      if (!res.allowed) return res;
    }
    return { allowed: true };
  }

  const targetBranchId = targetBranchIdOrScopedPerm as string;
  const actions = actionsToGrant || ['view'];
  const permKeyToCheck = permissionIdOrKey || '';

  // Check if grantor has CAN_GRANT_PERMISSIONS on targetBranchId
  const hasDelegationPerm =
    canPerformAction(grantor, 'grant_permissions', targetBranchId, 'grant') ||
    canPerformAction(grantor, 'CAN_GRANT_PERMISSIONS', targetBranchId, 'grant') ||
    canPerformAction(grantor, 'grant_permissions', targetBranchId, 'view') ||
    canPerformAction(grantor, 'CAN_GRANT_PERMISSIONS', targetBranchId, 'view');

  if (!hasDelegationPerm) {
    return {
      allowed: false,
      reason: `You do not have 'Can Grant Permissions' authorization for branch "${targetBranchId}".`,
    };
  }

  // For every action requested, grantor must possess that action in targetBranchId
  const def = findPermissionDefinition(permKeyToCheck);
  const permKey = def ? def.key : permKeyToCheck;

  for (const action of actions) {
    const grantorHasAction = canPerformAction(grantor, permKey, targetBranchId, action);
    if (!grantorHasAction) {
      return {
        allowed: false,
        reason: `Delegation violation: You do not possess the "${action}" action on "${def?.label || permKey}" in "${targetBranchId}". You cannot grant more access than you possess.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Backwards-compatible permission checker function.
 * Supports legacy signature (role, permissions, required)
 * and rich signature (user, permissionKey, branchId, action).
 */
export function hasPermission(
  roleOrUser: UserRole | Partial<UserRecord> | null | undefined,
  permissionsOrKey?: UserPermission[] | string | null,
  requiredOrBranch?: UserPermission | string,
  maybeAction?: string
): boolean {
  if (!roleOrUser) return false;

  // Rich UserRecord signature:
  if (typeof roleOrUser === 'object' && 'role' in roleOrUser) {
    const user = roleOrUser as Partial<UserRecord>;
    const permKey = typeof permissionsOrKey === 'string' ? permissionsOrKey : '';
    const branch = typeof requiredOrBranch === 'string' ? requiredOrBranch : undefined;
    const action = maybeAction || 'view';
    return canPerformAction(user, permKey, branch, action);
  }

  // Legacy role & permissions array signature:
  const role = roleOrUser as UserRole;
  const permissions = Array.isArray(permissionsOrKey) ? permissionsOrKey : [];
  const required = requiredOrBranch as UserPermission;

  if (role === 'MAIN_ADMIN') return true;
  if ((role === 'SUB_ADMIN' || role === 'FACULTY' || role === 'STAFF') && Array.isArray(permissions)) {
    return permissions.includes(required);
  }
  return false;
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: UserPermission[] | null | undefined,
  requiredList: UserPermission[]
): boolean {
  if (!role) return false;
  if (role === 'MAIN_ADMIN') return true;
  return requiredList.some((p) => hasPermission(role, permissions, p));
}
