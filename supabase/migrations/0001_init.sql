-- =============================================================================
-- PeterPark - Schema iniziale
-- PostgreSQL + PostGIS su Supabase
-- =============================================================================
-- Convenzioni:
--  - Tutte le tabelle hanno id uuid + created_at/updated_at
--  - Le coordinate sono in geography(POINT, 4326) (WGS84)
--  - La logica di business e' in RPC (funzioni SQL) per essere portabile
--  - RLS abilitato ovunque, niente accesso anonimo se non esplicito
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- =============================================================================
-- TIPI ENUM
-- =============================================================================

create type spot_type as enum ('free', 'paid', 'disc', 'disabled', 'motorbike', 'electric');
create type spot_status as enum ('active', 'claimed', 'expired', 'invalid');
create type tx_reason as enum (
  'initial_bonus',
  'report_created',
  'report_confirmed',
  'spot_claimed',
  'feedback_bonus',
  'fraud_penalty',
  'daily_streak',
  'invite_bonus',
  'admin_adjustment'
);

-- =============================================================================
-- PROFILI UTENTE
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  points int not null default 50,
  reputation real not null default 1.0 check (reputation between 0 and 1),
  level int not null default 1,
  total_reports int not null default 0,
  total_claims int not null default 0,
  total_feedbacks int not null default 0,
  last_streak_at date,
  streak_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_username on public.profiles (lower(username));

-- =============================================================================
-- PARCHEGGI SEGNALATI
-- =============================================================================

create table public.parking_spots (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  location geography(POINT, 4326) not null,
  address text,
  spot_type spot_type not null default 'free',
  status spot_status not null default 'active',
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  notes text,
  photo_url text,
  available_from timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indice GIST per query geografiche veloci (ST_DWithin, ordinamento per distanza)
create index idx_parking_spots_location on public.parking_spots using gist (location);
create index idx_parking_spots_status on public.parking_spots (status);
create index idx_parking_spots_expires on public.parking_spots (expires_at);
create index idx_parking_spots_reporter on public.parking_spots (reporter_id);

-- =============================================================================
-- FEEDBACK
-- =============================================================================

create table public.feedbacks (
  id uuid primary key default uuid_generate_v4(),
  spot_id uuid not null references public.parking_spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  was_available boolean not null,
  rating smallint check (rating between 1 and 5),
  comment text,
  arrived_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index idx_feedbacks_spot on public.feedbacks (spot_id);
create index idx_feedbacks_user on public.feedbacks (user_id);

-- =============================================================================
-- STORICO TRANSAZIONI PUNTI (audit log)
-- =============================================================================

create table public.points_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason tx_reason not null,
  related_spot_id uuid references public.parking_spots(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_points_tx_user on public.points_transactions (user_id, created_at desc);

-- =============================================================================
-- TRIGGER: aggiornamento automatico updated_at
-- =============================================================================

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger trg_parking_spots_updated_at before update on public.parking_spots
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- TRIGGER: creazione profilo automatica alla registrazione
-- =============================================================================

create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Garantisce unicita': se gia' preso, appende parte dell'id
  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_username || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, username, points)
  values (new.id, v_username, 50);

  insert into public.points_transactions (user_id, delta, reason)
  values (new.id, 50, 'initial_bonus');

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- =============================================================================
-- RPC: ricerca parcheggi nelle vicinanze
-- =============================================================================

create or replace function public.spots_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 500,
  p_limit int default 30
)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_username text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  address text,
  spot_type spot_type,
  status spot_status,
  notes text,
  photo_url text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.reporter_id,
    p.username as reporter_username,
    st_y(s.location::geometry) as latitude,
    st_x(s.location::geometry) as longitude,
    st_distance(s.location, st_makepoint(p_lng, p_lat)::geography) as distance_m,
    s.address,
    s.spot_type,
    s.status,
    s.notes,
    s.photo_url,
    s.expires_at,
    s.created_at
  from public.parking_spots s
  join public.profiles p on p.id = s.reporter_id
  where s.status = 'active'
    and s.expires_at > now()
    and st_dwithin(s.location, st_makepoint(p_lng, p_lat)::geography, p_radius_m)
  order by s.location <-> st_makepoint(p_lng, p_lat)::geography
  limit p_limit;
$$;

-- =============================================================================
-- RPC: creazione di una segnalazione
-- =============================================================================

create or replace function public.create_parking_spot(
  p_lat double precision,
  p_lng double precision,
  p_spot_type spot_type default 'free',
  p_address text default null,
  p_notes text default null,
  p_photo_url text default null,
  p_duration_minutes int default 10
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_spot_id uuid;
  v_recent_count int;
  v_close_count int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Anti-spam: max 5 segnalazioni nelle ultime 24 ore
  select count(*) into v_recent_count
  from public.parking_spots
  where reporter_id = v_user_id
    and created_at > now() - interval '24 hours';
  if v_recent_count >= 5 then
    raise exception 'rate_limit_daily' using hint = 'Max 5 segnalazioni al giorno';
  end if;

  -- Anti-spam: no segnalazioni a meno di 50m dall'ultima dello stesso utente attiva
  select count(*) into v_close_count
  from public.parking_spots
  where reporter_id = v_user_id
    and status = 'active'
    and expires_at > now()
    and st_dwithin(location, st_makepoint(p_lng, p_lat)::geography, 50);
  if v_close_count > 0 then
    raise exception 'too_close_to_existing' using hint = 'Esiste gia una tua segnalazione vicina';
  end if;

  insert into public.parking_spots (
    reporter_id, location, address, spot_type, notes, photo_url, expires_at
  )
  values (
    v_user_id,
    st_makepoint(p_lng, p_lat)::geography,
    p_address,
    p_spot_type,
    p_notes,
    p_photo_url,
    now() + (p_duration_minutes || ' minutes')::interval
  )
  returning id into v_spot_id;

  -- +5 punti provvisori (verranno confermati con feedback positivo)
  update public.profiles
  set points = points + 5,
      total_reports = total_reports + 1
  where id = v_user_id;

  insert into public.points_transactions (user_id, delta, reason, related_spot_id)
  values (v_user_id, 5, 'report_created', v_spot_id);

  return v_spot_id;
end;
$$;

-- =============================================================================
-- RPC: prendere un parcheggio (claim)
-- =============================================================================

create or replace function public.claim_parking_spot(p_spot_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user_points int;
  v_spot record;
  v_cost int := 10;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_spot from public.parking_spots where id = p_spot_id for update;
  if not found then raise exception 'spot_not_found'; end if;
  if v_spot.status <> 'active' then raise exception 'spot_not_available'; end if;
  if v_spot.expires_at <= now() then raise exception 'spot_expired'; end if;
  if v_spot.reporter_id = v_user_id then raise exception 'cannot_claim_own_spot'; end if;

  select points into v_user_points from public.profiles where id = v_user_id for update;
  if v_user_points < v_cost then
    raise exception 'insufficient_points' using hint = 'Servono almeno 10 punti';
  end if;

  update public.parking_spots
  set status = 'claimed', claimed_by = v_user_id, claimed_at = now()
  where id = p_spot_id;

  update public.profiles
  set points = points - v_cost,
      total_claims = total_claims + 1
  where id = v_user_id;

  insert into public.points_transactions (user_id, delta, reason, related_spot_id)
  values (v_user_id, -v_cost, 'spot_claimed', p_spot_id);
end;
$$;

-- =============================================================================
-- RPC: lasciare un feedback dopo l'arrivo
-- =============================================================================

create or replace function public.submit_feedback(
  p_spot_id uuid,
  p_was_available boolean,
  p_rating smallint default null,
  p_comment text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_spot record;
  v_feedback_bonus int := 2;
  v_confirm_bonus int := 10;
  v_fraud_penalty int := -20;
  v_negative_count int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_spot from public.parking_spots where id = p_spot_id;
  if not found then raise exception 'spot_not_found'; end if;
  if v_spot.reporter_id = v_user_id then raise exception 'cannot_feedback_own_spot'; end if;

  insert into public.feedbacks (spot_id, user_id, was_available, rating, comment)
  values (p_spot_id, v_user_id, p_was_available, p_rating, p_comment);

  -- +2 punti a chi lascia il feedback
  update public.profiles
  set points = points + v_feedback_bonus,
      total_feedbacks = total_feedbacks + 1
  where id = v_user_id;

  insert into public.points_transactions (user_id, delta, reason, related_spot_id)
  values (v_user_id, v_feedback_bonus, 'feedback_bonus', p_spot_id);

  if p_was_available then
    -- Bonus di conferma al reporter
    update public.profiles
    set points = points + v_confirm_bonus,
        reputation = least(1.0, reputation + 0.02)
    where id = v_spot.reporter_id;

    insert into public.points_transactions (user_id, delta, reason, related_spot_id)
    values (v_spot.reporter_id, v_confirm_bonus, 'report_confirmed', p_spot_id);
  else
    -- Se almeno 2 feedback negativi -> segnalazione invalida + penalita'
    select count(*) into v_negative_count
    from public.feedbacks
    where spot_id = p_spot_id and was_available = false;

    if v_negative_count >= 2 then
      update public.parking_spots set status = 'invalid' where id = p_spot_id;

      update public.profiles
      set points = greatest(0, points + v_fraud_penalty),
          reputation = greatest(0, reputation - 0.1)
      where id = v_spot.reporter_id;

      insert into public.points_transactions (user_id, delta, reason, related_spot_id)
      values (v_spot.reporter_id, v_fraud_penalty, 'fraud_penalty', p_spot_id);
    end if;
  end if;
end;
$$;

-- =============================================================================
-- RPC: scadenza automatica spot (chiamata da cron)
-- =============================================================================

create or replace function public.expire_old_spots()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.parking_spots
  set status = 'expired'
  where status in ('active', 'claimed') and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.parking_spots enable row level security;
alter table public.feedbacks enable row level security;
alter table public.points_transactions enable row level security;

-- profiles: tutti gli utenti loggati vedono i profili pubblici (username/avatar/level)
-- ma solo il proprietario puo aggiornare
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- parking_spots: tutti gli utenti loggati possono leggere gli spot attivi
-- creazione/aggiornamento solo tramite RPC (security definer), quindi blocchiamo insert/update diretti
create policy "spots_select_all" on public.parking_spots
  for select to authenticated using (true);

-- feedbacks: ognuno vede i feedback ma scrive solo i propri (e solo tramite RPC)
create policy "feedbacks_select_all" on public.feedbacks
  for select to authenticated using (true);

-- points_transactions: ognuno vede solo le proprie transazioni
create policy "tx_select_own" on public.points_transactions
  for select to authenticated using (user_id = auth.uid());

-- =============================================================================
-- REALTIME: abilita gli eventi su parking_spots
-- =============================================================================

alter publication supabase_realtime add table public.parking_spots;
