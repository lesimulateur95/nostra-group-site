
export type DealEdition = {
  id: number;
  title: string;
  box_count: number;
  prize_labels: string[];
  status: "draft" | "open" | "closed" | "archived";
  created_at: string;
};

export type DealOpenedBox = {
  box_number: number;
  prize_label: string;
  opened_at: string;
};

export type DealPublicSession = {
  id: string;
  status:
    | "choosing"
    | "playing"
    | "banker_call"
    | "accepted"
    | "final"
    | "stopped";
  player_name: string;
  selected_box: number | null;
  banker_offer: string | null;
  final_reward: string | null;
  selected_box_prize: string | null;
  opened_boxes: DealOpenedBox[];
  opened_count: number;
  created_at: string;
  updated_at: string;
};

export type DealPublicState = {
  configured: boolean;
  edition: DealEdition | null;
  session: DealPublicSession | null;
};

export type DealDashboardBox = {
  box_number: number;
  prize_label: string;
  opened: boolean;
};

export type DealDashboardSession = {
  id: string;
  user_id: string;
  player_name: string;
  status: DealPublicSession["status"];
  selected_box: number | null;
  banker_offer: string | null;
  final_reward: string | null;
  selected_box_prize: string | null;
  opened_count: number;
  boxes: DealDashboardBox[];
  created_at: string;
  updated_at: string;
};

export type DealDashboardState = {
  edition: DealEdition | null;
  sessions: DealDashboardSession[];
};
