import {
  CatalogueViewV51,
} from "@/components/motors/catalogue-view-v51";

export default function CatalogueLocationPage({
  searchParams,
}: {
  searchParams: Promise<{
    cart_added?: string;
    cart_error?: string;
  }>;
}) {
  return (
    <CatalogueViewV51
      catalogType="concession"
      title="Catalogue location"
      description="Découvre les véhicules proposés à la location par Nostra Motors."
      searchParams={searchParams}
    />
  );
}
