// 쿼카 셰프(페르소나)별로 레시피가 실제로 달라지는지 잰다.
// 사용: [LEGACY=1] node scripts/recipe-eval/persona.js <라벨> [세트당 호출수=3] [페르소나id,...]
// 페르소나 문구는 src/services/personas.ts 에서 직접 읽는다(앱과 항상 같은 문구로 시험).
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

const label = process.argv[2] || 'p';
const N = +(process.argv[3] || 3);
const only = process.argv[4] ? process.argv[4].split(',') : null;

// personas.ts 에서 id·prompt 추출
const src = fs.readFileSync(path.join(ROOT, 'src/services/personas.ts'), 'utf8');
const PERSONAS = [...src.matchAll(/id: '(\w+)'[\s\S]*?prompt: '((?:[^'\\]|\\.)*)'/g)]
  .map(m => ({ id: m[1], prompt: m[2].replace(/\\'/g, "'") }))
  .filter(p => !only || only.includes(p.id));

// 페르소나 차이가 드러나도록 고기·채소·탄수화물·단 재료를 섞은 냉장고
const SETS = {
  P1: ['닭가슴살', '계란', '두부', '양파', '감자', '밥', '우유', '애호박', '버섯'],
  P2: ['돼지고기', '김치', '고구마', '당근', '대파', '버터', '바나나', '우유'],
};

let seq = 0;
const uid = () => `prompt_test_${label}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
const errors = [];

async function call(ings, persona) {
  const body = { action: 'recipe', userId: uid(), ...legacyBody({ ings, persona: persona || undefined }) };
  if (!process.env.LEGACY) {
    delete body.systemInstruction; delete body.contents; delete body.generationConfig; delete body.model;
    body.recipeInput = { mode: 'ingredients', ingredients: ings, servings: 2, persona: persona || undefined, lang: 'Korean (한국어)', region: 'South Korea' };
  }
  const res = await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const t = (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
  try { return JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)); }
  catch { errors.push(`${persona ? persona.slice(0, 20) : 'default'}: HTTP ${res.status} ${j.code || j.error || 'PARSE_FAIL'}`); return []; }
}

// ── 레시피 단위 특징 ──
const has = (r, re) => re.test([r.name, ...(r.ingredients || [])].join(' '));
const feat = r => {
  const n = r.nutrition || {};
  const ings = r.ingredients || [];
  return {
    kcal: +n.calories || 0, protein: +n.protein || 0, carbs: +n.carbs || 0,
    nIng: ings.length,
    mins: parseInt(String(r.cookTime).replace(/[^0-9]/g, '')) || 0,
    spicy: has(r, /고춧가루|고추장|청양|고추|매운|불닭|칠리|chili/i),
    sweet: has(r, /설탕|꿀|올리고당|시럽|바나나|초콜릿|연유/),
    dessertName: /케이크|쿠키|푸딩|머핀|맛탕|파이|타르트|스무디|라떼|빵|팬케이크|브라우니|아이스|셰이크|양갱|떡|디저트|그라탕|토스트/.test(r.name),
    animal: has(r, /닭|돼지|소고기|고기|베이컨|햄|계란|달걀|우유|버터|치즈|크림|꿀|멸치|액젓|생선|새우/),
    carbStaple: has(r, /밥|쌀|면|파스타|빵|떡|감자|고구마|설탕|올리고당|밀가루|부침가루|바나나/),
    soup: /국|탕|찌개|전골|수프|스프|죽/.test(r.name),
    plating: (r.steps || []).some(s => /플레이팅|가니시|접시 (중앙|가운데)|접시에 (예쁘게|가지런히|돌려)|소스를 (뿌|두르|끼얹)|끼얹|데코|곁들|한 방울/.test(s)),
    korean: /국|탕|찌개|조림|볶음|무침|나물|전$|부침|찜|구이|밥|죽|김치|불고기|제육|떡/.test(r.name),
  };
};
const avg = (a, k) => a.length ? Math.round(a.reduce((s, x) => s + x[k], 0) / a.length) : 0;
const pct = (a, k) => a.length ? Math.round(100 * a.filter(x => x[k]).length / a.length) : 0;

(async () => {
  for (let i = 0; i < 3; i++) await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify({ action: '__probe__', userId: 'probe' }) }).catch(() => {});

  const tasks = [];
  for (const p of PERSONAS) for (const [k, ings] of Object.entries(SETS)) for (let i = 0; i < N; i++) tasks.push({ p, k, ings });
  const results = {};
  let idx = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      const rs = await call(t.ings, t.p.prompt);
      (results[t.p.id] ||= []).push(...rs.map(r => ({ set: t.k, recipe: r })));
    }
  }));
  fs.writeFileSync(path.join(OUT, `persona_${label}.json`), JSON.stringify(results, null, 2));

  const rows = PERSONAS.map(p => {
    const rs = (results[p.id] || []); const f = rs.map(x => feat(x.recipe));
    return { id: p.id, n: rs.length, kcal: avg(f, 'kcal'), prot: avg(f, 'protein'), carb: avg(f, 'carbs'), ing: avg(f, 'nIng'), min: avg(f, 'mins'),
      spicy: pct(f, 'spicy'), sweet: pct(f, 'sweet'), dessert: pct(f, 'dessertName'), animal: pct(f, 'animal'),
      carbS: pct(f, 'carbStaple'), soup: pct(f, 'soup'), plate: pct(f, 'plating'), kor: pct(f, 'korean'),
      names: [...new Set(rs.map(x => x.recipe.name))] };
  });
  const pad = (v, w) => String(v).padStart(w);
  console.log('페르소나     n  kcal 단백 탄수 재료 분  매운% 단% 디저트% 동물성% 탄수재료% 국물% 플레이팅% 한식%');
  for (const r of rows) console.log(r.id.padEnd(10) + pad(r.n, 3) + pad(r.kcal, 6) + pad(r.prot, 5) + pad(r.carb, 5) + pad(r.ing, 5) + pad(r.min, 4) +
    pad(r.spicy, 6) + pad(r.sweet, 5) + pad(r.dessert, 7) + pad(r.animal, 8) + pad(r.carbS, 9) + pad(r.soup, 7) + pad(r.plate, 9) + pad(r.kor, 6));
  console.log('\n요리 이름:');
  for (const r of rows) console.log(`  ${r.id}: ${r.names.join(', ')}`);
  console.log(`\n호출 실패 ${errors.length}건`); errors.forEach(e => console.log('  ' + e));
})();
