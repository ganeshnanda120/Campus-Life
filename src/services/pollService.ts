import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
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
import type { CampusPoll, UserRecord } from '../types';

const POLLS_STORAGE_KEY = 'campus_life_polls';
const activePollListeners = new Set<(polls: CampusPoll[]) => void>();

function notifyLocalPollListeners() {
  pollService.getPolls().then((data) => {
    activePollListeners.forEach((cb) => cb(data));
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === POLLS_STORAGE_KEY) {
      notifyLocalPollListeners();
    }
  });
}

const INITIAL_POLLS: CampusPoll[] = [
  {
    id: 'poll_001',
    title: 'Sunday Weekend Special Mess Dinner Preference',
    question: 'Select your preferred main course for the upcoming celebratory Sunday dinner meal across student dining halls.',
    description: 'Student affairs dining committee is selecting the special menu option based on popular majority student votes.',
    options: [
      { id: 'opt_1', text: 'Paneer Tikka Biryani with Veg Raita & Gulab Jamun', votes: 482 },
      { id: 'opt_2', text: 'Chole Bhature with Punjabi Lassi & Kheer', votes: 180 },
      { id: 'opt_3', text: 'South Indian Deluxe Thali (Dosa, Uttapam, Payasam)', votes: 90 },
      { id: 'opt_4', text: 'Fried Rice with Manchurian & Hakka Noodles', votes: 145 },
    ],
    votedUserIds: ['student_uid_demo_099'],
    allowMultiple: false,
    expiryDate: '2026-10-10T23:59:59.000Z',
    status: 'ACTIVE',
    isActive: true,
    createdBy: 'subadmin_uid_002',
    createdByName: 'Mess Committee In-charge',
    createdAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'poll_002',
    title: 'Central Library Extended Night Hours Feedback',
    question: 'Should the central library air-conditioned reading halls remain open until 02:00 AM during mid-semester examination week?',
    description: 'University senate is reviewing feasibility of extended quiet study hours and nocturnal campus shuttle facilities.',
    options: [
      { id: 'opt_yes', text: 'Yes, extend reading halls until 02:00 AM', votes: 612 },
      { id: 'opt_no', text: 'No, current midnight 12:00 AM timing is sufficient', votes: 84 },
    ],
    votedUserIds: [],
    allowMultiple: false,
    expiryDate: '2026-10-14T23:59:59.000Z',
    status: 'ACTIVE',
    isActive: true,
    createdBy: 'admin_uid_001',
    createdByName: 'Chief Librarian',
    createdAt: '2026-10-02T09:00:00.000Z',
  },
];

function getLocalPolls(): CampusPoll[] {
  try {
    const raw = safeStorage.getItem(POLLS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return INITIAL_POLLS;
}

function saveLocalPolls(polls: CampusPoll[]) {
  try {
    safeStorage.setItem(POLLS_STORAGE_KEY, JSON.stringify(polls));
  } catch {
    // ignore
  }
}

export const pollService = {
  async getPolls(): Promise<CampusPoll[]> {
    let polls = getLocalPolls();

    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'polls');
        const q = query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(50));
        const snap = await getDocs(q);
        if (!snap.empty) {
          polls = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CampusPoll, 'id'>),
          }));
        }
      } catch (err) {
        console.warn('Firestore polls fetch fallback:', err);
      }
    }

    return polls;
  },

  async createPoll(
    data: Omit<CampusPoll, 'id' | 'createdAt' | 'votedUserIds' | 'userVotes'>,
    author: UserRecord
  ): Promise<CampusPoll> {
    const id = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPoll: CampusPoll = {
      ...data,
      id,
      votedUserIds: [],
      userVotes: {},
      status: 'ACTIVE',
      isActive: true,
      createdBy: author.uid,
      createdByName: author.name,
      createdAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'polls', id);
        await setDoc(docRef, newPoll);
      } catch (err) {
        console.warn('Firestore poll create fallback:', err);
      }
    }

    const localList = getLocalPolls();
    localList.unshift(newPoll);
    saveLocalPolls(localList);
    notifyLocalPollListeners();

    await notificationService.createNotification({
      userId: 'ALL',
      title: `New Campus Poll: ${newPoll.title}`,
      message: `Your opinion counts! Cast your vote on "${newPoll.title}". Active until ${new Date(newPoll.expiryDate).toLocaleDateString()}.`,
      type: 'poll',
      entityId: id,
      link: '/polls',
    });

    await auditService.logAction({
      actorId: author.uid,
      actorName: author.name,
      actorRole: author.role,
      action: 'POLL_CREATED',
      entityType: 'poll',
      entityId: id,
      newValue: JSON.stringify({ title: newPoll.title }),
    });

    await activityService.logActivity({
      userId: author.uid,
      title: 'Poll Created',
      description: `Created campus poll: ${newPoll.title}`,
      entityType: 'poll',
      entityId: id,
    });

    return newPoll;
  },

  async votePoll(pollId: string, optionIds: string[], user: UserRecord): Promise<void> {
    const polls = getLocalPolls();
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) throw new Error('Poll not found');

    if (poll.votedUserIds.includes(user.uid)) {
      throw new Error('You have already cast your vote in this poll. Duplicate voting is restricted.');
    }

    // Increment votes
    poll.options.forEach((opt) => {
      if (optionIds.includes(opt.id)) {
        opt.votes += 1;
      }
    });

    poll.votedUserIds.push(user.uid);
    if (!poll.userVotes) poll.userVotes = {};
    poll.userVotes[user.uid] = optionIds;

    saveLocalPolls(polls);
    notifyLocalPollListeners();

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'polls', pollId);
        await updateDoc(docRef, {
          options: poll.options,
          votedUserIds: poll.votedUserIds,
          [`userVotes.${user.uid}`]: optionIds,
        });
      } catch (err) {
        console.warn('Firestore vote update fallback:', err);
      }
    }

    await activityService.logActivity({
      userId: user.uid,
      title: 'Poll Response Submitted',
      description: `Voted in poll: "${poll.title}"`,
      entityType: 'poll',
      entityId: pollId,
    });
  },

  async closePoll(pollId: string, actor: UserRecord): Promise<void> {
    const polls = getLocalPolls();
    const poll = polls.find((p) => p.id === pollId);
    if (poll) {
      poll.status = 'CLOSED';
      poll.isActive = false;
      saveLocalPolls(polls);
      notifyLocalPollListeners();
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'polls', pollId);
        await updateDoc(docRef, { status: 'CLOSED', isActive: false });
      } catch (err) {
        console.warn('Firestore poll close fallback:', err);
      }
    }

    await auditService.logAction({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'POLL_CLOSED',
      entityType: 'poll',
      entityId: pollId,
    });
  },

  subscribePolls(callback: (polls: CampusPoll[]) => void): () => void {
    activePollListeners.add(callback);

    // Initial immediate invocation
    this.getPolls().then(callback).catch(() => {});

    let unsubscribeFirestore: (() => void) | null = null;
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, 'polls');
        const q = query(colRef, orderBy('createdAt', 'desc'), firestoreLimit(50));
        unsubscribeFirestore = onSnapshot(
          q,
          () => {
            this.getPolls().then(callback).catch(() => {});
          },
          (err) => {
            console.warn('Firestore polls subscription warning:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach Firestore polls listener:', err);
      }
    }

    return () => {
      activePollListeners.delete(callback);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },
};
