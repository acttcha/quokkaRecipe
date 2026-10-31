// 앱 알레르기 선택지(분류명: 유제품·해산물·견과류·글루텐…)와 맵기 설정이 실제 레시피에서 지켜지는지 잰다.
// 앱이 보내는 문장 형식(preferences.ts preferencesToPrompt) 그대로 구버전 경로로 호출한다.
// 재료 기반 + 요리명 검색(서버 1차 필터 없이 최종 검사만 받는 경로) 둘 다.
// 사용: node scripts/recipe-eval/allergy.js <라벨> [세트당 호출수=4]
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

const label = process.argv[2] || 'a';
const N = +(process.argv[3] || 4);
const allergy = a => `🚨 Allergies / cannot eat: ${a} → NEVER use these ingredients. Do not include them anywhere in ingredients or steps.`;
const spice = v => `- Spice tolerance: ${v} → reduce or omit spicy seasonings (chili, chili powder, hot sauce, etc.) beyond this level.`;
const EN = { lang: 'English', country: 'United States' };

// forbid: 재료 목록·요리명에 나오면 위반(noName 이면 재료만). stepsForbid: 단계 본문 검사용(팁 문장이 걸리지 않는 단어만).
// spice: 맵기 세트 — 위반은 청양·불닭만, 고춧가루·고추장 양은 따로 잰다.
const SETS0 = {
  유제품: { ings: ['우유', '버터', '치즈', '계란', '감자', '양파'], prefs: [allergy('유제품')], forbid: /우유|버터|치즈|크림|요거트|라떼|그라탕|연유/ },
  해산물: { ings: ['새우', '오징어', '어묵', '두부', '애호박', '김치'], prefs: [allergy('해산물')], forbid: /새우|오징어|어묵|멸치|액젓|젓갈|굴소스|참치|해물|조개/, stepsForbid: /새우|오징어|어묵|멸치|참치/ },
  견과류: { ings: ['땅콩', '호두', '닭가슴살', '브로콜리', '고구마'], prefs: [allergy('견과류')], forbid: /땅콩|호두|아몬드|잣|견과|캐슈/ },
  글루텐: { ings: ['국수', '식빵', '계란', '감자', '애호박'], prefs: [allergy('글루텐')], forbid: /국수|빵|밀가루|부침가루|튀김가루|파스타|라면|만두/ },
  계란: { ings: ['계란', '메추리알', '두부', '시금치', '밥'], prefs: [allergy('계란')], forbid: /계란|달걀|메추리알|노른자|흰자|마요/ },
  돼지고기: { ings: ['삼겹살', '베이컨', '소고기', '양파', '감자'], prefs: [allergy('돼지고기')], forbid: /돼지|삼겹|베이컨|햄|스팸/ },
  맵기0: { ings: ['김치', '돼지고기', '두부', '대파'], prefs: [spice('매운 음식 전혀 못 먹음')], forbid: /청양|불닭|땡초/, spice: true },
  맵기1: { ings: ['김치', '돼지고기', '두부', '대파'], prefs: [spice('약간 매운 정도만 가능')], forbid: /청양|불닭|땡초/, spice: true },
  검색_해산물: { dish: '새우볶음밥', prefs: [allergy('해산물')], forbid: /새우|오징어|멸치|액젓|젓갈|굴소스|해물|조개|게살/, stepsForbid: /새우|오징어|멸치|게살/, noName: true },
  검색_유제품: { dish: '크림 파스타', prefs: [allergy('유제품')], forbid: /우유|버터|치즈|생크림|파마산|요거트/, noName: true },
  검색_글루텐: { dish: '김치전', prefs: [allergy('글루텐')], forbid: /밀가루|부침가루|튀김가루|빵가루/, noName: true },
  검색_견과: { dish: '멸치볶음', prefs: [allergy('견과류')], forbid: /땅콩|호두|아몬드|잣|견과|캐슈/, noName: true },
  EN_dairy: { ings: ['milk', 'butter', 'cheese', 'eggs', 'potatoes', 'onion'], prefs: [allergy('dairy')], forbid: /\bmilk|butter|cheese|cream|yogurt|parmesan/i, ...EN },
  EN_eggs: { ings: ['eggs', 'eggplant', 'chicken breast', 'rice', 'garlic'], prefs: [allergy('eggs')], forbid: /\beggs?\b|omelet|frittata|mayo/i, ...EN },
};

const SETS = process.env.ONLY ? Object.fromEntries(Object.entries(SETS0).filter(([k]) => process.env.ONLY.split(',').includes(k))) : SETS0;
if (!SETS.계란) SETS.계란 = SETS0.계란;
let seq = 0;
const uid = () => `prompt_test_${label}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

// 요리명 검색은 서버가 프롬프트를 다시 만들지 않고 앱 것을 그대로 쓴다 → 앱의 DISH_SYSTEM 원문을 읽어 쓴다.
const claudeSrc = fs.readFileSync(path.join(ROOT, 'src/services/claude.ts'), 'utf8');
const DISH_SYSTEM = claudeSrc.match(/const DISH_SYSTEM = `([\s\S]*?)`;/)[1].replace(/\$\{[^}]+\}/g, '');

// 1.0.5 앱 generateRecipeByName 과 같은 형식
function dishBody(s) {
  const b = legacyBody({ ings: ['x'], prefs: s.prefs, lang: s.lang, country: s.country });
  b.systemInstruction.parts[0].text = DISH_SYSTEM + '\n\nAlways output real, valid recipes in the EXACT JSON format specified above.';
  const full = b.contents[0].parts[0].text;
  const loc = full.slice(full.indexOf('\n\n[Language'));
  const pref = `\n\n[User preferences — MUST be reflected]\n${s.prefs.join('\n')}`;
  b.contents[0].parts[0].text = `Dish to make: ${s.dish}${pref}\nServings: make it for 2 serving(s) — scale ingredient amounts and nutrition for 2 serving(s), and set JSON "servings" to 2.` + loc;
  return b;
}

// "고춧가루 1/2작은술", "고추장 1큰술" → 작은술 단위(1큰술 = 3작은술). 여러 줄이면 합.
function amount(ings, re) {
  let sum = 0;
  for (const x of ings) {
    if (!re.test(x)) continue;
    const m = x.match(/(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(큰술|작은술)/);
    if (!m) continue;
    let v = m[2] ? +m[1] / +m[2] : +m[1];
    if (m[3] === '큰술') v *= 3;
    sum += v;
  }
  return Math.round(sum * 100) / 100;
}

async function call(s) {
  const body = { action: 'recipe', userId: uid(), ...(s.dish ? dishBody(s) : legacyBody({ ings: s.ings, prefs: s.prefs, lang: s.lang, country: s.country })) };
  const res = await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const t = (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
  try {
    const g = res.headers.get('x-allergy-guard');
    return { recipes: JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)), guard: g && decodeURIComponent(g) };
  } catch { return { err: `HTTP ${res.status} ${j.code || j.error || 'PARSE_FAIL'}${j.terms ? ' ' + j.terms : ''}` }; }
}

(async () => {
  // 식은 인스턴스에 몰리면 BOOT_ERROR → 먼저 깨운다
  await Promise.all([0, 1, 2].map(() => call(SETS.계란).catch(() => null)));
  const all = {};
  const guards = [], spiceRows = [];
  let viol = 0, total = 0, errs = 0;
  await Promise.all(Object.entries(SETS).map(async ([k, s]) => {
    all[k] = [];
    for (let i = 0; i < N; i++) {
      const r = await call(s);
      if (r.err) { errs++; console.log(`  [${k}] 에러 ${r.err}`); continue; }
      if (r.guard) guards.push(`${k}:${r.guard}`);
      for (const x of r.recipes) {
        total++;
        all[k].push(x);
        const ings = x.ingredients || [];
        // "굴소스 대신 간장" 처럼 빼라는 문맥은 위반이 아니다(서버 판정과 같은 기준)
        const head = (s.noName ? ings.join(' | ') : [x.name, ...ings].join(' | ')).replace(/[가-힣A-Za-z]+\s?(대신|없이|없는|빼고)/g, ' ');
        const steps = (x.steps || []).join(' ').replace(/[가-힣A-Za-z]+\s?(대신|없이|없는|빼고)/g, ' ');
        const bad = head.match(s.forbid)?.[0] || steps.match(s.stepsForbid || s.forbid)?.[0];
        if (bad) { viol++; console.log(`  ✗ [${k}] ${x.name} — "${bad}"  재료: ${ings.join(', ')}`); }
        if (s.spice) spiceRows.push(`  [${k}] ${x.name}: 고춧가루 ${amount(ings, /고춧가루/)}작은술 · 고추장 ${amount(ings, /고추장/)}작은술`);
      }
    }
  }));
  for (const [k, xs] of Object.entries(all)) console.log(`  ${k}: ${xs.map(x => x.name).join(', ')}`);
  console.log(spiceRows.sort().join('\n'));
  console.log('  최종검사 개입: ' + (guards.join(', ') || '없음'));
  fs.writeFileSync(path.join(OUT, `allergy_${label}.json`), JSON.stringify(all, null, 2));
  console.log(`■ [${label}] 알레르기 위반 ${viol}/${total} · 에러 ${errs}`);
})();
