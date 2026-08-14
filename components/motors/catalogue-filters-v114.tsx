"use client";

import { useEffect, useMemo, useState } from "react";

export function CatalogueFiltersV114({
  brands,
  collections = [],
}: {
  brands: string[];
  collections?: Array<{ slug: string; name: string }>;
}) {
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [collection, setCollection] = useState("");
  const [availability, setAvailability] = useState("all");
  const [commerce, setCommerce] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("default");

  const filterKey = useMemo(
    () => [search, brand, collection, availability, commerce, minPrice, maxPrice, sort].join("|"),
    [search, brand, collection, availability, commerce, minPrice, maxPrice, sort],
  );

  useEffect(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-catalogue-card-v114]"),
    );
    const normalizedSearch = search.trim().toLocaleLowerCase("fr-FR");
    const min = minPrice ? Number(minPrice) : Number.NEGATIVE_INFINITY;
    const max = maxPrice ? Number(maxPrice) : Number.POSITIVE_INFINITY;

    for (const card of cards) {
      const cardBrand = card.dataset.brand ?? "";
      const label = card.dataset.search ?? "";
      const cardCollection = card.dataset.collection ?? "";
      const price = Number(card.dataset.price ?? 0);
      const stock = Number(card.dataset.stock ?? 0);
      const canReserve = card.dataset.reserve === "true";
      const canOrder = card.dataset.sale === "true";
      const status = card.dataset.status ?? "available";

      const matchSearch = !normalizedSearch || label.includes(normalizedSearch);
      const matchBrand = !brand || cardBrand === brand;
      const matchCollection = !collection || cardCollection === collection;
      const matchPrice = price >= min && price <= max;
      const matchAvailability =
        availability === "all" ||
        (availability === "available" && stock > 0 && status === "available") ||
        (availability === "unavailable" && (stock <= 0 || status !== "available"));
      const matchCommerce =
        commerce === "all" ||
        (commerce === "reservation" && canReserve) ||
        (commerce === "sale" && canOrder) ||
        (commerce === "blocked" && !canReserve && !canOrder);

      card.hidden = !(
        matchSearch &&
        matchBrand &&
        matchCollection &&
        matchPrice &&
        matchAvailability &&
        matchCommerce
      );
    }

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-catalogue-brand-section-v114]"),
    );
    for (const section of sections) {
      const visibleCards = section.querySelectorAll<HTMLElement>(
        "[data-catalogue-card-v114]:not([hidden])",
      );
      section.hidden = visibleCards.length === 0;

      const grid = section.querySelector<HTMLElement>(".catalogue-vehicle-grid");
      if (grid) {
        const allCards = Array.from(
          grid.querySelectorAll<HTMLElement>("[data-catalogue-card-v114]"),
        );
        allCards.sort((a, b) => {
          if (sort === "default") {
            return Number(a.dataset.order ?? 0) - Number(b.dataset.order ?? 0);
          }
          const priceA = Number(a.dataset.price ?? 0);
          const priceB = Number(b.dataset.price ?? 0);
          return sort === "price-desc" ? priceB - priceA : priceA - priceB;
        });
        for (const item of allCards) grid.appendChild(item);
      }
    }

    const root = document.querySelector<HTMLElement>("[data-catalogue-results-v114]");
    const noResults = document.querySelector<HTMLElement>("[data-catalogue-no-results-v114]");
    const visibleCount = cards.filter((card) => !card.hidden).length;
    if (root) root.dataset.visibleCount = String(visibleCount);
    if (noResults) noResults.hidden = visibleCount !== 0;
  }, [filterKey, search, brand, collection, availability, commerce, minPrice, maxPrice, sort]);

  function reset() {
    setSearch("");
    setBrand("");
    setCollection("");
    setAvailability("all");
    setCommerce("all");
    setMinPrice("");
    setMaxPrice("");
    setSort("default");
  }

  return (
    <section className="catalogue-filters-v114" aria-label="Filtres du catalogue">
      <div className="catalogue-filter-main-v114">
        <label>
          <span>Rechercher</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Marque ou modèle"
          />
        </label>
        <label>
          <span>Marque</span>
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            <option value="">Toutes les marques</option>
            {brands.map((item) => (
              <option value={item.toLocaleLowerCase("fr-FR")} key={item}>{item}</option>
            ))}
          </select>
        </label>
        {collections.length > 0 && (
          <label>
            <span>Collection</span>
            <select value={collection} onChange={(event) => setCollection(event.target.value)}>
              <option value="">Toutes les collections</option>
              {collections.map((item) => (
                <option value={item.slug} key={item.slug}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Disponibilité</span>
          <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
            <option value="all">Tous</option>
            <option value="available">Disponible</option>
            <option value="unavailable">Indisponible</option>
          </select>
        </label>
        <label>
          <span>Achat possible</span>
          <select value={commerce} onChange={(event) => setCommerce(event.target.value)}>
            <option value="all">Tous</option>
            <option value="reservation">Réservation autorisée</option>
            <option value="sale">Vente autorisée</option>
            <option value="blocked">Vente et réservation bloquées</option>
          </select>
        </label>
      </div>

      <div className="catalogue-filter-secondary-v114">
        <label><span>Prix minimum</span><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
        <label><span>Prix maximum</span><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
        <label>
          <span>Trier</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="default">Ordre du catalogue</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
          </select>
        </label>
        <button type="button" onClick={reset}>Réinitialiser les filtres</button>
      </div>
    </section>
  );
}
