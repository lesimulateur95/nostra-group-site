
import { createClient } from "@/lib/supabase/server";

export type NostraMailbox = {
  id: number;
  address: string;
  display_name: string;
  mailbox_type: "citizen" | "team";
};

export type MailMessage = {
  message_id: number;
  thread_id: string;
  sender_address: string;
  sender_name: string;
  recipient_address: string;
  recipient_name: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
  direction: "inbox" | "sent";
};

export type CitizenMailbox = {
  mailbox_id: number;
  user_id: string;
  address: string;
  display_name: string;
};

function firstRow<T>(value: T[] | T | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getMyMailboxOverview(): Promise<{
  configured: boolean;
  mailbox: NostraMailbox | null;
  unread: number;
}> {
  const supabase = await createClient();

  const [mailboxResult, unreadResult] = await Promise.all([
    supabase.rpc("nostra_get_or_create_my_mailbox"),
    supabase.rpc("nostra_get_unread_mail_count"),
  ]);

  if (mailboxResult.error) {
    return { configured: false, mailbox: null, unread: 0 };
  }

  return {
    configured: true,
    mailbox: firstRow(mailboxResult.data as NostraMailbox[] | NostraMailbox | null),
    unread: Number(firstRow(unreadResult.data as number[] | number | null) ?? 0),
  };
}

export async function getMyMailMessages(
  folder: "inbox" | "sent",
): Promise<MailMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nostra_get_my_mail_messages", {
    p_folder: folder,
  });

  if (error) return [];
  return (data ?? []) as MailMessage[];
}

export async function getMyMailThread(
  threadId: string,
): Promise<MailMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nostra_get_my_mail_thread", {
    p_thread_id: threadId,
  });

  if (error) return [];
  return (data ?? []) as MailMessage[];
}

export async function getUnreadTeamMailCount(): Promise<{
  configured: boolean;
  unread: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_unread_team_mail_count",
  );

  return {
    configured: !error,
    unread: error
      ? 0
      : Number(firstRow(data as number[] | number | null) ?? 0),
  };
}

export async function getTeamMailMessages(
  folder: "inbox" | "sent",
): Promise<MailMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nostra_get_team_mail_messages", {
    p_folder: folder,
  });

  if (error) return [];
  return (data ?? []) as MailMessage[];
}

export async function getTeamMailThread(
  threadId: string,
): Promise<MailMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nostra_get_team_mail_thread", {
    p_thread_id: threadId,
  });

  if (error) return [];
  return (data ?? []) as MailMessage[];
}

export async function getCitizenMailboxes(): Promise<CitizenMailbox[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_citizen_mailboxes_for_team",
  );

  if (error) return [];
  return (data ?? []) as CitizenMailbox[];
}
