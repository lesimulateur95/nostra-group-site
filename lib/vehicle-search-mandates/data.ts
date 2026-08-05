import { createClient } from "@/lib/supabase/server";

export type SearchProposalV134 = {
  id: number; mandate_id: number; vehicle_name: string; price: number;
  year: number | null; mileage: number | null; source_url: string | null;
  details: string | null; status: string; created_at: string;
};

export type SearchMandateV134 = {
  id: number; mandate_number: string; user_id: string; customer_name: string;
  customer_email: string | null; customer_phone: string | null;
  brand: string | null; model: string | null; vehicle_type: string | null;
  budget_min: number; budget_max: number; year_min: number | null;
  max_mileage: number | null; required_features: string | null; notes: string | null;
  status: string; assigned_staff: string | null; staff_note: string | null;
  selected_proposal_id: number | null; created_at: string; updated_at: string;
  proposals: SearchProposalV134[];
};

const mandateColumns = "id,mandate_number,user_id,customer_name,customer_email,customer_phone,brand,model,vehicle_type,budget_min,budget_max,year_min,max_mileage,required_features,notes,status,assigned_staff,staff_note,selected_proposal_id,created_at,updated_at";

function proposal(row: Record<string, unknown>): SearchProposalV134 {
  return { ...row, id: Number(row.id), mandate_id: Number(row.mandate_id), price: Number(row.price), year: row.year == null ? null : Number(row.year), mileage: row.mileage == null ? null : Number(row.mileage) } as SearchProposalV134;
}

function mandate(row: Record<string, unknown>, proposals: SearchProposalV134[]): SearchMandateV134 {
  return { ...row, id: Number(row.id), budget_min: Number(row.budget_min), budget_max: Number(row.budget_max), year_min: row.year_min == null ? null : Number(row.year_min), max_mileage: row.max_mileage == null ? null : Number(row.max_mileage), selected_proposal_id: row.selected_proposal_id == null ? null : Number(row.selected_proposal_id), proposals } as SearchMandateV134;
}

async function load(userId?: string): Promise<SearchMandateV134[]> {
  const supabase = await createClient();
  let query = supabase.from("vehicle_search_mandates_v134").select(mandateColumns).order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) return [];
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = rows.map((row) => Number(row.id));
  if (!ids.length) return [];
  const result = await supabase.from("vehicle_search_proposals_v134").select("id,mandate_id,vehicle_name,price,year,mileage,source_url,details,status,created_at").in("mandate_id", ids).order("created_at", { ascending: false });
  const list = ((result.data ?? []) as unknown as Record<string, unknown>[]).map(proposal);
  return rows.map((row) => mandate(row, list.filter((item) => item.mandate_id === Number(row.id))));
}

export async function getSearchMandatesConfiguredV134() {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_search_mandates_v134").select("id").limit(1);
  return !error;
}

export const getSearchMandatesV134 = () => load();
export const getOwnSearchMandatesV134 = (userId: string) => load(userId);

export async function getSearchMandateSummaryV134() {
  const configured = await getSearchMandatesConfiguredV134();
  const rows = configured ? await load() : [];
  return { configured, total: rows.length, pending: rows.filter((row) => ["new", "searching", "proposed"].includes(row.status)).length };
}
