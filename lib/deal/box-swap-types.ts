export type DealBoxSwapStatus =
  | "pending"
  | "choosing"
  | "kept"
  | "swapped"
  | "cancelled";

export type DealBoxSwapCall = {
  id: number;
  status: DealBoxSwapStatus;
  current_box: number;
  new_box: number | null;
  created_at: string;
};

export type DealBoxSwapPublicState = {
  configured: boolean;
  call: DealBoxSwapCall | null;
  available_boxes: number[];
};

export type DealBoxSwapManagerSession = {
  id: string;
  player_name: string;
  status: string;
  selected_box: number | null;
  opened_count: number;
  active_swap_status: "pending" | "choosing" | null;
};

export type DealBoxSwapDashboardState = {
  configured: boolean;
  sessions: DealBoxSwapManagerSession[];
};
