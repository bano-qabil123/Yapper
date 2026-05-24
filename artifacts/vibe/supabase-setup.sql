-- ============================================================
-- VIBE APP — Supabase Setup Script
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  bio text,
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.followers (
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (user_id, target_user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('follow', 'like', 'comment')),
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── STORAGE BUCKET ───────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.followers enable row level security;
alter table public.notifications enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "posts_select" on public.posts;
drop policy if exists "posts_insert" on public.posts;
drop policy if exists "posts_delete" on public.posts;
drop policy if exists "likes_select" on public.likes;
drop policy if exists "likes_insert" on public.likes;
drop policy if exists "likes_delete" on public.likes;
drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_delete" on public.comments;
drop policy if exists "followers_select" on public.followers;
drop policy if exists "followers_insert" on public.followers;
drop policy if exists "followers_delete" on public.followers;
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;

-- PROFILES
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- POSTS
create policy "posts_select" on public.posts
  for select to authenticated using (true);

create policy "posts_insert" on public.posts
  for insert to authenticated with check (user_id = auth.uid());

create policy "posts_delete" on public.posts
  for delete to authenticated using (user_id = auth.uid());

-- LIKES
create policy "likes_select" on public.likes
  for select to authenticated using (true);

create policy "likes_insert" on public.likes
  for insert to authenticated with check (user_id = auth.uid());

create policy "likes_delete" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- COMMENTS
create policy "comments_select" on public.comments
  for select to authenticated using (true);

create policy "comments_insert" on public.comments
  for insert to authenticated with check (user_id = auth.uid());

create policy "comments_delete" on public.comments
  for delete to authenticated using (user_id = auth.uid());

-- FOLLOWERS
create policy "followers_select" on public.followers
  for select to authenticated using (true);

create policy "followers_insert" on public.followers
  for insert to authenticated with check (user_id = auth.uid());

create policy "followers_delete" on public.followers
  for delete to authenticated using (user_id = auth.uid());

-- NOTIFICATIONS
create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (true);

create policy "notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid());

-- ── STORAGE POLICIES ─────────────────────────────────────────

drop policy if exists "media_select" on storage.objects;
drop policy if exists "media_insert" on storage.objects;
drop policy if exists "media_update" on storage.objects;

create policy "media_select" on storage.objects
  for select using (bucket_id = 'media');

create policy "media_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

create policy "media_update" on storage.objects
  for update to authenticated using (bucket_id = 'media');

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
-- This trigger auto-creates a blank profile row when a new user signs up.
-- This prevents the profile fetch from failing right after registration.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── DONE ─────────────────────────────────────────────────────
-- After running this, test with:
--   select * from public.profiles limit 5;
--   select * from public.posts limit 5;
