import type { LeaderboardRepository, LeaderboardSnapshot } from "./repository";
import { dayKey, periodBounds } from "./time";
import type {
  EncouragementBalance,
  LeaderboardEntry,
  LeaderboardPeriod,
  RankingRules,
} from "./types";

const MESSAGES = [
  "Your effort matters, even on the days when progress feels small.",
  "You are doing better than you think. Keep going.",
  "Someone believes in you today. Take the next step at your own pace.",
  "The care you put into your work is already something to be proud of.",
  "You do not have to be perfect to make meaningful progress.",
] as const;

export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

function ensureMember(snapshot: LeaderboardSnapshot, id: string, displayName?: string) {
  let member = snapshot.members.find((candidate) => candidate.id === id);
  if (!member) {
    member = { id, displayName: displayName?.trim() || id };
    snapshot.members.push(member);
  } else if (displayName?.trim()) {
    member.displayName = displayName.trim();
  }
  return member;
}

function balance(snapshot: Readonly<LeaderboardSnapshot>, userId: string, now: Date): EncouragementBalance {
  const date = dayKey(now);
  const earned = snapshot.taskCompletions.filter(
    (completion) => completion.userId === userId && completion.dayKey === date,
  ).length * snapshot.rules.encouragementsPerTask;
  const used = snapshot.encouragements.filter(
    (encouragement) => encouragement.senderId === userId && encouragement.dayKey === date,
  ).length;
  return {
    date,
    base: snapshot.rules.dailyBaseEncouragements,
    earned,
    used,
    available: Math.max(0, snapshot.rules.dailyBaseEncouragements + earned - used),
  };
}

export class LeaderboardService {
  constructor(private readonly repository: LeaderboardRepository) {}

  getBalance(userId: string, now = new Date()) {
    return this.repository.read((snapshot) => balance(snapshot, userId, now));
  }

  getInbox(userId: string, limit = 50) {
    return this.repository.read((snapshot) => snapshot.encouragements
      .filter((item) => item.recipientId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit));
  }

  completeTask(userId: string, displayName: string | undefined, taskId: string, now = new Date()) {
    return this.repository.write((snapshot) => {
      ensureMember(snapshot, userId, displayName);
      if (snapshot.taskCompletions.some((item) => item.userId === userId && item.taskId === taskId)) {
        throw new DomainError("TASK_ALREADY_REWARDED", "This task has already been rewarded.", 409);
      }
      const completion = {
        id: crypto.randomUUID(), userId, taskId,
        completedAt: now.toISOString(), dayKey: dayKey(now),
      };
      snapshot.taskCompletions.push(completion);
      return { completion, balance: balance(snapshot, userId, now) };
    });
  }

  sendEncouragement(
    senderId: string,
    senderName: string | undefined,
    recipientId: string,
    recipientName: string | undefined,
    now = new Date(),
  ) {
    return this.repository.write((snapshot) => {
      if (senderId === recipientId) {
        throw new DomainError("SELF_ENCOURAGEMENT", "You cannot encourage yourself.");
      }
      ensureMember(snapshot, senderId, senderName);
      ensureMember(snapshot, recipientId, recipientName);
      const date = dayKey(now);
      if (snapshot.encouragements.some((item) =>
        item.senderId === senderId && item.recipientId === recipientId && item.dayKey === date)) {
        throw new DomainError(
          "RECIPIENT_ALREADY_ENCOURAGED",
          "You have already encouraged this person today.",
          409,
        );
      }
      if (balance(snapshot, senderId, now).available === 0) {
        throw new DomainError("NO_ENCOURAGEMENTS_AVAILABLE", "No encouragements are available today.", 409);
      }
      const index = Math.floor(Math.random() * MESSAGES.length);
      const encouragement = {
        id: crypto.randomUUID(), senderId, recipientId, message: MESSAGES[index],
        createdAt: now.toISOString(), dayKey: date,
      };
      snapshot.encouragements.push(encouragement);
      return { encouragement, balance: balance(snapshot, senderId, now) };
    });
  }

  getLeaderboard(period: LeaderboardPeriod, now = new Date(), limit = 50) {
    return this.repository.read((snapshot) => {
      const { startsAt, endsAt } = periodBounds(period, now);
      const inPeriod = (value: string) => {
        const time = new Date(value).getTime();
        return time >= startsAt.getTime() && time < endsAt.getTime();
      };
      const entries = snapshot.members.map((member) => {
        const tasksCompleted = snapshot.taskCompletions.filter(
          (item) => item.userId === member.id && inPeriod(item.completedAt),
        ).length;
        const encouragementsReceived = snapshot.encouragements.filter(
          (item) => item.recipientId === member.id && inPeriod(item.createdAt),
        ).length;
        return {
          userId: member.id,
          displayName: member.displayName,
          tasksCompleted,
          encouragementsReceived,
          score: tasksCompleted * snapshot.rules.pointsPerTask
            + encouragementsReceived * snapshot.rules.pointsPerEncouragementReceived,
        };
      });
      entries.sort((a, b) => b.score - a.score
        || b.encouragementsReceived - a.encouragementsReceived
        || a.displayName.localeCompare(b.displayName));
      const ranked: LeaderboardEntry[] = entries.slice(0, limit).map((entry, index) => ({
        ...entry, rank: index + 1,
      }));
      return { period, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), rules: snapshot.rules, entries: ranked };
    });
  }

  getRules() { return this.repository.read((snapshot) => snapshot.rules); }

  updateRules(rules: RankingRules) {
    return this.repository.write((snapshot) => { snapshot.rules = rules; return snapshot.rules; });
  }
}
