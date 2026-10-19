-- Mi Ruta · esquema completo. Puedes ejecutarlo varias veces sin problema.
-- Supabase → SQL Editor → New query → pegar todo → Run.

-- ── Unidades en vivo ──────────────────────────────────────────────
create table if not exists public.units (
  id text primary key,                         -- = id del conductor (auth.uid())
  nombre text not null,
  ruta text not null,
  tipo text not null default 'carrito' check (tipo in ('bus','carrito')),
  estado text not null check (estado in ('cupo','lleno')),
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.units add column if not exists tipo text not null default 'carrito' check (tipo in ('bus','carrito'));

-- ── Reportes de pasajeros ─────────────────────────────────────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  ruta text not null,
  tipo text not null check (tipo in ('vi','lleno','nopasa')),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- ── Conductores (cuenta + aprobación manual) ──────────────────────
create table if not exists public.drivers (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null,
  nombre text not null default '',
  aprobado boolean not null default false,     -- tú lo cambias a true en Table Editor
  created_at timestamptz not null default now()
);

create or replace function public.es_conductor_aprobado()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.drivers d where d.id = auth.uid() and d.aprobado)
$$;
grant execute on function public.es_conductor_aprobado() to authenticated;

-- ── Seguridad (RLS) ───────────────────────────────────────────────
alter table public.units   enable row level security;
alter table public.reports enable row level security;
alter table public.drivers enable row level security;

-- units: todos leen; solo un conductor aprobado escribe SU propia unidad
drop policy if exists "units_all" on public.units;
drop policy if exists "units_select" on public.units;
drop policy if exists "units_insert" on public.units;
drop policy if exists "units_update" on public.units;
drop policy if exists "units_delete" on public.units;
create policy "units_select" on public.units for select to anon, authenticated using (true);
create policy "units_insert" on public.units for insert to authenticated
  with check (id = auth.uid()::text and public.es_conductor_aprobado());
create policy "units_update" on public.units for update to authenticated
  using (id = auth.uid()::text and public.es_conductor_aprobado())
  with check (id = auth.uid()::text and public.es_conductor_aprobado());
create policy "units_delete" on public.units for delete to authenticated
  using (id = auth.uid()::text);

-- reports: cualquiera puede avisar (no leer)
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert to anon, authenticated with check (true);

-- drivers: cada conductor ve su fila y puede crearla (siempre sin aprobar)
drop policy if exists "drivers_select_own" on public.drivers;
drop policy if exists "drivers_insert_own" on public.drivers;
create policy "drivers_select_own" on public.drivers for select to authenticated using (id = auth.uid());
create policy "drivers_insert_own" on public.drivers for insert to authenticated
  with check (id = auth.uid() and aprobado = false);

-- Limpia unidades de pruebas anteriores
delete from public.units;

-- ── Tiempo real ───────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.units;
exception when duplicate_object then null;
end $$;
