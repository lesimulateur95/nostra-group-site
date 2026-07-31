export const CASINO_GAMES = [
  "poker",
  "blackjack",
  "roulette",
  "slots",
  "dice",
  "plinko",
  "coinflip",
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

export type CasinoAdminData = {
  conversions: Array<CasinoConversion & { userId: string; citizenName: string }>;
  wallets: CasinoAdminWallet[];
};
