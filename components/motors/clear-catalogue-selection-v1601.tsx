"use client";

import { useEffect } from "react";
import { clearCatalogueVehicleSelectionV1601 } from "@/components/motors/catalogue-selection-v1601";

export function ClearCatalogueSelectionV1601() {
  useEffect(() => {
    clearCatalogueVehicleSelectionV1601();
  }, []);

  return null;
}
