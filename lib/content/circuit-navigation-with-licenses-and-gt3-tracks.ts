import {
  getCircuitNavigationWithLicenses,
} from "@/lib/content/circuit-navigation-with-licenses";
import type {
  CircuitNavCategory,
  CircuitNavPage,
} from "@/lib/content/circuit-navigation";

const gt3ChampionshipTracksPage: CircuitNavPage = {
  key: "gt3-circuits-championnat",
  href:
    "/circuit/championnat-gt3rs/circuit-du-championnat",
  label: "Circuit du championnat",
};

export async function getCircuitNavigationWithLicensesAndGt3Tracks(): Promise<
  CircuitNavCategory[]
> {
  const categories =
    await getCircuitNavigationWithLicenses();

  return categories.map((category) => {
    if (category.key !== "championnat-gt3rs") {
      return category;
    }

    const alreadyPresent = category.children.some(
      (page) =>
        page.key === gt3ChampionshipTracksPage.key,
    );

    if (alreadyPresent) return category;

    const overviewIndex = category.children.findIndex(
      (page) => page.key === "championnat-gt3rs",
    );

    const children = [...category.children];

    children.splice(
      overviewIndex >= 0
        ? overviewIndex + 1
        : children.length,
      0,
      gt3ChampionshipTracksPage,
    );

    return {
      ...category,
      children,
    };
  });
}
