import type { Encouragement, Member, RankingRules, TaskCompletion } from "./types";

export interface LeaderboardSnapshot {
  members: Member[];
  encouragements: Encouragement[];
  taskCompletions: TaskCompletion[];
  rules: RankingRules;
}

export interface LeaderboardRepository {
  read<T>(operation: (snapshot: Readonly<LeaderboardSnapshot>) => T): Promise<T>;
  write<T>(operation: (snapshot: LeaderboardSnapshot) => T): Promise<T>;
}
