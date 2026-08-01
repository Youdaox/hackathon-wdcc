import { leaderboardRepository } from "./memory-repository";
import { LeaderboardService } from "./service";

export const leaderboardService = new LeaderboardService(leaderboardRepository);
export * from "./types";
