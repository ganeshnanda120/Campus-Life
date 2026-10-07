/**
 * Academic Hierarchy Service
 * Manages the academic structural cascade:
 * Branch -> Department -> Degree/Program -> Year/Semester -> Section/Class -> Subjects -> Students
 */

import type { UserRecord } from '../types';
import {
  getUserAssignedBranches,
  canPerformAction,
  areBranchesEqual,
  normalizeBranchName,
} from './permissionService';
import { getLocalDegrees, doesBranchMatch, doesDegreeMatch } from './degreeProgramService';

export interface DepartmentConfig {
  id: string;
  name: string;
  code: string;
}

export interface ProgramConfig {
  id: string;
  code: string;
  name: string;
  durationYears: number;
  departmentName: string;
  branchName: string;
}

export interface SubjectConfig {
  code: string;
  name: string;
}

// Built-in canonical hierarchy definitions
export const DEFAULT_BRANCHES = ['B.Tech', 'BCA', 'MCA', 'MBA'];

export const BRANCH_DEPARTMENTS: Record<string, string[]> = {
  'b.tech': [
    'Computer Science & Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical Engineering',
    'Electronics & Telecommunication',
    'Information Technology',
  ],
  'bca': ['Computer Applications'],
  'mca': ['Computer Applications'],
  'mba': ['Management Studies'],
};

export const DEPARTMENT_PROGRAMS: Record<string, { code: string; name: string; durationYears: number }[]> = {
  'computer science & engineering': [
    { code: 'BTECH_CSE', name: 'B.Tech CSE', durationYears: 4 },
  ],
  'mechanical engineering': [
    { code: 'BTECH_ME', name: 'B.Tech ME', durationYears: 4 },
  ],
  'civil engineering': [
    { code: 'BTECH_CE', name: 'B.Tech CE', durationYears: 4 },
  ],
  'electrical engineering': [
    { code: 'BTECH_EE', name: 'B.Tech EE', durationYears: 4 },
  ],
  'electronics & telecommunication': [
    { code: 'BTECH_ETC', name: 'B.Tech ETC', durationYears: 4 },
  ],
  'information technology': [
    { code: 'BTECH_IT', name: 'B.Tech IT', durationYears: 4 },
  ],
  'computer applications': [
    { code: 'BCA', name: 'BCA', durationYears: 3 },
    { code: 'MCA', name: 'MCA', durationYears: 2 },
  ],
  'management studies': [
    { code: 'MBA', name: 'MBA', durationYears: 2 },
  ],
};

export const CURRICULUM_SUBJECTS: Record<string, Record<number, SubjectConfig[]>> = {
  'BTECH_CSE': {
    1: [
      { code: 'CS101', name: 'Introduction to Programming' },
      { code: 'MA101', name: 'Engineering Mathematics I' },
      { code: 'PH101', name: 'Applied Physics' },
    ],
    2: [
      { code: 'CS102', name: 'Data Structures Fundamentals' },
      { code: 'MA102', name: 'Discrete Mathematics' },
      { code: 'EE101', name: 'Basic Electrical Engineering' },
    ],
    3: [
      { code: 'CS301', name: 'Database Management Systems (DBMS)' },
      { code: 'CS302', name: 'Operating Systems' },
      { code: 'CS303', name: 'Computer Networks' },
      { code: 'CS304', name: 'Software Engineering' },
      { code: 'CS305', name: 'Data Structures & Algorithms' },
    ],
    4: [
      { code: 'CS401', name: 'Design & Analysis of Algorithms' },
      { code: 'CS402', name: 'Computer Architecture & Org' },
      { code: 'CS403', name: 'Theory of Computation' },
      { code: 'CS404', name: 'Web Technologies' },
    ],
    5: [
      { code: 'CS501', name: 'Compiler Design' },
      { code: 'CS502', name: 'Artificial Intelligence' },
      { code: 'CS503', name: 'Information Security' },
    ],
    6: [
      { code: 'CS601', name: 'Machine Learning' },
      { code: 'CS602', name: 'Cloud Computing Architecture' },
      { code: 'CS603', name: 'Mobile Computing' },
    ],
  },
  'BCA': {
    1: [
      { code: 'BCA101', name: 'Programming in C' },
      { code: 'BCA102', name: 'Computer Fundamentals' },
    ],
    2: [
      { code: 'BCA201', name: 'Data Structures using C' },
      { code: 'BCA202', name: 'Digital Electronics' },
    ],
    3: [
      { code: 'BCA301', name: 'Database Management Systems' },
      { code: 'BCA302', name: 'Java Programming' },
      { code: 'BCA303', name: 'Web Development Basics' },
      { code: 'BCA304', name: 'Operating Systems' },
    ],
    4: [
      { code: 'BCA401', name: 'Python Programming' },
      { code: 'BCA402', name: 'Software Engineering' },
      { code: 'BCA403', name: 'Computer Networks' },
    ],
    5: [
      { code: 'BCA501', name: 'PHP & MySQL Applications' },
      { code: 'BCA502', name: 'Network Security' },
    ],
    6: [
      { code: 'BCA601', name: 'Cloud Technologies' },
      { code: 'BCA602', name: 'Major Project Viva' },
    ],
  },
  'MCA': {
    1: [
      { code: 'MCA101', name: 'Advanced Data Structures' },
      { code: 'MCA102', name: 'Object Oriented Software Design' },
    ],
    2: [
      { code: 'MCA201', name: 'Advanced Database Systems' },
      { code: 'MCA202', name: 'Web Technologies & Frameworks' },
    ],
    3: [
      { code: 'MCA301', name: 'Distributed Systems & Cloud' },
      { code: 'MCA302', name: 'Machine Learning & Big Data' },
    ],
    4: [
      { code: 'MCA401', name: 'Industry Internship & Capstone' },
    ],
  },
};

export const STANDARD_PERIODS = [
  'Period 1 (09:00 - 10:00)',
  'Period 2 (10:00 - 11:00)',
  'Period 3 (11:15 - 12:15)',
  'Period 4 (12:15 - 01:15)',
  'Period 5 (02:00 - 03:00)',
  'Period 6 (03:00 - 04:00)',
  'Period 7 (04:00 - 05:00)',
];

export const STANDARD_SECTIONS = ['A', 'B', 'C', 'D'];

export const academicHierarchyService = {
  /**
   * Returns list of authorized branches for attendance operations
   */
  getAuthorizedBranchesForUser(
    user: Partial<UserRecord> | null | undefined,
    action: string = 'take_attendance'
  ): string[] {
    if (!user || user.isActive === false) return [];

    if (user.role === 'MAIN_ADMIN') {
      const dynamicDegrees = getLocalDegrees();
      const allBranches = Array.from(
        new Set([
          ...DEFAULT_BRANCHES,
          ...dynamicDegrees.map((d) => d.name),
        ])
      );
      return allBranches;
    }

    const assigned = getUserAssignedBranches(user);
    return assigned.filter((branch) =>
      canPerformAction(user, 'MANAGE_ATTENDANCE', branch, action) ||
      canPerformAction(user, 'MANAGE_ATTENDANCE', branch, 'view')
    );
  },

  /**
   * Returns authorized branches where user has specific 'take_attendance' action
   */
  getTakeAttendanceBranches(user: Partial<UserRecord> | null | undefined): string[] {
    if (!user || user.isActive === false) return [];
    if (user.role === 'MAIN_ADMIN') return DEFAULT_BRANCHES;

    const assigned = getUserAssignedBranches(user);
    return assigned.filter((branch) =>
      canPerformAction(user, 'MANAGE_ATTENDANCE', branch, 'take_attendance') ||
      canPerformAction(user, 'MANAGE_ATTENDANCE', branch, 'add')
    );
  },

  /**
   * Returns departments available under a specific branch
   */
  getDepartmentsForBranch(branchName: string): string[] {
    if (!branchName) return [];
    const key = branchName.trim().toLowerCase();

    // Direct lookup
    if (BRANCH_DEPARTMENTS[key]) {
      return BRANCH_DEPARTMENTS[key];
    }

    // Check alias or canonical
    const canonical = normalizeBranchName(branchName);
    if (BRANCH_DEPARTMENTS[canonical.toLowerCase()]) {
      return BRANCH_DEPARTMENTS[canonical.toLowerCase()];
    }

    // Dynamic degrees check
    const degrees = getLocalDegrees();
    const match = degrees.find((d) => d.name.toLowerCase() === key || d.id.toLowerCase() === key);
    if (match && match.branches.length > 0) {
      return match.branches;
    }

    // Fallback: If department equals branch name
    return [branchName];
  },

  /**
   * Returns degree/program options under a department
   */
  getProgramsForDepartment(
    branchName: string,
    departmentName: string
  ): { code: string; name: string; durationYears: number }[] {
    if (!departmentName) return [];
    const deptKey = departmentName.trim().toLowerCase();

    if (DEPARTMENT_PROGRAMS[deptKey]) {
      return DEPARTMENT_PROGRAMS[deptKey];
    }

    // Dynamic lookup by degree
    const degrees = getLocalDegrees();
    const degMatch = degrees.find(
      (d) =>
        d.branches.some((b) => b.toLowerCase() === deptKey) ||
        d.name.toLowerCase() === deptKey
    );
    if (degMatch) {
      return [
        {
          code: degMatch.name.toUpperCase().replace(/\s+/g, '_'),
          name: degMatch.name,
          durationYears: degMatch.durationYears,
        },
      ];
    }

    return [
      {
        code: `${branchName.toUpperCase()}_${departmentName.toUpperCase()}`.replace(/\s+/g, '_'),
        name: `${branchName} ${departmentName}`,
        durationYears: 4,
      },
    ];
  },

  /**
   * Returns allowable semesters for given duration in years
   */
  getSemestersForDuration(durationYears: number): number[] {
    const total = Math.max(1, durationYears * 2);
    const sems: number[] = [];
    for (let i = 1; i <= total; i++) {
      sems.push(i);
    }
    return sems;
  },

  /**
   * Returns sections available for class
   */
  getSections(): string[] {
    return STANDARD_SECTIONS;
  },

  /**
   * Returns curriculum subjects for selected program and semester
   */
  getSubjectsForProgram(
    programCode: string,
    semester: number
  ): SubjectConfig[] {
    const cleanCode = (programCode || '').toUpperCase();
    const programSubjects = CURRICULUM_SUBJECTS[cleanCode];
    if (programSubjects && programSubjects[semester]) {
      return programSubjects[semester];
    }

    // Fallback default subjects for CSE or general engineering
    return [
      { code: `SUB${semester}01`, name: 'Core Subject 1' },
      { code: `SUB${semester}02`, name: 'Core Subject 2' },
      { code: `SUB${semester}03`, name: 'Department Elective' },
      { code: `SUB${semester}04`, name: 'Laboratory Session' },
    ];
  },

  /**
   * Returns standardized daily lecture periods
   */
  getPeriods(): string[] {
    return STANDARD_PERIODS;
  },

  /**
   * Filters all students strictly according to the academic coordinate hierarchy:
   * (branch, department, degree, semester, section)
   */
  filterStudentsByAcademicHierarchy(
    allStudents: UserRecord[],
    criteria: {
      branch: string;
      department?: string;
      degree?: string;
      semester?: number;
      section?: string;
    }
  ): UserRecord[] {
    const { branch, department, degree, semester, section } = criteria;
    const cleanBranch = (branch || '').trim();
    const cleanDept = (department || '').trim();
    const cleanDegree = (degree || '').trim();
    const cleanSec = (section || 'A').trim().toUpperCase();

    return allStudents.filter((stu) => {
      if (stu.role !== 'STUDENT') return false;
      if (!stu.isActive) return false;

      // 1. Branch match
      const stuBranch = stu.branch || stu.department || '';
      const branchMatches =
        areBranchesEqual(stuBranch, cleanBranch) ||
        doesBranchMatch(stu.branch, stu.department, cleanBranch);
      if (!branchMatches) return false;

      // 2. Department match (if specified)
      if (cleanDept && cleanDept !== 'ALL') {
        const stuDept = (stu.department || '').trim();
        const deptMatches =
          areBranchesEqual(stuDept, cleanDept) ||
          doesBranchMatch(stu.branch, stu.department, cleanDept);
        if (!deptMatches) return false;
      }

      // 3. Degree match (if specified)
      if (cleanDegree && cleanDegree !== 'ALL') {
        const stuDegree = (stu.degree || stu.department || '').trim();
        const degreeMatches =
          doesDegreeMatch(stu.degree, stu.department, cleanDegree) ||
          stuDegree.toLowerCase().includes(cleanDegree.toLowerCase()) ||
          cleanDegree.toLowerCase().includes(stuDegree.toLowerCase());
        if (!degreeMatches) return false;
      }

      // 4. Semester match (if specified)
      if (semester && semester > 0) {
        if (stu.semester && stu.semester !== semester) return false;
      }

      // 5. Section match (if student has a defined section)
      if (stu.section && stu.section.trim()) {
        if (stu.section.trim().toUpperCase() !== cleanSec) return false;
      }

      return true;
    });
  },
};
