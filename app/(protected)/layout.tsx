import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlobalNotificationPopup } from "@/components/notifications/global-notification-popup";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  return (
    <>
      {children}
      <GlobalNotificationPopup />
    </>
  );
}
