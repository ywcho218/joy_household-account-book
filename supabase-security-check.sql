-- Supabase 보안 점검 (SQL Editor에서 한 블록씩 실행)

-- 1) RLS가 켜져 있는지: rowsecurity 가 전부 true 여야 해요.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('entries','month_meta','household_members','households');

-- 2) 정책 목록: 로그인한 가족 계정만 접근하도록 되어 있어야 해요.
--    roles 에 anon 이 있거나 qual 이 true 이면 로그인 없이 열려 있는 거예요.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) monthly_summary 뷰: 기본값은 뷰 소유자 권한으로 실행돼서 RLS를 우회해요.
--    아래로 바꾸면 조회하는 사람의 RLS가 적용돼요.
alter view public.monthly_summary set (security_invoker = true);

-- 4) anon(로그인 안 한 사람)에게 불필요한 권한이 있으면 회수
revoke all on public.entries, public.month_meta, public.household_members, public.households from anon;
revoke all on public.monthly_summary from anon;
