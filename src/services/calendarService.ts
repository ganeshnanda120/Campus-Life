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
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import type { CampusCalendarEvent, UserRecord } from '../types';

const CALENDAR_STORAGE_KEY = 'campus_life_calendar_events';
const activeCalendarListeners = new Set<(events: CampusCalendarEvent[]) => void>();

function notifyLocalCalendarListeners() {
  calendarService.getEvents().then((evts) => {
    activeCalendarListeners.forEach((cb) => cb(evts));
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CALENDAR_STORAGE_KEY) {
      notifyLocalCalendarListeners();
    }
  });
}

const INITIAL_EVENTS: CampusCalendarEvent[] = [
  {
    id: 'cal_ev_001',
    title: 'BPUT End-Semester Theory Examinations (Phase 1)',
    category: 'examination',
    startDate: '2026-10-15T09:30:00.000Z',
    endDate: '2026-10-24T12:30:00.000Z',
    description: 'Autonomous end-semester examinations for 5th and 7th semester students across all engineering branches. Reporting time 09:00 AM sharp at Central Exam Block.',
    location: 'Central Exam Block, Halls 1 to 8',
    organizer: 'Office of the Controller of Examinations',
    status: 'PUBLISHED',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cal_ev_002',
    title: 'Diwali & Kali Puja Institutional Break',
    category: 'holiday',
    startDate: '2026-10-28T00:00:00.000Z',
    endDate: '2026-11-02T23:59:59.000Z',
    description: 'Campus academic activities remain suspended. Hostel mess facilities operate on holiday timings. Central Library reading room open 09:00 AM – 04:00 PM.',
    location: 'Main University Campus',
    organizer: 'General Administration',
    status: 'PUBLISHED',
    createdAt: '2026-09-25T10:00:00.000Z',
  },
  {
    id: 'cal_ev_003',
    title: 'Annual Inter-College Hackathon 2026',
    category: 'event',
    startDate: '2026-11-14T09:00:00.000Z',
    endDate: '2026-11-15T18:00:00.000Z',
    description: '36-hour non-stop prototyping hackathon focusing on Campus Operations, Smart City Solutions, and Green Energy. Mentors from premier tech firms on campus.',
    location: 'Computing Center & Innovation Hub',
    organizer: 'Center for Innovation & Entrepreneurship',
    status: 'PUBLISHED',
    createdAt: '2026-09-28T12:00:00.000Z',
  },
  {
    id: 'cal_ev_004',
    title: 'Hands-on Workshop: High Performance Cloud Architectures',
    category: 'workshop',
    startDate: '2026-11-20T14:00:00.000Z',
    endDate: '2026-11-20T17:30:00.000Z',
    description: 'Interactive session covering distributed systems, containerization, and zero-trust security. Certificate of participation will be issued.',
    location: 'Seminar Hall 2, Dept of CSE',
    organizer: 'Department of Computer Science & Engineering',
    status: 'PUBLISHED',
    createdAt: '2026-10-02T11:00:00.000Z',
  },
  {
    id: 'cal_ev_005',
    title: 'Final Date for State Post-Matric Scholarship Submission',
    category: 'deadline',
    startDate: '2026-11-05T17:00:00.000Z',
    description: 'Last date for submission of verified Bonafide and Income certificates to the Student Welfare Section for scholarship disbursement.',
    location: 'Student Affairs Window 3',
    organizer: 'Scholarship & Welfare Section',
    status: 'PUBLISHED',
    createdAt: '2026-10-01T09:00:00.000Z',
  },
];

function getLocalEvents(): CampusCalendarEvent[] {
  try {
    const raw = safeStorage.getItem(CALENDAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return INITIAL_EVENTS;
}

function saveLocalEvents(events: CampusCalendarEvent[]) {
  try {
    safeStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export const calendarService = {
  async getEvents(): Promise<CampusCalendarEvent[]> {
    let events = getLocalEvents();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'calendar');
        const q = query(colRef, orderBy('startDate', 'asc'), firestoreLimit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          events = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CampusCalendarEvent, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore calendar fetch fallback:', err);
      }
    }

    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  },

  async createEvent(
    data: Omit<CampusCalendarEvent, 'id' | 'createdAt'>,
    author: UserRecord
  ): Promise<CampusCalendarEvent> {
    const id = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEvent: CampusCalendarEvent = {
      ...data,
      id,
      status: data.status || 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await setDoc(docRef, newEvent);
      } catch (err) {
        console.warn('Firestore event create fallback:', err);
      }
    }

    const localList = getLocalEvents();
    localList.push(newEvent);
    saveLocalEvents(localList);
    notifyLocalCalendarListeners();

    // Notify users
    await notificationService.createNotification({
      userId: 'ALL',
      title: `Calendar Event: ${newEvent.title}`,
      message: `${newEvent.category.toUpperCase()} scheduled for ${new Date(newEvent.startDate).toLocaleDateString()}. Location: ${newEvent.location || 'Campus'}`,
      type: 'calendar',
      entityId: id,
      link: '/calendar',
    });

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'CALENDAR_EVENT_CREATED',
      entityType: 'calendar',
      entityId: id,
      newValue: JSON.stringify({ title: newEvent.title, date: newEvent.startDate }),
    });

    await activityService.logActivity({
      userId: author.uid,
      title: 'Event Scheduled',
      description: `Created campus calendar event: ${newEvent.title}`,
      entityType: 'calendar',
      entityId: id,
    });

    return newEvent;
  },

  async updateEvent(id: string, updates: Partial<CampusCalendarEvent>, actor: UserRecord): Promise<void> {
    const updatedAt = new Date().toISOString();
    const finalUpdates = { ...updates, updatedAt };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await updateDoc(docRef, finalUpdates);
      } catch (err) {
        console.warn('Firestore event update fallback:', err);
      }
    }

    const localList = getLocalEvents();
    const idx = localList.findIndex((e) => e.id === id);
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...finalUpdates };
      saveLocalEvents(localList);
      notifyLocalCalendarListeners();
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CALENDAR_EVENT_UPDATED',
      entityType: 'calendar',
      entityId: id,
      changes: JSON.stringify(updates),
    });
  },

  async deleteEvent(id: string, actor: UserRecord): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'calendar', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore event delete fallback:', err);
      }
    }

    const localList = getLocalEvents().filter((e) => e.id !== id);
    saveLocalEvents(localList);
    notifyLocalCalendarListeners();

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CALENDAR_EVENT_DELETED',
      entityType: 'calendar',
      entityId: id,
    });
  },

  subscribeEvents(callback: (events: CampusCalendarEvent[]) => void): () => void {
    activeCalendarListeners.add(callback);

    // Initial immediate invocation
    this.getEvents().then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'calendar');
        const q = query(colRef, orderBy('startDate', 'asc'), firestoreLimit(100));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getEvents().then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore calendar subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore calendar listener:', err);
      }
    }

    return () => {
      activeCalendarListeners.delete(callback);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
