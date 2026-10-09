import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { getLocalUsers, saveLocalUsers, safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import { requestService } from './requestService';
import { complaintService } from './complaintService';
import { gatePassService } from './gatePassService';
import {
  normalizeStudentAcademicRecord,
  normalizeFacultyAcademicRecord,
  doesDegreeMatch,
  doesBranchMatch,
} from './degreeProgramService';
import {
  getUserAssignedBranches,
  areBranchesEqual,
  findPermissionDefinition,
  canUserDelegatePermission,
} from './permissionService';
import type {
  UserRecord,
  UserRole,
  StudentCategory,
  UserPermission,
  ScopedPermission,
} from '../types';

export interface ActorContext {
  uid: string;
  name: string;
  role: UserRole;
}

export interface QueryUsersParams {
  role?: UserRole | UserRole[];
  searchQuery?: string;
  department?: string;
  degree?: string;
  branch?: string;
  authorizedBranches?: string[];
  year?: number | string;
  semester?: number | string;
  studentCategory?: StudentCategory | '';
  status?: 'active' | 'inactive' | 'all';
  sortBy?: 'name' | 'studentId' | 'rollNumber' | 'employeeId' | 'department' | 'degree' | 'branch' | 'year' | 'createdAt' | 'isActive';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface QueryUsersResult {
  users: UserRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ValidationResult {
  valid: boolean;
  field?: 'email' | 'studentId' | 'rollNumber' | 'employeeId';
  message?: string;
}

export interface DashboardStats {
  totalStudents: number;
  hostelers: number;
  dayScholars: number;
  totalFaculty: number;
  totalStaff: number;
  totalSubAdmins: number;
  pendingRequests: number;
  activeComplaints: number;
  pendingGatePasses: number;
}

class UserService {
  private inFlightUsersPromise: Promise<UserRecord[]> | null = null;
  private usersCache: { data: UserRecord[]; timestamp: number } | null = null;

  invalidateUsersCache(): void {
    this.usersCache = null;
  }

  /**
   * Fetch all users from Firestore if connected, or fallback to the local synchronized repository.
   */
  async getAllUsers(forceRefresh = false): Promise<UserRecord[]> {
    const now = Date.now();
    if (!forceRefresh && this.usersCache && now - this.usersCache.timestamp < 3000) {
      return this.usersCache.data;
    }

    if (this.inFlightUsersPromise) {
      return this.inFlightUsersPromise;
    }

    this.inFlightUsersPromise = (async () => {
      let result: UserRecord[];
      if (isFirebaseConfigured && db) {
        try {
          const usersRef = collection(db, 'users');
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore getAllUsers timed out')), 3500)
          );
          const snapshot = await Promise.race([getDocs(usersRef), timeoutPromise]);
          if (!snapshot.empty) {
            const list: UserRecord[] = [];
            snapshot.forEach((d) => {
              const raw = d.data() as UserRecord;
              const norm =
                raw.role === 'STUDENT'
                  ? normalizeStudentAcademicRecord(raw)
                  : raw.role === 'FACULTY'
                  ? normalizeFacultyAcademicRecord(raw)
                  : raw;
              list.push(norm);
            });

            // Merge with local users to ensure locally provisioned accounts are preserved
            const localUsers = getLocalUsers();
            const userMap = new Map<string, UserRecord>();
            for (const u of localUsers) {
              const norm =
                u.role === 'STUDENT'
                  ? normalizeStudentAcademicRecord(u)
                  : u.role === 'FACULTY'
                  ? normalizeFacultyAcademicRecord(u)
                  : u;
              userMap.set(u.uid || u.email.toLowerCase(), norm);
            }
            for (const u of list) {
              userMap.set(u.uid || u.email.toLowerCase(), u);
            }
            result = Array.from(userMap.values());
            saveLocalUsers(result);
          } else {
            result = getLocalUsers().map((u) =>
              u.role === 'STUDENT'
                ? normalizeStudentAcademicRecord(u)
                : u.role === 'FACULTY'
                ? normalizeFacultyAcademicRecord(u)
                : u
            );
          }
        } catch (err) {
          console.warn('Firestore getAllUsers failed, falling back to local store:', err);
          result = getLocalUsers().map((u) =>
            u.role === 'STUDENT'
              ? normalizeStudentAcademicRecord(u)
              : u.role === 'FACULTY'
              ? normalizeFacultyAcademicRecord(u)
              : u
          );
        }
      } else {
        result = getLocalUsers().map((u) =>
          u.role === 'STUDENT'
            ? normalizeStudentAcademicRecord(u)
            : u.role === 'FACULTY'
            ? normalizeFacultyAcademicRecord(u)
            : u
        );
      }
      this.usersCache = { data: result, timestamp: Date.now() };
      return result;
    })().finally(() => {
      this.inFlightUsersPromise = null;
    });

    return this.inFlightUsersPromise;
  }

  /**
   * Fetch a single user by UID
   */
  async getUserById(uid: string): Promise<UserRecord | null> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const raw = snapshot.data() as UserRecord;
          return raw.role === 'STUDENT'
            ? normalizeStudentAcademicRecord(raw)
            : raw.role === 'FACULTY'
            ? normalizeFacultyAcademicRecord(raw)
            : raw;
        }
      } catch (err) {
        console.warn('Firestore getUserById failed, falling back to local store:', err);
      }
    }
    const all = getLocalUsers();
    const found = all.find((u) => u.uid === uid) || null;
    return found
      ? found.role === 'STUDENT'
        ? normalizeStudentAcademicRecord(found)
        : found.role === 'FACULTY'
        ? normalizeFacultyAcademicRecord(found)
        : found
      : null;
  }

  /**
   * Validate uniqueness for Email, Student ID, Roll Number, and Employee ID.
   * Prevents duplicate registrations before committing to Firestore/local store.
   */
  async validateUniqueness(
    data: {
      email: string;
      studentId?: string;
      rollNumber?: string;
      employeeId?: string;
    },
    excludeUid?: string
  ): Promise<ValidationResult> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanStudentId = data.studentId?.trim().toUpperCase();
    const cleanRollNumber = data.rollNumber?.trim().toUpperCase();
    const cleanEmployeeId = data.employeeId?.trim().toUpperCase();

    const users = await this.getAllUsers();

    for (const u of users) {
      if (excludeUid && u.uid === excludeUid) continue;

      if (u.email.toLowerCase() === cleanEmail) {
        return {
          valid: false,
          field: 'email',
          message: `The email address "${data.email}" is already registered in the system.`,
        };
      }

      if (cleanStudentId && u.studentId && u.studentId.toUpperCase() === cleanStudentId) {
        return {
          valid: false,
          field: 'studentId',
          message: `The Student ID "${data.studentId}" is already assigned to another student (${u.name}).`,
        };
      }

      if (cleanRollNumber && u.rollNumber && u.rollNumber.toUpperCase() === cleanRollNumber) {
        return {
          valid: false,
          field: 'rollNumber',
          message: `The Roll Number "${data.rollNumber}" is already in use by ${u.name}.`,
        };
      }

      if (cleanEmployeeId && u.employeeId && u.employeeId.toUpperCase() === cleanEmployeeId) {
        return {
          valid: false,
          field: 'employeeId',
          message: `The Employee ID "${data.employeeId}" is already assigned to ${u.name}.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Query, filter, sort, and paginate users with Firestore-friendly behavior.
   */
  async queryUsers(params: QueryUsersParams): Promise<QueryUsersResult> {
    const {
      role,
      searchQuery = '',
      department,
      degree,
      branch,
      year,
      semester,
      studentCategory,
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 10,
      authorizedBranches,
    } = params;

    let users = await this.getAllUsers();

    // 1. Role filter
    if (role) {
      if (Array.isArray(role)) {
        users = users.filter((u) => role.includes(u.role));
      } else {
        users = users.filter((u) => u.role === role);
      }
    }

    // 2. Status filter
    if (status === 'active') {
      users = users.filter((u) => u.isActive);
    } else if (status === 'inactive') {
      users = users.filter((u) => !u.isActive);
    }

    // 3. Degree / Department filter
    const degreeOrDept = degree || department;
    if (degreeOrDept && degreeOrDept !== 'ALL') {
      users = users.filter((u) => {
        if (Array.isArray(u.degreeAssignments) && u.degreeAssignments.length > 0) {
          const hasDeg = u.degreeAssignments.some(
            (a) =>
              a.degreeName.toLowerCase() === degreeOrDept.toLowerCase() ||
              doesDegreeMatch(a.degreeName, undefined, degreeOrDept)
          );
          if (hasDeg) return true;
        }
        if (u.role === 'STUDENT' || u.role === 'FACULTY') {
          return doesDegreeMatch(u.degree, u.department, degreeOrDept);
        }
        return u.department && u.department.toLowerCase() === degreeOrDept.toLowerCase();
      });
    }

    // 4. Branch filter
    if (branch && branch !== 'ALL') {
      users = users.filter((u) => {
        if (Array.isArray(u.assignedBranches) && u.assignedBranches.length > 0) {
          const hasBr = u.assignedBranches.some(
            (b) =>
              b.toLowerCase() === branch.toLowerCase() ||
              doesBranchMatch(b, undefined, branch) ||
              areBranchesEqual(b, branch)
          );
          if (hasBr) return true;
        }
        if (Array.isArray(u.degreeAssignments) && u.degreeAssignments.length > 0) {
          const hasBr = u.degreeAssignments.some(
            (a) =>
              a.branchName.toLowerCase() === branch.toLowerCase() ||
              doesBranchMatch(a.branchName, undefined, branch)
          );
          if (hasBr) return true;
        }
        if (Array.isArray(u.specialSessionBranches) && u.specialSessionBranches.length > 0) {
          const hasSpec = u.specialSessionBranches.some(
            (s) => s.toLowerCase() === branch.toLowerCase()
          );
          if (hasSpec) return true;
        }
        if (u.role === 'STUDENT' || u.role === 'FACULTY') {
          return doesBranchMatch(u.branch, u.department, branch);
        }
        return u.branch && u.branch.toLowerCase() === branch.toLowerCase();
      });
    }

    // 4b. Authorized branches security filter (strictly restricts data access to authorized branches)
    if (authorizedBranches && authorizedBranches.length > 0) {
      users = users.filter((u) => {
        const uBranches = getUserAssignedBranches(u);
        if (uBranches.length > 0) {
          return uBranches.some((ub) =>
            authorizedBranches.some((ab) => areBranchesEqual(ub, ab))
          );
        }
        if (u.branch) {
          return authorizedBranches.some((ab) => doesBranchMatch(u.branch, u.department, ab));
        }
        if (u.degree) {
          return authorizedBranches.some((ab) => doesDegreeMatch(u.degree, u.department, ab));
        }
        return false;
      });
    }

    // 5. Year filter
    if (year && year !== 'ALL') {
      const yNum = Number(year);
      users = users.filter((u) => u.year === yNum);
    }

    // 6. Semester filter
    if (semester && semester !== 'ALL') {
      const sNum = Number(semester);
      users = users.filter((u) => u.semester === sNum);
    }

    // 7. Student Category filter
    if (studentCategory) {
      users = users.filter((u) => u.studentCategory === studentCategory);
    }

    // 8. Search query (matches name, email, studentId, rollNumber, employeeId, degree, department, branch, degreeAssignments, specialSessionBranches)
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      users = users.filter((u) => {
        const hasAssignmentMatch =
          Array.isArray(u.degreeAssignments) &&
          u.degreeAssignments.some(
            (a) =>
              a.degreeName.toLowerCase().includes(queryLower) ||
              a.branchName.toLowerCase().includes(queryLower)
          );
        const hasSpecialSessionMatch =
          Array.isArray(u.specialSessionBranches) &&
          u.specialSessionBranches.some((s) => s.toLowerCase().includes(queryLower));

        return (
          u.name.toLowerCase().includes(queryLower) ||
          u.email.toLowerCase().includes(queryLower) ||
          (u.studentId && u.studentId.toLowerCase().includes(queryLower)) ||
          (u.rollNumber && u.rollNumber.toLowerCase().includes(queryLower)) ||
          (u.employeeId && u.employeeId.toLowerCase().includes(queryLower)) ||
          (u.degree && u.degree.toLowerCase().includes(queryLower)) ||
          (u.department && u.department.toLowerCase().includes(queryLower)) ||
          (u.branch && u.branch.toLowerCase().includes(queryLower)) ||
          hasAssignmentMatch ||
          hasSpecialSessionMatch
        );
      });
    }

    // 9. Sorting
    users.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalCount = users.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const validPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (validPage - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);

    return {
      users: paginatedUsers,
      totalCount,
      totalPages,
      currentPage: validPage,
      pageSize,
    };
  }

  /**
   * Create a new User (Student, Faculty, Staff, or Sub-Admin).
   * Note: Initial account state:
   * isActive = true, isActivated = false, emailVerified = false.
   * No password is generated or stored by the administrator.
   */
  async createUser(
    userData: Omit<UserRecord, 'uid' | 'isActive' | 'isActivated' | 'createdAt' | 'updatedAt'>,
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    // 1. Uniqueness check
    const validation = await this.validateUniqueness({
      email: userData.email,
      studentId: userData.studentId,
      rollNumber: userData.rollNumber,
      employeeId: userData.employeeId,
    });

    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    // 2. Generate unique document UID
    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const initialPwd = (userData as any).initialPassword || (userData as any).authPassword;
    const newUser: UserRecord = {
      ...userData,
      uid,
      isActive: true,
      isActivated: (userData as any).isActivated ?? false,
      emailVerified: (userData as any).emailVerified ?? false,
      ...(initialPwd ? { initialPassword: initialPwd, authPassword: initialPwd } : {}),
      createdAt: now,
      updatedAt: now,
    };

    // 3. Write to Firestore if available
    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, newUser);
      } catch (err: any) {
        console.warn('Firestore user creation warning, syncing local store:', err);
      }
    }

    // 4. Update local repository
    const localUsers = getLocalUsers();
    localUsers.unshift(newUser);
    saveLocalUsers(localUsers);
    this.invalidateUsersCache();

    // 5. Append forensic audit log
    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CREATE_USER',
      entityType: newUser.role,
      entityId: newUser.studentId || newUser.employeeId || newUser.uid,
      changes: `Created ${newUser.role} record for ${newUser.name} (${newUser.email}). Assigned department: ${newUser.department || 'N/A'}.`,
    });

    return { success: true, user: newUser };
  }

  /**
   * Edit existing user profile information.
   * Prevents unauthorized alteration of role, active status, and activation status.
   */
  async updateUser(
    uid: string,
    updates: Partial<UserRecord>,
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }

    // Uniqueness validation if sensitive identifier keys changed
    if (
      (updates.email && updates.email.toLowerCase() !== existing.email.toLowerCase()) ||
      (updates.studentId && updates.studentId !== existing.studentId) ||
      (updates.rollNumber && updates.rollNumber !== existing.rollNumber) ||
      (updates.employeeId && updates.employeeId !== existing.employeeId)
    ) {
      const validation = await this.validateUniqueness(
        {
          email: updates.email || existing.email,
          studentId: updates.studentId || existing.studentId,
          rollNumber: updates.rollNumber || existing.rollNumber,
          employeeId: updates.employeeId || existing.employeeId,
        },
        uid
      );
      if (!validation.valid) {
        return { success: false, error: validation.message };
      }
    }

    // If changing category to DAY_SCHOLAR, clear hostel details cleanly (Section 9)
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.studentCategory === 'DAY_SCHOLAR') {
      sanitizedUpdates.hostelName = '';
      sanitizedUpdates.hostelBlock = '';
      sanitizedUpdates.roomNumber = '';
    }

    // Guard: Prevent arbitrary client override of security flags through generic edit
    delete (sanitizedUpdates as any).role;
    delete (sanitizedUpdates as any).isActive;
    delete (sanitizedUpdates as any).isActivated;
    delete (sanitizedUpdates as any).emailVerified;

    const now = new Date().toISOString();
    const updatedUser: UserRecord = {
      ...existing,
      ...sanitizedUpdates,
      updatedAt: now,
    };

    // Update in Firestore
    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { ...sanitizedUpdates, updatedAt: now });
      } catch (err: any) {
        console.warn('Firestore updateDoc warning:', err);
      }
    }

    // Update in local store
    const localUsers = getLocalUsers();
    const index = localUsers.findIndex((u) => u.uid === uid);
    if (index !== -1) {
      localUsers[index] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    // Record audit log
    const changedKeys = Object.keys(sanitizedUpdates).join(', ');
    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'UPDATE_USER',
      entityType: existing.role,
      entityId: existing.studentId || existing.employeeId || existing.uid,
      changes: `Updated administrative fields for ${existing.name}: [${changedKeys}]`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Directly configure user login credentials and activate status (MAIN_ADMIN only)
   */
  async setUserCredentials(
    uid: string,
    password: string,
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    if (actor.role !== 'MAIN_ADMIN') {
      return { success: false, error: 'Only MAIN_ADMIN can directly assign credentials.' };
    }
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }

    safeStorage.setItem(`campus_life_pwd_${existing.email.toLowerCase()}`, password);
    safeStorage.setItem(`campus_life_verification_${existing.email.toLowerCase()}`, 'VERIFIED');

    const updatedUser: UserRecord = {
      ...existing,
      isActivated: true,
      emailVerified: true,
      initialPassword: password,
      authPassword: password,
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', existing.uid);
        await setDoc(userDocRef, updatedUser, { merge: true });
      } catch (err: any) {
        console.warn('Firestore setUserCredentials warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(
      (u) => u.uid === existing.uid || u.email.toLowerCase() === existing.email.toLowerCase()
    );
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
    } else {
      localUsers.unshift(updatedUser);
    }
    saveLocalUsers(localUsers);
    this.invalidateUsersCache();

    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'UPDATE_USER',
      entityType: existing.role,
      entityId: existing.employeeId || existing.uid,
      changes: `Directly configured login credentials & activated access for ${existing.name} (${existing.email}).`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Soft deactivation of user account (isActive = false).
   * Campus history, complaints, and requests are preserved intact.
   */
  async deactivateUser(
    uid: string,
    actor: ActorContext,
    reason?: string
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }

    const now = new Date().toISOString();
    const updatedUser: UserRecord = {
      ...existing,
      isActive: false,
      updatedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { isActive: false, updatedAt: now });
      } catch (err: any) {
        console.warn('Firestore deactivation warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'DEACTIVATE_USER',
      entityType: existing.role,
      entityId: existing.studentId || existing.employeeId || existing.uid,
      changes: `Deactivated ${existing.role} ${existing.name} (${existing.email}). Reason: ${reason || 'Administrative Action'}.`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Reactivate user account (isActive = true).
   */
  async reactivateUser(
    uid: string,
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }

    const now = new Date().toISOString();
    const updatedUser: UserRecord = {
      ...existing,
      isActive: true,
      updatedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { isActive: true, updatedAt: now });
      } catch (err: any) {
        console.warn('Firestore reactivation warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'REACTIVATE_USER',
      entityType: existing.role,
      entityId: existing.studentId || existing.employeeId || existing.uid,
      changes: `Reactivated account access for ${existing.role} ${existing.name} (${existing.email}).`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Assign or revoke granular permissions for SUB_ADMIN, FACULTY, or STAFF.
   */
  async updateUserPermissions(
    uid: string,
    permissions: UserPermission[],
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }
    if (existing.role === 'MAIN_ADMIN') {
      return { success: false, error: 'Main Administrator permissions cannot be modified.' };
    }
    if (existing.role === 'STUDENT') {
      return { success: false, error: 'Granular permissions cannot be assigned to student accounts.' };
    }
    if (!['SUB_ADMIN', 'FACULTY', 'STAFF'].includes(existing.role)) {
      return { success: false, error: 'Permissions can only be assigned to Sub-Admin, Faculty, or Staff accounts.' };
    }

    const prevPermissions = existing.permissions || [];
    const added = permissions.filter((p) => !prevPermissions.includes(p));
    const removed = prevPermissions.filter((p) => !permissions.includes(p));

    const now = new Date().toISOString();
    const updatedUser: UserRecord = {
      ...existing,
      permissions,
      updatedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { permissions, updatedAt: now });
      } catch (err: any) {
        console.warn('Firestore permissions update warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    // Audit logs for added/revoked permissions
    if (added.length > 0) {
      await auditService.logAction({
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'ASSIGN_PERMISSION',
        entityType: existing.role,
        entityId: existing.uid,
        changes: `Granted permissions to ${existing.name} (${existing.role}): [${added.join(', ')}]`,
      });
    }

    if (removed.length > 0) {
      await auditService.logAction({
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'REVOKE_PERMISSION',
        entityType: existing.role,
        entityId: existing.uid,
        changes: `Revoked permissions from ${existing.name} (${existing.role}): [${removed.join(', ')}]`,
      });
    }

    return { success: true, user: updatedUser };
  }

  async updateSubAdminPermissions(
    uid: string,
    permissions: UserPermission[],
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    return this.updateUserPermissions(uid, permissions, actor);
  }

  /**
   * Assign or update branches for a user (SUB_ADMIN, FACULTY, STAFF).
   * Automatically sanitizes existing scoped permissions if any branch was revoked.
   */
  async updateUserAssignedBranches(
    uid: string,
    assignedBranches: string[],
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }
    if (existing.role === 'MAIN_ADMIN') {
      return { success: false, error: 'Main Administrator branch assignments cannot be modified.' };
    }
    if (existing.role === 'STUDENT') {
      return { success: false, error: 'Branch assignment for students is governed by academic degree enrolments.' };
    }

    const cleanBranches = Array.from(new Set(assignedBranches.map((b) => b.trim()).filter(Boolean)));
    const now = new Date().toISOString();

    // Sanitize scopedPermissions: automatically prune branches no longer assigned to user
    const updatedScopedPermissions = (existing.scopedPermissions || [])
      .map((sp) => {
        if (sp.scopeType === 'ALL_ASSIGNED_BRANCHES') return sp;
        const validBranches = sp.branchIds.filter((b) => cleanBranches.some((cb) => areBranchesEqual(cb, b)));
        return {
          ...sp,
          branchIds: validBranches,
        };
      })
      .filter((sp) => sp.scopeType === 'ALL_ASSIGNED_BRANCHES' || sp.branchIds.length > 0);

    const updatedUser: UserRecord = {
      ...existing,
      assignedBranches: cleanBranches,
      scopedPermissions: updatedScopedPermissions,
      updatedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, {
          assignedBranches: cleanBranches,
          scopedPermissions: updatedScopedPermissions,
          updatedAt: now,
        });
      } catch (err: any) {
        console.warn('Firestore branch assignment update warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'UPDATE_USER',
      entityType: existing.role,
      entityId: existing.uid,
      changes: `Updated assigned branches for ${existing.name} (${existing.role}): [${cleanBranches.join(', ')}]`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Assign, update, or revoke branch-scoped permissions for SUB_ADMIN, FACULTY, or STAFF.
   * Enforces delegation limits if grantor is not MAIN_ADMIN.
   * Automatically synchronizes legacy permissions array for zero backward incompatibility.
   */
  async updateUserScopedPermissions(
    uid: string,
    scopedPermissions: ScopedPermission[],
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'User record not found.' };
    }
    if (existing.role === 'MAIN_ADMIN') {
      return { success: false, error: 'Main Administrator permissions cannot be modified.' };
    }
    if (existing.role === 'STUDENT') {
      return { success: false, error: 'Administrative permissions cannot be granted to students.' };
    }

    const userAssignedBranches = getUserAssignedBranches(existing);

    // If grantor is not MAIN_ADMIN, enforce delegation limits
    if (actor.role !== 'MAIN_ADMIN') {
      const grantor = await this.getUserById(actor.uid);
      if (!grantor) {
        return { success: false, error: 'Grantor record not found.' };
      }

      for (const sp of scopedPermissions) {
        const targetBranches =
          sp.scopeType === 'ALL_ASSIGNED_BRANCHES' ? userAssignedBranches : sp.branchIds;

        for (const branch of targetBranches) {
          const delegationCheck = canUserDelegatePermission(
            grantor,
            branch,
            sp.permissionId,
            sp.actions
          );
          if (!delegationCheck.allowed) {
            return {
              success: false,
              error: delegationCheck.reason || 'Delegated permission exceeds grantor scope.',
            };
          }
        }
      }
    }

    // Sanitize scopedPermissions: Prune any branches that the target user is not assigned to
    const sanitizedPermissions: ScopedPermission[] = [];
    for (const sp of scopedPermissions) {
      const cleanActions = Array.from(new Set(sp.actions.map((a) => a.toLowerCase().trim()).filter(Boolean)));
      if (cleanActions.length === 0) continue;

      if (sp.scopeType === 'ALL_ASSIGNED_BRANCHES') {
        sanitizedPermissions.push({
          permissionId: sp.permissionId,
          actions: cleanActions,
          scopeType: 'ALL_ASSIGNED_BRANCHES',
          branchIds: [],
        });
      } else {
        const validBranches = sp.branchIds.filter((b) =>
          userAssignedBranches.some((ub) => areBranchesEqual(ub, b))
        );
        if (validBranches.length > 0) {
          sanitizedPermissions.push({
            permissionId: sp.permissionId,
            actions: cleanActions,
            scopeType: 'SELECTED_BRANCHES',
            branchIds: validBranches,
          });
        }
      }
    }

    // Derive synchronized legacy permissions array for backwards-compatibility
    const legacyPermissionsSet = new Set<UserPermission>();
    for (const sp of sanitizedPermissions) {
      const def = findPermissionDefinition(sp.permissionId);
      if (def) {
        legacyPermissionsSet.add(def.id);
      }
    }
    const legacyPermissions = Array.from(legacyPermissionsSet);

    const now = new Date().toISOString();
    const updatedUser: UserRecord = {
      ...existing,
      scopedPermissions: sanitizedPermissions,
      permissions: legacyPermissions,
      updatedAt: now,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, {
          scopedPermissions: sanitizedPermissions,
          permissions: legacyPermissions,
          updatedAt: now,
        });
      } catch (err: any) {
        console.warn('Firestore scoped permissions update warning:', err);
      }
    }

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) {
      localUsers[idx] = updatedUser;
      saveLocalUsers(localUsers);
      this.invalidateUsersCache();
    }

    await auditService.logAction({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'ASSIGN_PERMISSION',
      entityType: existing.role,
      entityId: existing.uid,
      changes: `Updated branch-scoped permissions for ${existing.name} (${existing.role}): [${sanitizedPermissions.map((p) => `${p.permissionId}(${p.scopeType}:${p.actions.join('+')})`).join(', ')}]`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Get dynamic aggregated dashboard counters from Firestore/storage.
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const users = await this.getAllUsers();

    let totalStudents = 0;
    let hostelers = 0;
    let dayScholars = 0;
    let totalFaculty = 0;
    let totalStaff = 0;
    let totalSubAdmins = 0;

    for (const u of users) {
      if (u.role === 'STUDENT') {
        totalStudents++;
        if (u.studentCategory === 'HOSTELER') hostelers++;
        if (u.studentCategory === 'DAY_SCHOLAR') dayScholars++;
      } else if (u.role === 'FACULTY') {
        totalFaculty++;
      } else if (u.role === 'STAFF') {
        totalStaff++;
      } else if (u.role === 'SUB_ADMIN') {
        totalSubAdmins++;
      }
    }

    // Pending counts strictly from real operational collections (0 default, strictly NO dummy data)
    let pendingRequests = 0;
    let activeComplaints = 0;
    let pendingGatePasses = 0;

    if (isFirebaseConfigured && db) {
      try {
        const reqSnapshot = await getDocs(
          query(collection(db, 'requests'), where('status', '==', 'PENDING'))
        );
        pendingRequests = reqSnapshot.size;
      } catch {
        // Fallback to local service
      }

      try {
        const compSnapshot = await getDocs(
          query(collection(db, 'complaints'), where('status', 'in', ['SUBMITTED', 'IN_PROGRESS', 'OVERDUE']))
        );
        activeComplaints = compSnapshot.size;
      } catch {
        // Fallback to local service
      }

      try {
        const gpSnapshot = await getDocs(
          query(collection(db, 'gatePassRequests'), where('status', '==', 'PENDING'))
        );
        pendingGatePasses = gpSnapshot.size;
      } catch {
        // Fallback to local service
      }
    }

    if (pendingRequests === 0) {
      try {
        const allReqs = await requestService.getAllRequests();
        pendingRequests = allReqs.filter((r) => r.status === 'PENDING').length;
      } catch {
        pendingRequests = 0;
      }
    }

    if (activeComplaints === 0) {
      try {
        const allCmp = await complaintService.getComplaints();
        activeComplaints = allCmp.filter((c) => ['SUBMITTED', 'IN_PROGRESS', 'OVERDUE'].includes(c.status)).length;
      } catch {
        activeComplaints = 0;
      }
    }

    if (pendingGatePasses === 0) {
      try {
        const allGp = await gatePassService.getPasses();
        pendingGatePasses = allGp.filter((g: any) => g.status === 'PENDING').length;
      } catch {
        pendingGatePasses = 0;
      }
    }

    return {
      totalStudents,
      hostelers,
      dayScholars,
      totalFaculty,
      totalStaff,
      totalSubAdmins,
      pendingRequests,
      activeComplaints,
      pendingGatePasses,
    };
  }
}

export const userService = new UserService();
