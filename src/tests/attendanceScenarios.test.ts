declare const process: any;

import {
  canPerformAction,
  canUserDelegatePermission,
} from '../services/permissionService';
import { academicHierarchyService } from '../services/academicHierarchyService';
import { attendanceService } from '../services/attendanceService';
import type { UserRecord, ScopedPermission } from '../types';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    testsFailed++;
  }
}

const makeUser = (data: Partial<UserRecord>): UserRecord =>
  ({
    isActivated: true,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isActive: true,
    ...data,
  } as UserRecord);

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING SECTION 53 SCENARIO TESTS (17 TESTS)');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Faculty assigned BCA + B.Tech, Attendance permission on both
  // Expected: Can take attendance for both BCA and B.Tech
  // -------------------------------------------------------------------------
  console.log('TEST 1: Faculty assigned BCA + B.Tech with Attendance on both');
  const user1 = makeUser({
    uid: 'u_rahul_1',
    email: 'rahul1@campus.edu',
    name: 'Rahul Sharma',
    role: 'FACULTY',
    assignedBranches: ['BCA', 'B.Tech'],
    scopedPermissions: [
      {
        permissionId: 'manage_attendance',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA', 'B.Tech'],
        actions: ['view', 'take_attendance'],
      },
    ],
  });

  const branches1 = academicHierarchyService.getTakeAttendanceBranches(user1);
  assert(
    branches1.includes('BCA') && branches1.includes('B.Tech'),
    'TEST 1: Faculty can take attendance for both BCA and B.Tech',
    `Got branches: ${JSON.stringify(branches1)}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Faculty assigned BCA + B.Tech, Attendance permission on BCA only
  // Expected: Only BCA appears in Take Attendance. B.Tech does not appear.
  // -------------------------------------------------------------------------
  console.log('\nTEST 2: Faculty assigned BCA + B.Tech with Attendance on BCA only');
  const user2 = makeUser({
    ...user1,
    uid: 'u_rahul_2',
    scopedPermissions: [
      {
        permissionId: 'manage_attendance',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA'],
        actions: ['view', 'take_attendance'],
      },
    ],
  });

  const branches2 = academicHierarchyService.getTakeAttendanceBranches(user2);
  assert(
    branches2.includes('BCA') && !branches2.includes('B.Tech'),
    'TEST 2: Only BCA appears in Take Attendance; B.Tech does not appear',
    `Got branches: ${JSON.stringify(branches2)}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: B.Tech selected, Department: CSE
  // Expected: Only CSE students appear. Mechanical/Civil/etc. must not appear.
  // -------------------------------------------------------------------------
  console.log('\nTEST 3: Department filtering under B.Tech');
  const sampleStudents: UserRecord[] = [
    makeUser({
      uid: 'stu_cse_1',
      studentId: 'STU_CSE_01',
      email: 'cse1@campus.edu',
      name: 'CSE Student 1',
      role: 'STUDENT',
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
    }),
    makeUser({
      uid: 'stu_me_1',
      studentId: 'STU_ME_01',
      email: 'me1@campus.edu',
      name: 'Mech Student 1',
      role: 'STUDENT',
      branch: 'B.Tech',
      department: 'Mechanical Engineering',
      degree: 'B.Tech ME',
      semester: 3,
      section: 'A',
    }),
    makeUser({
      uid: 'stu_ce_1',
      studentId: 'STU_CE_01',
      email: 'ce1@campus.edu',
      name: 'Civil Student 1',
      role: 'STUDENT',
      branch: 'B.Tech',
      department: 'Civil Engineering',
      degree: 'B.Tech CE',
      semester: 3,
      section: 'A',
    }),
  ];

  const cseFiltered = academicHierarchyService.filterStudentsByAcademicHierarchy(
    sampleStudents,
    {
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
    }
  );
  assert(
    cseFiltered.length === 1 && cseFiltered[0].studentId === 'STU_CSE_01',
    'TEST 3: Only CSE students appear; Mechanical and Civil are excluded',
    `Returned ${cseFiltered.length} students`
  );

  // -------------------------------------------------------------------------
  // TEST 4: BCA selected
  // Expected: BCA students only. No B.Tech students.
  // -------------------------------------------------------------------------
  console.log('\nTEST 4: BCA branch filtering');
  const bcaStudent = makeUser({
    uid: 'stu_bca_1',
    studentId: 'STU_BCA_01',
    email: 'bca1@campus.edu',
    name: 'BCA Student 1',
    role: 'STUDENT',
    branch: 'BCA',
    department: 'Computer Applications',
    degree: 'BCA',
    semester: 3,
    section: 'A',
  });

  const mixedStudents = [...sampleStudents, bcaStudent];
  const bcaFiltered = academicHierarchyService.filterStudentsByAcademicHierarchy(
    mixedStudents,
    {
      branch: 'BCA',
    }
  );
  assert(
    bcaFiltered.length === 1 && bcaFiltered[0].branch === 'BCA',
    'TEST 4: Only BCA students appear; No B.Tech students appear',
    `Returned: ${JSON.stringify(bcaFiltered.map((s) => s.branch))}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Cascade hierarchy selection:
  // B.Tech -> CSE -> B.Tech CSE -> 3rd Sem -> Sec A -> DBMS
  // Expected: Only Section A B.Tech CSE students appear.
  // -------------------------------------------------------------------------
  console.log('\nTEST 5: Full academic cascade hierarchy filtering');
  const secBStudent = makeUser({
    uid: 'stu_cse_secb',
    studentId: 'STU_CSE_SECB',
    email: 'cse_b@campus.edu',
    name: 'CSE Section B Student',
    role: 'STUDENT',
    branch: 'B.Tech',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech CSE',
    semester: 3,
    section: 'B',
  });
  const sem5Student = makeUser({
    uid: 'stu_cse_sem5',
    studentId: 'STU_CSE_SEM5',
    email: 'cse5@campus.edu',
    name: 'CSE Sem 5 Student',
    role: 'STUDENT',
    branch: 'B.Tech',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech CSE',
    semester: 5,
    section: 'A',
  });

  const cascadeList = [...mixedStudents, secBStudent, sem5Student];
  const exactClassFiltered = academicHierarchyService.filterStudentsByAcademicHierarchy(
    cascadeList,
    {
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
    }
  );
  assert(
    exactClassFiltered.length === 1 && exactClassFiltered[0].studentId === 'STU_CSE_01',
    'TEST 5: Only Section A B.Tech CSE 3rd Semester students appear',
    `Returned IDs: ${JSON.stringify(exactClassFiltered.map((s) => s.studentId))}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Submit attendance. Attendance saved and student dashboard updates.
  // -------------------------------------------------------------------------
  console.log('\nTEST 6: Submit attendance session and calculate update');
  const sessionResult = await attendanceService.submitAttendanceSession({
    branch: 'B.Tech',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech CSE',
    semester: 3,
    section: 'A',
    subjectCode: 'CS301',
    subjectName: 'Database Management Systems',
    period: 'Period 1 (09:00 - 10:00)',
    date: '2026-10-10',
    studentRoster: [
      { studentId: 'STU_TEST_01', studentName: 'Student Test 01', status: 'PRESENT' },
      { studentId: 'STU_TEST_02', studentName: 'Student Test 02', status: 'ABSENT' },
    ],
    actor: { uid: user1.uid, name: user1.name, role: user1.role },
  });

  assert(
    sessionResult.success && sessionResult.session !== undefined,
    'TEST 6: Attendance session submitted and saved',
    sessionResult.error
  );

  const studentAtt1 = await attendanceService.getStudentAttendance('STU_TEST_01');
  assert(
    studentAtt1.attendedClasses === 1 && studentAtt1.totalClasses === 1 && studentAtt1.overallPercentage === 100,
    'TEST 6b: Student 1 attendance reflects session update in real-time (1/1 = 100%)'
  );

  // -------------------------------------------------------------------------
  // TEST 7: Attendance exists for B.Tech CSE 3rd Sem Sec A DBMS Period 1 10 October.
  // Another user tries to take the same attendance.
  // Expected: Duplicate detected (shows popup in UI).
  // -------------------------------------------------------------------------
  console.log('\nTEST 7: Duplicate session check on identical academic coordinates');
  const duplicateFound = await attendanceService.checkDuplicateSession({
    branch: 'B.Tech',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech CSE',
    semester: 3,
    section: 'A',
    subjectCode: 'CS301',
    date: '2026-10-10',
    period: 'Period 1 (09:00 - 10:00)',
  });
  assert(
    duplicateFound !== null && duplicateFound.subjectCode === 'CS301',
    'TEST 7: Duplicate session correctly detected for same date/period/class',
    `Found session: ${duplicateFound?.id}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Another user wants to take:
  // B.Tech CSE 3rd Sem Sec A Operating Systems Period 2 (or same day different class)
  // Expected: Allowed because it is a different attendance session.
  // -------------------------------------------------------------------------
  console.log('\nTEST 8: Different class or period on same day is NOT duplicate');
  const differentClassDuplicate = await attendanceService.checkDuplicateSession({
    branch: 'B.Tech',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech CSE',
    semester: 3,
    section: 'A',
    subjectCode: 'CS302', // Operating Systems
    date: '2026-10-10',
    period: 'Period 2 (10:00 - 11:00)',
  });
  assert(
    differentClassDuplicate === null,
    'TEST 8: Operating Systems Period 2 is allowed as a distinct attendance session'
  );

  // -------------------------------------------------------------------------
  // TEST 9: DBMS: 4 conducted, 3 present -> Expected: DBMS = 75%
  // -------------------------------------------------------------------------
  console.log('\nTEST 9: Single subject percentage calculation (4 conducted, 3 present)');
  const testStudentId = 'STU_CALC_TEST';
  // Helper to submit records directly into calculation
  for (let i = 1; i <= 4; i++) {
    await attendanceService.submitAttendanceSession({
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
      subjectCode: 'DBMS',
      subjectName: 'DBMS',
      period: `Period ${i}`,
      date: `2026-10-0${i}`,
      studentRoster: [
        { studentId: testStudentId, studentName: 'Calc Student', status: i <= 3 ? 'PRESENT' : 'ABSENT' },
      ],
      actor: { uid: 'fac_1', name: 'Fac 1', role: 'FACULTY' },
    });
  }

  const stuSummary9 = await attendanceService.getStudentAttendance(testStudentId);
  const dbmsSubject = stuSummary9.subjects.find((s) => s.subjectCode === 'DBMS');
  assert(
    dbmsSubject !== undefined &&
      dbmsSubject.totalClasses === 4 &&
      dbmsSubject.attendedClasses === 3 &&
      dbmsSubject.percentage === 75,
    'TEST 9: DBMS percentage is precisely 75% (3/4)',
    `Got ${dbmsSubject?.percentage}%`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Multi-subject non-averaged overall attendance:
  // DBMS: 4 conducted, 3 present
  // OS: 5 conducted, 4 present
  // CN: 6 conducted, 5 present
  // Total Present = 12, Total Conducted = 15 -> Overall = 12/15 = 80%
  // Must NOT average subject percentages: (75 + 80 + 83.33) / 3 = 79.44%
  // -------------------------------------------------------------------------
  console.log('\nTEST 10: Strict overall attendance ratio (NOT subject averaging)');
  // Add 5 OS sessions (4 present, 1 absent)
  for (let i = 1; i <= 5; i++) {
    await attendanceService.submitAttendanceSession({
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
      subjectCode: 'OS',
      subjectName: 'Operating Systems',
      period: `Period ${i}`,
      date: `2026-10-1${i}`,
      studentRoster: [
        { studentId: testStudentId, studentName: 'Calc Student', status: i <= 4 ? 'PRESENT' : 'ABSENT' },
      ],
      actor: { uid: 'fac_1', name: 'Fac 1', role: 'FACULTY' },
    });
  }
  // Add 6 CN sessions (5 present, 1 absent)
  for (let i = 1; i <= 6; i++) {
    await attendanceService.submitAttendanceSession({
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
      subjectCode: 'CN',
      subjectName: 'Computer Networks',
      period: `Period ${i}`,
      date: `2026-10-2${i}`,
      studentRoster: [
        { studentId: testStudentId, studentName: 'Calc Student', status: i <= 5 ? 'PRESENT' : 'ABSENT' },
      ],
      actor: { uid: 'fac_1', name: 'Fac 1', role: 'FACULTY' },
    });
  }

  const stuSummary10 = await attendanceService.getStudentAttendance(testStudentId);
  assert(
    stuSummary10.totalClasses === 15 &&
      stuSummary10.attendedClasses === 12 &&
      stuSummary10.overallPercentage === 80,
    'TEST 10: Overall percentage is strictly 80% (12/15) - NOT averaged',
    `Got ${stuSummary10.overallPercentage}% (total: ${stuSummary10.totalClasses}, attended: ${stuSummary10.attendedClasses})`
  );

  // -------------------------------------------------------------------------
  // TEST 11: Unconducted class is NOT counted as absent
  // Student has DBMS: 4 conducted, 3 present. OS: no attendance taken yet.
  // Expected: Overall = 3/4 = 75%.
  // -------------------------------------------------------------------------
  console.log('\nTEST 11: Classes with no attendance taken are NOT counted in denominator');
  const stuUnconducted = 'STU_UNCONDUCTED_TEST';
  for (let i = 1; i <= 4; i++) {
    await attendanceService.submitAttendanceSession({
      branch: 'B.Tech',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech CSE',
      semester: 3,
      section: 'A',
      subjectCode: 'DBMS',
      subjectName: 'DBMS',
      period: `Period ${i}`,
      date: `2026-11-0${i}`,
      studentRoster: [
        { studentId: stuUnconducted, studentName: 'Unconducted Test', status: i <= 3 ? 'PRESENT' : 'ABSENT' },
      ],
      actor: { uid: 'fac_1', name: 'Fac 1', role: 'FACULTY' },
    });
  }
  const stuSummary11 = await attendanceService.getStudentAttendance(stuUnconducted);
  assert(
    stuSummary11.totalClasses === 4 &&
      stuSummary11.attendedClasses === 3 &&
      stuSummary11.overallPercentage === 75,
    'TEST 11: Overall attendance ignores unconducted classes (3/4 = 75%)',
    `Got total: ${stuSummary11.totalClasses}, %: ${stuSummary11.overallPercentage}`
  );

  // -------------------------------------------------------------------------
  // TEST 12: Admin removes B.Tech from user's assignment
  // Expected: B.Tech disappears from accessible dashboard/attendance scope immediately
  // -------------------------------------------------------------------------
  console.log('\nTEST 12: Revocation of assigned branch removes it immediately from scope');
  const user12: UserRecord = {
    ...user1,
    assignedBranches: ['BCA'], // B.Tech removed
  };
  const branches12 = academicHierarchyService.getAuthorizedBranchesForUser(user12, 'take_attendance');
  assert(
    !branches12.includes('B.Tech') && branches12.includes('BCA'),
    'TEST 12: B.Tech disappears from attendance scope immediately after removal from assigned branches',
    `Branches: ${JSON.stringify(branches12)}`
  );

  // -------------------------------------------------------------------------
  // TEST 13: Admin revokes Attendance permission
  // Expected: Take Attendance disappears. Direct access attempt must be denied.
  // -------------------------------------------------------------------------
  console.log('\nTEST 13: Revocation of Attendance permission denies access');
  const user13: UserRecord = {
    ...user1,
    scopedPermissions: [], // all permissions removed
  };
  const canTake13 = canPerformAction(user13, 'MANAGE_ATTENDANCE', 'BCA', 'take_attendance');
  const branches13 = academicHierarchyService.getTakeAttendanceBranches(user13);
  assert(
    !canTake13 && branches13.length === 0,
    'TEST 13: Revoked Attendance permission denies take_attendance action and yields 0 branches'
  );

  // -------------------------------------------------------------------------
  // TEST 14: User manually changes URL/document ID to an unauthorized branch
  // Expected: Access denied.
  // -------------------------------------------------------------------------
  console.log('\nTEST 14: URL manipulation to unauthorized branch is denied');
  const user14: UserRecord = {
    ...user1,
    assignedBranches: ['BCA'],
    scopedPermissions: [
      {
        permissionId: 'manage_attendance',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA'],
        actions: ['view', 'take_attendance'],
      },
    ],
  };
  const urlAttemptBranch = 'B.Tech'; // Attempting to access B.Tech via query parameter
  const isUrlAllowed = canPerformAction(user14, 'MANAGE_ATTENDANCE', urlAttemptBranch, 'view');
  assert(
    !isUrlAllowed,
    'TEST 14: URL manipulation to unauthorized branch (B.Tech) is strictly rejected'
  );

  // -------------------------------------------------------------------------
  // TEST 15: User tries unauthorized operation on another branch
  // Expected: Security checks reject it.
  // -------------------------------------------------------------------------
  console.log('\nTEST 15: Cross-branch mutation attempt rejected');
  const canMutateBTech = canPerformAction(user14, 'MANAGE_ATTENDANCE', 'B.Tech', 'take_attendance');
  assert(
    !canMutateBTech,
    'TEST 15: User unauthorized on B.Tech is rejected when trying to record attendance'
  );

  // -------------------------------------------------------------------------
  // TEST 16: Can Grant Permissions: User has BCA only
  // Expected: Can delegate only BCA permissions. Cannot delegate B.Tech.
  // -------------------------------------------------------------------------
  console.log('\nTEST 16: Delegated permissions cannot exceed grantor scope');
  const grantorUser = makeUser({
    uid: 'u_rahul_delegator',
    email: 'rahul_del@campus.edu',
    name: 'Rahul Delegator',
    role: 'FACULTY',
    assignedBranches: ['BCA', 'B.Tech'],
    scopedPermissions: [
      {
        permissionId: 'can_grant_permissions',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA'],
        actions: ['grant'],
      },
      {
        permissionId: 'manage_attendance',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA'],
        actions: ['view', 'take_attendance'],
      },
    ],
  });

  const bcaPermAttempt: ScopedPermission = {
    permissionId: 'manage_attendance',
    scopeType: 'SELECTED_BRANCHES',
    branchIds: ['BCA'],
    actions: ['view'],
  };
  const btechPermAttempt: ScopedPermission = {
    permissionId: 'manage_attendance',
    scopeType: 'SELECTED_BRANCHES',
    branchIds: ['B.Tech'],
    actions: ['view'],
  };

  const canDelegateBCA = canUserDelegatePermission(grantorUser, bcaPermAttempt);
  const canDelegateBTech = canUserDelegatePermission(grantorUser, btechPermAttempt);

  assert(
    canDelegateBCA.allowed && !canDelegateBTech.allowed,
    'TEST 16: Can delegate only BCA permissions; cannot delegate B.Tech permissions',
    `BCA: ${canDelegateBCA.allowed}, B.Tech: ${canDelegateBTech.allowed} (reason: ${canDelegateBTech.reason})`
  );

  // -------------------------------------------------------------------------
  // TEST 17: User has Attendance: View + Take Attendance, but NOT Edit Attendance
  // Expected: Can take attendance. Cannot edit an existing attendance session.
  // -------------------------------------------------------------------------
  console.log('\nTEST 17: Take Attendance permission does NOT grant Edit Attendance');
  const user17 = makeUser({
    uid: 'u_rahul_no_edit',
    email: 'rahul_no_edit@campus.edu',
    name: 'Rahul No Edit',
    role: 'FACULTY',
    assignedBranches: ['BCA'],
    scopedPermissions: [
      {
        permissionId: 'manage_attendance',
        scopeType: 'SELECTED_BRANCHES',
        branchIds: ['BCA'],
        actions: ['view', 'take_attendance'], // notice 'edit' / 'edit_attendance' is absent
      },
    ],
  });

  const canTake17 = canPerformAction(user17, 'MANAGE_ATTENDANCE', 'BCA', 'take_attendance');
  const canEdit17 =
    canPerformAction(user17, 'MANAGE_ATTENDANCE', 'BCA', 'edit_attendance') ||
    canPerformAction(user17, 'MANAGE_ATTENDANCE', 'BCA', 'edit');

  assert(
    canTake17 && !canEdit17,
    'TEST 17: User can take attendance but cannot edit existing attendance records',
    `canTake: ${canTake17}, canEdit: ${canEdit17}`
  );

  console.log('\n====================================================');
  console.log(`RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('====================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
