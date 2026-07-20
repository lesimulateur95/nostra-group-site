
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(
  value: FormDataEntryValue | null,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeThread(value: FormDataEntryValue | null): string {
  const thread = text(value, 80);
  return /^[0-9a-f-]{36}$/i.test(thread) ? thread : "";
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return supabase;
}

export async function sendMailToNostra(formData: FormData) {
  const subject = text(formData.get("subject"), 180);
  const body = text(formData.get("body"), 5000);

  if (subject.length < 3 || body.length < 3) {
    redirect("/profil/messagerie?error=invalid");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("nostra_send_mail_to_team", {
    p_subject: subject,
    p_body: body,
  });

  if (error) redirect("/profil/messagerie?error=send");

  revalidatePath("/profil");
  revalidatePath("/profil/messagerie");
  revalidatePath("/dashboard/messagerie");
  redirect("/profil/messagerie?sent=1");
}

export async function sendTeamMailToCitizen(formData: FormData) {
  const mailboxId = integer(formData.get("recipient_mailbox_id"));
  const subject = text(formData.get("subject"), 180);
  const body = text(formData.get("body"), 5000);

  if (mailboxId <= 0 || subject.length < 3 || body.length < 3) {
    redirect("/dashboard/messagerie?error=invalid");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("nostra_send_mail_to_user", {
    p_recipient_mailbox_id: mailboxId,
    p_subject: subject,
    p_body: body,
  });

  if (error) redirect("/dashboard/messagerie?error=send");

  revalidatePath("/profil/messagerie");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messagerie");
  redirect("/dashboard/messagerie?sent=1");
}

export async function replyToMail(formData: FormData) {
  const threadId = safeThread(formData.get("thread_id"));
  const body = text(formData.get("body"), 5000);
  const context = text(formData.get("context"), 20);

  if (!threadId || body.length < 2) {
    redirect(
      context === "team"
        ? "/dashboard/messagerie?error=invalid"
        : "/profil/messagerie?error=invalid",
    );
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc("nostra_reply_to_mail", {
    p_thread_id: threadId,
    p_body: body,
  });

  if (error) {
    redirect(
      context === "team"
        ? `/dashboard/messagerie?thread=${threadId}&error=reply`
        : `/profil/messagerie?thread=${threadId}&error=reply`,
    );
  }

  revalidatePath("/profil");
  revalidatePath("/profil/messagerie");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messagerie");

  redirect(
    context === "team"
      ? `/dashboard/messagerie?thread=${threadId}&replied=1`
      : `/profil/messagerie?thread=${threadId}&replied=1`,
  );
}

export async function openMyMailThread(formData: FormData) {
  const threadId = safeThread(formData.get("thread_id"));
  if (!threadId) redirect("/profil/messagerie");

  const supabase = await requireUser();
  await supabase.rpc("nostra_mark_mail_thread_read", {
    p_thread_id: threadId,
  });

  revalidatePath("/profil");
  revalidatePath("/profil/messagerie");
  redirect(`/profil/messagerie?thread=${threadId}`);
}

export async function openTeamMailThread(formData: FormData) {
  const threadId = safeThread(formData.get("thread_id"));
  if (!threadId) redirect("/dashboard/messagerie");

  const supabase = await requireUser();
  await supabase.rpc("nostra_mark_team_mail_thread_read", {
    p_thread_id: threadId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messagerie");
  redirect(`/dashboard/messagerie?thread=${threadId}`);
}


export async function deleteMyMailThread(formData: FormData) {
  const threadId = safeThread(formData.get("thread_id"));
  if (!threadId) redirect("/profil/messagerie?error=delete");

  const supabase = await requireUser();
  const { error } = await supabase.rpc(
    "nostra_delete_my_mail_thread",
    {
      p_thread_id: threadId,
    },
  );

  if (error) {
    redirect(
      `/profil/messagerie?thread=${threadId}&error=delete`,
    );
  }

  revalidatePath("/profil");
  revalidatePath("/profil/messagerie");
  redirect("/profil/messagerie?deleted=1");
}

export async function deleteTeamMailThread(formData: FormData) {
  const threadId = safeThread(formData.get("thread_id"));
  if (!threadId) {
    redirect("/dashboard/messagerie?error=delete");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc(
    "nostra_delete_team_mail_thread",
    {
      p_thread_id: threadId,
    },
  );

  if (error) {
    redirect(
      `/dashboard/messagerie?thread=${threadId}&error=delete`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messagerie");
  redirect("/dashboard/messagerie?deleted=1");
}
