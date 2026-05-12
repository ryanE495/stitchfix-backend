# Stitchworks

Job tracker for Western Slope Stitchworks. Single-operator web app — Kanban
board of repair jobs and a customer ledger. Mobile-first.

Stack: React + Vite + TypeScript, Tailwind v4, Supabase (Postgres + Storage),
TanStack Query, dnd-kit, React Router, deployed on Netlify.

## Access model

**No login.** The app is gated only by obscurity of the deploy URL. The
Supabase anon key sits in the JS bundle, and the database policies allow
anon read/write to the Stitchworks tables. Don't share the URL publicly.

To add a login back later: re-introduce magic-link auth and replace the
`_open` RLS policies with email-gated ones. (See earlier git history.)

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

The dev server is pinned to port **3000** to match the default Supabase
`site_url`. (No login flow uses it now, but it's the project convention.)

### Environment variables

| Var | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Public anon key from Supabase → Project Settings → API. |

## Supabase setup (one-time)

1. Create a Supabase project (or reuse an existing one — the migration uses
   `stitchworks_*` table names to namespace and won't touch other tables).
2. **Apply the schema:** open `supabase/migration.sql` and run it in
   Supabase → SQL Editor. Idempotent and safe to re-run.

The migration creates:
- Tables: `stitchworks_customers`, `stitchworks_jobs`, `stitchworks_job_photos`
- Enums: `stitchworks_contact_source`, `stitchworks_job_status`
- A public storage bucket: `stitchworks-job-photos`
- Open RLS policies (anon read/write) on the 3 tables + the bucket

## Deploy to Netlify

```bash
# Push the repo to GitHub, then in Netlify:
# 1. Add new site → import from GitHub → pick the repo.
# 2. Build settings auto-detect from netlify.toml (npm run build → dist/).
# 3. In Site Settings → Environment Variables, add:
#      VITE_SUPABASE_URL
#      VITE_SUPABASE_ANON_KEY
# 4. Deploy.
```

`netlify.toml` configures the SPA fallback so React Router routes (e.g.
`/customers/abc`) work after a refresh.

## Project layout

```
supabase/migration.sql   one-shot schema migration (idempotent)
netlify.toml             build + SPA redirect for Netlify
src/
  main.tsx               providers (QueryClient, Router)
  App.tsx                routes
  lib/
    supabase.ts          Supabase client
    queryClient.ts       TanStack Query defaults
    types.ts             DB types + enum labels
    dates.ts             daysSince, age-tone, date formatting
    format.ts            currency + decimal parsing
    imageCompress.ts     canvas-based image resize for uploads
  hooks/
    useJobs.ts           jobs query (+ single job query)
    useJobMutations.ts   create/update/advance-status (optimistic)
    useCustomers.ts      customers with aggregated job stats
    useCustomerMutations.ts
    useJobPhotos.ts      list/upload/delete (uploads compressed)
    useIsDesktop.ts      matchMedia hook for DnD enablement
  components/
    TopNav.tsx           title, view toggle, action button
    Modal.tsx            bottom-sheet on mobile, centered on desktop
    JobCard.tsx          card with day-age badge (green/yellow/red)
    KanbanColumn.tsx     droppable column
    JobDetailModal.tsx   edit all fields, advance status, photos
    NewJobModal.tsx      pick or create customer, then job details
    CustomerPicker.tsx   search + inline new-customer form
    PhotoUploader.tsx    camera + gallery input
    PhotoStrip.tsx       thumbs in horizontal scroller
    PhotoLightbox.tsx    fullscreen viewer with prev/next
  pages/
    KanbanPage.tsx       board (6 columns, mobile-scroll / desktop-grid)
    CustomersPage.tsx    list with search + lifetime revenue
    CustomerDetailPage.tsx  inline-editable info + job history
```

## Notes

- **Drag-and-drop** is desktop-only (≥768px). On mobile, change status from
  the job detail modal — tap a card, tap a status button.
- **Photos** are auto-compressed to ~1600px long-edge JPEG before upload, so
  phone shots arrive at a few hundred KB instead of multi-MB.
- **Status timestamps** auto-fill when you advance status:
  - moving to `in_shop` sets `date_received` if empty
  - moving to `complete_awaiting_pickup` sets `date_completed`
  - moving to `paid_closed` sets `date_paid`
- **Optimistic updates** apply on status changes and inline edits; on
  failure the UI reverts and TanStack Query refetches the canonical row.
- **Not in v1:** invoicing, SMS, analytics, multi-user, calendar, automated
  reminders. (Use Stripe externally; text from your phone.)

## Useful scripts

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # tsc + vite build → dist/
npm run preview  # serve the built dist/ on http://localhost:3000
npm run lint     # eslint
```
