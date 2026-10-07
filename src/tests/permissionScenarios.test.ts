/**
 * Automated Verification of Section 33 Scenarios
 * Tests branch-scoped permissions, action-level checks, delegation limits, and dynamic dashboard modules.
 */

import type { UserRecord } from '../types';
import {
  canPerformAction,
  getAccessibleBranches,
  canUserDelegatePermission,
  getAuthorizedBranchModules,
} from '../services/permissionService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeUser(partial: Partial<UserRecord> & { uid: string; name: string; role: UserRecord['role'] }): UserRecord {
  return {
    email: `${partial.uid}@campus.edu`,
    isActive: true,
    isActivated: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

console.log('Running Section 33 Verification Scenarios...\n');

// -----------------------------------------------------------------------------
// TEST 1:
// User: Faculty
// Assigned: BCA + B.Tech
// Permission: Student Records -> View
// Scope: All Assigned Branches
// Expected: Student Records View available for BCA and B.Tech.
// -----------------------------------------------------------------------------
console.log('TEST 1: Faculty assigned BCA + B.Tech, Student Records View on ALL_ASSIGNED_BRANCHES');
const test1User = makeUser({
  uid: 'fac-1',
  name: 'Faculty One',
  role: 'FACULTY',
  assignedBranches: ['BCA', 'B.Tech'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view'],
      scopeType: 'ALL_ASSIGNED_BRANCHES',
      branchIds: [],
    },
  ],
});

assert(
  canPerformAction(test1User, 'MANAGE_STUDENTS', 'BCA', 'view') === true,
  'Student Records View is allowed for BCA'
);
assert(
  canPerformAction(test1User, 'MANAGE_STUDENTS', 'B.Tech', 'view') === true,
  'Student Records View is allowed for B.Tech'
);
assert(
  canPerformAction(test1User, 'MANAGE_STUDENTS', 'BCA', 'edit') === false,
  'Student Records Edit is denied for BCA (only view granted)'
);
assert(
  canPerformAction(test1User, 'MANAGE_STUDENTS', 'MCA', 'view') === false,
  'Student Records View is denied for unassigned branch MCA'
);

// -----------------------------------------------------------------------------
// TEST 2:
// User: Faculty
// Assigned: BCA + B.Tech
// Permission: Student Records -> View + Edit
// Scope: BCA only
// Expected: BCA -> View + Edit, B.Tech -> No Student Records access
// -----------------------------------------------------------------------------
console.log('\nTEST 2: Faculty assigned BCA + B.Tech, Student Records View + Edit on BCA only');
const test2User = makeUser({
  uid: 'fac-2',
  name: 'Faculty Two',
  role: 'FACULTY',
  assignedBranches: ['BCA', 'B.Tech'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view', 'edit'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
  ],
});

assert(
  canPerformAction(test2User, 'MANAGE_STUDENTS', 'BCA', 'view') === true,
  'BCA -> View is allowed'
);
assert(
  canPerformAction(test2User, 'MANAGE_STUDENTS', 'BCA', 'edit') === true,
  'BCA -> Edit is allowed'
);
assert(
  canPerformAction(test2User, 'MANAGE_STUDENTS', 'BCA', 'delete') === false,
  'BCA -> Delete is denied'
);
assert(
  canPerformAction(test2User, 'MANAGE_STUDENTS', 'B.Tech', 'view') === false,
  'B.Tech -> View is denied (not in scope)'
);
assert(
  canPerformAction(test2User, 'MANAGE_STUDENTS', 'B.Tech', 'edit') === false,
  'B.Tech -> Edit is denied'
);

// -----------------------------------------------------------------------------
// TEST 3:
// User: Staff
// Assigned: BCA + B.Tech + MCA
// Permission: Attendance -> View
// Scope: BCA + MCA
// Expected: BCA -> Attendance View, MCA -> Attendance View, B.Tech -> No Attendance
// -----------------------------------------------------------------------------
console.log('\nTEST 3: Staff assigned BCA + B.Tech + MCA, Attendance View on BCA + MCA');
const test3User = makeUser({
  uid: 'staff-1',
  name: 'Staff One',
  role: 'STAFF',
  assignedBranches: ['BCA', 'B.Tech', 'MCA'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_ATTENDANCE',
      actions: ['view'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA', 'MCA'],
    },
  ],
});

assert(
  canPerformAction(test3User, 'MANAGE_ATTENDANCE', 'BCA', 'view') === true,
  'BCA -> Attendance View is allowed'
);
assert(
  canPerformAction(test3User, 'MANAGE_ATTENDANCE', 'MCA', 'view') === true,
  'MCA -> Attendance View is allowed'
);
assert(
  canPerformAction(test3User, 'MANAGE_ATTENDANCE', 'B.Tech', 'view') === false,
  'B.Tech -> Attendance View is denied'
);

// -----------------------------------------------------------------------------
// TEST 4:
// User: Sub Admin
// Assigned: BCA + B.Tech
// Permission: Can Grant Permissions
// Scope: BCA only
// Expected: Can grant permissions only for BCA. Cannot grant B.Tech permissions.
// -----------------------------------------------------------------------------
console.log('\nTEST 4: Sub Admin assigned BCA + B.Tech, Can Grant Permissions on BCA only');
const test4User = makeUser({
  uid: 'subadmin-1',
  name: 'Sub Admin One',
  role: 'SUB_ADMIN',
  assignedBranches: ['BCA', 'B.Tech'],
  scopedPermissions: [
    {
      permissionId: 'CAN_GRANT_PERMISSIONS',
      actions: ['grant', 'revoke'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
  ],
});

assert(
  canPerformAction(test4User, 'CAN_GRANT_PERMISSIONS', 'BCA', 'grant') === true,
  'Can grant permissions in BCA'
);
assert(
  canPerformAction(test4User, 'CAN_GRANT_PERMISSIONS', 'B.Tech', 'grant') === false,
  'Cannot grant permissions in B.Tech'
);

// -----------------------------------------------------------------------------
// TEST 5:
// User: Faculty
// Assigned: BCA + B.Tech
// Permissions:
// BCA -> Student Records View + Edit
// B.Tech -> Student Records View
// Can Grant Permissions: BCA only
// Expected:
// Can delegate BCA Student Records View/Edit.
// Cannot delegate B.Tech.
// Cannot delegate Delete because Delete was not granted.
// -----------------------------------------------------------------------------
console.log('\nTEST 5: Faculty delegation limit enforcement');
const test5User = makeUser({
  uid: 'fac-5',
  name: 'Faculty Rahul',
  role: 'FACULTY',
  assignedBranches: ['BCA', 'B.Tech'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view', 'edit'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['B.Tech'],
    },
    {
      permissionId: 'CAN_GRANT_PERMISSIONS',
      actions: ['grant'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
  ],
});

const delegateBCAViewEdit = canUserDelegatePermission(
  test5User,
  'BCA',
  'MANAGE_STUDENTS',
  ['view', 'edit']
);
assert(delegateBCAViewEdit.allowed === true, 'Can delegate BCA Student Records View/Edit');

const delegateBTechView = canUserDelegatePermission(
  test5User,
  'B.Tech',
  'MANAGE_STUDENTS',
  ['view']
);
assert(
  delegateBTechView.allowed === false,
  'Cannot delegate B.Tech (grant delegation permission only covers BCA)'
);

const delegateBCADelete = canUserDelegatePermission(
  test5User,
  'BCA',
  'MANAGE_STUDENTS',
  ['view', 'delete']
);
assert(
  delegateBCADelete.allowed === false,
  'Cannot delegate Delete on BCA because user does not have Delete himself'
);

// -----------------------------------------------------------------------------
// TEST 6:
// Admin removes B.Tech assignment.
// Before: BCA + B.Tech
// After: BCA
// Expected: B.Tech dashboard/data immediately disappears.
// -----------------------------------------------------------------------------
console.log('\nTEST 6: Removing branch assignment immediately invalidates permissions');
const test6UserBefore = makeUser({
  uid: 'user-6',
  name: 'User Six',
  role: 'FACULTY',
  assignedBranches: ['BCA', 'B.Tech'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view'],
      scopeType: 'ALL_ASSIGNED_BRANCHES',
      branchIds: [],
    },
  ],
});

assert(
  canPerformAction(test6UserBefore, 'MANAGE_STUDENTS', 'B.Tech', 'view') === true,
  'Before: B.Tech View is active'
);

// Admin updates assignedBranches to BCA only
const test6UserAfter: UserRecord = {
  ...test6UserBefore,
  assignedBranches: ['BCA'],
};

assert(
  canPerformAction(test6UserAfter, 'MANAGE_STUDENTS', 'B.Tech', 'view') === false,
  'After: B.Tech View is immediately false'
);
assert(
  canPerformAction(test6UserAfter, 'MANAGE_STUDENTS', 'BCA', 'view') === true,
  'After: BCA View remains active'
);
const activeBranchesAfter = getAccessibleBranches(test6UserAfter, 'MANAGE_STUDENTS', 'view');
assert(
  activeBranchesAfter.includes('B.Tech') === false,
  'Accessible branches list does not include B.Tech'
);

// -----------------------------------------------------------------------------
// TEST 7:
// Admin grants BCA -> Attendance -> View
// Expected: Attendance appears on the user dashboard
// -----------------------------------------------------------------------------
console.log('\nTEST 7: Admin grants BCA -> Attendance -> View');
const test7UserBefore = makeUser({
  uid: 'user-7',
  name: 'User Seven',
  role: 'FACULTY',
  assignedBranches: ['BCA'],
  scopedPermissions: [],
});

const modulesBefore = getAuthorizedBranchModules(test7UserBefore);
assert(
  Object.keys(modulesBefore).length === 0,
  'Before grant: No modules on dashboard (empty branch section hidden)'
);

const test7UserAfter: UserRecord = {
  ...test7UserBefore,
  scopedPermissions: [
    {
      permissionId: 'MANAGE_ATTENDANCE',
      actions: ['view'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
  ],
};

const modulesAfter = getAuthorizedBranchModules(test7UserAfter);
assert(Object.keys(modulesAfter).length === 1, 'After grant: Exactly 1 branch section visible');
assert(Boolean(modulesAfter['BCA']), 'Branch section is BCA');
assert(
  modulesAfter['BCA'].some((m) => m.definition.id === 'MANAGE_ATTENDANCE'),
  'Attendance module appears on BCA section'
);

// -----------------------------------------------------------------------------
// TEST 8:
// Admin revokes BCA -> Attendance -> View
// Expected: Attendance disappears immediately
// -----------------------------------------------------------------------------
console.log('\nTEST 8: Admin revokes BCA -> Attendance -> View');
const test8UserRevoked: UserRecord = {
  ...test7UserAfter,
  scopedPermissions: [],
};

const modulesRevoked = getAuthorizedBranchModules(test8UserRevoked);
assert(
  Object.keys(modulesRevoked).length === 0,
  'After revoke: Attendance module disappears immediately and branch section is hidden'
);
assert(
  canPerformAction(test8UserRevoked, 'MANAGE_ATTENDANCE', 'BCA', 'view') === false,
  'canPerformAction returns false after revocation'
);

// -----------------------------------------------------------------------------
// TEST 9:
// User manually changes URL to an unauthorized branch:
// /students?branch=btech
// Expected: Access denied.
// -----------------------------------------------------------------------------
console.log('\nTEST 9: Manual URL change to unauthorized branch');
const test9User = makeUser({
  uid: 'user-9',
  name: 'User Nine',
  role: 'FACULTY',
  assignedBranches: ['BCA'],
  scopedPermissions: [
    {
      permissionId: 'MANAGE_STUDENTS',
      actions: ['view'],
      scopeType: 'SELECTED_BRANCHES',
      branchIds: ['BCA'],
    },
  ],
});

// User attempts to query ?branch=btech
const urlRequestedBranch = 'btech';
const isAllowedUrlAccess = canPerformAction(
  test9User,
  'MANAGE_STUDENTS',
  urlRequestedBranch,
  'view'
);
assert(
  isAllowedUrlAccess === false,
  'Manual URL query ?branch=btech is rejected fail-closed with access denied'
);

// -----------------------------------------------------------------------------
// TEST 10:
// User attempts unauthorized operation (e.g. Delete when not granted)
// -----------------------------------------------------------------------------
console.log('\nTEST 10: Action-level security prevents unauthorized operations');
const isAllowedDelete = canPerformAction(
  test9User,
  'MANAGE_STUDENTS',
  'BCA',
  'delete'
);
assert(
  isAllowedDelete === false,
  'Unauthorized Delete action is rejected fail-closed'
);

console.log('\n======================================================');
console.log('ALL SECTION 33 SCENARIOS PASSED SUCCESSFULLY (10/10)!');
console.log('======================================================\n');
