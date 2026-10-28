-- 쿼카레시피 퍼널/리텐션 조회 모음
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- 데이터 출처: public.usage_events
--   app_open          = 앱 실행 (하루 1회만 기록 / 최초 기록 = 사실상 설치)
--   fridge_setup_done = 냉장고 설정 완료 (건너뛰기는 기록 안 됨)
--   onboarding_done = 온보딩 완료 (평생 1회)
--   scan / recipe / qa = AI 호출 (leaf_usage > 0)

-- ───────────────────────────────────────────────────────────
-- 1) 핵심 퍼널 — 설치한 사람 중 몇 명이 레시피까지 갔나
-- ───────────────────────────────────────────────────────────
with u as (
  select
    user_id,
    min(create_dts) filter (where action = 'app_open')        as first_open,
    min(create_dts) filter (where action = 'fridge_setup_done') as fridge_done,
    min(create_dts) filter (where action = 'onboarding_done') as onboarded,
    min(create_dts) filter (where action = 'recipe')          as first_recipe
  from public.usage_events
  group by user_id
)
select
  count(*) filter (where first_open   is not null) as "설치",
  count(*) filter (where fridge_done  is not null) as "냉장고설정",
  count(*) filter (where onboarded    is not null) as "온보딩완료",
  count(*) filter (where first_recipe is not null) as "첫레시피",
  round(100.0 * count(*) filter (where onboarded    is not null)
              / nullif(count(*) filter (where first_open is not null), 0), 1) as "온보딩%",
  round(100.0 * count(*) filter (where first_recipe is not null)
              / nullif(count(*) filter (where first_open is not null), 0), 1) as "레시피도달%"
from u;

-- ───────────────────────────────────────────────────────────
-- 2) 일별 활성 사용자 + 신규/복귀 분해
-- ───────────────────────────────────────────────────────────
with opens as (
  select user_id, (create_dts at time zone 'Asia/Seoul')::date as d
  from public.usage_events where action = 'app_open'
),
firsts as (select user_id, min(d) as first_d from opens group by user_id)
select
  o.d as "날짜",
  count(*)                                   as "활성자",
  count(*) filter (where o.d = f.first_d)    as "신규",
  count(*) filter (where o.d > f.first_d)    as "재방문"
from opens o join firsts f using (user_id)
group by o.d order by o.d desc limit 30;

-- ───────────────────────────────────────────────────────────
-- 3) D1 / D7 리텐션 — 설치 다음날·일주일 뒤 돌아온 비율
-- ───────────────────────────────────────────────────────────
with opens as (
  select user_id, (create_dts at time zone 'Asia/Seoul')::date as d
  from public.usage_events where action = 'app_open'
),
firsts as (select user_id, min(d) as first_d from opens group by user_id)
select
  f.first_d as "설치일",
  count(distinct f.user_id) as "설치자",
  round(100.0 * count(distinct o.user_id) filter (where o.d = f.first_d + 1)
              / nullif(count(distinct f.user_id), 0), 1) as "D1%",
  round(100.0 * count(distinct o.user_id) filter (where o.d = f.first_d + 7)
              / nullif(count(distinct f.user_id), 0), 1) as "D7%"
from firsts f left join opens o using (user_id)
group by f.first_d order by f.first_d desc limit 30;

-- ───────────────────────────────────────────────────────────
-- 4) 기능별 사용량 + 잎사귀 소비 (어떤 기능이 실제로 쓰이나)
-- ───────────────────────────────────────────────────────────
select
  action as "기능",
  count(*) as "호출수",
  count(distinct user_id) as "사용자수",
  round(sum(leaf_usage), 1) as "잎사귀소비"
from public.usage_events
where create_dts > now() - interval '30 days'
group by action order by 호출수 desc;

-- ───────────────────────────────────────────────────────────
-- 5) 이탈 지점 — 앱은 열었는데 레시피를 한 번도 안 뽑은 사람
-- ───────────────────────────────────────────────────────────
select count(*) as "레시피미사용자"
from (
  select user_id
  from public.usage_events
  group by user_id
  having count(*) filter (where action = 'recipe') = 0
) t;
