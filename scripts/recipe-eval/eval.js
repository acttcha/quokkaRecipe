// 레시피 2단계 생성 평가 하네스 (gemini-proxy 를 실제로 호출 — 1회 약 2원, 테스트 지갑이 쌓임).
// 결과·실패 원문은 scripts/recipe-eval/out/ 에 저장된다(.gitignore 처리).
// 사용: [S1MODEL=lite] [S1COUNT=8] [ONLY=A] node eval.js <라벨> [독립횟수/세트=4] [연속횟수=4]
// 지갑은 ID당 하루 5회라 호출마다 새 ID 를 쓴다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const pick = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1].replace(/["\r\s]/g, '');
const URL = pick('EXPO_PUBLIC_SUPABASE_URL');
const KEY = pick('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const label = process.argv[2] || 'run';
const IND = +(process.argv[3] || 4);
const SEQ = +(process.argv[4] || 4);

// forbid: 결과에 나오면 제약 위반(알레르기·식단)
const SETS_ALL = {
  A: { ings: ['두부', '계란', '양파', '김치', '대파'] },
  B: { ings: ['닭가슴살', '양배추', '당근', '마늘'] },
  C: { ings: ['감자', '베이컨', '우유', '양파'] },
  D: { ings: ['두부', '계란', '양파', '김치', '대파'], prefs: { allergies: ['계란'] }, forbid: /계란|달걀|노른자|흰자|에그/ },
  E: { ings: ['감자', '베이컨', '우유', '양파'], prefs: { dietType: '채식 (육류 제외)' }, forbid: /베이컨|햄|고기|소시지/ },
  F: { ings: ['두부', '계란', '우유', '양파', '감자'], prefs: { dietType: '비건 (동물성 식품 모두 제외)' }, forbid: /계란|달걀|우유|치즈|버터|크림|베이컨|고기/ },
};
const ONLY = process.env.ONLY;
const SETS = ONLY ? Object.fromEntries(ONLY.split(',').map(k => [k, SETS_ALL[k]])) : SETS_ALL;
// 기본 양념/조리용 — 이건 목록에 없어도 허용
const SEASON = ['오일','소금','설탕','간장','국간장','진간장','양조간장','식용유','기름','참기름','들기름','올리브','고춧가루','고추장','된장','후추','후춧','마늘','다진마늘','생강','식초','물','밀가루','전분','녹말','맛술','미림','청주','깨','참깨','통깨','올리고당','물엿','꿀','액젓','다시다','육수','멸치육수','치킨스톡','버터','청양고추','홍고추','고추','부침가루','튀김가루','빵가루','케첩','마요네즈','굴소스','카레','파슬리','허브','월계수','쌀','밥','레몬'];

let seq = 0;
const uid = () => `prompt_test_${label}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
const H = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` };

const { legacyBody } = require('./legacy.js');
// 구버전 앱(1.0.5)이 보내는 선호도 문장 형식
const legacyPrefs = p => [
  ...(p?.allergies?.length ? [`🚨 Allergies / cannot eat: ${p.allergies.join(', ')} → NEVER use these ingredients. Do not include them anywhere in ingredients or steps.`] : []),
  ...(p?.dietType ? [`🚨 Diet type: ${p.dietType} → never use ingredients that don't fit this diet.`] : []),
];

async function call(set, recent, exclude) {
  const t0 = Date.now();
  const payload = process.env.LEGACY
    ? { action: 'recipe', userId: uid(), ...legacyBody({ ings: set.ings, prefs: legacyPrefs(set.prefs), exclude, recent }) }
    : { action: 'recipe', userId: uid(),
        recipeInput: { mode: 'ingredients', ingredients: set.ings, prefs: set.prefs, servings: 2, recent, exclude,
          lang: 'Korean (한국어)', region: 'South Korea' } };
  const res = await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  const pathHdr = res.headers.get('x-recipe-path') || '';
  const ms = Date.now() - t0;
  const h = k => +(res.headers.get(k) || 0);
  const names1 = decodeURIComponent(res.headers.get('x-stage1-names') || '');
  let body; try { body = await res.json(); } catch { return { err: 'BAD_JSON', ms }; }
  if (body.error) return { err: String(body.error).slice(0, 60), ms };
  if (body.code === 'BOOT_ERROR') return { err: 'BOOT', ms };
  try {
    const t = (body.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
    const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
    const u = body.usageMetadata || {};
    return { ms, names1, path: pathHdr, recipes: arr.map(r => ({ n: r.name, i: r.ingredients || [], s: r.steps || [] })),
      s1: { in: h('x-stage1-in'), out: h('x-stage1-out') },
      s2: { in: u.promptTokenCount || 0, out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
  } catch {
    fs.writeFileSync(path.join(OUT, `fail_${label}_${seq}.json`), JSON.stringify({ names1, body }, null, 2));
    return { err: 'PARSE_FAIL', ms };
  }
}

const norm = s => s.replace(/\s/g, '');
function offending(ings, recipe) {
  const ok = g => { const x = g.replace(/[0-9./]+.*$/, '').trim() || g;
    return ings.some(h => g.includes(h) || x.includes(h)) || SEASON.some(s => g.includes(s)) ||
      (ings.includes('계란') && /달걀|노른자|흰자/.test(g)) || (ings.includes('대파') && /파/.test(g)); };
  return recipe.i.filter(g => !ok(g));
}

async function pool(tasks, n = 4) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}

(async () => {
  // 워밍업: 배포 직후 차가운 상태에서 동시 요청이 몰리면 BOOT_ERROR 가 난다(코드 무관) → 먼저 데운다.
  for (let i = 0; i < 3; i++) await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H, body: JSON.stringify({ action: '__probe__', userId: 'probe' }) }).catch(() => {});

  const W = 1400 / 1e6;
  const all = [];
  const report = { label, sets: {} };
  for (const [name, set] of Object.entries(SETS)) {
    const ind = await pool(Array.from({ length: IND }, () => () => call(set, [], [])), 4);
    const sq = []; let recent = [];
    for (let k = 0; k < SEQ; k++) {
      const r = await call(set, recent, []);
      sq.push(r);
      if (r.recipes) recent = [...r.recipes.map(x => x.n), ...recent].slice(0, 20);
    }
    const runs = [...ind, ...sq];
    all.push(...runs);
    const bad = []; let halluc = 0, recipes = 0, violations = [];
    runs.forEach(r => (r.recipes || []).forEach(x => {
      recipes++;
      const o = offending(set.ings, x);
      if (o.length) { halluc++; bad.push(x.n + '→' + o.join('/')); }
      if (set.forbid) {
        const hit = [x.n, ...x.i].filter(t => set.forbid.test(t));
        if (hit.length) violations.push(x.n + '→' + hit.join('/'));
      }
    }));
    const indNames = ind.flatMap(r => (r.recipes || []).map(x => norm(x.n)));
    const seqNames = sq.flatMap(r => (r.recipes || []).map(x => norm(x.n)));
    report.sets[name] = {
      ind: ind.map(r => r.err ? 'ERR:' + r.err : r.recipes.map(x => x.n).join(' | ')),
      seq: sq.map(r => r.err ? 'ERR:' + r.err : r.recipes.map(x => x.n).join(' | ')),
      halluc, recipes, bad, violations,
      indUnique: new Set(indNames).size + '/' + indNames.length,
      seqRepeats: seqNames.length - new Set(seqNames).size,
      errors: runs.filter(r => r.err).length,
    };
  }
  const ok = all.filter(r => !r.err);
  const avg = k => ok.reduce((s, r) => s + k(r), 0) / Math.max(ok.length, 1);
  const lite1 = true; // 1단계는 이제 lite 고정
  const c1 = (avg(r => r.s1.in) * (lite1 ? 0.25 : 1.5) + avg(r => r.s1.out) * (lite1 ? 1.5 : 9)) * W;
  const c2 = (avg(r => r.s2.in) * 0.25 + avg(r => r.s2.out) * 1.5) * W;
  const sum = k => Object.values(report.sets).reduce((s, x) => s + (typeof x[k] === 'number' ? x[k] : x[k].length), 0);
  report.summary = {
    calls: all.length, errors: all.length - ok.length,
    stage1Ran: ok.filter(r => r.s1.out > 0).length + '/' + ok.length + ' [' + [...new Set(ok.map(r => r.path))].join(',') + ']',
    halluc: sum('halluc'), recipes: sum('recipes'), seqRepeats: sum('seqRepeats'), violations: sum('violations'),
    cost: { s1: +c1.toFixed(2), s2: +c2.toFixed(2), total: +(c1 + c2).toFixed(2) },
    tokens: { s1in: Math.round(avg(r => r.s1.in)), s1out: Math.round(avg(r => r.s1.out)), s2out: Math.round(avg(r => r.s2.out)) },
    latencyMs: Math.round(avg(r => r.ms)),
  };
  fs.writeFileSync(path.join(OUT, `eval_${label}.json`), JSON.stringify({ report, raw: all }, null, 2));
  for (const [k, v] of Object.entries(report.sets)) {
    const s = SETS[k];
    console.log(`── 세트 ${k} (${s.ings.join(',')})${s.prefs ? ' ' + JSON.stringify(s.prefs) : ''} ──`);
    v.ind.forEach((l, i) => console.log(`  독립${i + 1}: ${l}`));
    v.seq.forEach((l, i) => console.log(`  연속${i + 1}: ${l}`));
    console.log(`  환각 ${v.halluc}/${v.recipes}${v.bad.length ? '  ' + v.bad.join(' ; ') : ''} · 제약위반 ${v.violations.length}${v.violations.length ? ' ' + v.violations.join(' ; ') : ''} · 독립고유 ${v.indUnique} · 연속반복 ${v.seqRepeats} · 에러 ${v.errors}`);
  }
  const s = report.summary;
  console.log(`\n■ [${label}] 환각 ${s.halluc}/${s.recipes} · 제약위반 ${s.violations} · 연속반복 ${s.seqRepeats} · 에러 ${s.errors}/${s.calls} · 1단계 ${s.stage1Ran} · 원가 ${s.cost.total}원 (${s.cost.s1}+${s.cost.s2}) · s1 ${s.tokens.s1in}/${s.tokens.s1out} s2out ${s.tokens.s2out} · ${s.latencyMs}ms`);
})();
