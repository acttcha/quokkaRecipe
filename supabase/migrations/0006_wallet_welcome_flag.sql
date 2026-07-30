-- 쿼카레시피 — wallet_touch 가 "이번 호출로 지갑이 처음 생성됐는지(=첫 방문, 웰컴 지급됨)" 를 반환.
-- 앱이 첫 방문 유저에게 "웰컴 잎사귀 지급" 팝업을 1회 띄우기 위함.
-- 데이터 보존: 테이블은 건드리지 않고 함수만 교체.

create or replace function public.wallet_touch(
  p_user_id text,
  p_daily_max numeric default 3,
  p_welcome numeric default 2,
  p_auth_type text default 'guest'
) returns jsonb
language plpgsql
as $$
declare
  w public.wallets;
  v_new boolean := false;   -- insert 가 실제로 행을 넣었으면 true (= 첫 방문)
begin
  insert into public.wallets (user_id, leaf_bonus, welcome_fg, leaf_daily, daily_reset_dt, auth_type)
    values (p_user_id, p_welcome, true, p_daily_max, public.kst_today(), p_auth_type)
    on conflict (user_id) do nothing;
  v_new := FOUND;   -- on conflict do nothing 이면 FOUND=false, 새로 생성됐으면 true

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
    'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid, 'isPro', w.subs_fg,
    'welcomed', v_new,
    'welcomeAmount', case when v_new then p_welcome else 0 end);
end; $$;

revoke all on function public.wallet_touch(text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.wallet_touch(text, numeric, numeric, text) to service_role;
