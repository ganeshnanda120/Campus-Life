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
import { getLocalUsers, saveLocalUsers } from '../firebase/authService';
import { auditService } from './auditService';
import { requestService } from './requestService';
import { complaintService } from './complaintService';
import { gatePassService } from './gatePassService';
import type {
  UserRecord,
  UserRole,
  StudentCategory,
  UserPermission,
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
  branch?: string;
  year?: number | string;
  semester?: number | string;
  studentCategory?: StudentCategory | '';
  status?: 'active' | 'inactive' | 'all';
  sortBy?: 'name' | 'studentId' | 'rollNumber' | 'employeeId' | 'department' | 'branch' | 'year' | 'createdAt' | 'isActive';
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
  /**
   * Fetch all users from Firestore if connected, or fallback to the local synchronized repository.
   */
  async getAllUsers(): Promise<UserRecord[]> {
    if (isFirebaseConfigured && db) {
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        if (!snapshot.empty) {
          const list: UserRecord[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as UserRecord);
          });
          return list;
        }
      } catch (err) {
        console.warn('Firestore getAllUsers failed, falling back to local store:', err);
      }
    }
    return getLocalUsers();
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
          return snapshot.data() as UserRecord;
        }
      } catch (err) {
        console.warn('Firestore getUserById failed, falling back to local store:', err);
      }
    }
    const all = getLocalUsers();
    return all.find((u) => u.uid === uid) || null;
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
      branch,
      year,
      semester,
      studentCategory,
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 10,
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

    // 3. Department filter
    if (department && department !== 'ALL') {
      users = users.filter(
        (u) => u.department && u.department.toLowerCase() === department.toLowerCase()
      );
    }

    // 4. Branch filter
    if (branch && branch !== 'ALL') {
      users = users.filter((u) => u.branch && u.branch.toLowerCase() === branch.toLowerCase());
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

    // 8. Search query (matches name, email, studentId, rollNumber, employeeId, department, branch)
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      users = users.filter((u) => {
        return (
          u.name.toLowerCase().includes(queryLower) ||
          u.email.toLowerCase().includes(queryLower) ||
          (u.studentId && u.studentId.toLowerCase().includes(queryLower)) ||
          (u.rollNumber && u.rollNumber.toLowerCase().includes(queryLower)) ||
          (u.employeeId && u.employeeId.toLowerCase().includes(queryLower)) ||
          (u.department && u.department.toLowerCase().includes(queryLower)) ||
          (u.branch && u.branch.toLowerCase().includes(queryLower))
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

    const newUser: UserRecord = {
      ...userData,
      uid,
      isActive: true,
      isActivated: false,
      emailVerified: false,
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
   * Assign or revoke granular permissions for a Sub-Admin.
   */
  async updateSubAdminPermissions(
    uid: string,
    permissions: UserPermission[],
    actor: ActorContext
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const existing = await this.getUserById(uid);
    if (!existing) {
      return { success: false, error: 'Sub-Admin record not found.' };
    }
    if (existing.role !== 'SUB_ADMIN') {
      return { success: false, error: 'Permissions can only be assigned to Sub-Admin accounts.' };
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
    }

    // Audit logs for added/revoked permissions
    if (added.length > 0) {
      await auditService.logAction({
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'ASSIGN_PERMISSION',
        entityType: 'SUB_ADMIN',
        entityId: existing.uid,
        changes: `Granted permissions to ${existing.name}: [${added.join(', ')}]`,
      });
    }

    if (removed.length > 0) {
      await auditService.logAction({
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'REVOKE_PERMISSION',
        entityType: 'SUB_ADMIN',
        entityId: existing.uid,
        changes: `Revoked permissions from ${existing.name}: [${removed.join(', ')}]`,
      });
    }

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
