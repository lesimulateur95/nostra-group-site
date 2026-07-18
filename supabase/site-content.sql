-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Cette table permet au Dashboard Gérant de modifier les pages du Nostra Circuit.

create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_pages enable row level security;

drop policy if exists "site pages readable by authenticated users" on public.site_pages;
create policy "site pages readable by authenticated users"
on public.site_pages
for select
to authenticated
using (true);

drop policy if exists "manager can insert site pages" on public.site_pages;
create policy "manager can insert site pages"
on public.site_pages
for insert
to authenticated
with check (
  coalesce(
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'sub'
  ) = '331843410962939908'
);

drop policy if exists "manager can update site pages" on public.site_pages;
create policy "manager can update site pages"
on public.site_pages
for update
to authenticated
using (
  coalesce(
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'sub'
  ) = '331843410962939908'
)
with check (
  coalesce(
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'sub'
  ) = '331843410962939908'
);

drop policy if exists "manager can delete site pages" on public.site_pages;
create policy "manager can delete site pages"
on public.site_pages
for delete
to authenticated
using (
  coalesce(
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'user_metadata' ->> 'sub'
  ) = '331843410962939908'
);
