// 1단계 후보와 페르소나 적합도(f)를 그대로 보여준다 — 페르소나가 왜 안 먹히는지 진단용.
// 사용: node scripts/recipe-eval/stage1.js <페르소나id> [횟수=3]
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const pick = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1].replace(/["\r\s]/g, '');
const URL = pick('EXPO_PUBLIC_SUPABASE_URL');
const KEY = pick('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const H = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` };
const { legacyBody } = require('./legacy.js');

const id = process.argv[2] || 'dessert';
const N = +(process.argv[3] || 3);
const src = fs.readFileSync(path.join(ROOT, 'src/services/personas.ts'), 'utf8');
const m = [...src.matchAll(/id: '(\w+)'[\s\S]*?prompt: '((?:[^'\\]|\\.)*)'/g)].find(x => x[1] === id);
const persona = m ? m[2] : '';
const SETS = {
  P1: ['닭가슴살', '계란', '두부', '양파', '감자', '밥', '우유', '애호박', '버섯'],
  P2: ['돼지고기', '김치', '고구마', '당근', '대파', '버터', '바나나', '우유'],
};

(async () => {
  console.log(`페르소나 ${id}: ${persona}\n`);
  for (const [k, ings] of Object.entries(SETS)) for (let i = 0; i < N; i++) {
    const res = await fetch(`${URL}/functions/v1/gemini-proxy`, { method: 'POST', headers: H,
      body: JSON.stringify({ action: 'recipe', userId: `prompt_test_s1_${Date.now()}_${i}`, ...legacyBody({ ings, persona }) }) });
    await res.text();
    console.log(`[${k}] 후보: ${decodeURIComponent(res.headers.get('x-stage1-cands') || '(없음)')}`);
    console.log(`      선택: ${decodeURIComponent(res.headers.get('x-stage1-names') || '(없음)')}`);
  }
})();
