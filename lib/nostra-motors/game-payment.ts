import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { transferCitizenGameMoney } from "@/lib/game-bank/data";

type SupabaseLike = {
  from: (table: string) => any;
};

type UserLike = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
};

export type NostraPaymentResult =
  | {
      ok: true;
      payerPid: string;
      receiverPid: string;
      amount: number;
      paymentId: string | null;
      payerBalanceAfter: number;
    }
  | {
      ok: false;
      reason:
        | "steam"
        | "receiver"
        | "bank"
        | "funds"
        | "payer"
        | "receiver_missing"
        | "duplicate";
      available?: number | null;
    };

function receiverPid(): string | null {
  const value = process.env.NOSTRA_MOTORS_RECEIVER_PID?.trim();
  return value || null;
}

export async function getNostraPayerPid(
  supabase: SupabaseLike,
  user: UserLike,
): Promise<string | null> {
  const { data } = await supabase
    .from("member_profiles")
    .select("steam_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const profilePid =
    typeof data?.steam_id === "string" ? data.steam_id.trim() : "";
  if (profilePid) return profilePid;

  const metadataPid =
    typeof user.user_metadata?.steam_id === "string"
      ? user.user_metadata.steam_id.trim()
      : "";
  return metadataPid || null;
}

async function reservePaymentAttempt(args: {
  userId: string;
  payerPid: string;
  receiverPid: string;
  amount: number;
  idempotencyKey: string;
  description: string;
}): Promise<{ ok: true; id: string | null } | { ok: false }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("transactions")
      .insert({
        user_id: args.userId,
        player_pid: args.payerPid,
        sender_account: args.payerPid,
        receiver_account: args.receiverPid,
        amount: args.amount,
        currency: "EUR",
        transaction_type: "nostra_purchase",
        source: "nostra_motors",
        status: "processing",
        idempotency_key: args.idempotencyKey,
        description: args.description,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation : le même bouton a déjà été traité.
      if (String(error.code ?? "") === "23505") return { ok: false };
      console.error("[nostra-payment] Journal de paiement indisponible.", error);
      // Si la table d'historique est absente, on autorise quand même le paiement.
      return { ok: true, id: null };
    }
    return { ok: true, id: data?.id ? String(data.id) : null };
  } catch (error) {
    console.error("[nostra-payment] Réservation du paiement impossible.", error);
    return { ok: true, id: null };
  }
}

async function updatePaymentAttempt(
  paymentId: string | null,
  payload: Record<string, unknown>,
) {
  if (!paymentId) return;
  try {
    const admin = createAdminClient();
    await admin.from("transactions").update(payload).eq("id", paymentId);
  } catch (error) {
    console.error("[nostra-payment] Mise à jour du journal impossible.", error);
  }
}

export async function chargeNostraMotors(args: {
  supabase: SupabaseLike;
  user: UserLike;
  amount: number;
  idempotencyKey: string;
  description: string;
}): Promise<NostraPaymentResult> {
  const amount = Math.trunc(args.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, reason: "bank" };
  }

  const payerPid = await getNostraPayerPid(args.supabase, args.user);
  if (!payerPid) return { ok: false, reason: "steam" };

  const targetPid = receiverPid();
  if (!targetPid) return { ok: false, reason: "receiver" };

  const reserved = await reservePaymentAttempt({
    userId: args.user.id,
    payerPid,
    receiverPid: targetPid,
    amount,
    idempotencyKey: args.idempotencyKey,
    description: args.description,
  });
  if (!reserved.ok) return { ok: false, reason: "duplicate" };

  const transfer = await transferCitizenGameMoney(payerPid, targetPid, amount);
  if (transfer.status !== "transferred") {
    await updatePaymentAttempt(reserved.id, {
      status: "failed",
      processed_at: new Date().toISOString(),
      error_message: transfer.status,
      metadata: { available: "available" in transfer ? transfer.available : null },
    });
    if (transfer.status === "insufficient_funds") {
      return { ok: false, reason: "funds", available: transfer.available };
    }
    if (transfer.status === "not_found") {
      return { ok: false, reason: "payer", available: transfer.available };
    }
    if (transfer.status === "receiver_not_found") {
      return {
        ok: false,
        reason: "receiver_missing",
        available: transfer.available,
      };
    }
    return { ok: false, reason: "bank", available: transfer.available };
  }

  await updatePaymentAttempt(reserved.id, {
    status: "completed",
    processed_at: new Date().toISOString(),
    external_transaction_id: `GAME-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    metadata: {
      payer_balance_before: transfer.payerBalanceBefore,
      payer_balance_after: transfer.payerBalanceAfter,
      receiver_balance_before: transfer.receiverBalanceBefore,
      receiver_balance_after: transfer.receiverBalanceAfter,
    },
  });

  return {
    ok: true,
    payerPid,
    receiverPid: targetPid,
    amount,
    paymentId: reserved.id,
    payerBalanceAfter: transfer.payerBalanceAfter,
  };
}

export async function refundNostraMotors(args: {
  payerPid: string;
  receiverPid: string;
  amount: number;
  paymentId?: string | null;
  reason: string;
}): Promise<boolean> {
  const reverse = await transferCitizenGameMoney(
    args.receiverPid,
    args.payerPid,
    Math.trunc(args.amount),
  );
  const ok = reverse.status === "transferred";
  await updatePaymentAttempt(args.paymentId ?? null, {
    status: ok ? "refunded" : "failed",
    processed_at: new Date().toISOString(),
    error_message: ok ? null : `refund_failed:${args.reason}`,
    metadata: {
      refund_reason: args.reason,
      refund_completed: ok,
    },
  });
  return ok;
}

export async function attachNostraPaymentOrder(
  paymentId: string | null,
  orderId: string | number,
) {
  await updatePaymentAttempt(paymentId, { order_id: String(orderId) });
}
