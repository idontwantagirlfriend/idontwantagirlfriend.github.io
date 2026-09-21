-- Admin auth hardening: writes require an authenticated Supabase session
-- (Supabase Auth, single dashboard-created admin user, public signups disabled);
-- public reads stay anonymous. Apply via the Supabase dashboard SQL editor.
--
-- Run AFTER creating the admin user, BEFORE deploying the new bundle.

alter table public.posts enable row level security;
alter table public.reader_actions enable row level security;
alter table public.site_settings enable row level security;

-- Drop every pre-existing (anonymous-open) policy on these tables.
do $$
declare rec record;
begin
  for rec in
    select policyname, schemaname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('posts', 'reader_actions', 'site_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end $$;

-- posts: anonymous visitors see published posts only; the authenticated
-- admin sees everything (permissive SELECT policies OR together per role)
-- and holds full write access.
create policy posts_select_public on public.posts
  for select to anon using (is_published = true);
create policy posts_select_admin on public.posts
  for select to authenticated using (true);
create policy posts_insert_admin on public.posts
  for insert to authenticated with check (true);
create policy posts_update_admin on public.posts
  for update to authenticated using (true) with check (true);
create policy posts_delete_admin on public.posts
  for delete to authenticated using (true);

-- reader_actions: likes/bookmarks from anonymous readers (reader_id is a
-- client-generated UUID) — public read/write, unchanged behavior.
create policy reader_actions_select_public on public.reader_actions
  for select to anon, authenticated using (true);
create policy reader_actions_insert_public on public.reader_actions
  for insert to anon, authenticated with check (true);
create policy reader_actions_delete_public on public.reader_actions
  for delete to anon, authenticated using (true);

-- site_settings: public read (footer markdown); writes are admin-only.
-- An upsert is INSERT .. ON CONFLICT DO UPDATE, so both an INSERT and an
-- UPDATE policy are required. No DELETE policy: denied for everyone.
create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_insert_admin on public.site_settings
  for insert to authenticated with check (true);
create policy site_settings_update_admin on public.site_settings
  for update to authenticated using (true) with check (true);
