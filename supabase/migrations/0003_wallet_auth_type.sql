-- 쿼카레시피 — wallet_touch 에 auth_type 반영 (게스트/구글/애플 구분)
-- 기존 wallet_touch 는 auth_type 을 갱신하지 않아 로그인해도 'guest' 로 남았음.
-- 데이터 보존: 테이블은 건드리지 않고 함수만 교체.

-- 기존 3-인자 버전 제거 후 4-인자(p_auth_type 추가)로 재정의
drop function if exists public.wallet_touch(text, numeric, numeric);

create or replace function public.wallet_touch(
  p_user_id text,
  p_daily_max numeric default 3,
  p_welcome numeric default 2,
  p_auth_type text default 'guest'
) returns jsonb
language plpgsql
as $$
declare w public.wallets;
begin
  insert into public.wallets (user_id, leaf_bonus, welcome_fg, leaf_daily, daily_reset_dt, auth_type)
    values (p_user_id, p_welcome, true, p_daily_max, public.kst_today(), p_auth_type)
    on conflict (user_id) do nothing;

  select * into w from public.wallets where user_id = p_user_id for update;

  -- 로그인 신원이면 auth_type 갱신 (guest → google/apple). 게스트면 기존 값 유지.
  if p_auth_type is not null and p_auth_type <> 'guest' and w.auth_type is distinct from p_auth_type then
    update public.wallets set auth_type = p_auth_type, update_dts = now()
      where user_id = p_user_id
      returning * into w;
  end if;

  if w.daily_reset_dt < public.kst_today() then
    update public.wallets set leaf_daily = p_daily_max, daily_reset_dt = public.kst_today(), update_dts = now()
      where user_id = p_user_id
      returning * into w;
  end if;

  return jsonb_build_object(
    'daily', w.leaf_daily, 'bonus', w.leaf_bonus, 'paid', w.leaf_paid,
    'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid, 'isPro', w.subs_fg);
end; $$;

revoke all on function public.wallet_touch(text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.wallet_touch(text, numeric, numeric, text) to service_role;
