/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getCasinoSettings } from "@/lib/casino/data";
import { creditCitizenGameMoney } from "@/lib/game-bank/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const settings = await getCasinoSettings();
  if (!settings.configured) return NextResponse.json({ error: "Exécute d’abord le SQL V120 de la caisse." }, { status: 503 });
  const roles = await getUserRoleKeys(data.user);
  if (!settings.publicEnabled && !roles.includes("manager")) {
    return NextResponse.json({ error: "Le casino est fermé." }, { status: 403 });
  }
  if (!settings.cashoutEnabled) {
    return NextResponse.json({ error: "La revente de jetons est actuellement fermée." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const chipAmount = Math.trunc(Number(body.chipAmount));
  const requestId = String(body.requestId ?? "").trim();
  if (!Number.isFinite(chipAmount) || chipAmount < settings.minCashout || chipAmount > settings.maxCashout) {
    return NextResponse.json({ error: `Le montant doit être compris entre ${settings.minCashout.toLocaleString("fr-FR")} et ${settings.maxCashout.toLocaleString("fr-FR")} jetons.` }, { status: 400 });
  }
  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Référence de revente invalide. Recharge la page." }, { status: 400 });
  }

  const grossRpAmount = chipAmount * settings.rpPerChip;
  const rpAmount = Math.floor(grossRpAmount * (100 - settings.cashoutCommissionPercent) / 100);
  if (!Number.isSafeInteger(grossRpAmount) || !Number.isSafeInteger(rpAmount) || rpAmount <= 0) {
    return NextResponse.json({ error: "Montant RP trop élevé." }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("member_profiles")
    .select("steam_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const steamId =
    (typeof member?.steam_id === "string" && member.steam_id.trim()) ||
    (typeof data.user.user_metadata?.steam_id === "string" && data.user.user_metadata.steam_id.trim()) ||
    "";
  if (!steamId) {
    return NextResponse.json({ error: "Associe ton compte Steam avant de revendre des jetons." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "La caisse sécurisée n’est pas encore configurée." }, { status: 503 });
  }

  const { data: existing } = await admin
    .from("casino_cashout_requests")
    .select("id,user_id,status,rp_amount,chip_amount")
    .eq("id", requestId)
    .maybeSingle();
  if (existing) {
    if (existing.user_id === data.user.id && existing.status === "approved") {
      return NextResponse.json({ ok: true, alreadyCompleted: true, rpCredited: existing.rp_amount, chipsDebited: existing.chip_amount });
    }
    return NextResponse.json({ error: existing.user_id === data.user.id && existing.status === "pending" ? "Cette revente est encore en cours de vérification. Contacte la Direction avant de réessayer." : "Cette référence de revente est déjà utilisée." }, { status: 409 });
  }

  const { error: reserveError } = await (admin as any).rpc("casino_reserve_cashout_v16410", {
    p_request_id: requestId,
    p_user_id: data.user.id,
    p_steam_id: steamId,
    p_rp_amount: rpAmount,
    p_chip_amount: chipAmount,
    p_rate: settings.rpPerChip,
    p_commission_percent: settings.cashoutCommissionPercent,
  });
  if (reserveError) {
    console.error("[casino-cashier] Réservation revente impossible.", reserveError);
    const message = String(reserveError.message ?? reserveError.code ?? "");
    const friendly = message.includes("insufficient_balance")
      ? "Tu ne possèdes pas assez de jetons pour cette revente."
      : message.includes("pending_cashout_exists")
        ? "Une autre revente est réellement en cours. Actualise la caisse dans quelques secondes."
        : message.includes("invalid_cashout")
          ? "La revente demandée est invalide. Actualise la caisse puis réessaie."
          : message.includes("cashout_reference_used")
            ? "Cette référence de revente a déjà été utilisée. Actualise la caisse puis réessaie."
            : "La caisse n’a pas pu préparer la revente. Actualise la page et réessaie.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const credit = await creditCitizenGameMoney(steamId, rpAmount);
  if (credit.status !== "credited") {
    const { error: refundError } = await (admin as any).rpc("casino_reject_cashout_v16410", {
      p_request_id: requestId,
      p_reason: credit.status,
    });
    const reason = credit.status === "not_configured"
      ? "La liaison avec le compte bancaire en jeu n’est pas encore activée."
      : credit.status === "not_found"
        ? "Ton personnage n’a pas été trouvé dans la base du serveur."
        : "La banque RP est temporairement indisponible.";
    return NextResponse.json({ error: refundError ? "Incident de caisse : tes jetons sont réservés. Contacte immédiatement la Direction." : `${reason} Tes jetons ont été rendus automatiquement.` }, { status: credit.status === "unavailable" ? 503 : 400 });
  }

  const { data: result, error: finalizeError } = await (admin as any).rpc("casino_complete_cashout_v16410", {
    p_request_id: requestId,
  });
  if (finalizeError) {
    return NextResponse.json({ error: "L’argent RP a bien été crédité, mais le reçu n’a pas pu être clôturé. Ne recommence pas la revente et contacte la Direction avec l’heure de l’opération." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cashout: result,
    rpCredited: rpAmount,
    chipsDebited: chipAmount,
    accountLabel: credit.accountLabel,
    gameBalanceAfter: credit.balanceAfter,
    grossRpAmount,
    commissionPercent: settings.cashoutCommissionPercent,
  });
}
