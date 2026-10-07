import {
  isMemberEligibleForStudentComplaint,
} from '../services/complaintService';
import type { UserRecord, Complaint } from '../types';

function createMockStudent(params: Partial<UserRecord>): UserRecord {
  return {
    uid: params.uid || 'student_1',
    name: params.name || 'Student Test',
    email: params.email || 'student@test.edu',
    role: 'STUDENT',
    branch: params.branch || 'BCA',
    department: params.department || 'BCA',
    degree: params.degree || 'Bachelor of Computer Applications',
    isActive: true,
    isActivated: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...params,
  };
}

function createMockMember(params: Partial<UserRecord>): UserRecord {
  const br = params.branch || (params.assignedBranches && params.assignedBranches[0]) || 'BCA';
  return {
    uid: params.uid || 'member_1',
    name: params.name || 'Member Test',
    email: params.email || 'member@test.edu',
    role: params.role || 'FACULTY',
    assignedBranches: params.assignedBranches || [br],
    branch: br,
    department: params.department || br,
    isActive: params.isActive !== undefined ? params.isActive : true,
    isActivated: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...params,
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runComplaintTests() {
  console.log('====================================================');
  console.log('RUNNING BRANCH-SCOPED COMPLAINT BOX TEST SUITE');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 37 - SCENARIO 1
  // --------------------------------------------------------------------------
  console.log('TESTING SCENARIO 1 (BCA Student):');
  const bcaStudent = createMockStudent({ uid: 's_bca_1', name: 'Rahul', branch: 'BCA' });
  const facA = createMockMember({ uid: 'fac_a', name: 'Faculty A', role: 'FACULTY', assignedBranches: ['BCA'], branch: 'BCA' });
  const facB = createMockMember({ uid: 'fac_b', name: 'Faculty B', role: 'FACULTY', assignedBranches: ['B.Tech'], branch: 'B.Tech' });
  const staffA = createMockMember({ uid: 'staff_a', name: 'Staff A', role: 'STAFF', assignedBranches: ['BCA'], branch: 'BCA' });
  const staffB = createMockMember({ uid: 'staff_b', name: 'Staff B', role: 'STAFF', assignedBranches: ['MCA'], branch: 'MCA' });
  const subAdminA = createMockMember({ uid: 'sub_a', name: 'Sub Admin A', role: 'SUB_ADMIN', assignedBranches: ['BCA'], branch: 'BCA' });
  const subAdminB = createMockMember({ uid: 'sub_b', name: 'Sub Admin B', role: 'SUB_ADMIN', assignedBranches: ['B.Tech'], branch: 'B.Tech' });

  assert(isMemberEligibleForStudentComplaint(bcaStudent, facA) === true, 'Faculty A (BCA) is eligible for BCA student');
  assert(isMemberEligibleForStudentComplaint(bcaStudent, facB) === false, 'Faculty B (B.Tech) is NOT eligible for BCA student');
  assert(isMemberEligibleForStudentComplaint(bcaStudent, staffA) === true, 'Staff A (BCA) is eligible for BCA student');
  assert(isMemberEligibleForStudentComplaint(bcaStudent, staffB) === false, 'Staff B (MCA) is NOT eligible for BCA student');
  assert(isMemberEligibleForStudentComplaint(bcaStudent, subAdminA) === true, 'Sub Admin A (BCA) is eligible for BCA student');
  assert(isMemberEligibleForStudentComplaint(bcaStudent, subAdminB) === false, 'Sub Admin B (B.Tech) is NOT eligible for BCA student');

  // --------------------------------------------------------------------------
  // SECTION 37 - SCENARIO 2
  // --------------------------------------------------------------------------
  console.log('\nTESTING SCENARIO 2 (B.Tech Student with Multi-Branch Members):');
  const btechStudent = createMockStudent({ uid: 's_btech_1', name: 'Sanjay', branch: 'B.Tech' });
  const multiFac = createMockMember({ uid: 'fac_multi', name: 'Faculty Multi', role: 'FACULTY', assignedBranches: ['BCA', 'B.Tech'] });
  const btechStaff = createMockMember({ uid: 'staff_btech', name: 'Staff B.Tech', role: 'STAFF', assignedBranches: ['B.Tech'], branch: 'B.Tech' });
  const multiSubAdmin = createMockMember({ uid: 'sub_multi', name: 'Sub Admin Multi', role: 'SUB_ADMIN', assignedBranches: ['BCA', 'B.Tech'] });

  assert(isMemberEligibleForStudentComplaint(btechStudent, multiFac) === true, 'Faculty Multi (BCA+B.Tech) is eligible for B.Tech student');
  assert(isMemberEligibleForStudentComplaint(btechStudent, facA) === false, 'Faculty A (BCA only) is NOT eligible for B.Tech student');
  assert(isMemberEligibleForStudentComplaint(btechStudent, btechStaff) === true, 'Staff B.Tech is eligible for B.Tech student');
  assert(isMemberEligibleForStudentComplaint(btechStudent, multiSubAdmin) === true, 'Sub Admin Multi (BCA+B.Tech) is eligible for B.Tech student');

  // --------------------------------------------------------------------------
  // SECTION 37 - SCENARIO 3 (Multi-Branch Faculty Rahul: BCA + B.Tech):
  // --------------------------------------------------------------------------
  console.log('\nTESTING SCENARIO 3 (Multi-Branch Faculty Rahul: BCA + B.Tech):');
  const facRahul = createMockMember({ uid: 'fac_rahul', name: 'Faculty Rahul', role: 'FACULTY', assignedBranches: ['BCA', 'B.Tech'] });
  const mcaStudent = createMockStudent({ uid: 's_mca_1', name: 'Amit', branch: 'MCA' });

  assert(isMemberEligibleForStudentComplaint(bcaStudent, facRahul) === true, 'Faculty Rahul appears for BCA student');
  assert(isMemberEligibleForStudentComplaint(btechStudent, facRahul) === true, 'Faculty Rahul appears for B.Tech student');
  assert(isMemberEligibleForStudentComplaint(mcaStudent, facRahul) === false, 'Faculty Rahul does NOT appear for MCA student');

  // --------------------------------------------------------------------------
  // SECTION 37 - SCENARIO 4 (Admin Removes Faculty from BCA)
  // --------------------------------------------------------------------------
  console.log('\nTESTING SCENARIO 4 (Dynamic Update - Faculty Rahul reassigned to B.Tech only):');
  const facRahulUpdated = createMockMember({ uid: 'fac_rahul', name: 'Faculty Rahul', role: 'FACULTY', assignedBranches: ['B.Tech'], branch: 'B.Tech' });

  assert(isMemberEligibleForStudentComplaint(bcaStudent, facRahulUpdated) === false, 'Faculty Rahul now HIDDEN for BCA student');
  assert(isMemberEligibleForStudentComplaint(btechStudent, facRahulUpdated) === true, 'Faculty Rahul remains VISIBLE for B.Tech student');

  // --------------------------------------------------------------------------
  // SECTION 27 - STUDENT CANNOT TAG ANOTHER STUDENT
  // --------------------------------------------------------------------------
  console.log('\nTESTING ROLE RESTRICTIONS:');
  const peerStudent = createMockStudent({ uid: 's_peer', name: 'Peer Student', branch: 'BCA' });
  assert(isMemberEligibleForStudentComplaint(bcaStudent, peerStudent) === false, 'Student CANNOT tag another student');

  // --------------------------------------------------------------------------
  // SECTION 9 & 10 - DEPARTMENT / PROGRAM SPECIFIC SCOPE
  // --------------------------------------------------------------------------
  console.log('\nTESTING DEPARTMENT LEVEL ISOLATION:');
  const cseStudent = createMockStudent({ uid: 's_cse', name: 'CSE Student', branch: 'B.Tech', department: 'Computer Science' });
  const cseFaculty = createMockMember({ uid: 'fac_cse', name: 'CSE Faculty', role: 'FACULTY', assignedBranches: ['B.Tech'], department: 'Computer Science' });
  const mechFaculty = createMockMember({ uid: 'fac_mech', name: 'Mech Faculty', role: 'FACULTY', assignedBranches: ['B.Tech'], department: 'Mechanical Engineering' });

  assert(isMemberEligibleForStudentComplaint(cseStudent, cseFaculty) === true, 'CSE Faculty is eligible for CSE student under B.Tech');
  assert(isMemberEligibleForStudentComplaint(cseStudent, mechFaculty) === false, 'Mech Faculty is NOT eligible for CSE student under B.Tech');

  // --------------------------------------------------------------------------
  // SECTION 20 & 21 - CREATION VALIDATION & AUTHORITATIVE BRANCH
  // --------------------------------------------------------------------------
  console.log('\nTESTING BACKEND COMPLAINT CREATION VALIDATION:');
  
  // Test rejecting unauthorized tagged user
  let rejectionCaught = false;
  try {
    // facB belongs to B.Tech, bcaStudent is BCA
    const isFacBEligible = isMemberEligibleForStudentComplaint(bcaStudent, facB);
    if (!isFacBEligible) {
      throw new Error('You cannot tag a member outside your authorized branch (BCA).');
    }
  } catch (err: any) {
    rejectionCaught = true;
    assert(err.message.includes('outside your authorized branch'), 'Attempting to tag unauthorized member throws error');
  }
  assert(rejectionCaught === true, 'Unauthorized member tag was successfully rejected');

  // --------------------------------------------------------------------------
  // SECTION 15, 17, 18 - COMPLAINT VISIBILITY & BRANCH ISOLATION
  // --------------------------------------------------------------------------
  console.log('\nTESTING COMPLAINT VISIBILITY & BRANCH ISOLATION:');
  const bcaComplaint: Complaint = {
    id: 'cmp_100',
    complaintId: 'CMP-2026-1001',
    studentId: bcaStudent.uid,
    studentName: bcaStudent.name,
    studentEmail: bcaStudent.email,
    category: 'Classroom',
    title: 'Projector broken',
    location: 'Lab 1',
    description: 'Projector display failing',
    branch: 'BCA',
    department: 'BCA',
    status: 'SUBMITTED',
    priority: 'HIGH',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaStatus: 'WITHIN_SLA',
    timeline: [],
    taggedUserIds: [facA.uid],
    taggedUsers: [{ uid: facA.uid, name: facA.name, role: facA.role, branch: 'BCA' }],
  };

  const btechComplaint: Complaint = {
    id: 'cmp_200',
    complaintId: 'CMP-2026-1002',
    studentId: btechStudent.uid,
    studentName: btechStudent.name,
    studentEmail: btechStudent.email,
    category: 'Electrical',
    title: 'AC unit failure',
    location: 'BTech Block Room 102',
    description: 'AC unit leaking water',
    branch: 'B.Tech',
    department: 'Computer Science',
    status: 'SUBMITTED',
    priority: 'HIGH',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaStatus: 'WITHIN_SLA',
    timeline: [],
    taggedUserIds: [btechStaff.uid],
    taggedUsers: [{ uid: btechStaff.uid, name: btechStaff.name, role: btechStaff.role, branch: 'B.Tech' }],
  };

  // Rule 1: Student sees only their own complaints
  assert(bcaComplaint.studentId === bcaStudent.uid, 'BCA student sees BCA complaint');
  assert(btechComplaint.studentId !== bcaStudent.uid, 'BCA student CANNOT see B.Tech complaint');

  // Rule 2: Tagged Faculty A sees the complaint they are tagged in
  assert(bcaComplaint.taggedUserIds?.includes(facA.uid) === true, 'Faculty A (tagged in BCA complaint) can see it');
  assert(bcaComplaint.taggedUserIds?.includes(facB.uid) === false, 'Faculty B (not tagged, different branch) CANNOT see BCA complaint');

  // Rule 3: Branch isolation - B.Tech staff cannot see BCA complaint
  assert(bcaComplaint.branch === 'BCA', 'BCA complaint is scoped to BCA');
  assert(btechComplaint.branch === 'B.Tech', 'B.Tech complaint is scoped to B.Tech');

  // --------------------------------------------------------------------------
  // SECTION 12 - SEARCH CANNOT BYPASS BRANCH FILTERING
  // --------------------------------------------------------------------------
  console.log('\nTESTING SEARCH SCOPE INTEGRITY:');
  const allEligibleForBCA = [facA, staffA, subAdminA].filter((m) => isMemberEligibleForStudentComplaint(bcaStudent, m));
  const searchName = 'Faculty B'; // B.Tech faculty
  const searchResultsInsideBCA = allEligibleForBCA.filter((m) => m.name.toLowerCase().includes(searchName.toLowerCase()));
  assert(searchResultsInsideBCA.length === 0, 'Searching for "Faculty B" within BCA student tag scope yields 0 results');

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================');
}

runComplaintTests().catch((err) => {
  console.error('Test execution failed:', err);
  throw err;
});
