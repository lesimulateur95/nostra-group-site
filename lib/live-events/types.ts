export type LiveEventStatus = "draft" | "live" | "completed";
export type LiveEventFormat = "bracket" | "table";

export type EventCitizen = {
  user_id: string;
  name: string;
};

export type BracketData = {
  size: 4 | 8 | 16;
  participants: Array<EventCitizen | null>;
  winners: Record<string, EventCitizen>;
};

export type TableColumn = {
  id: string;
  label: string;
  kind: "text" | "citizen";
};

export type TableRow = {
  id: string;
  cells: Record<string, string | EventCitizen | null>;
};

export type CustomTableData = {
  columns: TableColumn[];
  rows: TableRow[];
};

export type LiveEventBoard = {
  id: number;
  title: string;
  subtitle: string;
  location: string;
  starts_at: string | null;
  format: LiveEventFormat;
  status: LiveEventStatus;
  accent_color: string;
  bracket_data: BracketData;
  table_data: CustomTableData;
  created_at: string;
  updated_at: string;
};

export const EMPTY_BRACKET: BracketData = {
  size: 8,
  participants: Array.from({ length: 8 }, () => null),
  winners: {},
};

export const EMPTY_TABLE: CustomTableData = {
  columns: [
    { id: "participant", label: "Nom et prénom", kind: "citizen" },
    { id: "score", label: "Score", kind: "text" },
    { id: "statut", label: "Statut", kind: "text" },
  ],
  rows: [],
};
