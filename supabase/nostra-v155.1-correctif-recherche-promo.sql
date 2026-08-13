-- V155.1 — Recherche citoyen + fiabilisation des codes promotionnels
-- À exécuter après V153.1 / V155.

create or replace function public.nostra_normalize_promo_code_v1551(p_code text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(coalesce(p_code,'')), '[^A-Z0-9_-]', '', 'g');
$$;

grant execute on function public.nostra_normalize_promo_code_v1551(text) to authenticated;

-- Toute nouvelle création/modification de code est normalisée de la même façon
-- que la saisie effectuée dans le panier.
create or replace function public.nostra_normalize_promo_row_v1551()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := public.nostra_normalize_promo_code_v1551(new.code);
  if coalesce(new.code,'') = '' then
    raise exception using message='promo_code_empty';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nostra_normalize_promo_v1551 on public.nostra_promo_codes_v153;
create trigger trg_nostra_normalize_promo_v1551
before insert or update of code on public.nostra_promo_codes_v153
for each row execute function public.nostra_normalize_promo_row_v1551();

-- Remplace la recherche stricte du code par une recherche normalisée.
-- Ex. "nostra 10", "NOSTRA10" et " nostra10 " pointent vers le même code.
create or replace function public.nostra_promo_quote_v153(
  p_code text,
  p_scope text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.nostra_promo_codes_v153%rowtype;
  v_total_uses integer := 0;
  v_user_uses integer := 0;
  v_discount numeric(14,2) := 0;
  v_normalized text := public.nostra_normalize_promo_code_v1551(p_code);
begin
  if v_uid is null then raise exception using message='not_authenticated'; end if;
  if coalesce(v_normalized,'') = '' then return jsonb_build_object('valid',false,'reason','empty'); end if;

  select * into v_code
  from public.nostra_promo_codes_v153
  where public.nostra_normalize_promo_code_v1551(code) = v_normalized
  order by created_at desc
  limit 1;

  if not found then return jsonb_build_object('valid',false,'reason','unknown','code',v_normalized); end if;
  if not v_code.enabled then return jsonb_build_object('valid',false,'reason','disabled','code',v_code.code); end if;
  if v_code.scope <> 'global' and v_code.scope <> p_scope then return jsonb_build_object('valid',false,'reason','scope','scope',v_code.scope); end if;
  if v_code.starts_at is not null and now() < v_code.starts_at then return jsonb_build_object('valid',false,'reason','not_started'); end if;
  if v_code.ends_at is not null and now() > v_code.ends_at then return jsonb_build_object('valid',false,'reason','expired'); end if;
  if coalesce(p_amount,0) < v_code.min_amount then return jsonb_build_object('valid',false,'reason','minimum','minimum',v_code.min_amount); end if;

  select count(*) into v_total_uses from public.nostra_promo_redemptions_v153 where promo_id=v_code.id;
  select count(*) into v_user_uses from public.nostra_promo_redemptions_v153 where promo_id=v_code.id and user_id=v_uid;
  if v_code.max_uses is not null and v_total_uses >= v_code.max_uses then return jsonb_build_object('valid',false,'reason','limit'); end if;
  if v_user_uses >= v_code.max_uses_per_user then return jsonb_build_object('valid',false,'reason','user_limit'); end if;

  if v_code.discount_type='percent' then
    v_discount := round(greatest(0,p_amount) * least(100,v_code.discount_value) / 100, 2);
  else
    v_discount := least(greatest(0,p_amount),v_code.discount_value);
  end if;
  if v_code.max_discount is not null then v_discount := least(v_discount,v_code.max_discount); end if;

  return jsonb_build_object(
    'valid',true,
    'promo_id',v_code.id,
    'code',v_code.code,
    'label',v_code.label,
    'scope',v_code.scope,
    'discount_type',v_code.discount_type,
    'discount_value',v_code.discount_value,
    'discount_amount',v_discount,
    'final_amount',greatest(0,p_amount-v_discount)
  );
end;
$$;

grant execute on function public.nostra_promo_quote_v153(text,text,numeric) to authenticated;

-- Diagnostic pratique : permet au Dashboard / SQL Editor de vérifier ce qui est
-- réellement présent sans modifier ni consommer le code.
create or replace function public.nostra_promo_debug_v1551(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := public.nostra_normalize_promo_code_v1551(p_code);
  v_row public.nostra_promo_codes_v153%rowtype;
begin
  if auth.uid() is null then raise exception using message='not_authenticated'; end if;
  select * into v_row from public.nostra_promo_codes_v153
  where public.nostra_normalize_promo_code_v1551(code)=v_norm
  order by created_at desc limit 1;
  if not found then return jsonb_build_object('found',false,'normalized',v_norm); end if;
  return jsonb_build_object(
    'found',true,'normalized',v_norm,'stored_code',v_row.code,
    'enabled',v_row.enabled,'scope',v_row.scope,
    'starts_at',v_row.starts_at,'ends_at',v_row.ends_at,
    'min_amount',v_row.min_amount
  );
end;
$$;

grant execute on function public.nostra_promo_debug_v1551(text) to authenticated;
