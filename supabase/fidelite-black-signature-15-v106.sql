-- Nostra Group V106 — Black Signature à 15 % partout
-- À exécuter une seule fois après avoir déployé les fichiers du correctif.
-- Ce script ne supprime aucune carte, commande ni donnée citoyen.

begin;

-- Corrige la remise utilisée par le catalogue, le panier et les commandes.
do $$
begin
  if to_regclass('public.loyalty_tiers') is not null then
    update public.loyalty_tiers
    set catalog_discount_percent = 15
    where lower(replace(replace(coalesce(code, ''), '_', ' '), '-', ' ')) like '%black%'
       or lower(coalesce(label, '')) like '%black signature%';
  end if;
end;
$$;

-- Corrige également l'ancien profil de fidélité encore affiché dans le profil
-- citoyen et dans le Dashboard.
do $$
begin
  if to_regclass('public.loyalty_profiles') is not null then
    update public.loyalty_profiles
    set discount_percent = 15,
        updated_at = now()
    where lower(replace(replace(trim(coalesce(tier, '')), '_', ' '), '-', ' '))
          in ('black', 'black signature')
      and discount_percent is distinct from 15;
  end if;
end;
$$;

-- Met à jour les avantages enregistrés en base, quel que soit le type utilisé
-- pour la colonne benefits (json/jsonb ou tableau de texte).
do $$
declare
  v_benefits_type text;
begin
  if to_regclass('public.loyalty_tiers') is null then
    return;
  end if;

  select data_type
    into v_benefits_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'loyalty_tiers'
    and column_name = 'benefits';

  if v_benefits_type in ('json', 'jsonb') then
    execute format(
      'update public.loyalty_tiers
       set benefits = replace(replace(benefits::text, %L, %L), %L, %L)::%s
       where lower(replace(replace(coalesce(code, ''''), ''_'', '' ''), ''-'', '' '')) like ''%%black%%''
          or lower(coalesce(label, '''')) like ''%%black signature%%''',
      '10 %', '15 %', '10%', '15%', v_benefits_type
    );
  elsif v_benefits_type = 'ARRAY' then
    execute
      'update public.loyalty_tiers
       set benefits = array(
         select replace(replace(item, ''10 %'', ''15 %''), ''10%'', ''15%'')
         from unnest(benefits) as item
       )
       where lower(replace(replace(coalesce(code, ''''), ''_'', '' ''), ''-'', '' '')) like ''%black%''
          or lower(coalesce(label, '''')) like ''%black signature%''';
  end if;
end;
$$;

-- Le contenu personnalisable déjà sauvegardé dans le Dashboard doit lui aussi
-- afficher 15 %, et pas seulement le texte par défaut du code.
do $$
begin
  if to_regclass('public.site_pages') is not null then
    update public.site_pages
    set content = replace(replace(content, '10 %', '15 %'), '10%', '15%'),
        updated_at = now()
    where slug = 'motors-fidelite'
      and (content like '%10 %%' or content like '%10%%');
  end if;
end;
$$;

commit;
