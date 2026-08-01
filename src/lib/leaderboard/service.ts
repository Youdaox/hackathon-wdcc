import type { LeaderboardRepository, LeaderboardSnapshot } from "./repository";
import { dayKey, periodBounds } from "./time";
import type {
  EncouragementBalance,
  EncouragementHistoryRecord,
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

const MAX_TASK_POINTS = 15;

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
  ).reduce((total, completion) => total + (completion.encouragementPointsAwarded ?? 0), 0);
  const taskPoints = Math.min(MAX_TASK_POINTS, snapshot.taskCompletions
    .filter((completion) => completion.userId === userId)
    .reduce((total, completion) => total + (completion.encouragementPointsAwarded ?? 0), 0));
  const used = snapshot.encouragements.filter(
    (encouragement) => encouragement.senderId === userId && encouragement.dayKey === date,
  ).length;
  return {
    date,
    base: snapshot.rules.dailyBaseEncouragements,
    earned,
    used,
    available: Math.max(0, snapshot.rules.dailyBaseEncouragements + earned - used),
    taskPoints,
    maxTaskPoints: MAX_TASK_POINTS,
  };
}

export class LeaderboardService {
  constructor(private readonly repository: LeaderboardRepository) {}

  getBalance(userId: string, now = new Date()) {
    return this.repository.read((snapshot) => balance(snapshot, userId, now));
  }

  getEncouragementHistory(userId: string, direction: "received" | "sent", limit = 50) {
    return this.repository.read((snapshot) => snapshot.encouragements
      .filter((item) => direction === "received" ? item.recipientId === userId : item.senderId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((item): EncouragementHistoryRecord => ({
        ...item,
        senderName: snapshot.members.find((member) => member.id === item.senderId)?.displayName ?? item.senderId,
        recipientName: snapshot.members.find((member) => member.id === item.recipientId)?.displayName ?? item.recipientId,
      })));
  }

  completeTask(userId: string, displayName: string | undefined, taskId: string, now = new Date()) {
    return this.repository.write((snapshot) => {
      ensureMember(snapshot, userId, displayName);
      if (snapshot.taskCompletions.some((item) => item.userId === userId && item.taskId === taskId)) {
        throw new DomainError("TASK_ALREADY_REWARDED", "This task has already been rewarded.", 409);
      }
      const pointsBefore = balance(snapshot, userId, now).taskPoints;
      const encouragementPointsAwarded = Math.min(
        snapshot.rules.encouragementsPerTask,
        MAX_TASK_POINTS - pointsBefore,
      );
      const completion = {
        id: crypto.randomUUID(), userId, taskId,
        completedAt: now.toISOString(), dayKey: dayKey(now),
        encouragementPointsAwarded,
      };
      snapshot.taskCompletions.push(completion);
      return {
        completion,
        encouragementPointsAwarded,
        challengeCompleted: pointsBefore + encouragementPointsAwarded >= MAX_TASK_POINTS,
        balance: balance(snapshot, userId, now),
      };
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

  seedDemoData(now = new Date()) {
    return this.repository.write((snapshot) => {
      const users = [
        ["user-1", "Alice"], ["user-2", "Bob"], ["user-3", "Charlie"],
        ["user-4", "Diana"], ["user-5", "Ethan"],
      ] as const;
      users.forEach(([id, name]) => ensureMember(snapshot, id, name));
      if (snapshot.taskCompletions.some((item) => item.id.startsWith("demo-seed-task-"))) {
        return { seeded: false, users: snapshot.members.filter((member) => member.id.startsWith("user-")) };
      }

      const at = new Date(now.getTime() - 3_600_000);
      const taskCounts = [4, 7, 5, 8, 3];
      users.forEach(([userId], userIndex) => {
        for (let index = 0; index < taskCounts[userIndex]; index += 1) {
          snapshot.taskCompletions.push({
            id: `demo-seed-task-${userId}-${index}`,
            userId,
            taskId: `demo-seed-${userId}-${index}`,
            completedAt: at.toISOString(),
            dayKey: "demo-seed",
            encouragementPointsAwarded: 0,
          });
        }
      });

      const samples = [
        ["user-2", "user-1", MESSAGES[0]],
        ["user-3", "user-1", MESSAGES[1]],
        ["user-1", "user-4", MESSAGES[2]],
        ["user-5", "user-2", MESSAGES[3]],
        ["user-4", "user-3", MESSAGES[4]],
      ] as const;
      samples.forEach(([senderId, recipientId, message], index) => snapshot.encouragements.push({
        id: `demo-seed-encouragement-${index}`,
        senderId, recipientId, message,
        createdAt: new Date(at.getTime() - index * 60_000).toISOString(),
        dayKey: "demo-seed",
      }));
      return { seeded: true, users: snapshot.members.filter((member) => member.id.startsWith("user-")) };
    });
  }
}
