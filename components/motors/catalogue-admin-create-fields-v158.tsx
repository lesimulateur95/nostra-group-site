"use client";

import { useState } from "react";

export function CatalogueAdminCreateFieldsV158({
  catalogTypes,
  defaultCatalogType,
  collections,
  defaultCollectionId = "",
}: {
  catalogTypes: Array<{ value: string; label: string }>;
  defaultCatalogType: string;
  collections: Array<{ id: string; name: string; active: boolean }>;
  defaultCollectionId?: string;
}) {
  const [catalogType, setCatalogType] = useState(defaultCatalogType);

  return (
    <>
      <label>
        Catalogue
        <select
          name="catalog_type"
          value={catalogType}
          onChange={(event) => setCatalogType(event.target.value)}
        >
          {catalogTypes.map((type) => (
            <option value={type.value} key={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      {catalogType === "exclusive" && (
        <label>
          Collection exclusive
          <select name="exclusive_collection_id" defaultValue={defaultCollectionId}>
            <option value="">Aucune collection</option>
            {collections
              .filter((collection) => collection.active)
              .map((collection) => (
                <option value={collection.id} key={collection.id}>
                  {collection.name}
                </option>
              ))}
          </select>
          <small>
            Tu peux créer ou modifier les collections depuis le bloc Collections du catalogue exclusif.
          </small>
        </label>
      )}
    </>
  );
}
