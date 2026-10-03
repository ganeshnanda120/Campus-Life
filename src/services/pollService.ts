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


function getLocalPolls(): CampusPoll[] {
  try {
    const raw = safeStorage.getItem(POLLS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
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
