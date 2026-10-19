-- Ejecuta esto en Supabase → SQL Editor (una sola vez).
create table if not exists public.units (
  id text primary key,
  nombre text not null,
  ruta text not null,
  tipo text not null default 'carrito' check (tipo in ('bus','carrito')),
  estado text not null check (estado in ('cupo','lleno')),
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  ruta text not null,
  tipo text not null check (tipo in ('vi','lleno','nopasa')),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.units enable row level security;
alter table public.reports enable row level security;

-- MVP: acceso abierto con la clave anon. Cualquiera podría falsear una unidad.
-- Antes de lanzar en serio: autenticación de conductores (Supabase Auth) y políticas por usuario.
create policy "units_all" on public.units for all to anon using (true) with check (true);
create policy "reports_insert" on public.reports for insert to anon with check (true);

-- Tiempo real
alter publication supabase_realtime add table public.units;

-- Si ya habías creado la tabla units antes, ejecuta solo esto:
-- alter table public.units add column if not exists tipo text not null default 'carrito' check (tipo in ('bus','carrito'));
