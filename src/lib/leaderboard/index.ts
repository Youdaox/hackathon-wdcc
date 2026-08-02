import { leaderboardRepository } from "./database-repository";
import { LeaderboardService } from "./service";

export const leaderboardService = new LeaderboardService(leaderboardRepository);
export * from "./types";
