export type LeaderboardPeriod = "week" | "month";

export interface RankingRules {
  dailyBaseEncouragements: number;
  encouragementsPerTask: number;
  pointsPerTask: number;
  pointsPerEncouragementReceived: number;
  timezone: "UTC";
}

export interface Member {
  id: string;
  displayName: string;
}

export interface Encouragement {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  createdAt: string;
  dayKey: string;
}

export interface EncouragementHistoryRecord extends Encouragement {
  senderName: string;
  recipientName: string;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  taskId: string;
  completedAt: string;
  dayKey: string;
  encouragementPointsAwarded: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  tasksCompleted: number;
  encouragementsSent: number;
}

export interface EncouragementBalance {
  date: string;
  base: number;
  earned: number;
  used: number;
  available: number;
  taskPoints: number;
  maxTaskPoints: number;
}
