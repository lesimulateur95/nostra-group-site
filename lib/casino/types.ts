export const CASINO_GAMES = [
  "poker",
  "blackjack",
  "roulette",
  "slots",
  "dice",
  "plinko",
  "coinflip",
  "double_or_quit",
  "baccarat",
] as const;

export type CasinoGameKey = (typeof CASINO_GAMES)[number];

export type CasinoSettings = {
  configured: boolean;
  publicEnabled: boolean;
  name: string;
  subtitle: string;
  rpPerChip: number;
  minConversion: number;
  maxConversion: number;
};

export type CasinoDifficulty = "balanced" | "hard" | "expert" | "custom";

export type CasinoGameSettings = {
  game: CasinoGameKey;
  enabled: boolean;
  difficulty: CasinoDifficulty;
  winRatePercent: number;
  minBet: number;
  maxBet: number;
  baseMultiplier: number;
  jackpotMultiplier: number;
  maxPayout: number;
};

export type CasinoGameStat = {
  game: CasinoGameKey;
  rounds: number;
  wagered: number;
  paid: number;
  houseProfit: number;
  rtpPercent: number;
};

export type CasinoRound = {
  id: string;
  userId: string;
  citizenName: string;
  game: CasinoGameKey;
  wager: number;
  payout: number;
  status: "pending" | "settled" | "refunded";
  createdAt: string;
};

export type CasinoWallet = {
  balance: number;
  lifetimeWagered: number;
  lifetimeWon: number;
  gamesPlayed: number;
  biggestWin: number;
  level: number;
  xp: number;
};

export type CasinoProfile = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  steamId: string | null;
};

export type CasinoConversion = {
  id: string;
  rpAmount: number;
  chipAmount: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  citizenName?: string;
  userId?: string;
};

export type CasinoLeaderboardRow = {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  lifetimeWon: number;
  biggestWin: number;
  level: number;
};

export type CasinoAdminWallet = CasinoWallet & {
  userId: string;
  displayName: string;
};

export type CasinoAdminCitizen = {
  userId: string;
  displayName: string;
};

export type CasinoAdminData = {
  conversions: Array<CasinoConversion & { userId: string; citizenName: string }>;
  wallets: CasinoAdminWallet[];
  citizens: CasinoAdminCitizen[];
  gameSettings: CasinoGameSettings[];
  gameStats: CasinoGameStat[];
  recentRounds: CasinoRound[];
};
