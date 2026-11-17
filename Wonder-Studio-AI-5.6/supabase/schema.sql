-- Wonder Studio AI 5.6 • Run in Supabase SQL Editor on a newly created project.
-- Every record is scoped to the authenticated user by RLS.
create table if not exists public.wonder_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 store text not null check(store in ('projects','assets','designs','settings')),
 id text not null,
 project_id text,
 body jsonb not null,
 updated_at timestamptz not null default now(),
 primary key (owner_id,store,id)
);
create index if not exists wonder_records_project on public.wonder_records(owner_id,project_id);
alter table public.wonder_records enable row level security;
grant select,insert,update,delete on public.wonder_records to authenticated;
drop policy if exists wonder_records_select on public.wonder_records;
drop policy if exists wonder_records_insert on public.wonder_records;
drop policy if exists wonder_records_update on public.wonder_records;
drop policy if exists wonder_records_delete on public.wonder_records;
create policy wonder_records_select on public.wonder_records for select to authenticated using ((select auth.uid())=owner_id);
create policy wonder_records_insert on public.wonder_records for insert to authenticated with check ((select auth.uid())=owner_id);
create policy wonder_records_update on public.wonder_records for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy wonder_records_delete on public.wonder_records for delete to authenticated using ((select auth.uid())=owner_id);
-- A private bucket. Never make it publicly readable.
insert into storage.buckets(id,name,public,file_size_limit) values ('wonder-assets','wonder-assets',false,20971520)
 on conflict(id) do update set public=false,file_size_limit=20971520;
drop policy if exists wonder_asset_select on storage.objects;
drop policy if exists wonder_asset_insert on storage.objects;
drop policy if exists wonder_asset_update on storage.objects;
drop policy if exists wonder_asset_delete on storage.objects;
create policy wonder_asset_select on storage.objects for select to authenticated
 using (bucket_id='wonder-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wonder_asset_insert on storage.objects for insert to authenticated
 with check (bucket_id='wonder-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wonder_asset_update on storage.objects for update to authenticated
 using (bucket_id='wonder-assets' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check (bucket_id='wonder-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wonder_asset_delete on storage.objects for delete to authenticated
 using (bucket_id='wonder-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
