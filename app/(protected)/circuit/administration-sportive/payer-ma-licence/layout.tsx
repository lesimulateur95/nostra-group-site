import type { ReactNode } from "react";

export default function ServiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  // La page reste toujours visible. Chaque type de licence est désormais
  // ouvert ou clôturé individuellement directement dans la page.
  return children;
}
