/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getCasinoSettings } from "@/lib/casino/data";
import {
  debitCitizenGameMoney,
  refundCitizenGameMoney,
} from "@/lib/game-bank/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const settings = await getCasinoSettings();
  if (!settings.configured) return NextResponse.json({ error: "Active d’abord le casino avec le SQL V108." }, { status: 503 });
  const roles = await getUserRoleKeys(data.user);
  if (!settings.publicEnabled && !roles.includes("manager")) {
    return NextResponse.json({ error: "Le casino est fermé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const chipAmount = Math.trunc(Number(body.chipAmount));
  const requestId = String(body.requestId ?? "").trim();
  if (!Number.isFinite(chipAmount) || chipAmount < settings.minConversion || chipAmount > settings.maxConversion) {
    return NextResponse.json({ error: `Le montant doit être compris entre ${settings.minConversion.toLocaleString("fr-FR")} et ${settings.maxConversion.toLocaleString("fr-FR")} jetons.` }, { status: 400 });
  }
  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Référence d’achat invalide. Recharge la page." }, { status: 400 });
  }

  const rpAmount = chipAmount * settings.rpPerChip;
  if (!Number.isSafeInteger(rpAmount) || rpAmount <= 0) {
    return NextResponse.json({ error: "Montant RP trop élevé." }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("member_profiles")
    .select("steam_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const steamId =
    (typeof member?.steam_id === "string" && member.steam_id.trim()) ||
    (typeof data.user.user_metadata?.steam_id === "string" &&
      data.user.user_metadata.steam_id.trim()) ||
    "";
  if (!steamId) {
    return NextResponse.json(
      { error: "Associe ton compte Steam avant d’acheter des jetons." },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "La caisse sécurisée n’est pas encore configurée." },
      { status: 503 },
    );
  }

  const { data: existing } = await admin
    .from("casino_conversion_requests")
    .select("id,user_id,status,chip_amount")
    .eq("id", requestId)
    .maybeSingle();
  if (existing) {
    if (existing.user_id === data.user.id && existing.status === "approved") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }
    return NextResponse.json({ error: existing.user_id === data.user.id && existing.status === "pending" ? "Cet achat est encore en cours de vérification. Contacte la Direction avant de réessayer." : "Cette référence d’achat est déjà utilisée." }, { status: 409 });
  }

  const { error: reservationError } = await admin
    .from("casino_conversion_requests")
    .insert({
      id: requestId,
      user_id: data.user.id,
      steam_id: steamId,
      rp_amount: rpAmount,
      chip_amount: chipAmount,
      rate: settings.rpPerChip,
      payment_mode: "rp_database",
      status: "pending",
    });
  if (reservationError) {
    return NextResponse.json(
      { error: "Un achat est déjà en cours pour ce compte. Recharge la caisse avant de réessayer." },
      { status: 409 },
    );
  }

  const debit = await debitCitizenGameMoney(steamId, rpAmount);
  if (debit.status !== "paid") {
    await admin
      .from("casino_conversion_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", requestId);
    const error =
      debit.status === "not_configured"
        ? "La liaison avec l’argent RP n’est pas encore activée. Aucun jeton n’a été créé."
        : debit.status === "not_found"
          ? "Ton personnage n’a pas été trouvé dans la base du serveur."
          : debit.status === "insufficient_funds"
            ? `Solde RP insuffisant${debit.available === null ? "." : ` : ${debit.available.toLocaleString("fr-FR")} € disponibles.`}`
            : "La banque RP est temporairement indisponible. Aucun argent n’a été débité.";
    return NextResponse.json({ error }, { status: debit.status === "unavailable" ? 503 : 400 });
  }

  const { data: result, error } = await (admin as any).rpc(
    "casino_complete_rp_purchase_v109",
    {
      p_request_id: requestId,
      p_user_id: data.user.id,
      p_steam_id: steamId,
      p_rp_amount: rpAmount,
      p_chip_amount: chipAmount,
      p_rate: settings.rpPerChip,
    },
  );
  if (error) {
    const refunded = await refundCitizenGameMoney(steamId, debit.debits);
    if (refunded) {
      await admin
        .from("casino_conversion_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
    }
    return NextResponse.json(
      {
        error: refunded
          ? "L’achat n’a pas pu être finalisé. L’argent RP a été remboursé automatiquement."
          : "Incident de caisse : contacte immédiatement la Direction avec l’heure de l’achat.",
      },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    purchase: result,
    rpDebited: rpAmount,
    chipsCredited: chipAmount,
  });
}
