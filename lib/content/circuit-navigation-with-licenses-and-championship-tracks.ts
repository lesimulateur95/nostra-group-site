import {
  getCircuitNavigationWithLicenses,
} from "@/lib/content/circuit-navigation-with-licenses";
import type {
  CircuitNavCategory,
  CircuitNavPage,
} from "@/lib/content/circuit-navigation";

const gt3TracksPage: CircuitNavPage = {
  key: "gt3-circuits-championnat",
  href:
    "/circuit/championnat-gt3rs/circuit-du-championnat",
  label: "Circuit du championnat",
};

const f1TracksPage: CircuitNavPage = {
  key: "f1-circuits-championnat",
  href:
    "/circuit/championnat-f1/circuit-du-championnat",
  label: "Circuit du championnat",
};

function insertTrackPage(
  category: CircuitNavCategory,
  targetPage: CircuitNavPage,
  overviewKey: string,
): CircuitNavCategory {
  const alreadyPresent = category.children.some(
    (page) => page.key === targetPage.key,
  );

  if (alreadyPresent) return category;

  const overviewIndex = category.children.findIndex(
    (page) => page.key === overviewKey,
  );

  const children = [...category.children];

  children.splice(
    overviewIndex >= 0
      ? overviewIndex + 1
      : children.length,
    0,
    targetPage,
  );

  return {
    ...category,
    children,
  };
}

export async function getCircuitNavigationWithLicensesAndChampionshipTracks(): Promise<
  CircuitNavCategory[]
> {
  const categories =
    await getCircuitNavigationWithLicenses();

  return categories.map((category) => {
    if (category.key === "championnat-gt3rs") {
      return insertTrackPage(
        category,
        gt3TracksPage,
        "championnat-gt3rs",
      );
    }

    if (category.key === "championnat-f1") {
      return insertTrackPage(
        category,
        f1TracksPage,
        "championnat-f1",
      );
    }

    return category;
  });
}
