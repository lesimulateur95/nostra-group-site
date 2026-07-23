import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DocumentAuthenticityPanel } from "@/components/documents/document-authenticity-panel";
import { getRegistryForInvoice } from "@/lib/documents/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileDocumentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const registry = await getRegistryForInvoice(id, data.user.id);

  return (
    <>
      {registry && <DocumentAuthenticityPanel document={registry} allowSignature />}
      {children}
    </>
  );
}
