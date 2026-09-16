-- 011: Put the admin tables behind a login.
--
-- Until now every stitchworks_* and repair_* table granted full read/write to
-- the `anon` role with a `USING (true)` policy. The anon key ships inside the
-- browser bundle, so that key WAS the credential: anyone who loaded the app
-- once could pull it out of the JS and read or delete all 57 customers and 63
-- jobs from curl, without the deploy URL. This makes `authenticated` the
-- required role for all of it.
--
-- RUN THIS ONLY AFTER the login screen works and you can sign in, or you will
-- lock yourself out of your own app. Recovery is 010 re-applied, or the
-- Supabase SQL editor (which runs as a superuser and ignores all of this).
--
-- ============================ SCOPE WARNING ============================
-- Head Water is a SHARED project. These tables are read by OTHER public
-- sites using the same anon key and are deliberately NOT locked down here:
--
--   blog_posts, portfolio_items, images        -- public marketing site
--   mwmw_blog_posts, mwmw_images,
--   mwmw_portfolio_items                       -- MWMW site
--   notary_solutions_blog                      -- notary site
--
-- They hold published content, not PII. Revoking anon on them breaks those
-- sites with no security benefit.
--
-- stitchworks_portfolio_items is the subtle one: migration 008 notes that
-- "the public Astro site filters status='published' itself when querying",
-- so the public portfolio DOES read this table anonymously. It is handled
-- below -- anon keeps SELECT, but only of published rows, and loses write.
-- =======================================================================

begin;

-- ---- 1. Fully private: customers, jobs, job photos, repairs -----------
-- No public consumer. authenticated only, for both rows and privileges.

revoke all on public.stitchworks_customers  from anon;
revoke all on public.stitchworks_jobs       from anon;
revoke all on public.stitchworks_job_photos from anon;
revoke all on public.repair_requests        from anon;
revoke all on public.repair_photos          from anon;

drop policy if exists stitchworks_customers_open  on public.stitchworks_customers;
drop policy if exists stitchworks_jobs_open       on public.stitchworks_jobs;
drop policy if exists stitchworks_job_photos_open on public.stitchworks_job_photos;
drop policy if exists repair_requests_open        on public.repair_requests;
drop policy if exists repair_photos_open          on public.repair_photos;

drop policy if exists stitchworks_customers_auth on public.stitchworks_customers;
create policy stitchworks_customers_auth
  on public.stitchworks_customers for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_jobs_auth on public.stitchworks_jobs;
create policy stitchworks_jobs_auth
  on public.stitchworks_jobs for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_job_photos_auth on public.stitchworks_job_photos;
create policy stitchworks_job_photos_auth
  on public.stitchworks_job_photos for all
  to authenticated using (true) with check (true);

drop policy if exists repair_requests_auth on public.repair_requests;
create policy repair_requests_auth
  on public.repair_requests for all
  to authenticated using (true) with check (true);

drop policy if exists repair_photos_auth on public.repair_photos;
create policy repair_photos_auth
  on public.repair_photos for all
  to authenticated using (true) with check (true);

-- The public intake form still has to be able to file NEW requests while
-- signed out. It gets INSERT and nothing else -- it can write a submission
-- but cannot read back a single existing row.
grant insert on public.repair_requests to anon;
grant insert on public.repair_photos   to anon;

drop policy if exists repair_requests_public_intake on public.repair_requests;
create policy repair_requests_public_intake
  on public.repair_requests for insert
  to anon with check (true);

drop policy if exists repair_photos_public_intake on public.repair_photos;
create policy repair_photos_public_intake
  on public.repair_photos for insert
  to anon with check (true);

-- ---- 2. Portfolio: public reads published rows, admin writes ----------
revoke all on public.stitchworks_portfolio_items from anon;
grant select on public.stitchworks_portfolio_items to anon;

drop policy if exists stitchworks_portfolio_items_open on public.stitchworks_portfolio_items;

-- Strictly tighter than before: drafts are no longer visible anonymously.
drop policy if exists stitchworks_portfolio_items_public_read
  on public.stitchworks_portfolio_items;
create policy stitchworks_portfolio_items_public_read
  on public.stitchworks_portfolio_items for select
  to anon using (status = 'published');

drop policy if exists stitchworks_portfolio_items_auth
  on public.stitchworks_portfolio_items;
create policy stitchworks_portfolio_items_auth
  on public.stitchworks_portfolio_items for all
  to authenticated using (true) with check (true);

commit;

-- ---- 3. Storage ------------------------------------------------------
-- Job photos: signed-in write only. NOTE the bucket itself is still
-- public=true, and stitchworks_job_photos.photo_url holds public URLs, so
-- existing images stay readable by direct link. Flipping the bucket private
-- would break every stored photo_url -- a separate migration if you want it.
drop policy if exists stitchworks_job_photos_insert on storage.objects;
drop policy if exists stitchworks_job_photos_update on storage.objects;
drop policy if exists stitchworks_job_photos_delete on storage.objects;

create policy stitchworks_job_photos_insert
  on storage.objects for insert
  to authenticated with check (bucket_id = 'stitchworks-job-photos');
create policy stitchworks_job_photos_update
  on storage.objects for update
  to authenticated using (bucket_id = 'stitchworks-job-photos');
create policy stitchworks_job_photos_delete
  on storage.objects for delete
  to authenticated using (bucket_id = 'stitchworks-job-photos');

-- Portfolio images: public site needs to display them, so SELECT stays open.
drop policy if exists stitchworks_portfolio_images_insert on storage.objects;
drop policy if exists stitchworks_portfolio_images_update on storage.objects;
drop policy if exists stitchworks_portfolio_images_delete on storage.objects;

create policy stitchworks_portfolio_images_insert
  on storage.objects for insert
  to authenticated with check (bucket_id = 'stitchworks-portfolio-images');
create policy stitchworks_portfolio_images_update
  on storage.objects for update
  to authenticated using (bucket_id = 'stitchworks-portfolio-images');
create policy stitchworks_portfolio_images_delete
  on storage.objects for delete
  to authenticated using (bucket_id = 'stitchworks-portfolio-images');

-- Repair photos: private bucket. Reading now requires a login; the intake
-- form's existing anon INSERT policy is left untouched so customers can
-- still attach photos to a new submission.
drop policy if exists repair_photos_read   on storage.objects;
drop policy if exists repair_photos_delete on storage.objects;

create policy repair_photos_read
  on storage.objects for select
  to authenticated using (bucket_id = 'repair-photos');
create policy repair_photos_delete
  on storage.objects for delete
  to authenticated using (bucket_id = 'repair-photos');
