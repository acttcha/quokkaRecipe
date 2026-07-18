-- 쿼카레시피 — RevenueCat 웹훅 멱등성(중복 처리 방지) + 웹훅 처리 로그
-- 웹훅은 재시도로 같은 이벤트(event.id)를 여러 번 보낼 수 있음 → 1회만 반영해야 함.
-- processed_events 는 "이미 처리한 이벤트" 기록 겸 감사 로그(결제 통계) 역할.

create table if not exists public.processed_events (
  event_id    text primary key,       -- RevenueCat event.id (멱등 키)
  event_type  text,                   -- INITIAL_PURCHASE / RENEWAL / NON_RENEWING_PURCHASE / EXPIRATION / TRANSFER ...
  user_id     text,                   -- app_user_id (기기ID/계정ID)
  product_id  text,                   -- 상품ID (base plan 접미사 제거)
  create_dts  timestamptz not null default now()
);
create index if not exists processed_events_user_idx on public.processed_events (user_id, create_dts desc);

-- 클라 직접 접근 차단 (service_role = 웹훅 엣지함수만 통과)
alter table public.processed_events enable row level security;

-- 이벤트 선점: 처음 보는 이벤트면 기록 후 true, 이미 처리했으면 false.
create or replace function public.claim_event(
  p_event_id text,
  p_type text default null,
  p_user_id text default null,
  p_product_id text default null
) returns boolean
language plpgsql
as $$
begin
  insert into public.processed_events (event_id, event_type, user_id, product_id)
    values (p_event_id, p_type, p_user_id, p_product_id);
  return true;
exception when unique_violation then
  return false;
end; $$;

revoke all on function public.claim_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_event(text, text, text, text) to service_role;
