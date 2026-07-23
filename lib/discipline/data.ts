import { createClient } from "@/lib/supabase/server";

export type DisciplineActionType =
  | "warning"
  | "penalty"
  | "suspension"
  | "points_deduction";

export type DisciplineSeverity = "minor" | "major" | "critical";
export type DisciplineStatus = "active" | "completed" | "cancelled";

export type CircuitDisciplinaryAction = {
  id: number;
  caseNumber: string;
  licenceId: string;
  licenceNumber: string;
  licenceName: string;
  holderUserId: string;
  holderName: string;
  actionType: DisciplineActionType;
  severity: DisciplineSeverity;
  reason: string;
  eventName: string | null;
  note: string | null;
  penaltyAmount: number;
  pointsRemoved: number;
  suspensionStartsOn: string | null;
  suspensionEndsOn: string | null;
  status: DisciplineStatus;
  issuedByName: string;
  issuedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
};

export type CircuitDisciplineHistoryEntry = {
  id: number;
  actionId: number;
  caseNumber: string;
  licenceNumber: string;
  holderUserId: string;
  holderName: string;
  actionType: DisciplineActionType;
  eventType: "created" | "completed" | "cancelled" | "auto_completed";
  reason: string | null;
  changedByName: string;
  createdAt: string;
};

export type CircuitDisciplineLicence = {
  id: string;
  holderUserId: string;
  holderName: string;
  licenceNumber: string;
  licenceName: string;
  storedStatus: string;
  validUntil: string | null;
  pointsRemoved: number;
  pointsRemaining: number;
  activeActions: number;
  currentSuspension: CircuitDisciplinaryAction | null;
};

export type CircuitDisciplineData = {
  configured: boolean;
  licences: CircuitDisciplineLicence[];
  actions: CircuitDisciplinaryAction[];
  history: CircuitDisciplineHistoryEntry[];
};

type UnknownRow = Record<string, unknown>;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function actionFromRow(row: UnknownRow): CircuitDisciplinaryAction {
  const actionType = String(row.action_type ?? "warning") as DisciplineActionType;
  const severity = String(row.severity ?? "minor") as DisciplineSeverity;
  const status = String(row.status ?? "active") as DisciplineStatus;

  return {
    id: Number(row.id ?? 0),
    caseNumber: String(row.case_number ?? ""),
    licenceId: String(row.licence_id ?? ""),
    licenceNumber: String(row.licence_number ?? ""),
    licenceName: String(row.licence_name ?? "Licence pilote"),
    holderUserId: String(row.holder_user_id ?? ""),
    holderName: String(row.holder_name ?? "Pilote"),
    actionType,
    severity,
    reason: String(row.reason ?? ""),
    eventName: stringOrNull(row.event_name),
    note: stringOrNull(row.note),
    penaltyAmount: Number(row.penalty_amount ?? 0),
    pointsRemoved: Number(row.points_removed ?? 0),
    suspensionStartsOn: stringOrNull(row.suspension_starts_on),
    suspensionEndsOn: stringOrNull(row.suspension_ends_on),
    status,
    issuedByName: String(row.issued_by_name ?? "Direction Nostra Circuit"),
    issuedAt: String(row.issued_at ?? ""),
    completedAt: stringOrNull(row.completed_at),
    cancelledAt: stringOrNull(row.cancelled_at),
    cancellationReason: stringOrNull(row.cancellation_reason),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function historyFromRow(row: UnknownRow): CircuitDisciplineHistoryEntry {
  return {
    id: Number(row.id ?? 0),
    actionId: Number(row.action_id ?? 0),
    caseNumber: String(row.case_number ?? ""),
    licenceNumber: String(row.licence_number ?? ""),
    holderUserId: String(row.holder_user_id ?? ""),
    holderName: String(row.holder_name ?? "Pilote"),
    actionType: String(row.action_type ?? "warning") as DisciplineActionType,
    eventType: String(row.event_type ?? "created") as CircuitDisciplineHistoryEntry["eventType"],
    reason: stringOrNull(row.reason),
    changedByName: String(row.changed_by_name ?? "Direction Nostra Circuit"),
    createdAt: String(row.created_at ?? ""),
  };
}

function isCurrentSuspension(action: CircuitDisciplinaryAction): boolean {
  if (
    action.actionType !== "suspension" ||
    action.status === "cancelled" ||
    !action.suspensionStartsOn ||
    !action.suspensionEndsOn
  ) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return today >= action.suspensionStartsOn && today <= action.suspensionEndsOn;
}

function buildLicences(
  rows: UnknownRow[],
  actions: CircuitDisciplinaryAction[],
): CircuitDisciplineLicence[] {
  return rows.map((row) => {
    const id = String(row.id ?? "");
    const licenceActions = actions.filter((action) => action.licenceId === id);
    const pointsRemoved = licenceActions
      .filter(
        (action) =>
          action.actionType === "points_deduction" &&
          action.status !== "cancelled",
      )
      .reduce((total, action) => total + action.pointsRemoved, 0);
    const currentSuspension =
      licenceActions.find((action) => isCurrentSuspension(action)) ?? null;
    const activeActions = licenceActions.filter(
      (action) => action.status === "active" || isCurrentSuspension(action),
    ).length;

    return {
      id,
      holderUserId: String(row.holder_user_id ?? ""),
      holderName: String(row.holder_name ?? "Pilote"),
      licenceNumber: String(row.licence_number ?? ""),
      licenceName: String(row.licence_name ?? "Licence pilote"),
      storedStatus: String(row.status ?? "Valide"),
      validUntil: stringOrNull(row.valid_until),
      pointsRemoved,
      pointsRemaining: Math.max(0, 12 - pointsRemoved),
      activeActions,
      currentSuspension,
    };
  });
}

async function fetchDisciplineData(userId?: string): Promise<CircuitDisciplineData> {
  try {
    const supabase = await createClient();

    await (supabase as any).rpc(
      "nostra_refresh_expired_disciplinary_suspensions",
    );

    let actionsQuery = (supabase as any)
      .from("nostra_circuit_disciplinary_actions")
      .select(
        "id,case_number,licence_id,licence_number,licence_name,holder_user_id,holder_name,action_type,severity,reason,event_name,note,penalty_amount,points_removed,suspension_starts_on,suspension_ends_on,status,issued_by_name,issued_at,completed_at,cancelled_at,cancellation_reason,updated_at",
      )
      .order("issued_at", { ascending: false });

    let licencesQuery = (supabase as any)
      .from("nostra_licences")
      .select(
        "id,holder_user_id,holder_name,licence_number,licence_name,status,valid_until",
      )
      .order("holder_name", { ascending: true });

    let historyQuery = (supabase as any)
      .from("nostra_circuit_disciplinary_history")
      .select(
        "id,action_id,case_number,licence_number,holder_user_id,holder_name,action_type,event_type,reason,changed_by_name,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (userId) {
      actionsQuery = actionsQuery.eq("holder_user_id", userId);
      licencesQuery = licencesQuery.eq("holder_user_id", userId);
      historyQuery = historyQuery.eq("holder_user_id", userId);
    }

    const [actionsResult, licencesResult, historyResult] = await Promise.all([
      actionsQuery,
      licencesQuery,
      historyQuery,
    ]);

    if (actionsResult.error) {
      return { configured: false, licences: [], actions: [], history: [] };
    }

    const actions = Array.isArray(actionsResult.data)
      ? actionsResult.data.map((row: UnknownRow) => actionFromRow(row))
      : [];
    const licenceRows = Array.isArray(licencesResult.data)
      ? (licencesResult.data as UnknownRow[])
      : [];
    const history = Array.isArray(historyResult.data)
      ? historyResult.data.map((row: UnknownRow) => historyFromRow(row))
      : [];

    return {
      configured: true,
      licences: buildLicences(licenceRows, actions),
      actions,
      history,
    };
  } catch {
    return { configured: false, licences: [], actions: [], history: [] };
  }
}

export async function getCircuitDisciplineDashboardData(): Promise<CircuitDisciplineData> {
  return fetchDisciplineData();
}

export async function getOwnCircuitDisciplineData(
  userId: string,
): Promise<CircuitDisciplineData> {
  return fetchDisciplineData(userId);
}
