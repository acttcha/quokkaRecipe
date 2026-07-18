-- 쿼카레시피 잎사귀 지갑 (서버 권위) + 사용 로그
-- 유저 신원 = RevenueCat app_user_id (게스트=기기ID, 로그인 시 계정ID)
-- 클라이언트는 DB 직접 접근 불가(RLS) — gemini-proxy 엣지함수가 service_role 로만 접근.
-- 잎사귀 조작은 아래 함수로만(원자적) → 위변조 방지.
--
-- 잎사귀 3단 분리 + 소비 순서: leaf_daily(무료일일) → leaf_bonus(무료보너스) → leaf_paid(구매)
--   · 무료(웰컴/광고/PRO월지급)를 먼저 쓰고, 돈 주고 산 것(leaf_paid)은 마지막에 → 소비자 보호.
-- 일일 리셋 기준: 한국(KST) 자정.

-- ─── 재실행 안전: 기존 것 정리 후 재생성 (⚠️ 개발용 — 지갑 데이터 초기화됨) ───
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('kst_today','wallet_touch','wallet_spend','wallet_credit','wallet_set_pro','wallet_merge')
  loop execute 'drop function ' || r.sig || ' cascade'; end loop;
end $$;
drop table if exists public.usage_events cascade;
drop table if exists public.wallets cascade;

-- ─── 헬퍼: KST 자정 기준 '오늘' 날짜 ─────────────────────────
create or replace function public.kst_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- ─── 테이블 ────────────────────────────────────────────────
create table if not exists public.wallets (
  user_id     text primary key,
  leaf_paid   numeric not null default 0,               -- 구매한 잎사귀 (돈 주고 산 것, 롤오버) ← 마지막 소비
  leaf_bonus  numeric not null default 0,               -- 무료 보너스 (웰컴/광고/PRO월지급, 롤오버) ← daily 다음 소비
  leaf_daily  numeric not null default 3,               -- 오늘 남은 무료 일일
  daily_reset_dt    date    not null default public.kst_today(), -- leaf_daily 기준일 (KST 자정 리셋)
  subs_fg     boolean not null default false,           -- 쿼카 패스(구독) 활성
  auth_type   text    not null default 'guest',         -- 'guest' | 'google' | 'apple'
  welcome_fg  boolean not null default false,           -- 웰컴 보너스 1회 지급 여부
  create_dts  timestamptz not null default now(),
  update_dts  timestamptz not null default now()
);

create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  action      text not null,                            -- 'scan' | 'recipe' | 'qa' ...
  leaf_usage  numeric not null default 0,               -- 이 호출로 소비한 잎사귀
  model       text,
  create_dts  timestamptz not null default now()
);
create index if not exists usage_events_user_idx   on public.usage_events (user_id, create_dts desc);
create index if not exists usage_events_action_idx on public.usage_events (action, create_dts desc);

-- ─── RLS: 클라 직접 접근 차단 (service_role = 엣지함수만 통과) ───
alter table public.wallets       enable row level security;
alter table public.usage_events  enable row level security;

-- ─── 함수 (엣지함수가 service_role 로 호출) ──────────────────

-- 지갑 조회/생성 + 일일 리셋 + 웰컴 보너스 1회(→ leaf_bonus). 잔액 반환.
create or replace function public.wallet_touch(
  p_user_id text,
  p_daily_max numeric default 3,
  p_welcome numeric default 2
) returns jsonb
language plpgsql
as $$
declare w public.wallets;
begin
  insert into public.wallets (user_id, leaf_bonus, welcome_fg, leaf_daily, daily_reset_dt)
    values (p_user_id, p_welcome, true, p_daily_max, public.kst_today())
    on conflict (user_id) do nothing;

  select * into w from public.wallets where user_id = p_user_id for update;

  if w.daily_reset_dt < public.kst_today() then
    update public.wallets set leaf_daily = p_daily_max, daily_reset_dt = public.kst_today(), update_dts = now()
      where user_id = p_user_id
      returning * into w;
  end if;

  return jsonb_build_object(
    'daily', w.leaf_daily, 'bonus', w.leaf_bonus, 'paid', w.leaf_paid,
    'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid, 'isPro', w.subs_fg);
end; $$;

-- 잎사귀 차감. 소비 순서: leaf_daily → leaf_bonus → leaf_paid. 부족하면 ok=false. 원자적.
create or replace function public.wallet_spend(
  p_user_id text,
  p_action text,
  p_cost numeric,
  p_daily_max numeric default 3,
  p_model text default null
) returns jsonb
language plpgsql
as $$
declare
  w public.wallets;
  d numeric; b numeric; p numeric;   -- daily / bonus / paid
  rem numeric; u numeric;
  v_today date := public.kst_today();
begin
  insert into public.wallets (user_id, leaf_daily, daily_reset_dt)
    values (p_user_id, p_daily_max, v_today)
    on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user_id for update;

  d := w.leaf_daily; b := w.leaf_bonus; p := w.leaf_paid;
  if w.daily_reset_dt < v_today then d := p_daily_max; end if;   -- 리셋

  if (d + b + p) < p_cost then
    update public.wallets set leaf_daily = d, daily_reset_dt = v_today, update_dts = now()
      where user_id = p_user_id;
    return jsonb_build_object('ok', false, 'daily', d, 'bonus', b, 'paid', p, 'total', d+b+p);
  end if;

  rem := p_cost;
  u := least(d, rem); d := d - u; rem := rem - u;   -- 1) daily
  u := least(b, rem); b := b - u; rem := rem - u;   -- 2) bonus
  u := least(p, rem); p := p - u; rem := rem - u;   -- 3) paid

  update public.wallets
    set leaf_daily = d, leaf_bonus = b, leaf_paid = p, daily_reset_dt = v_today, update_dts = now()
    where user_id = p_user_id;

  insert into public.usage_events (user_id, action, leaf_usage, model)
    values (p_user_id, p_action, p_cost, p_model);

  return jsonb_build_object('ok', true, 'daily', d, 'bonus', b, 'paid', p, 'total', d+b+p);
end; $$;

-- 잎사귀 적립. p_paid=true → 구매(leaf_paid), false → 무료보너스(leaf_bonus). 웹훅에서 호출.
create or replace function public.wallet_credit(
  p_user_id text,
  p_amount numeric,
  p_paid boolean default false
) returns jsonb
language plpgsql
as $$
declare w public.wallets;
begin
  insert into public.wallets (user_id, leaf_paid, leaf_bonus)
    values (p_user_id, case when p_paid then p_amount else 0 end,
                       case when p_paid then 0 else p_amount end)
    on conflict (user_id) do update set
      leaf_paid  = public.wallets.leaf_paid  + case when p_paid then p_amount else 0 end,
      leaf_bonus = public.wallets.leaf_bonus + case when p_paid then 0 else p_amount end,
      update_dts = now()
    returning * into w;
  return jsonb_build_object('bonus', w.leaf_bonus, 'paid', w.leaf_paid,
                           'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid);
end; $$;

-- 구독 상태 설정 (구독 활성/만료).
create or replace function public.wallet_set_pro(
  p_user_id text,
  p_is_pro boolean
) returns void
language sql
as $$
  insert into public.wallets (user_id, subs_fg) values (p_user_id, p_is_pro)
    on conflict (user_id) do update set subs_fg = p_is_pro, update_dts = now();
$$;

-- 지갑 병합 (TRANSFER: 옛 기기ID → 새 기기ID/계정). leaf_paid·leaf_bonus 합치고 원본 비움.
create or replace function public.wallet_merge(
  p_from text,
  p_to text
) returns void
language plpgsql
as $$
declare v public.wallets;
begin
  if p_from = p_to then return; end if;
  select * into v from public.wallets where user_id = p_from for update;
  if not found then return; end if;

  insert into public.wallets (user_id, leaf_paid, leaf_bonus)
    values (p_to, v.leaf_paid, v.leaf_bonus)
    on conflict (user_id) do update set
      leaf_paid  = public.wallets.leaf_paid  + v.leaf_paid,
      leaf_bonus = public.wallets.leaf_bonus + v.leaf_bonus,
      update_dts = now();

  update public.wallets set leaf_paid = 0, leaf_bonus = 0, update_dts = now() where user_id = p_from;
end; $$;

-- 함수는 엣지함수(service_role)만 호출. 클라(anon) 직접 호출 차단.
revoke all on function public.wallet_touch(text, numeric, numeric)                 from public, anon, authenticated;
revoke all on function public.wallet_spend(text, text, numeric, numeric, text)     from public, anon, authenticated;
revoke all on function public.wallet_credit(text, numeric, boolean)                from public, anon, authenticated;
revoke all on function public.wallet_set_pro(text, boolean)                        from public, anon, authenticated;
revoke all on function public.wallet_merge(text, text)                             from public, anon, authenticated;

grant execute on function public.wallet_touch(text, numeric, numeric)               to service_role;
grant execute on function public.wallet_spend(text, text, numeric, numeric, text)   to service_role;
grant execute on function public.wallet_credit(text, numeric, boolean)              to service_role;
grant execute on function public.wallet_set_pro(text, boolean)                      to service_role;
grant execute on function public.wallet_merge(text, text)                           to service_role;
