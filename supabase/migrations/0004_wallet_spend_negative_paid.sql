-- 쿼카레시피 — wallet_spend 가 음수 leaf_paid(환불 회수로 생긴 '빚')를 올바르게 처리하도록 수정.
-- 기존: paid 차감 시 least(p, rem) → p 가 음수면 빚이 0으로 리셋되는 버그.
-- 수정: least(greatest(p,0), rem) → 음수 paid 는 건드리지 않고 '빚'으로 유지.
--   · 잔액 체크는 여전히 합계(d+b+p)로 하므로, 빚만큼 총량이 깎여 사용 제한.
--   · 무료(daily/bonus)가 빚보다 많아야 사용 가능. 재구매 시 paid 에 더해져 빚 상환.
-- 데이터 보존: 함수만 교체(CREATE OR REPLACE, 시그니처 동일 → 권한 유지).

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
  u := least(greatest(d, 0), rem); d := d - u; rem := rem - u;   -- 1) daily
  u := least(greatest(b, 0), rem); b := b - u; rem := rem - u;   -- 2) bonus
  u := least(greatest(p, 0), rem); p := p - u; rem := rem - u;   -- 3) paid (음수 빚은 안 건드림)

  update public.wallets
    set leaf_daily = d, leaf_bonus = b, leaf_paid = p, daily_reset_dt = v_today, update_dts = now()
    where user_id = p_user_id;

  insert into public.usage_events (user_id, action, leaf_usage, model)
    values (p_user_id, p_action, p_cost, p_model);

  return jsonb_build_object('ok', true, 'daily', d, 'bonus', b, 'paid', p, 'total', d+b+p);
end; $$;

grant execute on function public.wallet_spend(text, text, numeric, numeric, text) to service_role;
