-- 0005: 보상형 광고 서버측 제한 (일일 상한 + 쿨다운).
--   H1 대응: 지금까지 광고 제한(횟수/쿨다운)이 클라 로컬(SecureStore)에만 있어
--   wallet 엔드포인트를 직접 호출하면 무한 적립 가능 → 서버에서 강제한다.

alter table public.wallets
  add column if not exists ad_count    int  not null default 0,               -- 오늘 시청 광고 수
  add column if not exists ad_reset_dt date not null default public.kst_today(), -- ad_count 기준일 (KST)
  add column if not exists last_ad_dts  timestamptz;                          -- 마지막 광고 적립 시각(쿨다운)

-- 보상형 광고 보상 적립 (서버 권위). 일일 상한/쿨다운을 서버에서 강제.
--   ok=false 면 지급 안 함 (reason: daily_limit | cooldown). 원자적(for update).
create or replace function public.wallet_ad_reward(
  p_user_id      text,
  p_amount       numeric,
  p_daily_max    int,
  p_cooldown_sec int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w        public.wallets;
  v_today  date := public.kst_today();
  v_count  int;
begin
  insert into public.wallets (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user_id for update;

  -- 날짜 바뀌면 광고 카운트 리셋
  v_count := case when w.ad_reset_dt < v_today then 0 else w.ad_count end;

  if v_count >= p_daily_max then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit',
      'bonus', w.leaf_bonus, 'paid', w.leaf_paid,
      'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid);
  end if;

  if w.last_ad_dts is not null
     and now() - w.last_ad_dts < make_interval(secs => p_cooldown_sec) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown',
      'bonus', w.leaf_bonus, 'paid', w.leaf_paid,
      'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid);
  end if;

  update public.wallets
    set leaf_bonus  = leaf_bonus + p_amount,
        ad_count    = v_count + 1,
        ad_reset_dt = v_today,
        last_ad_dts = now(),
        update_dts  = now()
    where user_id = p_user_id
    returning * into w;

  return jsonb_build_object('ok', true,
    'bonus', w.leaf_bonus, 'paid', w.leaf_paid,
    'total', w.leaf_daily + w.leaf_bonus + w.leaf_paid);
end; $$;

revoke all on function public.wallet_ad_reward(text, numeric, int, int) from anon, authenticated;
grant execute on function public.wallet_ad_reward(text, numeric, int, int) to service_role;
