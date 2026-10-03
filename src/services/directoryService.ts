import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import type { ServiceDirectoryEntry, UserRecord } from '../types';

const DIRECTORY_STORAGE_KEY = 'campus_life_service_directory';

const INITIAL_SERVICES: ServiceDirectoryEntry[] = [
  {
    id: 'svc_001',
    department: 'Examination',
    responsibleOffice: 'Office of the Controller of Examinations',
    servicesProvided: ['Semester Grade Cards', 'Official Transcripts', 'Provisional Degree', 'Form Fill-up Verification', 'Re-evaluation Grievances'],
    workingHours: '09:30 AM – 05:00 PM (Monday to Saturday)',
    location: 'Administrative Block, 1st Floor, Room 104',
    contactEmail: 'coe@bputcampuslife.edu',
    contactPhone: '+91 674 2300101',
    instructions: 'Bring your student digital ID and examination admit card for all in-person certificate collections.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_002',
    department: 'Hostel',
    responsibleOffice: 'Chief Warden & Hostel Administrative Office',
    servicesProvided: ['Room Allocation & Bed Transfer', 'Maintenance Oversight', 'Gate Pass Approvals', 'Guest Accommodation Clearance'],
    workingHours: '08:00 AM – 08:00 PM (All Days)',
    location: 'Hostel Block A, Ground Floor Administration Suite',
    contactEmail: 'chiefwarden@bputcampuslife.edu',
    contactPhone: '+91 674 2300102',
    instructions: 'Gate pass physical verification slips can be collected during evening roll call between 07:00 PM and 08:30 PM.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_003',
    department: 'IT',
    responsibleOffice: 'Campus IT Services & Network Operating Center (NOC)',
    servicesProvided: ['Campus Wi-Fi Credentials', 'Email Verification Support', 'ERP Account Password Reset', 'Computer Lab Access Tokens'],
    workingHours: '09:00 AM – 07:00 PM (Monday to Saturday)',
    location: 'Central Computing Building, 2nd Floor, Room 210',
    contactEmail: 'ithelpdesk@bputcampuslife.edu',
    contactPhone: '+91 674 2300103',
    instructions: 'Submit portal login reset tickets through the digital Help Center or visit with institutional identity card.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_004',
    department: 'Medical',
    responsibleOffice: 'Campus Health & Emergency Dispensary',
    servicesProvided: ['24/7 First Aid & Urgent Care', 'Prescription Pharmacy', 'Doctor Consultation', 'Emergency Ambulance Dispatch'],
    workingHours: '24 Hours / 7 Days a Week',
    location: 'Health Dispensary Block, Adjacent to Gate 2',
    contactEmail: 'healthcenter@bputcampuslife.edu',
    contactPhone: '+91 674 2300108',
    instructions: 'Direct emergency helpline available 24/7 for all hostellers and campus residents.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_005',
    department: 'Accounts',
    responsibleOffice: 'Finance & Accounts Division',
    servicesProvided: ['Semester Fee Receipts', 'Hostel Mess Fee Verification', 'Caution Deposit Refunds', 'Scholarship Endorsement'],
    workingHours: '10:00 AM – 04:30 PM (Monday to Friday)',
    location: 'Administrative Block, Ground Floor Counter 2–4',
    contactEmail: 'accounts@bputcampuslife.edu',
    contactPhone: '+91 674 2300105',
    instructions: 'Please produce online payment transaction UTR numbers for fee reconciliation.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_006',
    department: 'Library',
    responsibleOffice: 'Biju Patnaik Central University Library',
    servicesProvided: ['Book Borrowing & Renewals', 'Digital Research IEEE Access', 'Plagiarism Verification Checks', 'Quiet Reading Hall Booking'],
    workingHours: '08:00 AM – 10:00 PM (Examination week: Until 12:00 AM)',
    location: 'Central Library Building',
    contactEmail: 'library@bputcampuslife.edu',
    contactPhone: '+91 674 2300106',
    instructions: 'Digital ID barcode required for turnstile entry and book borrowing.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_007',
    department: 'Maintenance',
    responsibleOffice: 'Campus Estate & Engineering Maintenance Division',
    servicesProvided: ['Electrical Repair Dispatch', 'Plumbing & Water Supply', 'Civil Infrastructure Rectification', 'Air Conditioning Maintenance'],
    workingHours: '08:00 AM – 06:00 PM (Emergency on-call 24/7)',
    location: 'Estate Office Workshop, Near Power Substation',
    contactEmail: 'estate@bputcampuslife.edu',
    contactPhone: '+91 674 2300107',
    instructions: 'Register routine maintenance tickets through the Complaints & SLA module for monitored resolution.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'svc_008',
    department: 'Student Affairs',
    responsibleOffice: 'Dean of Student Welfare & Extracurriculars',
    servicesProvided: ['Student Club Approvals', 'Concession Bus Passes', 'Anti-Ragging Squad Assistance', 'Festival & Symposium Permissions'],
    workingHours: '09:30 AM – 05:00 PM (Monday to Friday)',
    location: 'Student Activity Center (SAC), 1st Floor',
    contactEmail: 'dsw@bputcampuslife.edu',
    contactPhone: '+91 674 2300109',
    instructions: 'Club proposals must be endorsed by the respective faculty advisor before submitting.',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
];

function getLocalServices(): ServiceDirectoryEntry[] {
  try {
    const raw = safeStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return INITIAL_SERVICES;
}

function saveLocalServices(services: ServiceDirectoryEntry[]) {
  try {
    safeStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(services));
  } catch {
    // ignore
  }
}

export const directoryService = {
  async getServices(filters?: { department?: string; search?: string }): Promise<ServiceDirectoryEntry[]> {
    let services = getLocalServices();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'serviceDirectory');
        const q = query(colRef, orderBy('department', 'asc'), firestoreLimit(50));
        const snap = await getDocs(q);
        if (!snap.empty) {
          services = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ServiceDirectoryEntry, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore serviceDirectory fetch fallback:', err);
      }
    }

    return services.filter((s) => {
      if (s.status === 'INACTIVE') return false;
      if (filters?.department && filters.department !== 'ALL' && s.department !== filters.department) {
        return false;
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matches =
          s.department.toLowerCase().includes(q) ||
          s.responsibleOffice.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.servicesProvided.some((srv) => srv.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  },

  async addService(
    data: Omit<ServiceDirectoryEntry, 'id' | 'createdAt' | 'status'>,
    author: UserRecord
  ): Promise<ServiceDirectoryEntry> {
    const id = `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: ServiceDirectoryEntry = {
      ...data,
      id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await setDoc(docRef, newEntry);
      } catch (err) {
        console.warn('Firestore serviceDirectory add fallback:', err);
      }
    }

    const localList = getLocalServices();
    localList.push(newEntry);
    saveLocalServices(localList);

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'SERVICE_DIRECTORY_ADDED',
      entityType: 'service_directory',
      entityId: id,
      newValue: JSON.stringify({ office: newEntry.responsibleOffice }),
    });

    return newEntry;
  },

  async updateService(
    id: string,
    updates: Partial<ServiceDirectoryEntry>,
    actor: UserRecord
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const finalUpdates = { ...updates, updatedAt };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await updateDoc(docRef, finalUpdates);
      } catch (err) {
        console.warn('Firestore serviceDirectory update fallback:', err);
      }
    }

    const localList = getLocalServices();
    const idx = localList.findIndex((s) => s.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...finalUpdates };
      saveLocalServices(localList);
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'SERVICE_DIRECTORY_UPDATED',
      entityType: 'service_directory',
      entityId: id,
      changes: JSON.stringify(updates),
    });
  },

  async deleteService(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'serviceDirectory', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore serviceDirectory delete fallback:', err);
      }
    }

    const localList = getLocalServices().filter((s) => s.id !== id);
    saveLocalServices(localList);

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'SERVICE_DIRECTORY_DELETED',
      entityType: 'service_directory',
      entityId: id,
    });
  },
};
