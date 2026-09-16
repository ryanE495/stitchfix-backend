-- 010: Let this admin app read/write the mail-in repair intake tables.
--
-- Background: repair_requests / repair_photos were created by the public
-- intake form, which submits anonymously and then stops caring. Their
-- policies granted ALL to {authenticated} only. This app ships the anon key
-- and has no sign-in, so every request it makes runs as `anon` -- meaning
-- the Repairs screen would read zero rows and every write would fail.
--
-- This brings them in line with the stitchworks_* tables, which already
-- grant {anon, authenticated} with a `true` predicate.
--
-- TRADE-OFF, stated plainly: the anon key is public (it ships in the browser
-- bundle), so "grant anon" means anyone who finds the key can read these
-- rows. repair_requests holds customer name / phone / email. This is the
-- same posture stitchworks_customers already has, so this changes the
-- amount of exposed PII, not the security model. The real fix for both is
-- Supabase Auth + an admin-only policy; that is a separate piece of work.

begin;

-- ---- table-level GRANTs ----------------------------------------------
-- RLS policies only decide WHICH ROWS a role may touch; they do not grant
-- the underlying SQL privilege. Without these the anon role gets a bare
-- "42501 permission denied for table repair_requests" before RLS is ever
-- consulted. The stitchworks_* tables already carry these grants, which is
-- why they work today -- the repair tables were only ever granted to
-- authenticated.

grant select, insert, update, delete on public.repair_requests to anon;
grant select, insert, update, delete on public.repair_photos   to anon;

-- ---- repair_requests -------------------------------------------------
drop policy if exists repair_requests_open on public.repair_requests;
drop policy if exists "Authenticated users have full access to repair requests"
  on public.repair_requests;

create policy repair_requests_open
  on public.repair_requests
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---- repair_photos ---------------------------------------------------
drop policy if exists repair_photos_open on public.repair_photos;
drop policy if exists "Authenticated users have full access to repair photos"
  on public.repair_photos;

create policy repair_photos_open
  on public.repair_photos
  for all
  to anon, authenticated
  using (true)
  with check (true);

commit;

-- ---- storage: repair-photos bucket -----------------------------------
-- The bucket is PRIVATE (storage.buckets.public = false), so the app reads
-- images through createSignedUrl(). That still requires a SELECT policy on
-- storage.objects for the calling role. The existing anon INSERT policy
-- ("Anon can upload photos to a fresh repair request") is left alone -- the
-- public intake form depends on it.

drop policy if exists repair_photos_read on storage.objects;
create policy repair_photos_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'repair-photos');

drop policy if exists repair_photos_delete on storage.objects;
create policy repair_photos_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'repair-photos');
