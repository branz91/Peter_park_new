-- =============================================================================
-- 0003_points_only_on_confirm.sql
--
-- Cambia la logica dei punti: niente piu' +5 alla creazione del report.
-- I punti vengono assegnati al reporter SOLO quando un altro utente conferma
-- la segnalazione con un feedback positivo (gia' gestito in submit_feedback).
--
-- La funzione submit_feedback continua ad assegnare:
--   * +2 al feedbacker per ogni feedback
--   * +10 al reporter su was_available = true
--   * -20 al reporter dopo 2 feedback negativi (fraud_penalty)
--
-- Da applicare DOPO 0001_init.sql e 0002_storage.sql.
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

  -- Statistica: aggiorniamo il contatore di segnalazioni, ma niente punti adesso.
  -- I punti arrivano solo quando un altro utente conferma con submit_feedback.
  update public.profiles
  set total_reports = total_reports + 1
  where id = v_user_id;

  return v_spot_id;
end;
$$;
