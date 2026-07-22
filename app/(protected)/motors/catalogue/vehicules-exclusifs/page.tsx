import {
  CatalogueViewV51,
} from "@/components/motors/catalogue-view-v51";

export default function ExclusiveCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    cart_added?: string;
    cart_error?: string;
  }>;
}) {
  return (
    <CatalogueViewV51
      catalogType="exclusive"
      title="Catalogue véhicules exclusifs"
      description="Les véhicules rares et exclusifs sélectionnés par la Direction Nostra Motors."
      searchParams={searchParams}
    />
  );
}
