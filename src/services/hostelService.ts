import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import { activityService } from './activityService';
import type {
  HostelRoom,
  HostelAllocation,
  HostelNotice,
  UserRole,
} from '../types';

const HOSTEL_ROOMS_STORAGE_KEY = 'campus_life_hostel_rooms';
const HOSTEL_ALLOCATIONS_STORAGE_KEY = 'campus_life_hostel_allocations';
const HOSTEL_NOTICES_STORAGE_KEY = 'campus_life_hostel_notices';

function getLocalRooms(): HostelRoom[] {
  try {
    const raw = safeStorage.getItem(HOSTEL_ROOMS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return [
    {
      id: 'room_204_A',
      hostelName: 'Aryabhatta Hall of Residence',
      block: 'Block A',
      roomNumber: '204',
      floor: 2,
      capacity: 3,
      occupied: 3,
      wardenName: 'Prof. Rajesh Swain',
      wardenContact: '+91 98765 00001',
      caretakerName: 'Mr. J. K. Nayak',
      caretakerContact: '+91 98765 00012',
      curfewTime: '09:00 PM',
    },
    {
      id: 'room_205_A',
      hostelName: 'Aryabhatta Hall of Residence',
      block: 'Block A',
      roomNumber: '205',
      floor: 2,
      capacity: 3,
      occupied: 2,
      wardenName: 'Prof. Rajesh Swain',
      wardenContact: '+91 98765 00001',
      caretakerName: 'Mr. J. K. Nayak',
      caretakerContact: '+91 98765 00012',
      curfewTime: '09:00 PM',
    },
    {
      id: 'room_101_B',
      hostelName: 'Kalam Hall of Residence',
      block: 'Block B',
      roomNumber: '101',
      floor: 1,
      capacity: 2,
      occupied: 2,
      wardenName: 'Dr. Snigdha Mohapatra',
      wardenContact: '+91 98765 00020',
      caretakerName: 'Mrs. R. Panda',
      caretakerContact: '+91 98765 00025',
      curfewTime: '09:00 PM',
    },
  ];
}

function saveLocalRooms(rooms: HostelRoom[]) {
  try {
    safeStorage.setItem(HOSTEL_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // ignore
  }
}

function getLocalAllocations(): HostelAllocation[] {
  try {
    const raw = safeStorage.getItem(HOSTEL_ALLOCATIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return [
    {
      id: 'alloc_001',
      studentId: 'student_uid_001',
      studentName: 'Aarav Sharma',
      studentRoll: '220101001',
      hostelName: 'Aryabhatta Hall of Residence',
      block: 'Block A',
      roomNumber: '204',
      bedNumber: 'A',
      allocationDate: '2025-07-20',
      status: 'ALLOCATED',
      roommates: [
        { name: 'Vikash Kumar', rollNumber: '220101015', branch: 'CSE' },
        { name: 'Subham Pradhan', rollNumber: '220101042', branch: 'CSE' },
      ],
    },
  ];
}

function saveLocalAllocations(allocations: HostelAllocation[]) {
  try {
    safeStorage.setItem(HOSTEL_ALLOCATIONS_STORAGE_KEY, JSON.stringify(allocations));
  } catch {
    // ignore
  }
}

function getLocalNotices(): HostelNotice[] {
  try {
    const raw = safeStorage.getItem(HOSTEL_NOTICES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return [
    {
      id: 'hnotice_001',
      title: 'Water Tank Sanitization Schedule',
      content: 'Overhead water tanks in Block A and B will undergo chemical disinfection on Sunday from 09:00 AM to 01:00 PM. Alternate water points are active on the ground floor.',
      hostelName: 'Aryabhatta Hall of Residence',
      block: 'Block A & B',
      date: '2026-10-02',
      priority: 'IMPORTANT',
    },
    {
      id: 'hnotice_002',
      title: 'Quiet Study Hours Implementation',
      content: 'In view of upcoming mid-term examinations, strict silence is to be observed in corridors and study halls after 10:00 PM.',
      hostelName: 'Aryabhatta Hall of Residence',
      date: '2026-09-28',
      priority: 'NORMAL',
    },
  ];
}

function saveLocalNotices(notices: HostelNotice[]) {
  try {
    safeStorage.setItem(HOSTEL_NOTICES_STORAGE_KEY, JSON.stringify(notices));
  } catch {
    // ignore
  }
}

export const hostelService = {
  async getAllocationForStudent(studentId: string): Promise<{
    allocation: HostelAllocation | null;
    roomDetails: HostelRoom | null;
  }> {
    const allocations = getLocalAllocations();
    const alloc = allocations.find((a) => a.studentId === studentId && a.status === 'ALLOCATED') || null;

    if (!alloc) {
      return { allocation: null, roomDetails: null };
    }

    const rooms = getLocalRooms();
    const room =
      rooms.find(
        (r) =>
          r.hostelName.toLowerCase() === alloc.hostelName.toLowerCase() &&
          r.block.toLowerCase() === alloc.block.toLowerCase() &&
          r.roomNumber === alloc.roomNumber
      ) || null;

    return { allocation: alloc, roomDetails: room };
  },

  async getAllRooms(): Promise<HostelRoom[]> {
    let list: HostelRoom[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'hostelRooms'));
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HostelRoom, 'id'>) }));
        }
      } catch (err) {
        console.warn('Firestore hostel rooms fallback:', err);
      }
    }
    if (list.length === 0) list = getLocalRooms();
    return list;
  },

  async getAllAllocations(): Promise<HostelAllocation[]> {
    let list: HostelAllocation[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'hostelAllocations'));
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HostelAllocation, 'id'>) }));
        }
      } catch (err) {
        console.warn('Firestore hostel allocations fallback:', err);
      }
    }
    if (list.length === 0) list = getLocalAllocations();
    return list;
  },

  async getHostelNotices(hostelName?: string): Promise<HostelNotice[]> {
    const all = getLocalNotices();
    if (!hostelName) return all;
    return all.filter((n) => n.hostelName.toLowerCase().includes(hostelName.toLowerCase()));
  },

  async assignRoomAllocation(
    data: {
      studentId: string;
      studentName: string;
      studentRoll: string;
      hostelName: string;
      block: string;
      roomNumber: string;
      bedNumber?: string;
    },
    adminActor: { uid: string; name: string; role: UserRole }
  ): Promise<HostelAllocation> {
    const id = `alloc_${Date.now()}`;
    const newAlloc: HostelAllocation = {
      id,
      studentId: data.studentId,
      studentName: data.studentName,
      studentRoll: data.studentRoll,
      hostelName: data.hostelName,
      block: data.block,
      roomNumber: data.roomNumber,
      bedNumber: data.bedNumber || 'A',
      allocationDate: new Date().toISOString().split('T')[0],
      status: 'ALLOCATED',
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'hostelAllocations', id);
        await setDoc(docRef, newAlloc);
      } catch (err) {
        console.warn('Firestore hostel allocation fallback:', err);
      }
    }

    const localAllocations = getLocalAllocations();
    localAllocations.push(newAlloc);
    saveLocalAllocations(localAllocations);

    // Update room occupancy
    const rooms = getLocalRooms();
    const room = rooms.find(
      (r) =>
        r.hostelName.toLowerCase() === data.hostelName.toLowerCase() &&
        r.block.toLowerCase() === data.block.toLowerCase() &&
        r.roomNumber === data.roomNumber
    );
    if (room && room.occupied < room.capacity) {
      room.occupied += 1;
      saveLocalRooms(rooms);
    }

    // Audit log
    await auditService.logAction({
      actorUid: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      action: 'UPDATE_HOSTEL_ALLOCATION',
      entityType: 'HOSTEL_ALLOCATION',
      entityId: id,
      changes: `Allocated ${data.hostelName}, ${data.block} Room ${data.roomNumber} to ${data.studentName} (${data.studentRoll})`,
    });

    // Activity log
    await activityService.logActivity({
      userId: data.studentId,
      userName: data.studentName,
      userRole: 'STUDENT',
      activityType: 'HOSTEL_ALLOCATION_UPDATED',
      description: `Room allocation updated: ${data.hostelName} ${data.block} Room ${data.roomNumber}`,
      entityType: 'HOSTEL',
      entityId: id,
    });

    return newAlloc;
  },

  async addHostelNotice(
    notice: Omit<HostelNotice, 'id' | 'date'>,
    adminActor: { uid: string; name: string; role: UserRole }
  ): Promise<HostelNotice> {
    const id = `hnotice_${Date.now()}`;
    const newNotice: HostelNotice = {
      ...notice,
      id,
      date: new Date().toISOString().split('T')[0],
    };

    const localList = getLocalNotices();
    localList.unshift(newNotice);
    saveLocalNotices(localList);

    await auditService.logAction({
      actorUid: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      action: 'CREATE_HOSTEL_NOTICE',
      entityType: 'HOSTEL_NOTICE',
      entityId: id,
      changes: `Published notice "${notice.title}" for ${notice.hostelName}`,
    });

    return newNotice;
  },
};
