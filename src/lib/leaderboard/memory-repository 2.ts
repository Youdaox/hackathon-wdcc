import type { LeaderboardRepository, LeaderboardSnapshot } from "./repository";

const DEFAULT_STATE: LeaderboardSnapshot = {
  members: [],
  encouragements: [],
  taskCompletions: [],
  rules: {
    dailyBaseEncouragements: 3,
    encouragementsPerTask: 1,
    pointsPerTask: 10,
    pointsPerEncouragementReceived: 4,
    timezone: "UTC",
  },
};

declare global {
  var inclineLeaderboardState: LeaderboardSnapshot | undefined;
  var inclineLeaderboardQueue: Promise<void> | undefined;
}

function state(): LeaderboardSnapshot {
  globalThis.inclineLeaderboardState ??= structuredClone(DEFAULT_STATE);
  return globalThis.inclineLeaderboardState;
}

export class MemoryLeaderboardRepository implements LeaderboardRepository {
  async read<T>(operation: (snapshot: Readonly<LeaderboardSnapshot>) => T): Promise<T> {
    await (globalThis.inclineLeaderboardQueue ?? Promise.resolve());
    return operation(state());
  }

  async write<T>(operation: (snapshot: LeaderboardSnapshot) => T): Promise<T> {
    const previous = globalThis.inclineLeaderboardQueue ?? Promise.resolve();
    let release!: () => void;
    globalThis.inclineLeaderboardQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return operation(state());
    } finally {
      release();
    }
  }
}

export const leaderboardRepository = new MemoryLeaderboardRepository();
