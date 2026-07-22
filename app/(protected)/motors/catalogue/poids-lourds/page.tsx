import {
  CatalogueViewV51,
} from "@/components/motors/catalogue-view-v51";

export default function HeavyCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    cart_added?: string;
    cart_error?: string;
  }>;
}) {
  return (
    <CatalogueViewV51
      catalogType="heavy"
      title="Catalogue poids lourd"
      description="Les poids lourds sélectionnés par la Direction Nostra Motors."
      searchParams={searchParams}
    />
  );
}
