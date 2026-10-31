// 레시피 "품질" 점검용 샘플 수집 + 자동 점검.
// eval.js 가 "재료가 맞는가"를 본다면, 이건 "레시피로서 쓸 만한가"를 본다.
// 사용: [LEGACY=1] node scripts/recipe-eval/sample.js <라벨> [세트당 호출수=3]
// 전체 레시피를 out/sample_<라벨>.json 에 저장 → 사람이 읽고 채점한다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const pick = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1].replace(/["\r\s]/g, '');
const URL = pick('EXPO_PUBLIC_SUPABASE_URL');
const KEY = pick('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const H = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` };
const { legacyBody } = require('./legacy.js');

const label = process.argv[2] || 'q';
const N = +(process.argv[3] || 3);

// eval.js 세트와 겹치지 않는, 실제 냉장고에 흔한 조합
const SETS = {
  G: ['돼지고기', '김치', '두부', '대파'],
  H: ['계란', '밥', '양파', '당근', '햄'],
  I: ['닭다리살', '감자', '당근', '양파'],
  J: ['소고기', '무', '대파', '마늘'],
  K: ['애호박', '두부', '양파', '청양고추'],
  L: ['파스타면', '토마토', '마늘', '양파', '베이컨'],
};

let seq = 0;
const uid = () => `prompt_test_${label}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function call(ings) {
  const payload = process.env.LEGACY
    ? { action: 'recipe', userId: uid(), ...legacyBody({ ings }) }
    : { action: 'recipe', userId: uid(), recipeInput: { mode: 'ingredients', ingredients: ings, servings: 2, lang: 'Korean (한국어)', region: 'South Korea' } };
  const res = await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  const t = (body.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
  try { return JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)); }
  catch { errors.push(`${ings.join(',')}: HTTP ${res.status} ${body.code || body.error || 'PARSE_FAIL'}`); return null; }
}

// ── 자동 점검 ──
const SEASON = /소금|설탕|간장|식용유|기름|오일|참기름|들기름|올리브|고춧가루|고추장|된장|후추|후춧|마늘|생강|식초|물|밀가루|전분|맛술|미림|청주|깨|올리고당|물엿|액젓|다시다|육수|버터|굴소스|케첩|부침가루|파슬리/;
const core = s => s.replace(/\(.*?\)/g, '').replace(/[0-9./~]+\s*(g|kg|ml|L|개|큰술|작은술|컵|모|대|쪽|줌|장|알|공기|인분|T|t|cm|약간|적당량|꼬집)?.*$/, '').trim();
function check(r, ings) {
  const issues = [];
  const steps = (r.steps || []).join(' ');
  // 1) 재료 목록에 있는데 조리 과정에서 한 번도 안 나오는 재료
  for (const g of r.ingredients || []) {
    const name = core(g);
    if (!name || name.length < 1) continue;
    const key = name.length > 2 ? name.slice(0, 2) : name;
    if (!steps.includes(key)) issues.push(`안 쓰는 재료: ${name}`);
  }
  // 2) 분량 없는 재료
  for (const g of r.ingredients || []) if (!/[0-9]|약간|적당량|조금|꼬집/.test(g)) issues.push(`분량 없음: ${g}`);
  // 3) 간 — 따라 했을 때 "짜서 못 먹는" 레시피 (2인분 기준)
  const tsp = (g) => { const m = g.match(/([0-9.]+|[0-9]+\/[0-9]+)\s*(큰술|작은술)/); if (!m) return 0;
    const v = m[1].includes('/') ? eval(m[1]) : parseFloat(m[1]); return m[2] === '큰술' ? v * 3 : v; };
  const ingr = r.ingredients || [];
  const find = re => ingr.find(g => re.test(core(g)));
  const salt = find(/^소금$/); const pepper = find(/^후추|^후춧/);
  const soupish = /국|탕|찌개|죽|전골/.test(r.name);
  if (pepper && tsp(pepper) >= 1) issues.push(`후추 과다: ${pepper}`);
  // 파스타 면 삶는 물의 소금은 간이 아니므로 제외
  const pastaWater = (r.steps || []).some(s => /소금/.test(s) && /삶/.test(s) && /면/.test(s));
  if (salt && !pastaWater && tsp(salt) > (soupish ? 1.5 : 1)) issues.push(`소금 과다: ${salt}`);
  const salty = ingr.some(g => /햄|베이컨|김치|치즈|된장|고추장/.test(g));
  if (salty && salt && !pastaWater && tsp(salt) >= 0.5 && !soupish) issues.push(`짠 재료에 소금 추가: ${salt}`);
  const doen = find(/^된장$/), water = (ingr.find(g => /^물\s/.test(g)) || '').match(/([0-9]+)\s*ml/);
  if (doen && water && tsp(doen) / 3 / (parseInt(water[1]) / 400) > 2) issues.push(`된장 과다: ${doen} / 물 ${water[1]}ml`);
  // 4) 정체성·표기
  if (/전$/.test(r.name.replace(/\s/g, '')) && !ingr.some(g => /밀가루|부침가루|전분|계란|달걀|튀김가루/.test(g))) issues.push('전인데 반죽 없음');
  if (/[(（]/.test(r.name)) issues.push('이름에 괄호');
  // 5) 마늘을 먼저 볶고 고기·베이컨을 나중에 오래 볶는 순서(마늘이 탐)
  const st = r.steps || [];
  const gi = st.findIndex(s => /마늘/.test(s) && /볶|굽/.test(s));
  const mi = st.findIndex((s, i) => i > gi && /베이컨|돼지고기|소고기|닭/.test(s) && /([3-9]|1[0-9])\s*분/.test(s));
  if (gi >= 0 && mi > gi && !/다진 마늘|마늘을 넣/.test(st.slice(mi).join(' '))) issues.push('마늘 먼저 볶고 고기 나중(탐)');
  if (/min|hour/i.test(r.cookTime || '')) issues.push('조리시간 영어');
  // 4) 단계 수
  const n = (r.steps || []).length; if (n < 4 || n > 6) issues.push(`단계 수 ${n}`);
  // 5) 칼로리 상식 범위(1인분)
  const kcal = r.nutrition?.calories; if (!(kcal >= 80 && kcal <= 1200)) issues.push(`칼로리 이상 ${kcal}`);
  // 6) 조리시간 표기 vs 단계에 적힌 시간 합 (단계 합이 표기보다 크게 길면 거짓 표기)
  const sum = (steps.match(/([0-9]+)\s*분/g) || []).reduce((a, m) => a + parseInt(m), 0);
  const ct = parseInt(r.cookTime) || 0; if (ct && sum > ct * 1.5 + 5) issues.push(`조리시간 ${r.cookTime} < 단계 합 ${sum}분`);
  return issues;
}

const errors = [];

(async () => {
  // 워밍업: 한동안 요청이 없어 식은 인스턴스에 동시 요청이 몰리면 BOOT_ERROR 가 난다(배포 직후만이 아님).
  for (let i = 0; i < 3; i++) await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify({ action: '__probe__', userId: 'probe' }) }).catch(() => {});
  const all = [];
  const tasks = [];
  for (const [k, ings] of Object.entries(SETS)) for (let i = 0; i < N; i++) tasks.push({ k, ings });
  let idx = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (idx < tasks.length) { const t = tasks[idx++]; const rs = await call(t.ings); (rs || []).forEach(r => all.push({ set: t.k, ings: t.ings, recipe: r, auto: check(r, t.ings) })); }
  }));
  all.sort((a, b) => a.set.localeCompare(b.set));
  fs.writeFileSync(path.join(OUT, `sample_${label}.json`), JSON.stringify(all, null, 2));
  const flagged = all.filter(x => x.auto.length);
  const tally = {};
  all.forEach(x => x.auto.forEach(i => { const k = i.replace(/:.*$/, '').replace(/[0-9]+/g, '#').replace(/ [^ ]+$/, ''); tally[k] = (tally[k] || 0) + 1; }));
  console.log(`레시피 ${all.length}개 · 자동점검 걸린 레시피 ${flagged.length}개 · 호출 실패 ${errors.length}건`);
  errors.forEach(e => console.log('  실패: ' + e));
  console.log('유형별:', JSON.stringify(tally));
  flagged.slice(0, 40).forEach(x => console.log(`  [${x.set}] ${x.recipe.name}: ${x.auto.join(' / ')}`));
})();
