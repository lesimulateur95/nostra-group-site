export type ProfileBadge = {
  id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  sort_order: number;
  earned: boolean;
  awarded_at: string | null;
  award_source: string | null;
  note: string | null;
};

export type BadgeCatalogItem = {
  id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  is_active: boolean;
  sort_order: number;
};

export type BadgeMember = {
  user_id: string;
  display_name: string;
  email: string | null;
};

export type BadgeAward = {
  id: string;
  user_id: string;
  badge_id: string;
  badge_label: string;
  badge_icon: string;
  member_name: string;
  awarded_at: string;
  award_source: string;
  note: string | null;
};

export type BadgeAdministrationData = {
  configured: boolean;
  error: string | null;
  catalog: BadgeCatalogItem[];
  members: BadgeMember[];
  awards: BadgeAward[];
};
