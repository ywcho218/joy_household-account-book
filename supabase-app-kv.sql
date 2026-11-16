-- 템플릿·예산·메모 저장용 테이블 (SQL Editor에서 한 번만 실행)
create table if not exists public.app_kv (
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, key)
);
alter table public.app_kv enable row level security;
create policy "members all app_kv" on public.app_kv
  for all using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- 마이너스 금액 저장이 막혀 있는지 확인 (결과가 비어 있으면 문제없음)
-- amount >= 0 같은 check 제약이 보이면 알려주세요.
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.entries'::regclass and contype = 'c';
