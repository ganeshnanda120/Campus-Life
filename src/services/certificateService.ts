import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import type { Certificate } from '../types';

const CERTIFICATE_STORAGE_KEY = 'campus_life_certificates';

const INITIAL_CERTIFICATES: Certificate[] = [
  {
    id: 'cert_001',
    certificateId: 'CERT-2026-0042',
    requestId: 'REQ-2026-001',
    studentId: 'STU2026001',
    studentName: 'Aarav Sharma',
    studentRoll: '220101001',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
    semester: 6,
    certificateType: 'Bonafide Certificate',
    issueDate: '2026-02-10T10:00:00.000Z',
    issuedBy: 'Prof. Rajesh Swain',
    issuedByRole: 'SUB_ADMIN',
    purpose: 'State Post-Matric Merit Scholarship Application',
    status: 'ACTIVE',
    institutionName: 'Biju Patnaik University of Technology — Campus Life',
  },
  {
    id: 'cert_002',
    certificateId: 'CERT-2026-0078',
    requestId: 'REQ-2026-004',
    studentId: 'STU2026001',
    studentName: 'Aarav Sharma',
    studentRoll: '220101001',
    department: 'Computer Science & Engineering',
    branch: 'CSE',
    year: 3,
    semester: 6,
    certificateType: 'Study & Conduct Certificate',
    issueDate: '2026-01-20T14:30:00.000Z',
    issuedBy: 'Chief Administrative Officer',
    issuedByRole: 'MAIN_ADMIN',
    purpose: 'National Bank Educational Loan Verification',
    status: 'ACTIVE',
    institutionName: 'Biju Patnaik University of Technology — Campus Life',
  }
];

function getLocalCertificates(): Certificate[] {
  try {
    const raw = safeStorage.getItem(CERTIFICATE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  try {
    safeStorage.setItem(CERTIFICATE_STORAGE_KEY, JSON.stringify(INITIAL_CERTIFICATES));
  } catch {
    // ignore
  }
  return INITIAL_CERTIFICATES;
}

function saveLocalCertificates(certs: Certificate[]) {
  try {
    safeStorage.setItem(CERTIFICATE_STORAGE_KEY, JSON.stringify(certs));
  } catch {
    // ignore
  }
}

export const certificateService = {
  async getStudentCertificates(studentId: string): Promise<Certificate[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'certificates');
        const q = query(colRef, where('studentId', '==', studentId), orderBy('issueDate', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Certificate, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore certificates fetch fallback:', err);
      }
    }
    const all = getLocalCertificates();
    return all.filter((c) => c.studentId === studentId);
  },

  async getAllCertificates(): Promise<Certificate[]> {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'certificates');
        const q = query(colRef, orderBy('issueDate', 'desc'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Certificate, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore all certificates fetch fallback:', err);
      }
    }
    return getLocalCertificates();
  },

  async getCertificateById(certificateId: string): Promise<Certificate | null> {
    const all = getLocalCertificates();
    return all.find((c) => c.id === certificateId || c.certificateId === certificateId) || null;
  },

  async issueCertificate(data: Omit<Certificate, 'id' | 'certificateId' | 'issueDate' | 'status'>): Promise<Certificate> {
    const count = getLocalCertificates().length + 1;
    const certNum = String(count).padStart(4, '0');
    const certificateId = `CERT-2026-${certNum}`;
    const id = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newCert: Certificate = {
      ...data,
      id,
      certificateId,
      issueDate: new Date().toISOString(),
      status: 'ACTIVE',
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'certificates', id);
        await setDoc(docRef, newCert);
      } catch (err) {
        console.warn('Firestore certificate issue fallback:', err);
      }
    }

    const localList = getLocalCertificates();
    localList.unshift(newCert);
    saveLocalCertificates(localList);

    return newCert;
  },
};
