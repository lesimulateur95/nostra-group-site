import { CatalogueViewV51 } from "@/components/motors/catalogue-view-v51";

export default function UsedVehiclesCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    cart_added?: string;
    cart_error?: string;
  }>;
}) {
  return (
    <CatalogueViewV51
      catalogType="used"
      title="Véhicules d’occasion"
      description="Des véhicules contrôlés et remis en vente par Nostra Motors, disponibles à la réservation ou à la commande."
      searchParams={searchParams}
    />
  );
}
