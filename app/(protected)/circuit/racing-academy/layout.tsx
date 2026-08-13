import type { ReactNode } from "react";
import { PoleMaintenanceGuard } from "@/components/v153/pole-maintenance-guard";

export default function RacingAcademyCitizenLayout({ children }: { children: ReactNode }) {
  return <PoleMaintenanceGuard pole="academy">{children}</PoleMaintenanceGuard>;
}
