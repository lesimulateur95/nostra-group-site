/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { getCasinoSettings } from "@/lib/casino/data";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const settings = await getCasinoSettings();
  if (!settings.configured) return NextResponse.json({ error: "Active d’abord le casino avec le SQL V108." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const chipAmount = Math.trunc(Number(body.chipAmount));
  if (!Number.isFinite(chipAmount) || chipAmount < settings.minConversion || chipAmount > settings.maxConversion) {
    return NextResponse.json({ error: `Le montant doit être compris entre ${settings.minConversion.toLocaleString("fr-FR")} et ${settings.maxConversion.toLocaleString("fr-FR")} jetons.` }, { status: 400 });
  }

  const { data: result, error } = await (supabase as any).rpc("casino_request_conversion_v108", {
    p_chip_amount: chipAmount,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    return NextResponse.json({ error: message.includes("pending_exists") ? "Tu as déjà une demande en attente." : "La demande n’a pas pu être enregistrée." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, request: result });
}
