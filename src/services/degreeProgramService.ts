import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import type { DegreeProgram, UserRecord } from '../types';

export const BRANCH_ALIASES: Record<string, string[]> = {
  'Computer Science & Engineering': [
    'computer science & engineering',
    'computer science and engineering',
    'computer science',
    'cse',
    'cs',
  ],
  'Electrical Engineering': [
    'electrical engineering',
    'electrical',
    'ee',
  ],
  'Mechanical Engineering': [
    'mechanical engineering',
    'mechanical',
    'me',
  ],
  'Civil Engineering': [
    'civil engineering',
    'civil',
    'ce',
  ],
  'Electronics & Telecommunication': [
    'electronics & telecommunication',
    'electronics & telecommunication engineering',
    'electronics and telecommunication',
    'electronics and telecommunication engineering',
    'etc',
    'ece',
    'electronics',
  ],
  'Information Technology': [
    'information technology',
    'it',
  ],
};

export const normalizeStudentAcademicRecord = <T extends Partial<UserRecord>>(user: T): T => {
  if (!user || user.role !== 'STUDENT') return user;

  let resolvedDegree = user.degree?.trim();
  let resolvedBranch = user.branch?.trim() || '';

  const getCanonicalBranch = (val?: string): string | null => {
    if (!val) return null;
    const clean = val.trim().toLowerCase();
    for (const [canonical, aliases] of Object.entries(BRANCH_ALIASES)) {
      if (canonical.toLowerCase() === clean || aliases.includes(clean)) {
        return canonical;
      }
    }
    return null;
  };

  const branchFromDept = getCanonicalBranch(user.department);
  const branchFromBranch = getCanonicalBranch(user.branch);
  const branchFromDegree = getCanonicalBranch(user.degree);

  // If degree is not set, or was set to a branch name
  if (!resolvedDegree || branchFromDegree) {
    if (branchFromDegree) {
      resolvedBranch = branchFromDegree;
      resolvedDegree = 'B.Tech';
    } else if (branchFromDept) {
      resolvedDegree = 'B.Tech';
      resolvedBranch = branchFromBranch || branchFromDept;
    } else if (user.department?.toLowerCase() === 'b.tech' || user.department?.toLowerCase() === 'btech') {
      resolvedDegree = 'B.Tech';
      if (branchFromBranch) resolvedBranch = branchFromBranch;
    } else {
      resolvedDegree = user.degree || 'B.Tech';
    }
  }

  // Canonicalize branch name if an alias was used (e.g. CSE -> Computer Science & Engineering)
  if (branchFromBranch) {
    resolvedBranch = branchFromBranch;
  } else if (!resolvedBranch && branchFromDept) {
    resolvedBranch = branchFromDept;
  }

  return {
    ...user,
    degree: resolvedDegree,
    branch: resolvedBranch,
  };
};

export const doesBranchMatch = (userBranch?: string, userDept?: string, filterBranch?: string): boolean => {
  if (!filterBranch || filterBranch === 'ALL') return true;
  const target = filterBranch.trim().toLowerCase();

  const uB = userBranch?.trim().toLowerCase() || '';
  const uD = userDept?.trim().toLowerCase() || '';

  if (uB === target || uD === target) return true;

  for (const [canonical, aliases] of Object.entries(BRANCH_ALIASES)) {
    const isTargetThisCanonical = canonical.toLowerCase() === target || aliases.includes(target);
    if (isTargetThisCanonical) {
      if (canonical.toLowerCase() === uB || aliases.includes(uB) || canonical.toLowerCase() === uD || aliases.includes(uD)) {
        return true;
      }
    }
  }

  return false;
};

export const doesDegreeMatch = (userDegree?: string, userDept?: string, filterDegree?: string): boolean => {
  if (!filterDegree || filterDegree === 'ALL') return true;
  const target = filterDegree.trim().toLowerCase();

  const uDeg = userDegree?.trim().toLowerCase() || '';
  const uDept = userDept?.trim().toLowerCase() || '';

  if (uDeg === target || uDept === target) return true;

  // If filter is B.Tech, any legacy student who had an engineering department or default B.Tech is a match
  if (target === 'b.tech' || target === 'btech') {
    if (!userDegree || userDegree.toLowerCase() === 'b.tech' || userDegree.toLowerCase() === 'btech') {
      return true;
    }
    for (const [canonical, aliases] of Object.entries(BRANCH_ALIASES)) {
      if (canonical.toLowerCase() === uDept || aliases.includes(uDept) || canonical.toLowerCase() === uDeg || aliases.includes(uDeg)) {
        return true;
      }
    }
  }

  return false;
};

const DEGREES_STORAGE_KEY = 'campus_life_academic_degrees';

export const DEFAULT_DEGREES: DegreeProgram[] = [
  {
    id: 'btech',
    name: 'B.Tech',
    durationYears: 4,
    branches: [
      'Computer Science & Engineering',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Civil Engineering',
      'Electronics & Telecommunication',
      'Information Technology',
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function getLocalDegrees(): DegreeProgram[] {
  try {
    const raw = safeStorage.getItem(DEGREES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Guarantee B.Tech exists with its 6 default branches
        const btechExists = parsed.some((d) => d.name.toLowerCase() === 'b.tech');
        if (!btechExists) {
          parsed.unshift(DEFAULT_DEGREES[0]);
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_DEGREES;
}

function saveLocalDegrees(degrees: DegreeProgram[]): void {
  try {
    safeStorage.setItem(DEGREES_STORAGE_KEY, JSON.stringify(degrees));
  } catch {
    // ignore
  }
}

export const getYearLabel = (year: number): string => {
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return `${year}th Year`;
};

export const getAvailableYears = (durationYears: number): { value: number; label: string }[] => {
  const count = Math.max(1, Math.floor(durationYears));
  return Array.from({ length: count }, (_, i) => ({
    value: i + 1,
    label: getYearLabel(i + 1),
  }));
};

export const getAvailableSemesters = (durationYears: number): { value: number; label: string }[] => {
  const totalSemesters = Math.max(1, Math.floor(durationYears * 2));
  return Array.from({ length: totalSemesters }, (_, i) => ({
    value: i + 1,
    label: `Semester ${i + 1}`,
  }));
};

export const degreeProgramService = {
  async getDegrees(): Promise<DegreeProgram[]> {
    if (isFirebaseConfigured && db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'academic_degrees'));
        if (!querySnapshot.empty) {
          const list: DegreeProgram[] = [];
          querySnapshot.forEach((docSnap) => {
            list.push(docSnap.data() as DegreeProgram);
          });
          if (!list.some((d) => d.name.toLowerCase() === 'b.tech')) {
            list.unshift(DEFAULT_DEGREES[0]);
          }
          saveLocalDegrees(list);
          return list;
        }
      } catch (err) {
        console.warn('Firestore getDegrees fallback to local store:', err);
      }
    }
    return getLocalDegrees();
  },

  async addDegree(
    name: string,
    durationYears: number,
    actor?: { uid: string; name: string; role: string }
  ): Promise<{ success: boolean; degree?: DegreeProgram; error?: string }> {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Degree / Program Name is required.' };
    }

    if (!Number.isInteger(durationYears) || durationYears <= 0) {
      return {
        success: false,
        error: 'Duration must be a positive whole number greater than 0 (e.g. 1, 2, 3, 4, 5, 7).',
      };
    }

    const currentDegrees = await this.getDegrees();
    const existing = currentDegrees.find(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return {
        success: false,
        error: `A degree with the name "${trimmed}" already exists.`,
      };
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newDegree: DegreeProgram = {
      id: `deg_${slug}_${Date.now()}`,
      name: trimmed,
      durationYears: Math.floor(durationYears),
      branches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    currentDegrees.push(newDegree);
    saveLocalDegrees(currentDegrees);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'academic_degrees', newDegree.id), newDegree);
      } catch (err) {
        console.warn('Firestore save degree fallback:', err);
      }
    }

    if (actor) {
      try {
        await auditService.logAction({
          action: 'CREATE',
          entityType: 'DegreeProgram',
          entityId: newDegree.id,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role as any,
          changes: `Added new academic degree "${newDegree.name}" with duration ${newDegree.durationYears} years.`,
        });
      } catch {
        // ignore
      }
    }

    return { success: true, degree: newDegree };
  },

  async addBranch(
    degreeName: string,
    branchName: string,
    actor?: { uid: string; name: string; role: string }
  ): Promise<{ success: boolean; degree?: DegreeProgram; error?: string }> {
    const trimmedBranch = branchName.trim();
    if (!trimmedBranch) {
      return { success: false, error: 'Branch Name is required.' };
    }

    const currentDegrees = await this.getDegrees();
    const degreeIndex = currentDegrees.findIndex(
      (d) => d.name.toLowerCase() === degreeName.trim().toLowerCase()
    );

    if (degreeIndex === -1) {
      return {
        success: false,
        error: `Selected degree "${degreeName}" was not found.`,
      };
    }

    const targetDegree = currentDegrees[degreeIndex];
    const branchExists = targetDegree.branches.some(
      (b) => b.toLowerCase() === trimmedBranch.toLowerCase()
    );

    if (branchExists) {
      return {
        success: false,
        error: `Branch "${trimmedBranch}" already exists under ${targetDegree.name}.`,
      };
    }

    targetDegree.branches.push(trimmedBranch);
    targetDegree.updatedAt = new Date().toISOString();

    saveLocalDegrees(currentDegrees);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'academic_degrees', targetDegree.id), {
          branches: targetDegree.branches,
          updatedAt: targetDegree.updatedAt,
        });
      } catch (err) {
        console.warn('Firestore update degree branches fallback:', err);
      }
    }

    if (actor) {
      try {
        await auditService.logAction({
          action: 'UPDATE',
          entityType: 'DegreeProgram',
          entityId: targetDegree.id,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role as any,
          changes: `Added new branch "${trimmedBranch}" to academic degree "${targetDegree.name}".`,
        });
      } catch {
        // ignore
      }
    }

    return { success: true, degree: targetDegree };
  },
};
