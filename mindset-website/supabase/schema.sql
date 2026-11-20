-- Mindset database schema. Run in Supabase Dashboard > SQL Editor.
-- IMPORTANT: This schema uses app_metadata.role='admin' for administrator access.
-- app_metadata can only be changed by a trusted admin using the Supabase dashboard/service role.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Creator',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 1200),
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists posts_public_feed_idx on public.posts(status, created_at desc);
create index if not exists posts_owner_idx on public.posts(user_id, created_at desc);

create or replace function public.is_mindset_admin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
on public.profiles for select using (true);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public can read approved posts" on public.posts;
create policy "Public can read approved posts"
on public.posts for select to anon, authenticated
using (status = 'approved' or auth.uid() = user_id or public.is_mindset_admin());

drop policy if exists "Signed-in users submit pending posts" on public.posts;
create policy "Signed-in users submit pending posts"
on public.posts for insert to authenticated
with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Only admins can review posts" on public.posts;
create policy "Only admins can review posts"
on public.posts for update to authenticated
using (public.is_mindset_admin())
with check (public.is_mindset_admin());

drop policy if exists "Owners delete their own posts; admins delete any" on public.posts;
create policy "Owners delete their own posts; admins delete any"
on public.posts for delete to authenticated
using (auth.uid() = user_id or public.is_mindset_admin());

-- Private media bucket. Do not make this bucket public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload only into their own folder" on storage.objects;
create policy "Users upload only into their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners and admins can read private media" on storage.objects;
create policy "Owners and admins can read private media"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_mindset_admin()
  )
);

drop policy if exists "Owners can delete their own media" on storage.objects;
create policy "Owners can delete their own media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
