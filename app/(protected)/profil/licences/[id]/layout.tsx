import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DocumentAuthenticityPanel } from "@/components/documents/document-authenticity-panel";
import { getRegistryForLicence } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileLicenceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const registry = await getRegistryForLicence(id, data.user.id);

  return (
    <>
      {registry && <DocumentAuthenticityPanel document={registry} allowSignature />}
      {children}
    </>
  );
}
