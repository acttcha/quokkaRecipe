import { Recipe } from '../types';
import { loadPreferences, preferencesToPrompt } from './preferences';
import { getMockMode, getRecipeModelKey, RECIPE_MODELS } from './devSettings';
import { callGemini } from './gemini';

// Anthropic API 호출은 Supabase Edge Function (claude-proxy)를 통해 프록시.
// Claude API 키는 Supabase 서버에만 존재하고, 앱에는 publishable key만 박힘.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const CLAUDE_API_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`;

const MOCK_INGREDIENTS = ['계란', '토마토', '양파', '마늘', '올리브오일'];

const MOCK_RECIPES: Recipe[] = [
  {
    name: '계란 토마토 볶음',
    description: '간단하고 빠르게 만들 수 있는 중식풍 볶음 요리입니다.',
    cookTime: '10분',
    servings: 2,
    difficulty: 'Easy',
    ingredients: ['계란 3개', '토마토 2개', '양파 1/2개', '소금 약간', '설탕 1작은술'],
    steps: ['토마토를 먹기 좋은 크기로 자른다', '계란을 풀어 소금을 넣는다', '팬에 기름을 두르고 계란을 반숙으로 볶는다', '토마토를 넣고 소금, 설탕으로 간한다', '2분 더 볶아 완성한다'],
    nutrition: { calories: 210, protein: 14, carbs: 8, fat: 13 },
  },
  {
    name: '마늘 양파 파스타',
    description: '알리오 올리오 스타일의 간단한 오일 파스타입니다.',
    cookTime: '20분',
    servings: 2,
    difficulty: 'Easy',
    ingredients: ['파스타 200g', '마늘 6쪽', '양파 1개', '올리브오일 4큰술', '파슬리 약간'],
    steps: ['파스타를 삶는다', '팬에 올리브오일을 두르고 마늘을 볶는다', '양파를 추가해 투명해질 때까지 볶는다', '삶은 파스타를 넣고 면수 약간과 함께 버무린다', '파슬리로 마무리한다'],
    nutrition: { calories: 480, protein: 12, carbs: 68, fat: 18 },
  },
  {
    name: '토마토 계란국',
    description: '부드러운 계란과 새콤한 토마토가 어우러진 따뜻한 국입니다.',
    cookTime: '15분',
    servings: 2,
    difficulty: 'Easy',
    ingredients: ['토마토 1개', '계란 2개', '마늘 2쪽', '국간장 1큰술', '물 400ml'],
    steps: ['물을 끓이고 마늘을 넣는다', '토마토를 넣고 5분 끓인다', '계란을 풀어 천천히 넣는다', '국간장으로 간을 맞춘다'],
    nutrition: { calories: 95, protein: 8, carbs: 6, fat: 4 },
  },
];

async function callClaude(body: object): Promise<string> {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status} 오류`);
  }

  const data = await response.json();
  return data.content[0].text as string;
}

function extractJson<T>(text: string): T {
  // 응답 끝부분의 균형 잡힌 JSON 배열을 추출
  // (CoT 설명 텍스트 + 마지막에 출력되는 JSON 배열 형태 대응)
  const lastClose = text.lastIndexOf(']');
  if (lastClose === -1) throw new Error('응답에서 JSON을 찾을 수 없습니다');

  let depth = 0;
  let start = -1;
  for (let i = lastClose; i >= 0; i--) {
    const c = text[i];
    if (c === ']') depth++;
    else if (c === '[') {
      depth--;
      if (depth === 0) { start = i; break; }
    }
  }
  if (start === -1) throw new Error('응답에서 JSON 시작을 찾을 수 없습니다');
  return JSON.parse(text.slice(start, lastClose + 1)) as T;
}

// 모호한 카테고리 표현 필터 — 레시피와 매칭 불가능하므로 제거
const VAGUE_INGREDIENT_TERMS = new Set([
  '소스', '소스류', '양념', '양념류', '조미료', '조미료류',
  '채소', '채소류', '야채', '야채류',
  '고기', '고기류', '육류', '가금류',
  '반찬', '반찬류', '밑반찬', '반찬통',
  '식재료', '식재료류', '재료', '식료품',
  '곡류', '두류', '견과류', '어류', '패류', '어패류', '해조류',
  '과일', '과일류',
  '유제품', '유제품류', '발효식품',
  '기타', '음식', '식품',
]);

function filterVagueIngredients(items: string[]): string[] {
  return items.filter((raw) => {
    if (!raw || typeof raw !== 'string') return false;
    // 괄호 부가 정보 제거하고 본체만 검사
    const core = raw.replace(/\([^)]*\)/g, '').trim();
    if (!core) return false;
    if (VAGUE_INGREDIENT_TERMS.has(core)) return false;
    // "○○류" 형태는 거의 항상 카테고리 표현 → 제외 (단, 짧은 단어는 통과)
    if (core.length >= 3 && core.endsWith('류')) return false;
    return true;
  });
}

export async function identifyIngredients(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string[]> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 1500));
    return MOCK_INGREDIENTS;
  }
  const text = await callGemini({
    system: '사진 속 식재료/음식을 한국어 일반명으로 정확히 식별하는 어시스턴트입니다.',
    userText: `사진의 식재료/음식을 한국어 일반명으로 식별하세요.

[작업 순서]
1. 사진에 보이는 것을 1문장으로 설명.
2. 그중 본인이 **한국에 실재하는 식재료/음식 이름**이라고 확신하는 것만 골라 JSON 배열로 출력.

[필수 규칙]
1. 실재하는 한국 식재료/음식 이름만 — 들어본 적 없는 단어, 오타 같은 단어, 추측해서 만든 단어는 절대 X.
   ❌ "마른 젠선" (가짜), "파이슨 브레톤 우유" (가짜), "조선 사이다" (가짜)
   ✅ "마른 생선", "우유", "사이다"
2. 라벨 글씨가 흐릿하거나 잘 안 읽히면, 글씨에 의존하지 말고 **시각적 외관**으로 판단해서 일반명 사용.
   - 예: 라벨이 불분명한 우유팩 → "우유" (브랜드명 추측 X)
   - 예: 흐릿한 글씨로 "마른생선" 같이 보이면 → "마른 생선" (실재하는 단어로)
3. 일반명만 사용 — 브랜드/제품명 X. (예: "라면", "사이다", "우유" — "신라면", "조선 사이다" X)
4. 가공식품·완성 음식은 음식 이름 그대로 (예: 단팥빵, 김밥, 두부, 김치).
   원재료로 분해 X — 단팥빵을 "빵+팥"으로 쪼개지 마세요.
5. 카테고리 표현 X — "소스", "양념", "채소", "고기", "○○류" 전부 금지.
6. 모호하거나 확신 없으면 빼세요. 추가하느니 빼는 게 낫습니다.

[출력 형식]
1줄 설명 + JSON 배열.

예시 1:
사진에 빨간 사과 두 개와 양파 한 개가 있다.
["사과", "양파"]

예시 2:
사진에 우유팩과 단팥빵 하나가 있다.
["우유", "단팥빵"]

확실한 것이 없으면:
판단 불가.
[]`,
    images: [{ mimeType, dataBase64: imageBase64 }],
    maxOutputTokens: 512,
    temperature: 0,
  });
  return filterVagueIngredients(extractJson<string[]>(text));
}

export async function identifyReceiptItems(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string[]> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 1500));
    return ['계란', '우유', '버터', '양파', '당근', '닭가슴살', '브로콜리', '두부', '마늘', '파프리카'];
  }
  const text = await callGemini({
    system: '한국 마트/슈퍼마켓 영수증에서 식재료·식품을 정확히 추출하는 어시스턴트입니다.',
    userText: `한국 마트/슈퍼마켓 영수증입니다. 영수증에서 또렷이 읽히는 식재료 또는 식품을 한국어로 추출하세요.

- 브랜드명·용량·수량은 제거하고 핵심 이름만 (예: "풀무원 국산콩두부 300g" → "두부")
- 가공식품/완성식품이면 그대로 (예: 단팥빵, 김밥)
- 세제·생활용품 등 식품 아닌 건 제외
- 글자가 흐릿하거나 추측해야 하면 추가하지 마세요

JSON 배열로만 응답. 다른 텍스트 X.
예: ["계란", "우유", "양파", "닭가슴살"]
아무것도 명확하지 않으면: []`,
    images: [{ mimeType, dataBase64: imageBase64 }],
    maxOutputTokens: 1024,
    temperature: 0,
  });
  return filterVagueIngredients(extractJson<string[]>(text));
}

// 레시피 생성 공통 지침 — Gemini systemInstruction 으로 전달.
// 레시피 생성/요리명 생성은 Gemini 2.5 Flash 사용(상식·비용 우위). 비전/Q&A 는 아직 Claude.
const RECIPE_SYSTEM = `당신은 한국 가정식에 능숙한 요리사입니다. 사용자의 보유 재료로 만들 수 있는, 실제로 흔히 먹는 레시피 2가지를 추천합니다.

가장 중요: 재료를 조합해 새로운 요리를 창작하지 마세요. 실제로 존재하고 사람들이 자주 먹는 보편적인 요리(예: 김치볶음밥, 된장찌개, 제육볶음, 계란말이, 비빔밥, 잔치국수, 오므라이스, 김치찌개) 중에서 보유 재료로 만들 수 있는 것을 고르세요. 재료를 억지로 엮은 괴상한 요리(예: 초고추장 라면, 매실 볶음밥) 절대 금지.

규칙:
1. 보유 재료를 다 쓸 필요 없음 — 한 요리에 어울리는 재료만 쓰고 나머지는 무시. 양념·소스(간장·초고추장·매실청·쌈장 등)는 간 맞추는 용도일 뿐 주재료가 아님.
2. 이름은 그 요리의 익숙한 실제 이름으로(재료 나열식 금지). 갖지 않은 재료·소스를 이름에 넣지 말 것(김치 없이 "김치찌개" X).
3. 모든 재료에 분량 표기(예: 간장 1큰술, 마늘 3쪽). "적당량·약간" 금지.
4. steps 4~6단계, 각 단계 한 문장, 시간·분량 구체적으로(예: "중불에서 3분"). 한 요리를 위해 다른 요리를 먼저 만들지 말 것.
5. 정확한 한국어만, 사용자 선호([사용자 선호도]) 반영.

설명·머리말 없이 아래 JSON 배열로만 응답:
[{"name":"요리명","description":"한 줄 설명","cookTime":"15분","servings":2,"difficulty":"Easy","ingredients":["재료 분량",...],"steps":["단계",...],"nutrition":{"calories":520,"protein":22,"carbs":65,"fat":18}}]
difficulty는 Easy·Medium·Hard 중 하나, nutrition은 1인분 kcal/g.`;

// 요리명 기반 생성 공통 지침 (정적)
const DISH_SYSTEM = `당신은 한식·양식·중식·일식·동남아 등 다양한 요리에 능숙한 가정식 요리사입니다. 사용자가 만들고 싶다고 한 요리의 표준 레시피를 서로 다른 변형 2가지로 간결하게 작성합니다.

[필수 규칙]
1. 요청 요리의 보편적·표준 형태로 작성. 스타일(한/중/일/양식) 명시 시 그대로, 모호하면 한국 가정식 기준.
2. 변형 2가지는 서로 달라야 함(예: 김치찌개 → 기본/참치). 변형이 애매하면 분량·난이도 변형(간단/정식).
3. 분량 필수: 모든 재료에 정확한 분량. "적당량·약간·조금" 금지.
4. steps: 4~6단계, 각 단계 한 문장. 재료·분량·시간 구체적으로. 모호한 표현 금지.
5. 한 요리를 위해 다른 요리를 먼저 만들지 말 것. 정확한 한국어만, 오타·영어 혼용 금지.

[출력] 설명·머리말 없이 아래 JSON 배열로만 응답:
[{"name":"변형 이름","description":"한 줄 설명","cookTime":"30분","servings":2,"difficulty":"Easy","ingredients":["재료 분량",...],"steps":["단계",...],"nutrition":{"calories":320,"protein":18,"carbs":24,"fat":12}}]
difficulty는 Easy·Medium·Hard 중 하나, nutrition은 1인분 kcal/g.`;

// 인분 지시문 — ingredients 분량·nutrition·servings 를 N인분 기준으로.
function servingsText(servings: number): string {
  return `\n인분: ${servings}인분 — ingredients 분량과 nutrition을 ${servings}인분 기준으로 맞추고, JSON의 servings도 ${servings}로 하세요.`;
}

// 레시피 JSON 생성 — 개발자 모드에서 고른 모델(Gemini/Claude)로 라우팅.
async function generateRecipeJson(system: string, userText: string): Promise<string> {
  const cfg = RECIPE_MODELS[getRecipeModelKey()];
  if (cfg.provider === 'gemini') {
    return callGemini({ system, userText, maxOutputTokens: 2200, jsonOutput: true, model: cfg.model });
  }
  return callClaude({
    model: cfg.model,
    max_tokens: 2200,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: userText }],
  });
}

export async function generateRecipes(ingredients: string[], exclude: string[] = [], servings = 2): Promise<Recipe[]> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const excludeText = exclude.length
    ? `\n제외(이미 추천함, 겹치지 말 것): ${exclude.join(', ')}`
    : '';
  const text = await generateRecipeJson(
    RECIPE_SYSTEM,
    `재료: ${ingredients.join(', ')}${prefText}${excludeText}${servingsText(servings)}`,
  );
  return extractJson<Recipe[]>(text);
}

/**
 * 특정 요리 이름으로 레시피 생성 (재료 기반이 아닌, 요리 이름 기반)
 * - 사용자가 만들고 싶은 요리를 입력 → 표준 레시피 1~3가지 변형 반환
 */
export async function generateRecipeByName(dishName: string, exclude: string[] = [], servings = 2): Promise<Recipe[]> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const excludeText = exclude.length
    ? `\n제외(이미 추천한 변형, 겹치지 말 것): ${exclude.join(', ')}`
    : '';
  const text = await generateRecipeJson(
    DISH_SYSTEM,
    `만들고 싶은 요리: ${dishName}${prefText}${excludeText}${servingsText(servings)}`,
  );
  return extractJson<Recipe[]>(text);
}

export async function askQuokka(recipe: Recipe, question: string): Promise<string> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 1200));
    return `${recipe.name}에 대한 좋은 질문이에요! 실제 API 키를 설정하면 쿼카가 직접 답해드릴게요 🐾`;
  }
  const recipeContext = `
레시피명: ${recipe.name}
설명: ${recipe.description}
조리시간: ${recipe.cookTime}
재료: ${recipe.ingredients.join(', ')}
조리법: ${recipe.steps.join(' → ')}
  `.trim();

  const text = await callGemini({
    system: `당신은 요리를 잘 아는 친근한 쿼카 캐릭터입니다. 사용자의 레시피 질문에 친근하고 짧게(3-5문장) 한국어로 답하고, 이모지를 적절히 사용해 귀엽게 답변하세요. 절대로 **굵은 글씨**, *기울임* 등 마크다운 기호를 쓰지 말고 일반 텍스트로만 답하세요.`,
    userText: `[레시피 정보]
${recipeContext}

[질문]
${question}`,
    maxOutputTokens: 600,
  });
  return text.trim();
}

// ─── 유튜브 영상 분석 ──────────────────────────────────────────

export interface YoutubeRecipeAnalysis {
  recipeName: string;
  cookTime: string;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ingredients: string[];
  steps: string[];
  tips: string[];
}

export async function analyzeYoutubeRecipe(
  videoTitle: string,
  channelTitle: string,
  description: string,
  transcript: string,
): Promise<YoutubeRecipeAnalysis> {
  const hasDescription = description.trim().length >= 80;
  const hasTranscript  = transcript.trim().length >= 80;

  if (!hasDescription && !hasTranscript) {
    throw new Error(
      '영상의 자막 및 설명 데이터가 제공되지 않아 조리 방법을 특정하기 어렵습니다.\n다른 영상을 선택해주세요.'
    );
  }

  const parts = [
    `유튜브 영상 제목: ${videoTitle}`,
    `채널명: ${channelTitle}`,
    hasDescription ? `\n영상 설명:\n${description.slice(0, 2000)}` : '',
    hasTranscript  ? `\n자막 내용:\n${transcript.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n');

  const text = await callGemini({
    system: `유튜브 요리 영상 정보(제목·설명·자막)를 분석해 레시피를 추출하는 어시스턴트입니다. 자막이 있으면 자막의 실제 조리 흐름을 중심으로, 영상 설명의 재료 정보를 함께 활용해 최대한 정확하고 상세하게 작성하세요. 자막이 없으면 설명과 제목만으로 최선을 다해 추출하세요.

반드시 다음 JSON 형식으로만 응답:
{"recipeName":"요리 이름","cookTime":"예: 30분","servings":2,"difficulty":"Easy 또는 Medium 또는 Hard","ingredients":["재료1 (양)","재료2 (양)"],"steps":["1단계 상세 설명","2단계 상세 설명"],"tips":["팁1","팁2"]}`,
    userText: `다음 유튜브 요리 영상 정보를 분석해서 레시피를 추출해주세요.

${parts}`,
    maxOutputTokens: 2000,
    jsonOutput: true,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('레시피 분석에 실패했어요');

  const p = JSON.parse(jsonMatch[0]);
  return {
    recipeName: p.recipeName || videoTitle,
    cookTime: p.cookTime || '?분',
    servings: typeof p.servings === 'number' ? p.servings : 2,
    difficulty: ['Easy', 'Medium', 'Hard'].includes(p.difficulty) ? p.difficulty : 'Medium',
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
    steps: Array.isArray(p.steps) ? p.steps : [],
    tips: Array.isArray(p.tips) ? p.tips : [],
  };
}
