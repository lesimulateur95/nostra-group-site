import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { data: isDirection } = await supabase.rpc("nostra_security_is_direction", {
    p_user_id: authData.user.id,
  });
  if (!isDirection) {
    return NextResponse.json({ error: "Accès Direction requis" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("nostra_get_backup", { p_id: id });
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Sauvegarde introuvable" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nostra-group-backup-${id}.json"`,
      "cache-control": "no-store",
    },
  });
}
