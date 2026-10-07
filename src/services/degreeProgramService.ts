import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage, getLocalUsers, saveLocalUsers } from '../firebase/authService';
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
      resolvedDegree = user.degree || '';
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

export const normalizeFacultyAcademicRecord = <T extends Partial<UserRecord>>(
  user: T,
  degreesList?: DegreeProgram[]
): T => {
  if (!user || user.role !== 'FACULTY') return user;

  let resolvedDegree = user.degree?.trim();
  let resolvedBranch = user.branch?.trim() || '';

  if (resolvedDegree) {
    return {
      ...user,
      degree: resolvedDegree,
      branch: resolvedBranch,
    };
  }

  // Handle compatibility with legacy faculty records that only had department and optional branch
  const cleanDept = user.department?.trim() || '';
  const cleanBranch = user.branch?.trim() || '';

  if (cleanDept.toLowerCase() === 'b.tech' || cleanDept.toLowerCase() === 'btech') {
    resolvedDegree = 'B.Tech';
    resolvedBranch = cleanBranch;
  } else {
    for (const [canonical, aliases] of Object.entries(BRANCH_ALIASES)) {
      if (canonical.toLowerCase() === cleanDept.toLowerCase() || aliases.includes(cleanDept.toLowerCase())) {
        resolvedDegree = 'B.Tech';
        resolvedBranch = cleanBranch || canonical;
        break;
      }
    }
  }

  if (!resolvedDegree && degreesList && degreesList.length > 0) {
    const match = degreesList.find((d) => d.name.toLowerCase() === cleanDept.toLowerCase());
    if (match) {
      resolvedDegree = match.name;
    } else {
      const matchBranch = degreesList.find((d) =>
        d.branches.some((b) => b.toLowerCase() === cleanDept.toLowerCase())
      );
      if (matchBranch) {
        resolvedDegree = matchBranch.name;
        if (!resolvedBranch) resolvedBranch = cleanDept;
      }
    }
  }

  if (!resolvedDegree && cleanDept) {
    if (!isDegreeDeleted('B.Tech')) {
      resolvedDegree = 'B.Tech';
    }
    if (!resolvedBranch) resolvedBranch = cleanDept;
  }

  return {
    ...user,
    degree: resolvedDegree || user.degree || '',
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
const DEGREES_INITIALIZED_KEY = 'campus_life_academic_degrees_initialized';
const DELETED_DEGREES_STORAGE_KEY = 'campus_life_deleted_degrees';

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

function getDeletedDegreeNames(): Set<string> {
  try {
    const raw = safeStorage.getItem(DELETED_DEGREES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((s: string) => String(s).toLowerCase().trim()));
      }
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDeletedDegreeNames(names: Set<string>): void {
  try {
    safeStorage.setItem(
      DELETED_DEGREES_STORAGE_KEY,
      JSON.stringify(Array.from(names))
    );
  } catch {
    // ignore
  }
}

export function isDegreeDeleted(name?: string): boolean {
  if (!name) return false;
  const deleted = getDeletedDegreeNames();
  return deleted.has(name.toLowerCase().trim());
}

export function markDegreeDeleted(name: string): void {
  const clean = name.toLowerCase().trim();
  const deleted = getDeletedDegreeNames();
  deleted.add(clean);
  saveDeletedDegreeNames(deleted);

  if (isFirebaseConfigured && db) {
    try {
      const firestoreDb = db;
      setDoc(
        doc(firestoreDb, 'academic_degrees_metadata', 'tombstones'),
        {
          deletedNames: Array.from(deleted),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export function unmarkDegreeDeleted(name: string): void {
  const clean = name.toLowerCase().trim();
  const deleted = getDeletedDegreeNames();
  deleted.delete(clean);
  saveDeletedDegreeNames(deleted);

  if (isFirebaseConfigured && db) {
    try {
      const firestoreDb = db;
      setDoc(
        doc(firestoreDb, 'academic_degrees_metadata', 'tombstones'),
        {
          deletedNames: Array.from(deleted),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    } catch {
      // ignore
    }
  }
}

function isDegreesInitialized(): boolean {
  return safeStorage.getItem(DEGREES_INITIALIZED_KEY) === 'true';
}

function markDegreesInitialized(): void {
  safeStorage.setItem(DEGREES_INITIALIZED_KEY, 'true');
}

export function getLocalDegrees(): DegreeProgram[] {
  try {
    const raw = safeStorage.getItem(DEGREES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((d) => d && d.name && !isDegreeDeleted(d.name));
      }
    }
  } catch {
    // ignore
  }

  // If already initialized before, an empty/missing store means empty array!
  if (isDegreesInitialized()) {
    return [];
  }

  // Only on initial system installation, seed with default degrees (unless deleted)
  markDegreesInitialized();
  const initial = DEFAULT_DEGREES.filter((d) => !isDegreeDeleted(d.name));
  saveLocalDegrees(initial);
  return initial;
}

function saveLocalDegrees(degrees: DegreeProgram[]): void {
  try {
    markDegreesInitialized();
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

type DegreesSubscriber = (degrees: DegreeProgram[]) => void;
const subscribers = new Set<DegreesSubscriber>();

function notifySubscribers(degrees: DegreeProgram[]) {
  subscribers.forEach((cb) => {
    try {
      cb(degrees);
    } catch (err) {
      console.error('Degrees subscriber callback error:', err);
    }
  });
}

export function subscribeDegrees(callback: DegreesSubscriber): () => void {
  subscribers.add(callback);
  degreeProgramService
    .getDegrees()
    .then((list) => {
      callback(list);
    })
    .catch(() => {
      callback(getLocalDegrees());
    });

  let unsubscribeFirestore: (() => void) | undefined;
  if (isFirebaseConfigured && db) {
    try {
      unsubscribeFirestore = onSnapshot(
        collection(db, 'academic_degrees'),
        (snapshot) => {
          const list: DegreeProgram[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data() as DegreeProgram;
            if (d && d.name && !isDegreeDeleted(d.name)) {
              list.push(d);
            }
          });
          markDegreesInitialized();
          saveLocalDegrees(list);
          notifySubscribers(list);
        },
        (err) => {
          console.warn('Firestore academic_degrees onSnapshot error:', err);
        }
      );
    } catch (err) {
      console.warn('Firestore onSnapshot setup failed:', err);
    }
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === DEGREES_STORAGE_KEY || e.key === DELETED_DEGREES_STORAGE_KEY) {
      const list = getLocalDegrees();
      notifySubscribers(list);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    subscribers.delete(callback);
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

function assertAdmin(actor?: { uid: string; name: string; role: string }) {
  if (actor && actor.role !== 'MAIN_ADMIN' && actor.role !== 'SUB_ADMIN') {
    throw new Error('Unauthorized: Only administrators can modify academic degrees and branches.');
  }
}

export const degreeProgramService = {
  async getDegrees(): Promise<DegreeProgram[]> {
    if (isFirebaseConfigured && db) {
      try {
        const firestoreDb = db;
        // 1. Sync remote tombstones if available
        try {
          const tombstoneDoc = await getDoc(
            doc(firestoreDb, 'academic_degrees_metadata', 'tombstones')
          );
          if (tombstoneDoc.exists()) {
            const data = tombstoneDoc.data();
            if (Array.isArray(data?.deletedNames)) {
              const currentDeleted = getDeletedDegreeNames();
              data.deletedNames.forEach((n: string) =>
                currentDeleted.add(String(n).toLowerCase().trim())
              );
              saveDeletedDegreeNames(currentDeleted);
            }
          }
        } catch {
          // ignore
        }

        // 2. Query Firestore academic_degrees
        const querySnapshot = await getDocs(collection(firestoreDb, 'academic_degrees'));
        markDegreesInitialized();
        const list: DegreeProgram[] = [];
        querySnapshot.forEach((docSnap) => {
          const d = docSnap.data() as DegreeProgram;
          if (d && d.name && !isDegreeDeleted(d.name)) {
            list.push(d);
          }
        });
        saveLocalDegrees(list);
        return list;
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
    assertAdmin(actor);

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

    unmarkDegreeDeleted(trimmed);
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

    notifySubscribers(currentDegrees);
    return { success: true, degree: newDegree };
  },

  async editDegree(
    oldName: string,
    newName: string,
    durationYears: number,
    actor?: { uid: string; name: string; role: string }
  ): Promise<{ success: boolean; degree?: DegreeProgram; error?: string }> {
    assertAdmin(actor);

    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();

    if (!cleanNew) {
      return { success: false, error: 'Degree / Program Name is required.' };
    }

    if (!Number.isInteger(durationYears) || durationYears <= 0) {
      return {
        success: false,
        error: 'Duration must be a positive whole number greater than 0 (e.g. 1, 2, 3, 4, 5, 7).',
      };
    }

    const currentDegrees = await this.getDegrees();
    const targetIndex = currentDegrees.findIndex(
      (d) => d.name.toLowerCase() === cleanOld.toLowerCase()
    );

    if (targetIndex === -1) {
      return {
        success: false,
        error: `Degree "${cleanOld}" was not found.`,
      };
    }

    const nameConflict = currentDegrees.some(
      (d, i) => i !== targetIndex && d.name.toLowerCase() === cleanNew.toLowerCase()
    );
    if (nameConflict) {
      return {
        success: false,
        error: `Another degree with the name "${cleanNew}" already exists.`,
      };
    }

    const targetDegree = currentDegrees[targetIndex];
    targetDegree.name = cleanNew;
    targetDegree.durationYears = Math.floor(durationYears);
    targetDegree.updatedAt = new Date().toISOString();

    saveLocalDegrees(currentDegrees);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'academic_degrees', targetDegree.id), {
          name: targetDegree.name,
          durationYears: targetDegree.durationYears,
          updatedAt: targetDegree.updatedAt,
        });
      } catch (err) {
        console.warn('Firestore update degree fallback:', err);
      }
    }

    if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
      markDegreeDeleted(cleanOld);
      unmarkDegreeDeleted(cleanNew);
      await this.cascadeUpdateUsers({
        degreeFilter: cleanOld,
        newDegree: cleanNew,
      });
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
          changes: `Updated academic degree "${cleanOld}" to "${cleanNew}" (duration: ${targetDegree.durationYears} years).`,
        });
      } catch {
        // ignore
      }
    }

    notifySubscribers(currentDegrees);
    return { success: true, degree: targetDegree };
  },

  async addBranch(
    degreeName: string,
    branchName: string,
    actor?: { uid: string; name: string; role: string }
  ): Promise<{ success: boolean; degree?: DegreeProgram; error?: string }> {
    assertAdmin(actor);

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

    notifySubscribers(currentDegrees);
    return { success: true, degree: targetDegree };
  },

  async editBranch(
    degreeName: string,
    oldBranchName: string,
    newBranchName: string,
    actor?: { uid: string; name: string; role: string }
  ): Promise<{ success: boolean; degree?: DegreeProgram; error?: string }> {
    assertAdmin(actor);

    const cleanDeg = degreeName.trim();
    const cleanOld = oldBranchName.trim();
    const cleanNew = newBranchName.trim();

    if (!cleanNew) {
      return { success: false, error: 'Branch Name is required.' };
    }

    const currentDegrees = await this.getDegrees();
    const degreeIndex = currentDegrees.findIndex(
      (d) => d.name.toLowerCase() === cleanDeg.toLowerCase()
    );

    if (degreeIndex === -1) {
      return {
        success: false,
        error: `Selected degree "${cleanDeg}" was not found.`,
      };
    }

    const targetDegree = currentDegrees[degreeIndex];
    const oldBranchIndex = targetDegree.branches.findIndex(
      (b) => b.toLowerCase() === cleanOld.toLowerCase()
    );

    if (oldBranchIndex === -1) {
      return {
        success: false,
        error: `Branch "${cleanOld}" was not found under ${targetDegree.name}.`,
      };
    }

    const nameConflict = targetDegree.branches.some(
      (b, i) => i !== oldBranchIndex && b.toLowerCase() === cleanNew.toLowerCase()
    );
    if (nameConflict) {
      return {
        success: false,
        error: `Branch "${cleanNew}" already exists under ${targetDegree.name}.`,
      };
    }

    targetDegree.branches[oldBranchIndex] = cleanNew;
    targetDegree.updatedAt = new Date().toISOString();

    saveLocalDegrees(currentDegrees);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'academic_degrees', targetDegree.id), {
          branches: targetDegree.branches,
          updatedAt: targetDegree.updatedAt,
        });
      } catch (err) {
        console.warn('Firestore update branch fallback:', err);
      }
    }

    if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
      await this.cascadeUpdateUsers({
        degreeFilter: cleanDeg,
        branchFilter: cleanOld,
        newBranch: cleanNew,
      });
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
          changes: `Renamed branch "${cleanOld}" to "${cleanNew}" under degree "${targetDegree.name}".`,
        });
      } catch {
        // ignore
      }
    }

    notifySubscribers(currentDegrees);
    return { success: true, degree: targetDegree };
  },

  async getAffectedCounts(
    degreeName: string,
    branchName?: string
  ): Promise<{
    studentsCount: number;
    facultyCount: number;
    studentUids: string[];
    facultyUids: string[];
  }> {
    let allUsers: UserRecord[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty) {
          snap.forEach((d) => {
            allUsers.push(d.data() as UserRecord);
          });
        }
      } catch (err) {
        console.warn('Firestore getAffectedCounts fallback to local users:', err);
      }
    }
    if (allUsers.length === 0) {
      allUsers = getLocalUsers();
    }

    const cleanDeg = degreeName.trim();
    const cleanBranch = branchName?.trim();

    const studentUids: string[] = [];
    const facultyUids: string[] = [];

    for (const user of allUsers) {
      let isDegMatch = doesDegreeMatch(user.degree, user.department, cleanDeg);
      let isBrMatch = !cleanBranch || doesBranchMatch(user.branch, user.department, cleanBranch);

      if (Array.isArray(user.degreeAssignments) && user.degreeAssignments.length > 0) {
        const hasAssignment = user.degreeAssignments.some((a) => {
          const degOk =
            a.degreeName.toLowerCase().trim() === cleanDeg.toLowerCase() ||
            doesDegreeMatch(a.degreeName, undefined, cleanDeg);
          if (!degOk) return false;
          if (cleanBranch) {
            return (
              a.branchName.toLowerCase().trim() === cleanBranch.toLowerCase() ||
              doesBranchMatch(a.branchName, undefined, cleanBranch)
            );
          }
          return true;
        });
        if (hasAssignment) {
          isDegMatch = true;
          isBrMatch = true;
        }
      }

      if (!isDegMatch || !isBrMatch) continue;

      if (user.role === 'STUDENT') {
        studentUids.push(user.uid);
      } else if (user.role === 'FACULTY' || user.role === 'STAFF') {
        facultyUids.push(user.uid);
      }
    }

    return {
      studentsCount: studentUids.length,
      facultyCount: facultyUids.length,
      studentUids,
      facultyUids,
    };
  },

  async cascadeUpdateUsers(params: {
    degreeFilter: string;
    branchFilter?: string;
    newDegree?: string;
    newBranch?: string;
  }): Promise<void> {
    const { degreeFilter, branchFilter, newDegree, newBranch } = params;

    const localUsers = getLocalUsers();
    let modifiedLocal = false;
    const uidsToUpdateInFirestore: { uid: string; updates: Partial<UserRecord> }[] = [];

    for (let i = 0; i < localUsers.length; i++) {
      const u = localUsers[i];
      if (u.role !== 'STUDENT' && u.role !== 'FACULTY' && u.role !== 'STAFF') continue;

      let degMatch = doesDegreeMatch(u.degree, u.department, degreeFilter);
      let brMatch = !branchFilter || doesBranchMatch(u.branch, u.department, branchFilter);

      let assignmentModified = false;
      let newAssignments = u.degreeAssignments;
      if (Array.isArray(u.degreeAssignments) && u.degreeAssignments.length > 0) {
        newAssignments = u.degreeAssignments.map((a) => {
          let updated = { ...a };
          const aDegMatch =
            a.degreeName.toLowerCase().trim() === degreeFilter.toLowerCase() ||
            doesDegreeMatch(a.degreeName, undefined, degreeFilter);
          const aBrMatch =
            !branchFilter ||
            a.branchName.toLowerCase().trim() === branchFilter.toLowerCase() ||
            doesBranchMatch(a.branchName, undefined, branchFilter);

          if (aDegMatch && aBrMatch) {
            degMatch = true;
            brMatch = true;
            if (newDegree) {
              updated.degreeName = newDegree;
              assignmentModified = true;
            }
            if (newBranch && branchFilter) {
              updated.branchName = newBranch;
              assignmentModified = true;
            }
          }
          return updated;
        });
      }

      if (!degMatch || !brMatch) continue;

      const updates: Partial<UserRecord> = {};
      if (newDegree) {
        if (doesDegreeMatch(u.degree, undefined, degreeFilter)) {
          updates.degree = newDegree;
        }
        if (u.department && u.department.toLowerCase() === degreeFilter.toLowerCase()) {
          updates.department = newDegree;
        }
      }
      if (newBranch) {
        if (branchFilter && doesBranchMatch(u.branch, undefined, branchFilter)) {
          updates.branch = newBranch;
        }
        if (u.department && branchFilter && u.department.toLowerCase() === branchFilter.toLowerCase()) {
          updates.department = newBranch;
        }
      }
      if (assignmentModified && newAssignments) {
        updates.degreeAssignments = newAssignments;
      }

      localUsers[i] = { ...u, ...updates, updatedAt: new Date().toISOString() };
      modifiedLocal = true;
      uidsToUpdateInFirestore.push({ uid: u.uid, updates });
    }

    if (modifiedLocal) {
      saveLocalUsers(localUsers);
    }

    if (isFirebaseConfigured && db && uidsToUpdateInFirestore.length > 0) {
      try {
        const firestoreDb = db;
        const BATCH_SIZE = 450;
        for (let i = 0; i < uidsToUpdateInFirestore.length; i += BATCH_SIZE) {
          const chunk = uidsToUpdateInFirestore.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(firestoreDb);
          chunk.forEach(({ uid, updates }) => {
            batch.update(doc(firestoreDb, 'users', uid), {
              ...updates,
              updatedAt: new Date().toISOString(),
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Firestore cascadeUpdateUsers error:', err);
      }
    }
  },

  async cascadeDeleteUsers(uids: string[]): Promise<void> {
    if (uids.length === 0) return;
    const uidSet = new Set(uids);

    const localUsers = getLocalUsers();
    const remaining = localUsers.filter((u) => !uidSet.has(u.uid));
    saveLocalUsers(remaining);

    if (isFirebaseConfigured && db) {
      try {
        const firestoreDb = db;
        const BATCH_SIZE = 450;
        for (let i = 0; i < uids.length; i += BATCH_SIZE) {
          const chunk = uids.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(firestoreDb);
          chunk.forEach((uid) => {
            batch.delete(doc(firestoreDb, 'users', uid));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Firestore cascadeDeleteUsers error:', err);
      }
    }
  },

  async deleteDegree(
    degreeName: string,
    mode: 'CONFIG_ONLY' | 'CASCADE',
    actor?: { uid: string; name: string; role: string }
  ): Promise<{
    success: boolean;
    deletedStudentsCount?: number;
    deletedFacultyCount?: number;
    error?: string;
  }> {
    assertAdmin(actor);

    const cleanDeg = degreeName.trim();
    const currentDegrees = await this.getDegrees();
    const degreeIndex = currentDegrees.findIndex(
      (d) => d.name.toLowerCase() === cleanDeg.toLowerCase()
    );

    if (degreeIndex === -1) {
      return { success: false, error: `Degree "${cleanDeg}" was not found.` };
    }

    const targetDegree = currentDegrees[degreeIndex];
    let deletedStudentsCount = 0;
    let deletedFacultyCount = 0;

    if (mode === 'CASCADE') {
      const affected = await this.getAffectedCounts(cleanDeg);
      deletedStudentsCount = affected.studentsCount;
      deletedFacultyCount = affected.facultyCount;
      const allUidsToDelete = [...affected.studentUids, ...affected.facultyUids];

      await this.cascadeDeleteUsers(allUidsToDelete);
    }

    currentDegrees.splice(degreeIndex, 1);
    saveLocalDegrees(currentDegrees);
    markDegreeDeleted(cleanDeg);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'academic_degrees', targetDegree.id));
        const slug = cleanDeg.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (slug && slug !== targetDegree.id) {
          try {
            await deleteDoc(doc(db, 'academic_degrees', slug));
            await deleteDoc(doc(db, 'academic_degrees', `deg_${slug}`));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn('Firestore delete degree fallback:', err);
      }
    }

    if (actor) {
      try {
        await auditService.logAction({
          action: 'DELETE',
          entityType: 'DegreeProgram',
          entityId: targetDegree.id,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role as any,
          changes: `Deleted academic degree "${targetDegree.name}" (mode: ${mode}). Deleted students: ${deletedStudentsCount}, deleted faculty: ${deletedFacultyCount}.`,
        });
      } catch {
        // ignore
      }
    }

    notifySubscribers(currentDegrees);
    return {
      success: true,
      deletedStudentsCount,
      deletedFacultyCount,
    };
  },

  async deleteBranch(
    degreeName: string,
    branchName: string,
    mode: 'CONFIG_ONLY' | 'CASCADE',
    actor?: { uid: string; name: string; role: string }
  ): Promise<{
    success: boolean;
    deletedStudentsCount?: number;
    deletedFacultyCount?: number;
    error?: string;
  }> {
    assertAdmin(actor);

    const cleanDeg = degreeName.trim();
    const cleanBranch = branchName.trim();
    const currentDegrees = await this.getDegrees();
    const degreeIndex = currentDegrees.findIndex(
      (d) => d.name.toLowerCase() === cleanDeg.toLowerCase()
    );

    if (degreeIndex === -1) {
      return { success: false, error: `Degree "${cleanDeg}" was not found.` };
    }

    const targetDegree = currentDegrees[degreeIndex];
    const branchIndex = targetDegree.branches.findIndex(
      (b) => b.toLowerCase() === cleanBranch.toLowerCase()
    );

    if (branchIndex === -1) {
      return {
        success: false,
        error: `Branch "${cleanBranch}" was not found under ${targetDegree.name}.`,
      };
    }

    let deletedStudentsCount = 0;
    let deletedFacultyCount = 0;

    if (mode === 'CASCADE') {
      const affected = await this.getAffectedCounts(cleanDeg, cleanBranch);
      deletedStudentsCount = affected.studentsCount;
      deletedFacultyCount = affected.facultyCount;
      const allUidsToDelete = [...affected.studentUids, ...affected.facultyUids];

      await this.cascadeDeleteUsers(allUidsToDelete);
    }

    targetDegree.branches.splice(branchIndex, 1);
    targetDegree.updatedAt = new Date().toISOString();

    saveLocalDegrees(currentDegrees);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'academic_degrees', targetDegree.id), {
          branches: targetDegree.branches,
          updatedAt: targetDegree.updatedAt,
        });
      } catch (err) {
        console.warn('Firestore delete branch fallback:', err);
      }
    }

    if (actor) {
      try {
        await auditService.logAction({
          action: 'DELETE',
          entityType: 'DegreeProgram',
          entityId: targetDegree.id,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role as any,
          changes: `Deleted branch "${cleanBranch}" from degree "${targetDegree.name}" (mode: ${mode}). Deleted students: ${deletedStudentsCount}, deleted faculty: ${deletedFacultyCount}.`,
        });
      } catch {
        // ignore
      }
    }

    notifySubscribers(currentDegrees);
    return {
      success: true,
      deletedStudentsCount,
      deletedFacultyCount,
    };
  },
};
