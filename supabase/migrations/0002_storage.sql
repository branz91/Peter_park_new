-- =============================================================================
-- 0002_storage.sql — Bucket per le foto dei parcheggi
--
-- Da applicare DOPO 0001_init.sql nel SQL Editor di Supabase.
--
-- Convenzione path: <user_id>/<timestamp>-<rand>.<ext>
--   La prima cartella deve coincidere con auth.uid(): cosi' ogni utente puo'
--   caricare solo dentro la propria cartella, ma chiunque puo' leggere.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict (id) do nothing;

-- Lettura pubblica: le foto degli spot sono visibili a tutti gli utenti
drop policy if exists "spot_photos_public_read" on storage.objects;
create policy "spot_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'spot-photos');

-- Upload: solo utenti autenticati, e solo dentro la propria cartella
drop policy if exists "spot_photos_authenticated_upload" on storage.objects;
create policy "spot_photos_authenticated_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'spot-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Update: solo il proprietario (utile per overwrite/upsert)
drop policy if exists "spot_photos_owner_update" on storage.objects;
create policy "spot_photos_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'spot-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete: solo il proprietario
drop policy if exists "spot_photos_owner_delete" on storage.objects;
create policy "spot_photos_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'spot-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
