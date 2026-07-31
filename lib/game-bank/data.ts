import "server-only";

import type { RowDataPacket } from "mysql2/promise";

export type CitizenBankAccount = {
  key: string;
  label: string;
  balance: number;
};

export type CitizenBankInformation = {
  status:
    | "connected"
    | "not_configured"
    | "identity_missing"
    | "not_found"
    | "unavailable";
  citizenName: string | null;
  steamId: string | null;
  cash: number | null;
  accounts: CitizenBankAccount[];
  total: number | null;
  checkedAt: string | null;
};

type AccountColumn = {
  key: string;
  label: string;
  column: string;
};

type BankRow = RowDataPacket & {
  citizen_name: unknown;
  cash_balance: unknown;
  [key: `account_${number}`]: unknown;
};

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function requiredDatabaseConfiguration() {
  const host = optionalEnv("GAME_DB_HOST");
  const user = optionalEnv("GAME_DB_USER");
  const password = optionalEnv("GAME_DB_PASSWORD");
  const database = optionalEnv("GAME_DB_NAME");

  if (!host || !user || !password || !database) return null;

  return { host, user, password, database };
}

function safeIdentifier(value: string, fallback: string): string {
  return SAFE_IDENTIFIER.test(value) ? value : fallback;
}

function parseAccountColumns(): AccountColumn[] {
  const configured = optionalEnv("GAME_DB_BANK_ACCOUNTS");
  const entries = configured
    ? configured.split(";")
    : ["Compte bancaire principal:bankacc"];

  const accounts = entries.flatMap((entry, index) => {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) return [];

    const label = entry.slice(0, separator).trim();
    const column = entry.slice(separator + 1).trim();
    if (!label || !SAFE_IDENTIFIER.test(column)) return [];

    return [{ key: `account-${index}`, label, column }];
  });

  return accounts.length
    ? accounts
    : [
        {
          key: "account-0",
          label: "Compte bancaire principal",
          column: "bankacc",
        },
      ];
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePort(value: string | null): number {
  const port = Number(value ?? 3306);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3306;
}

function parseCitizenName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  // Certains serveurs stockent les alias Arma sous forme de tableau JSON.
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const aliases = JSON.parse(normalized) as unknown;
      if (Array.isArray(aliases)) {
        const latest = [...aliases]
          .reverse()
          .find((alias) => typeof alias === "string" && alias.trim());
        if (typeof latest === "string") return latest.trim();
      }
    } catch {
      // La valeur peut aussi être un nom simple entouré de crochets.
    }
  }

  return normalized;
}

export function isGameBankConfigured(): boolean {
  return Boolean(requiredDatabaseConfiguration());
}

export async function getCitizenBankInformation(
  steamId: string | null,
): Promise<CitizenBankInformation> {
  if (!steamId) {
    return {
      status: "identity_missing",
      citizenName: null,
      steamId: null,
      cash: null,
      accounts: [],
      total: null,
      checkedAt: null,
    };
  }

  const configuration = requiredDatabaseConfiguration();
  if (!configuration) {
    return {
      status: "not_configured",
      citizenName: null,
      steamId,
      cash: null,
      accounts: [],
      total: null,
      checkedAt: null,
    };
  }

  const table = safeIdentifier(
    optionalEnv("GAME_DB_PLAYERS_TABLE") ?? "players",
    "players",
  );
  const uidColumn = safeIdentifier(
    optionalEnv("GAME_DB_PLAYER_UID_COLUMN") ?? "playerid",
    "playerid",
  );
  const nameColumn = safeIdentifier(
    optionalEnv("GAME_DB_PLAYER_NAME_COLUMN") ?? "name",
    "name",
  );
  const cashColumn = safeIdentifier(
    optionalEnv("GAME_DB_PLAYER_CASH_COLUMN") ?? "cash",
    "cash",
  );
  const accountColumns = parseAccountColumns();
  const accountSelect = accountColumns
    .map(
      (account, index) =>
        `\`${account.column}\` as \`account_${index}\``,
    )
    .join(", ");

  let connection: Awaited<
    ReturnType<(typeof import("mysql2/promise"))["createConnection"]>
  > | null = null;

  try {
    const { createConnection } = await import("mysql2/promise");
    connection = await createConnection({
      host: configuration.host,
      port: parsePort(optionalEnv("GAME_DB_PORT")),
      user: configuration.user,
      password: configuration.password,
      database: configuration.database,
      connectTimeout: 5_000,
      enableKeepAlive: false,
      ssl:
        optionalEnv("GAME_DB_SSL") === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });

    const query = `select \`${nameColumn}\` as \`citizen_name\`, \`${cashColumn}\` as \`cash_balance\`, ${accountSelect} from \`${table}\` where \`${uidColumn}\` = ? limit 1`;
    const [rows] = await connection.execute<BankRow[]>(query, [steamId]);
    const row = rows[0];

    if (!row) {
      return {
        status: "not_found",
        citizenName: null,
        steamId,
        cash: 0,
        accounts: [],
        total: 0,
        checkedAt: new Date().toISOString(),
      };
    }

    const cash = amount(row.cash_balance);
    const accounts = accountColumns.map((account, index) => ({
      key: account.key,
      label: account.label,
      balance: amount(row[`account_${index}`]),
    }));

    return {
      status: "connected",
      citizenName: parseCitizenName(row.citizen_name),
      steamId,
      cash,
      accounts,
      total: accounts.reduce((sum, account) => sum + account.balance, cash),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[game-bank] Lecture de la base du serveur impossible.", error);
    return {
      status: "unavailable",
      citizenName: null,
      steamId,
      cash: null,
      accounts: [],
      total: null,
      checkedAt: null,
    };
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
