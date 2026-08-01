import "server-only";

import type { Connection, RowDataPacket } from "mysql2/promise";

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

type DebitRow = RowDataPacket & {
  [key: `payment_${number}`]: unknown;
};

type PaymentColumn = {
  column: string;
  label: string;
};

export type GameMoneyDebitResult =
  | {
      status: "paid";
      amount: number;
      availableBefore: number;
      debits: Array<{ column: string; label: string; amount: number }>;
    }
  | {
      status:
        | "not_configured"
        | "not_found"
        | "insufficient_funds"
        | "unavailable";
      available: number | null;
    };

export type GameMoneyCreditResult =
  | {
      status: "credited";
      amount: number;
      accountLabel: string;
      balanceAfter: number;
    }
  | {
      status: "not_configured" | "not_found" | "unavailable";
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

function databaseIdentifiers() {
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

  return { table, uidColumn, nameColumn, cashColumn };
}

function parsePaymentColumns(): PaymentColumn[] {
  const { cashColumn } = databaseIdentifiers();
  const accountColumns = parseAccountColumns();
  const labels = new Map(
    accountColumns.map((account) => [account.column, account.label]),
  );
  labels.set(cashColumn, "Argent liquide");

  const configured = optionalEnv("GAME_DB_CASINO_DEBIT_ORDER");
  const requested = configured
    ? configured.split(",").map((column) => column.trim())
    : [...accountColumns.map((account) => account.column), cashColumn];

  const unique = [...new Set(requested)].filter((column) =>
    SAFE_IDENTIFIER.test(column),
  );

  return unique.map((column) => ({
    column,
    label: labels.get(column) ?? column,
  }));
}

async function openGameDatabaseConnection(): Promise<Connection | null> {
  const configuration = requiredDatabaseConfiguration();
  if (!configuration) return null;

  const { createConnection } = await import("mysql2/promise");
  return createConnection({
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

  const { table, uidColumn, nameColumn, cashColumn } =
    databaseIdentifiers();
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
    connection = await openGameDatabaseConnection();
    if (!connection) throw new Error("game_database_not_configured");

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

export async function debitCitizenGameMoney(
  steamId: string,
  requestedAmount: number,
): Promise<GameMoneyDebitResult> {
  if (!requiredDatabaseConfiguration()) {
    return { status: "not_configured", available: null };
  }
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) {
    return { status: "insufficient_funds", available: 0 };
  }

  const { table, uidColumn } = databaseIdentifiers();
  const paymentColumns = parsePaymentColumns();
  if (!paymentColumns.length) {
    return { status: "not_configured", available: null };
  }

  let connection: Connection | null = null;
  try {
    connection = await openGameDatabaseConnection();
    if (!connection) return { status: "not_configured", available: null };
    await connection.beginTransaction();

    const paymentSelect = paymentColumns
      .map(
        (payment, index) =>
          `\`${payment.column}\` as \`payment_${index}\``,
      )
      .join(", ");
    const [rows] = await connection.execute<DebitRow[]>(
      `select ${paymentSelect} from \`${table}\` where \`${uidColumn}\` = ? limit 1 for update`,
      [steamId],
    );
    const row = rows[0];
    if (!row) {
      await connection.rollback();
      return { status: "not_found", available: 0 };
    }

    const balances = paymentColumns.map((_, index) =>
      Math.max(0, Math.trunc(amount(row[`payment_${index}`]))),
    );
    const availableBefore = balances.reduce((sum, balance) => sum + balance, 0);
    if (availableBefore < requestedAmount) {
      await connection.rollback();
      return { status: "insufficient_funds", available: availableBefore };
    }

    let remaining = requestedAmount;
    const debits = paymentColumns.map((payment, index) => {
      const debit = Math.min(balances[index], remaining);
      remaining -= debit;
      return { ...payment, amount: debit };
    });
    const changed = debits.filter((debit) => debit.amount > 0);
    const assignments = changed
      .map((debit) => `\`${debit.column}\` = \`${debit.column}\` - ?`)
      .join(", ");
    await connection.execute(
      `update \`${table}\` set ${assignments} where \`${uidColumn}\` = ?`,
      [...changed.map((debit) => debit.amount), steamId],
    );
    await connection.commit();

    return {
      status: "paid",
      amount: requestedAmount,
      availableBefore,
      debits: changed,
    };
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[game-bank] Débit Casino impossible.", error);
    return { status: "unavailable", available: null };
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

export async function refundCitizenGameMoney(
  steamId: string,
  debits: Array<{ column: string; amount: number }>,
): Promise<boolean> {
  const safeDebits = debits.filter(
    (debit) =>
      SAFE_IDENTIFIER.test(debit.column) &&
      Number.isSafeInteger(debit.amount) &&
      debit.amount > 0,
  );
  if (!requiredDatabaseConfiguration() || !safeDebits.length) return false;

  const { table, uidColumn } = databaseIdentifiers();
  let connection: Connection | null = null;
  try {
    connection = await openGameDatabaseConnection();
    if (!connection) return false;
    await connection.beginTransaction();
    const assignments = safeDebits
      .map((debit) => `\`${debit.column}\` = \`${debit.column}\` + ?`)
      .join(", ");
    const [result] = await connection.execute(
      `update \`${table}\` set ${assignments} where \`${uidColumn}\` = ?`,
      [...safeDebits.map((debit) => debit.amount), steamId],
    );
    const affectedRows = Number(
      (result as { affectedRows?: number }).affectedRows ?? 0,
    );
    if (affectedRows !== 1) throw new Error("casino_refund_player_not_found");
    await connection.commit();
    return true;
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[game-bank] Remboursement Casino impossible.", error);
    return false;
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

export async function creditCitizenGameMoney(
  steamId: string,
  requestedAmount: number,
): Promise<GameMoneyCreditResult> {
  if (!requiredDatabaseConfiguration()) return { status: "not_configured" };
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) {
    return { status: "unavailable" };
  }

  const { table, uidColumn } = databaseIdentifiers();
  const target = parseAccountColumns()[0];
  if (!target || !SAFE_IDENTIFIER.test(target.column)) {
    return { status: "not_configured" };
  }

  let connection: Connection | null = null;
  try {
    connection = await openGameDatabaseConnection();
    if (!connection) return { status: "not_configured" };
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `update \`${table}\` set \`${target.column}\` = \`${target.column}\` + ? where \`${uidColumn}\` = ?`,
      [requestedAmount, steamId],
    );
    const affectedRows = Number(
      (result as { affectedRows?: number }).affectedRows ?? 0,
    );
    if (affectedRows !== 1) {
      await connection.rollback();
      return { status: "not_found" };
    }
    const [rows] = await connection.execute<DebitRow[]>(
      `select \`${target.column}\` as \`payment_0\` from \`${table}\` where \`${uidColumn}\` = ? limit 1`,
      [steamId],
    );
    const balanceAfter = Math.max(0, Math.trunc(amount(rows[0]?.payment_0)));
    await connection.commit();
    return {
      status: "credited",
      amount: requestedAmount,
      accountLabel: target.label,
      balanceAfter,
    };
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[game-bank] Crédit de la revente Casino impossible.", error);
    return { status: "unavailable" };
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}
