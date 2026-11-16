-- 상대가 고친 내용을 화면에 바로 반영(실시간)하려면 한 번만 실행하세요. (SQL Editor)
-- 이미 추가돼 있으면 "already member" 같은 오류가 날 수 있는데, 그대로 두면 돼요.
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.month_meta;
alter publication supabase_realtime add table public.app_kv;
