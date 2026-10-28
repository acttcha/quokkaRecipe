-- 퍼널 측정용 이벤트 기록 (잎사귀와 무관).
-- 기존 usage_events 에는 AI 호출(scan/recipe/qa)만 쌓여서,
-- "AI 를 써보기 전에 이탈한 사람"이 전혀 보이지 않았다.
-- 설치 → 온보딩 완료 → 첫 레시피 → 재방문 구간을 보려고 leaf_usage = 0 이벤트를 남긴다.
--
-- p_once: 'day'  = 같은 유저가 하루에 한 번만 기록 (app_open → DAU/재방문)
--         'ever' = 평생 한 번만 기록 (onboarding_done)
-- 반환: 실제로 새로 기록했으면 true, 이미 있어서 건너뛰었으면 false.
create or replace function public.usage_track(
  p_user_id text,
  p_action  text,
  p_once    text default 'day'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_exists boolean;
begin
  if p_once = 'ever' then
    select exists(
      select 1 from public.usage_events
      where user_id = p_user_id and action = p_action
    ) into v_exists;
  else
    -- 일일 리셋과 같은 기준일(KST)을 쓴다 — wallet_touch 의 kst_today() 와 동일.
    select exists(
      select 1 from public.usage_events
      where user_id = p_user_id
        and action = p_action
        and (create_dts at time zone 'Asia/Seoul')::date = public.kst_today()
    ) into v_exists;
  end if;

  if v_exists then
    return false;
  end if;

  insert into public.usage_events (user_id, action, leaf_usage, model)
    values (p_user_id, p_action, 0, null);
  return true;
end; $$;

grant execute on function public.usage_track(text, text, text) to service_role;
