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
  if (!settings.configured) return NextResponse.json({ error: "Active d’abord le casino avec le SQL de la caisse." }, { status: 503 });
  const roles = await getUserRoleKeys(data.user);
  if (!settings.publicEnabled && !roles.includes("manager")) {
    return NextResponse.json({ error: "Le casino est fermé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId ?? "").trim();
  const packageId = typeof body.packageId === "string" ? body.packageId.trim() : "";
  const requestedRp = Math.trunc(Number(body.rpAmount));
  const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim().slice(0, 40) : "";
  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Référence d’achat invalide. Recharge la page." }, { status: 400 });
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

  let rpAmount = 0;
  let baseChipAmount = 0;
  let bonusChipAmount = 0;
  let resolvedPackageId: string | null = null;

  if (packageId) {
    if (!UUID_PATTERN.test(packageId)) {
      return NextResponse.json({ error: "Pack de jetons invalide." }, { status: 400 });
    }
    const { data: pack, error: packError } = await (admin as any)
      .from("casino_cashier_packages_v148")
      .select("id,chip_amount,bonus_percent,enabled")
      .eq("id", packageId)
      .maybeSingle();
    if (packError || !pack || pack.enabled !== true) {
      return NextResponse.json({ error: "Ce pack n’est plus disponible." }, { status: 400 });
    }
    baseChipAmount = Math.trunc(Number(pack.chip_amount));
    bonusChipAmount = Math.floor(baseChipAmount * Number(pack.bonus_percent ?? 0) / 100);
    rpAmount = baseChipAmount * settings.rpPerChip;
    resolvedPackageId = String(pack.id);
  } else {
    rpAmount = requestedRp;
    if (!Number.isSafeInteger(rpAmount) || rpAmount <= 0 || rpAmount % settings.rpPerChip !== 0) {
      return NextResponse.json({ error: `Le montant doit être un multiple exact de ${settings.rpPerChip.toLocaleString("fr-FR")} $RP.` }, { status: 400 });
    }
    baseChipAmount = Math.trunc(rpAmount / settings.rpPerChip);
    if (baseChipAmount < 1) {
      return NextResponse.json({ error: "L’achat minimum est de 1 jeton." }, { status: 400 });
    }
  }

  const chipAmount = baseChipAmount + bonusChipAmount;
  if (!Number.isSafeInteger(rpAmount) || rpAmount <= 0 || !Number.isSafeInteger(chipAmount) || chipAmount <= 0) {
    return NextResponse.json({ error: "Montant RP trop élevé." }, { status: 400 });
  }

  let discountAmount = 0;
  if (promoCode) {
    const { data: quote, error: promoError } = await (supabase as any).rpc("nostra_promo_quote_v153", {
      p_code: promoCode,
      p_scope: "cercle",
      p_amount: rpAmount,
    });
    if (promoError || !quote?.valid) {
      const reason = String(quote?.reason ?? "invalid");
      const labels: Record<string,string> = { unknown: "Code promotionnel inconnu.", disabled: "Ce code promotionnel est désactivé.", scope: "Ce code n’est pas valable à la caisse du Cercle.", not_started: "Cette promotion n’a pas encore commencé.", expired: "Cette promotion est terminée.", minimum: "Le montant minimum de cette promotion n’est pas atteint.", limit: "Ce code a atteint sa limite d’utilisation.", user_limit: "Tu as déjà utilisé ce code le nombre maximal de fois." };
      return NextResponse.json({ error: labels[reason] ?? "Code promotionnel invalide." }, { status: 400 });
    }
    discountAmount = Math.max(0, Math.min(rpAmount, Math.round(Number(quote.discount_amount ?? 0))));
  }
  const payableRp = Math.max(0, rpAmount - discountAmount);

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
    return NextResponse.json(
      { error: "Associe ton compte Steam avant d’acheter des jetons." },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from("casino_conversion_requests")
    .select("id,user_id,status,chip_amount,rp_amount,discount_amount,promo_code")
    .eq("id", requestId)
    .maybeSingle();
  if (existing) {
    if (existing.user_id === data.user.id && existing.status === "approved") {
      return NextResponse.json({ ok: true, alreadyCompleted: true, rpDebited: Math.max(0, Number(existing.rp_amount ?? 0) - Number(existing.discount_amount ?? 0)), chipsCredited: existing.chip_amount });
    }
    return NextResponse.json({ error: existing.user_id === data.user.id && existing.status === "pending" ? "Cet achat est encore en cours de vérification. Contacte la Direction avant de réessayer." : "Cette référence d’achat est déjà utilisée." }, { status: 409 });
  }

  const { error: reservationError } = await (admin as any).rpc(
    "casino_reserve_purchase_v16410",
    {
      p_request_id: requestId,
      p_user_id: data.user.id,
      p_steam_id: steamId,
      p_rp_amount: rpAmount,
      p_discount_amount: discountAmount,
      p_promo_code: promoCode || null,
      p_chip_amount: chipAmount,
      p_base_chip_amount: baseChipAmount,
      p_bonus_chip_amount: bonusChipAmount,
      p_rate: settings.rpPerChip,
      p_package_id: resolvedPackageId,
    },
  );
  if (reservationError) {
    console.error("[casino-cashier] Réservation achat impossible.", reservationError);
    const reservationMessage = String(
      reservationError.message ?? reservationError.code ?? "",
    );
    const error = reservationMessage.includes("pending_purchase_exists")
      ? "Un autre achat de jetons est réellement en cours. Attends quelques secondes puis actualise la caisse."
      : reservationMessage.includes("minimum_purchase")
        ? `L’achat minimum est de 1 jeton (${settings.rpPerChip.toLocaleString("fr-FR")} $RP au taux actuel).`
        : reservationMessage.includes("purchase_reference_used")
          ? "Cette référence d’achat a déjà été utilisée. Actualise la caisse puis réessaie."
          : reservationMessage.includes("invalid_purchase")
            ? "Les informations de l’achat sont invalides. Actualise la caisse puis réessaie."
            : "La caisse n’a pas pu préparer l’achat. Actualise la page et réessaie.";
    return NextResponse.json({ error }, { status: 409 });
  }

  const debit = payableRp > 0
    ? await debitCitizenGameMoney(steamId, payableRp)
    : { status: "paid" as const, amount: 0, availableBefore: 0, debits: [] as Array<{ column: string; label: string; amount: number }> };
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
            ? `Solde RP insuffisant${debit.available === null ? "." : ` : ${debit.available.toLocaleString("fr-FR")} $RP disponibles.`}`
            : "La banque RP est temporairement indisponible. Aucun argent n’a été débité.";
    return NextResponse.json({ error }, { status: debit.status === "unavailable" ? 503 : 400 });
  }

  const { data: result, error } = await (admin as any).rpc(
    "casino_complete_rp_purchase_v16410",
    {
      p_request_id: requestId,
      p_user_id: data.user.id,
      p_steam_id: steamId,
      p_rp_amount: rpAmount,
      p_base_chip_amount: baseChipAmount,
      p_bonus_chip_amount: bonusChipAmount,
      p_rate: settings.rpPerChip,
      p_package_id: resolvedPackageId,
      p_discount_amount: discountAmount,
      p_promo_code: promoCode || null,
    },
  );
  if (error) {
    const refunded = payableRp === 0 ? true : await refundCitizenGameMoney(steamId, debit.debits);
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
  if (promoCode) {
    await (supabase as any).rpc("nostra_redeem_promo_v153", {
      p_code: promoCode, p_scope: "cercle", p_amount: rpAmount, p_source_type: "casino_purchase", p_source_id: requestId,
    });
  }
  return NextResponse.json({
    ok: true,
    purchase: result,
    rpDebited: payableRp,
    discountAmount,
    chipsCredited: chipAmount,
    baseChips: baseChipAmount,
    bonusChips: bonusChipAmount,
  });
}
