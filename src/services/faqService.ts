import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import type { CampusFAQ, UserRecord } from '../types';

const FAQS_STORAGE_KEY = 'campus_life_help_faqs';

const INITIAL_FAQS: CampusFAQ[] = [
  {
    id: 'faq_001',
    category: 'Requests',
    question: 'How do I request an official Bonafide or Study Certificate?',
    answer: 'Navigate to "Requests & Certificates" from the main sidebar. Click "+ New Request", choose the required certificate type (Bonafide, Study, Character, etc.), specify the institutional purpose (e.g. passport application, state scholarship verification), upload any supporting documents if required, and submit. The academic section will verify and issue the digitally signed document.',
    tags: ['certificate', 'bonafide', 'scholarship', 'study'],
    helpfulCount: 0,
  },
  {
    id: 'faq_002',
    category: 'Gate Pass',
    question: 'What is the procedure for obtaining an overnight hostel gate pass?',
    answer: 'Hostel residents must navigate to the "Gate Pass" module at least 6 hours prior to planned departure. Enter your destination, leave date/time, expected return date/time, and parent/guardian contact consent. Upon warden review and digital approval, a cryptographic QR-coded digital gate pass is generated. Present this QR pass to security guards at Gate 1 or Gate 2 upon egress and re-entry.',
    tags: ['gate pass', 'hostel', 'leave', 'security', 'qr code'],
    helpfulCount: 0,
  },
  {
    id: 'faq_003',
    category: 'Attendance',
    question: 'What happens if my attendance in a course falls below 75%?',
    answer: 'In strict adherence with BPUT academic regulations, maintaining a minimum of 75% attendance in theory lectures and laboratory sessions is mandatory to appear for the end-semester examinations. If your percentage falls between 65% and 74%, a formal condonation request accompanied by certified medical documentation must be submitted via the Requests module for senate approval.',
    tags: ['attendance', 'bput', 'shortage', 'exams', 'medical'],
    helpfulCount: 0,
  },
  {
    id: 'faq_004',
    category: 'Complaints',
    question: 'How do I report electrical, plumbing, or internet issues in my hostel room?',
    answer: 'Go to "Complaints & SLA", click "Report Issue", select the relevant category (Hostel / Electrical / Plumbing / Wi-Fi), and provide your exact room and block location. A formal resolution timer (SLA) is attached immediately, and the ticket is dispatched to the campus estate technician. You can track status and provide completion feedback.',
    tags: ['complaint', 'maintenance', 'electrical', 'plumbing', 'sla'],
    helpfulCount: 0,
  },
  {
    id: 'faq_005',
    category: 'Login & Account',
    question: 'How does first-time student activation work without self-registration?',
    answer: 'Campus Life employs strict administrator-controlled enrollment. When the admissions department enters your university record, an official activation invitation is sent to your registered institutional email. Enter your email on the Activation screen, verify your email link, set your confidential password, and your account will be activated.',
    tags: ['login', 'activation', 'password', 'registration'],
    helpfulCount: 0,
  },
  {
    id: 'faq_006',
    category: 'Mess',
    question: 'Where can I see the daily hostel dining menu and submit meal feedback?',
    answer: 'Click "Hostel & Mess" in the navigation drawer. The daily breakfast, lunch, snacks, and dinner schedules are updated weekly by the mess committee. You can also vote in active dining polls and submit quality feedback directly to the chief warden.',
    tags: ['mess', 'dining', 'food', 'menu', 'hostel'],
    helpfulCount: 0,
  },
  {
    id: 'faq_007',
    category: 'Exams',
    question: 'How do I download my BPUT semester admit card and view exam schedules?',
    answer: 'Examination notices, timetables, and admit card release dates are announced under "Notices & Circulars" and the "Campus Calendar". Once published, you can verify your registration status and collect stamped hall tickets from the Examination Cell.',
    tags: ['exams', 'admit card', 'schedule', 'results', 'coe'],
    helpfulCount: 0,
  },
  {
    id: 'faq_008',
    category: 'Notices',
    question: 'Why do certain important notices require digital acknowledgement?',
    answer: 'Critical administrative notices (such as exam fee deadlines, safety emergencies, or code of conduct updates) have mandatory acknowledgement enabled by university leadership. Clicking "I have read and understood" records a tamper-proof timestamp confirming your awareness.',
    tags: ['notices', 'acknowledgement', 'circular', 'compliance'],
    helpfulCount: 0,
  },
];

function getLocalFAQs(): CampusFAQ[] {
  try {
    const raw = safeStorage.getItem(FAQS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Sanitize legacy fake hardcoded numbers
        return parsed.map((item) => ({
          ...item,
          helpfulCount: item.helpfulCount && item.helpfulCount > 50 ? 0 : item.helpfulCount || 0,
        }));
      }
    }
  } catch {
    // ignore
  }
  return INITIAL_FAQS;
}

function saveLocalFAQs(faqs: CampusFAQ[]) {
  try {
    safeStorage.setItem(FAQS_STORAGE_KEY, JSON.stringify(faqs));
  } catch {
    // ignore
  }
}

export const faqService = {
  async getFAQs(category?: string, search?: string): Promise<CampusFAQ[]> {
    let faqs = getLocalFAQs();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'helpCenter');
        const q = query(colRef, firestoreLimit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          faqs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CampusFAQ, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore helpCenter fetch fallback:', err);
      }
    }

    return faqs.filter((faq) => {
      if (category && category !== 'ALL' && faq.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q) ||
          faq.category.toLowerCase().includes(q) ||
          (faq.tags && faq.tags.some((t) => t.toLowerCase().includes(q)));
        if (!match) return false;
      }
      return true;
    });
  },

  async markHelpful(faqId: string): Promise<void> {
    const faqs = getLocalFAQs();
    const item = faqs.find((f) => f.id === faqId);
    if (item) {
      item.helpfulCount = (item.helpfulCount || 0) + 1;
      saveLocalFAQs(faqs);
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'helpCenter', faqId);
        await updateDoc(docRef, { helpfulCount: (item?.helpfulCount || 1) });
      } catch (err) {
        console.warn('Firestore helpCenter markHelpful fallback:', err);
      }
    }
  },

  async createFAQ(data: Omit<CampusFAQ, 'id'>, author: UserRecord): Promise<CampusFAQ> {
    const id = `faq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newFaq: CampusFAQ = {
      ...data,
      id,
      helpfulCount: 0,
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'helpCenter', id);
        await setDoc(docRef, newFaq);
      } catch (err) {
        console.warn('Firestore FAQ create fallback:', err);
      }
    }

    const localList = getLocalFAQs();
    localList.unshift(newFaq);
    saveLocalFAQs(localList);

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'FAQ_CREATED',
      entityType: 'help_center',
      entityId: id,
      newValue: JSON.stringify({ question: newFaq.question }),
    });

    return newFaq;
  },

  async deleteFAQ(faqId: string, author: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'helpCenter', faqId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore FAQ delete fallback:', err);
      }
    }

    const localList = getLocalFAQs().filter((f) => f.id !== faqId);
    saveLocalFAQs(localList);

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'FAQ_DELETED',
      entityType: 'help_center',
      entityId: faqId,
    });
  },
};
