import {
  getCircuitNavigation,
  type CircuitNavCategory,
  type CircuitNavPage,
} from "@/lib/content/circuit-navigation";

const licensePaymentPage: CircuitNavPage = {
  key: "licence-paiement",
  href: "/circuit/administration-sportive/payer-ma-licence",
  label: "Payer ma licence",
};

export async function getCircuitNavigationWithLicenses(): Promise<
  CircuitNavCategory[]
> {
  const categories = await getCircuitNavigation();

  return categories.map((category) => {
    if (category.key !== "administration-sportive") return category;

    const alreadyPresent = category.children.some(
      (page) => page.key === licensePaymentPage.key,
    );

    if (alreadyPresent) return category;

    const tariffIndex = category.children.findIndex(
      (page) => page.key === "licence-tarifs",
    );

    const children = [...category.children];
    children.splice(
      tariffIndex >= 0 ? tariffIndex + 1 : children.length,
      0,
      licensePaymentPage,
    );

    return {
      ...category,
      children,
    };
  });
}
