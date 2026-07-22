export const SECURITY_ROLE_OPTIONS = [
  { key: "direction", label: "Direction" },
  { key: "manager", label: "Gérant" },
  { key: "commercial", label: "Commercial" },
  { key: "employee", label: "Employé" },
  { key: "commissioner", label: "Commissaire" },
  { key: "citizen", label: "Citoyen" },
] as const;

export type SecurityRoleKey = (typeof SECURITY_ROLE_OPTIONS)[number]["key"];

export type SecuritySettings = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  require_delete_reason: boolean;
  backup_interval_hours: number;
  trash_retention_days: number;
  updated_at?: string;
};

export type SecurityPageAccess = {
  id: string;
  label: string;
  category: string;
  path_pattern: string;
  allowed_roles: SecurityRoleKey[];
  active: boolean;
  sort_order: number;
};

export type SecurityMember = {
  user_id: string;
  display_name: string;
  roles: string[];
  is_direction: boolean;
  blocked_until: string | null;
  block_reason: string | null;
};

export type SecurityBackup = {
  id: string;
  backup_kind: string;
  status: string;
  table_count: number;
  row_count: number;
  created_at: string;
  created_by_name: string | null;
};

export type SecurityTrashItem = {
  id: string;
  source_table: string;
  source_id: string | null;
  display_label: string | null;
  deletion_reason: string | null;
  deleted_by_name: string | null;
  deleted_at: string;
  restore_until: string;
};

export type SecurityLogin = {
  id: number;
  user_id: string;
  display_name: string | null;
  roles: string[];
  user_agent: string | null;
  ip_hash: string | null;
  first_path: string | null;
  logged_at: string;
};

export type SecurityAuditEntry = {
  id: number;
  actor_name: string | null;
  actor_roles: string[];
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SecurityOverview = {
  settings: SecuritySettings;
  pages: SecurityPageAccess[];
  members: SecurityMember[];
  backups: SecurityBackup[];
  trash: SecurityTrashItem[];
  logins: SecurityLogin[];
  audit: SecurityAuditEntry[];
};
