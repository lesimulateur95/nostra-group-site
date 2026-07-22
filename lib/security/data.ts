import { createClient } from "@/lib/supabase/server";
import type { SecurityOverview } from "@/lib/security/types";

export async function getSecurityOverview(): Promise<{
  configured: boolean;
  data: SecurityOverview | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const result = await supabase.rpc("nostra_security_overview");

  if (result.error) {
    return {
      configured: false,
      data: null,
      error: result.error.message,
    };
  }

  return {
    configured: true,
    data: result.data as SecurityOverview,
    error: null,
  };
}
