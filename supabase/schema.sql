-- FoodShare initial schema. Run in the Supabase SQL editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('donor','ngo','volunteer','admin');
create type public.donation_status as enum ('available','reserved','pickup_scheduled','collected','expired','reported');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  role public.app_role not null default 'donor',
  avatar_url text,
  home_lat double precision,
  home_lng double precision,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  organization_type text not null check (organization_type in ('ngo','restaurant','home','college','event','community')),
  description text,
  registration_number text,
  contact_phone text,
  address text not null,
  lat double precision,
  lng double precision,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id),
  organization_id uuid references public.organizations(id),
  food_name text not null,
  category text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  quantity_unit text not null default 'servings',
  estimated_meals integer not null check (estimated_meals > 0),
  dietary_tags text[] not null default '{}',
  pickup_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  expires_at timestamptz not null,
  pickup_window_start timestamptz not null,
  pickup_window_end timestamptz not null,
  notes text,
  photo_url text,
  status public.donation_status not null default 'available',
  food_safety_confirmed boolean not null default false,
  food_safety_confirmed_at timestamptz,
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_window_end >= pickup_window_start),
  check (expires_at > created_at),
  check (food_safety_confirmed = true)
);
create index donations_status_expiry_idx on public.donations(status, expires_at);
create index donations_location_idx on public.donations(pickup_lat, pickup_lng);
create index donations_donor_idx on public.donations(donor_id, created_at desc);

create table public.donation_claims (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  ngo_id uuid not null references public.profiles(id),
  claim_status text not null default 'accepted' check (claim_status in ('accepted','withdrawn','completed','rejected')),
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(donation_id)
);

create table public.pickup_tasks (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  volunteer_id uuid references public.profiles(id),
  pickup_address text not null,
  dropoff_address text not null,
  scheduled_for timestamptz,
  status text not null default 'open' check (status in ('open','accepted','on_the_way','picked_up','delivered','cancelled')),
  pickup_notes text,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.donation_events (
  id bigint generated always as identity primary key,
  donation_id uuid not null references public.donations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index donation_events_donation_idx on public.donation_events(donation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info',
  read_at timestamptz,
  link text,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.food_safety_confirmations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.donations(id) on delete cascade,
  confirmed_by uuid not null references public.profiles(id),
  safe_storage_confirmed boolean not null,
  allergen_info_confirmed boolean not null,
  within_safe_time_confirmed boolean not null,
  confirmation_text_version text not null default 'v1',
  created_at timestamptz not null default now(),
  check (safe_storage_confirmed and allergen_info_confirmed and within_safe_time_confirmed)
);

create table public.impact_metrics (
  id bigint generated always as identity primary key,
  donation_id uuid references public.donations(id) on delete set null,
  meals_rescued integer not null default 0,
  kilograms_diverted numeric(10,2) not null default 0,
  pickup_completed boolean not null default false,
  recorded_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  donation_id uuid references public.donations(id) on delete set null,
  reported_user_id uuid references public.profiles(id),
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  donation_id uuid references public.donations(id),
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger donations_updated_at before update on public.donations for each row execute function public.set_updated_at();

-- Role helper reads only the caller's own profile.
create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.donations enable row level security;
alter table public.donation_claims enable row level security;
alter table public.pickup_tasks enable row level security;
alter table public.donation_events enable row level security;
alter table public.notifications enable row level security;
alter table public.food_safety_confirmations enable row level security;
alter table public.impact_metrics enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
create policy "profile self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations visible to signed in users" on public.organizations for select to authenticated using (true);
create policy "organization owner creates" on public.organizations for insert to authenticated with check (owner_id = auth.uid());
create policy "organization owner updates" on public.organizations for update to authenticated using (owner_id = auth.uid() or public.current_role() = 'admin');

-- Available listing information is public to authenticated users. Private donor details
-- must be fetched from profiles only after a claim is accepted by the relevant user.
create policy "donations readable by signed in users" on public.donations for select to authenticated using (
  status in ('available','reserved','pickup_scheduled','collected')
  and (donor_id = auth.uid() or claimed_by = auth.uid() or public.current_role() in ('ngo','volunteer','admin') or status = 'available')
);
create policy "donor creates own donation" on public.donations for insert to authenticated with check (donor_id = auth.uid() and public.current_role() in ('donor','admin'));
create policy "donor or claimer updates donation" on public.donations for update to authenticated using (donor_id = auth.uid() or claimed_by = auth.uid() or public.current_role() = 'admin') with check (donor_id = auth.uid() or claimed_by = auth.uid() or public.current_role() = 'admin');

create policy "claims visible to participants" on public.donation_claims for select to authenticated using (
  ngo_id = auth.uid() or exists(select 1 from public.donations d where d.id = donation_id and d.donor_id = auth.uid()) or public.current_role() = 'admin'
);
create policy "verified NGO can claim" on public.donation_claims for insert to authenticated with check (
  ngo_id = auth.uid() and public.current_role() = 'ngo'
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.verified)
  and exists(select 1 from public.donations d where d.id = donation_id and d.status = 'available' and d.expires_at > now())
);
create policy "claim owner or admin updates" on public.donation_claims for update to authenticated using (ngo_id = auth.uid() or public.current_role() = 'admin');

create policy "pickup participants read" on public.pickup_tasks for select to authenticated using (
 volunteer_id = auth.uid() or exists(select 1 from public.donations d where d.id = donation_id and (d.donor_id = auth.uid() or d.claimed_by = auth.uid())) or public.current_role() = 'admin'
);
create policy "NGO creates pickup task" on public.pickup_tasks for insert to authenticated with check (public.current_role() in ('ngo','admin'));
create policy "volunteer updates own task" on public.pickup_tasks for update to authenticated using (volunteer_id = auth.uid() or public.current_role() = 'admin');

create policy "events visible to donation participants" on public.donation_events for select to authenticated using (
 exists(select 1 from public.donations d where d.id = donation_id and (d.donor_id = auth.uid() or d.claimed_by = auth.uid())) or public.current_role() in ('ngo','volunteer','admin')
);
create policy "authenticated can log event" on public.donation_events for insert to authenticated with check (actor_id = auth.uid());

create policy "notifications private to owner" on public.notifications for select to authenticated using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "notifications owner updates" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "safety confirmation participants" on public.food_safety_confirmations for select to authenticated using (
 confirmed_by = auth.uid() or exists(select 1 from public.donations d where d.id = donation_id and (d.donor_id = auth.uid() or d.claimed_by = auth.uid())) or public.current_role() = 'admin'
);
create policy "donor safety confirmation" on public.food_safety_confirmations for insert to authenticated with check (confirmed_by = auth.uid());
create policy "impact metrics readable" on public.impact_metrics for select to authenticated using (true);
create policy "reports reporter or admin" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.current_role() = 'admin');
create policy "authenticated report creation" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "admin manages reports" on public.reports for update to authenticated using (public.current_role() = 'admin');
create policy "admin reviews moderation" on public.moderation_actions for select to authenticated using (public.current_role() = 'admin');
create policy "admin creates moderation action" on public.moderation_actions for insert to authenticated with check (admin_id = auth.uid() and public.current_role() = 'admin');

-- Atomic claim RPC: the database re-checks expiry/status to prevent double claims.
create or replace function public.claim_donation(p_donation_id uuid)
returns public.donations language plpgsql security invoker set search_path = public
as $$
declare claimed public.donations;
begin
  if public.current_role() <> 'ngo' then raise exception 'Only NGO accounts can claim donations'; end if;
  update public.donations
    set status = 'reserved', claimed_by = auth.uid(), claimed_at = now()
    where id = p_donation_id and status = 'available' and expires_at > now()
    returning * into claimed;
  if claimed.id is null then raise exception 'Donation is no longer available or has expired'; end if;
  insert into public.donation_claims(donation_id, ngo_id) values (p_donation_id, auth.uid());
  insert into public.donation_events(donation_id, actor_id, event_type, description)
    values (p_donation_id, auth.uid(), 'claimed', 'Donation reserved by an NGO');
  return claimed;
end; $$;

-- Storage: create a private bucket named food-photos in Supabase Storage.
-- Recommended policies: authenticated donors can upload to a folder named with their auth.uid();
-- keep private donor contact data in profiles and never expose phone/email on public listing cards.
