-- 씨앗도둑 스토리보드 공동 리뷰 — Supabase SQL Editor에서 1회 실행
-- 1. Supabase 프로젝트 생성 후 이 SQL 실행
-- 2. 감독이 웹페이지에서 이메일 OTP 로그인
-- 3. 하단 멤버 추가 쿼리에서 이메일을 변경해 SQL Editor에서 실행

create table if not exists public.board_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.board_cuts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.board_meta (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists board_cuts_updated_at_idx on public.board_cuts(updated_at desc);
alter table public.board_members enable row level security;
alter table public.board_cuts enable row level security;
alter table public.board_meta enable row level security;

drop policy if exists "members see own membership" on public.board_members;
create policy "members see own membership" on public.board_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members can read cuts" on public.board_cuts;
create policy "members can read cuts" on public.board_cuts
  for select to authenticated using (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "editors can insert cuts" on public.board_cuts;
create policy "editors can insert cuts" on public.board_cuts
  for insert to authenticated with check (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  );

drop policy if exists "editors can update cuts" on public.board_cuts;
create policy "editors can update cuts" on public.board_cuts
  for update to authenticated using (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  ) with check (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  );

drop policy if exists "members can read metadata" on public.board_meta;
create policy "members can read metadata" on public.board_meta
  for select to authenticated using (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "editors can insert metadata" on public.board_meta;
create policy "editors can insert metadata" on public.board_meta
  for insert to authenticated with check (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  );

drop policy if exists "editors can update metadata" on public.board_meta;
create policy "editors can update metadata" on public.board_meta
  for update to authenticated using (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  ) with check (
    exists (select 1 from public.board_members m where m.user_id = (select auth.uid()) and m.role in ('owner','editor'))
  );

-- 필드 단위 병합: 두 사용자가 서로 다른 컷/필드를 수정해도 레코드 전체를 덮지 않음
create or replace function public.patch_board_cut(p_id text, p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_id is null or length(p_id) > 100 or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Invalid cut patch';
  end if;
  insert into public.board_cuts as c (id, data)
    values (p_id, p_patch)
  on conflict (id) do update set data = c.data || excluded.data, updated_at = now();
end;
$$;
revoke all on function public.patch_board_cut(text,jsonb) from public, anon;
grant execute on function public.patch_board_cut(text,jsonb) to authenticated;

-- Realtime 구독은 아래 publication에 테이블을 등록해야 작동
do $$ begin
  alter publication supabase_realtime add table public.board_cuts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.board_meta;
exception when duplicate_object then null;
end $$;

-- 로그인한 팀원(감독 포함)을 최초 등록: 이메일 주소 바꿔서 SQL Editor에서 개별 실행
-- insert into public.board_members(user_id, role)
-- select id, 'owner' from auth.users where email = 'director@example.com'
-- on conflict (user_id) do update set role = excluded.role;
-- 팀원은 'editor' 또는 'viewer' 지정
