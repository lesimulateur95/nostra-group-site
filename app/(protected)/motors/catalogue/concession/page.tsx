import {
  CatalogueViewV51,
} from "@/components/motors/catalogue-view-v51";

export default function CatalogueConcessionPage({
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
      title="Catalogue concession"
      description="Les véhicules disponibles directement à la concession Nostra Motors, sélectionnés par la Direction."
      searchParams={searchParams}
    />
  );
}
