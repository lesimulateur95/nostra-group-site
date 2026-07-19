import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/site/auto-refresh";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  return (
    <>
      <AutoRefresh />
      {children}
    </>
  );
}
