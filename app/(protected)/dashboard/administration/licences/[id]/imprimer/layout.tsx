import type { ReactNode } from "react";

import { DocumentAuthenticityPanel } from "@/components/documents/document-authenticity-panel";
import { getRegistryForLicence } from "@/lib/documents/data";

export default async function LicencePrintLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registry = await getRegistryForLicence(id);

  return (
    <>
      {registry && <DocumentAuthenticityPanel document={registry} />}
      {children}
    </>
  );
}
