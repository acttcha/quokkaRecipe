import { Recipe } from '../types';
import { loadPreferences, preferencesToPrompt } from './preferences';

// Anthropic API 호출은 Supabase Edge Function (claude-proxy)를 통해 프록시.
// Claude API 키는 Supabase 서버에만 존재하고, 앱에는 publishable key만 박힘.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const CLAUDE_API_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`;

const MODEL = 'claude-sonnet-4-6';
const MODEL_LIGHT = 'claude-haiku-4-5-20251001';
// 비용 절감 — Haiku 사용. 프롬프트로 품질 보강 시도.
const MODEL_RECIPE = MODEL_LIGHT;
const MODEL_YOUTUBE = MODEL_LIGHT;

// true: 테스트 모드 (API 키 없이 목 데이터 사용), false: 실제 API 호출
export const MOCK_MODE = false;

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
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('응답에서 JSON을 찾을 수 없습니다');
  return JSON.parse(match[0]) as T;
}

export async function identifyIngredients(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    return MOCK_INGREDIENTS;
  }
  const text = await callClaude({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        {
          type: 'text',
          text: `이 이미지에서 식별 가능한 구체적인 식재료만 추출하세요.

[규칙]
1. **확실히 보이는 것만 추가하세요.** 애매하거나 가려져있어 추측해야 하면 추가하지 마세요.
2. **구체적인 재료명만.** "소스류", "양념류", "고기류" 같은 카테고리 표현 금지.
   - ❌ 금지: "소스", "양념", "고기", "채소", "조미료", "기타"
   - ✅ 가능: "간장", "고추장", "돼지고기", "양배추"
3. **용기 안 내용물을 추측하지 마세요.** 통/병/봉지 라벨이 안 보이면 추가 X.
   - ❌ 흰 통 보고 "두부일 것 같다" 추측 X
   - ✅ 라벨 또는 내용물이 명확히 보일 때만 추가
4. **종류를 알 수 없으면 일반명으로.** 정확한 부위/품종 모르면 큰 범주로.
   - 잘 모르겠는 고기 → "돼지고기 모름" 식으로 ❌
   - 그냥 추가하지 마세요 (애매한 건 빼는 게 나음)
5. **확실한 재료가 하나도 없으면 빈 배열 반환.** 억지로 추가하지 마세요.

응답은 한국어 재료 이름의 JSON 배열만. 다른 텍스트 X.

예시: ["토마토", "양파", "마늘", "계란"]
하나도 명확하지 않으면: []`,
        },
      ],
    }],
  });
  return extractJson<string[]>(text);
}

export async function identifyReceiptItems(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    return ['계란', '우유', '버터', '양파', '당근', '닭가슴살', '브로콜리', '두부', '마늘', '파프리카'];
  }
  const text = await callClaude({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        {
          type: 'text',
          text: `이것은 마트/슈퍼마켓 영수증 사진입니다. 영수증 텍스트에서 명확히 읽히는 식재료/식품 항목만 추출하세요.

[규칙]
1. **글자가 또렷이 읽히는 항목만 추가.** 흐릿하거나 잘려서 추측해야 하면 추가하지 마세요.
2. **구체적인 재료명만.** "소스류", "양념류", "고기류" 같은 카테고리 표현 금지.
   - ❌ 금지: "소스", "양념", "고기", "채소", "조미료"
   - ✅ 가능: "간장", "고추장", "돼지고기", "양배추"
3. **세제·생활용품 등 식재료 아닌 건 제외.**
4. **브랜드명·용량·수량은 제거**하고 핵심 재료명만:
   - "풀무원 국산콩두부 300g" → "두부"
   - "농심 신라면 5입" → 제외 (가공식품이라 빼는 게 나음, 단순 재료 아님)
   - "한우 등심 200g" → "소고기 등심"
5. **알 수 없는 줄임말은 추가 X.** "스파게티" 같이 명확한 것만, "ㅅㅍㄱㅌ" 같은 줄임은 X.
6. **확실한 재료가 하나도 없으면 빈 배열.** 억지로 추가 X.

응답은 한국어 재료 이름의 JSON 배열만.

예시: ["계란", "우유", "양파", "닭가슴살"]
하나도 명확하지 않으면: []`,
        },
      ],
    }],
  });
  return extractJson<string[]>(text);
}

export async function generateRecipes(ingredients: string[]): Promise<Recipe[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const text = await callClaude({
    model: MODEL_RECIPE,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `당신은 한식·양식·중식·일식·동남아 등 다양한 요리에 능숙한 가정식 요리사입니다. 사용자의 보유 재료와 선호 스타일에 맞춰 실용적인 레시피 3가지를 추천하세요. 재료 구성을 보고 가장 자연스럽게 어울리는 요리 스타일로 만드세요.

재료: ${ingredients.join(', ')}${prefText}

━━━━━━━━━━━━━━━━━━━━━━
🚨 절대 규칙 (위반 시 잘못된 응답)
━━━━━━━━━━━━━━━━━━━━━━

【1】 이름 정직성
요리 이름(name)에 들어간 재료/소스는 반드시 ingredients 배열에 있어야 합니다.
없는 재료의 이름을 붙이는 것은 거짓말입니다.

❌ 거짓 이름 예시 (절대 금지):
  - "짜장 우동" → ingredients 에 춘장/짜장소스 없음
  - "카레 덮밥" → ingredients 에 카레가루 없음
  - "토마토 파스타" → ingredients 에 토마토 없음
  - "김치찌개" → ingredients 에 김치 없음

✅ 정직한 이름 예시:
  - 간장 + 소면 + 양파 → "간장 소면 볶음" (○)
  - 계란 + 토마토 → "토마토 계란 볶음" (○)
  - 김치 + 두부 → "김치 두부 찌개" (○)

판단이 애매하면 무난한 가정식 이름 (○○볶음, ○○찌개, ○○국, ○○덮밥)을 사용하세요.

【2】 표준 조리법 (불필요한 중간 요리 금지)
한 요리를 만들기 위해 다른 요리를 먼저 만들지 마세요. 표준 한국 가정식 조리법만 따르세요.

❌ 절대 하지 말 것:
  - "계란볶음밥" 만들 때 → "먼저 계란말이를 부쳐서 한입 크기로 자른다" (X)
  - "김치찌개" 만들 때 → "먼저 김치전을 부쳐서 잘라 넣는다" (X)
  - "두부조림" 만들 때 → "먼저 두부튀김을 만들어서 양념에 졸인다" (X)

✅ 표준 조리법:
  - "계란볶음밥" → "계란을 풀어 팬에 넣고 휘저어가며 밥과 함께 볶는다"
  - "김치찌개" → "김치를 한입 크기로 썰어 냄비에 넣고 끓인다"
  - "두부조림" → "두부를 도톰하게 썰어 양념장과 함께 졸인다"

재료는 그대로 손질해서 바로 쓰는 게 원칙. 2차 가공 단계를 넣지 마세요.

【3】 분량 표기 의무
ingredients 의 모든 항목에 정확한 분량 명시. "적당량" "약간" "조금" 같은 모호한 표현 금지.

❌ 금지: "고기 적당량", "양념 약간", "마늘 조금"
✅ 필수: "돼지고기 앞다리살 200g", "간장 2큰술", "마늘 3쪽", "물 400ml"

단위는 한국 가정에서 쓰는 것: 큰술, 작은술, 컵, g, ml, 개, 대, 쪽, 묶음 등.

【4】 steps 구체성
각 단계는:
  - 어떤 재료를 얼마나 쓰는지 명시
  - 시간/불세기 명시 (예: "중불에서 5분")
  - 초보자가 따라할 수 있을 정도로 명확

❌ 금지: "마늘을 볶는다", "양념하여 끓인다", "적당히 익힌다"
✅ 필수: "달군 팬에 식용유 2큰술을 두르고 다진 마늘 1큰술을 중불에서 30초간 볶는다"

steps 는 5~8단계. 너무 적으면 모호하고, 너무 많으면 복잡함.

【5】 정확한 한국어
모든 텍스트는 정확한 한국어로 작성. 오타, 영어 혼용 절대 금지.

❌ 금지: "참기rings을 뿌린다", "올리브 oil 두른다", "salt 약간"
✅ 필수: "참기름을 뿌린다", "올리브오일을 두른다", "소금 약간"

━━━━━━━━━━━━━━━━━━━━━━
💡 응답 전 자체 점검
━━━━━━━━━━━━━━━━━━━━━━
응답하기 전에 본인 응답을 점검하세요:

1. 요리 이름의 모든 단어가 ingredients 에 실제로 존재하는가? (없으면 이름 변경)
2. steps 에 "먼저 ○○를 만들어서..." 같은 중간 요리 단계가 있는가? (있으면 제거하고 표준 방법으로)
3. 모든 ingredients 에 분량이 적혀있는가? (없으면 추가)
4. 한국어가 정확하고 오타/영어 혼용 없는가?
5. 사용자 선호도 (위 [사용자 선호도] 섹션)를 다 반영했는가?

━━━━━━━━━━━━━━━━━━━━━━

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "name": "돼지고기 김치볶음밥",
    "description": "남은 김치와 돼지고기로 빠르게 만드는 든든한 한끼.",
    "cookTime": "15분",
    "servings": 2,
    "difficulty": "Easy",
    "ingredients": [
      "찬밥 2공기 (약 400g)",
      "돼지고기 앞다리살 150g",
      "신김치 1컵 (약 200g)",
      "대파 1대",
      "간장 1큰술",
      "참기름 1작은술",
      "식용유 2큰술"
    ],
    "steps": [
      "돼지고기는 한입 크기로 썰고, 신김치는 잘게 다지고, 대파는 송송 썬다.",
      "달군 팬에 식용유 2큰술을 두르고 돼지고기를 중불에서 3분간 노릇하게 볶는다.",
      "다진 김치와 간장 1큰술을 넣고 김치가 부드러워질 때까지 2분간 더 볶는다.",
      "찬밥 2공기를 넣고 김치 양념이 골고루 배도록 3분간 볶는다.",
      "불을 끄고 참기름 1작은술과 송송 썬 대파를 올려 마무리한다."
    ],
    "nutrition": { "calories": 520, "protein": 22, "carbs": 65, "fat": 18 }
  }
]

difficulty는 반드시 "Easy", "Medium", "Hard" 중 하나입니다.
nutrition은 1인분 기준 kcal/g 단위입니다.`,
    }],
  });
  return extractJson<Recipe[]>(text);
}

/**
 * 특정 요리 이름으로 레시피 생성 (재료 기반이 아닌, 요리 이름 기반)
 * - 사용자가 만들고 싶은 요리를 입력 → 표준 레시피 1~3가지 변형 반환
 */
export async function generateRecipeByName(dishName: string): Promise<Recipe[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const text = await callClaude({
    model: MODEL_RECIPE,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `당신은 한식·양식·중식·일식·동남아 등 다양한 요리에 능숙한 가정식 요리사입니다. 사용자가 만들고 싶다고 한 요리의 표준 레시피를 작성하세요.

사용자가 만들고 싶은 요리: ${dishName}${prefText}

━━━━━━━━━━━━━━━━━━━━━━
🚨 절대 규칙
━━━━━━━━━━━━━━━━━━━━━━

【1】 요리 이름의 표준 해석
"${dishName}" 의 일반적이고 표준적인 형태로 레시피를 작성하세요.
사용자가 한국식/중식/일식/양식 등을 명시했으면 그 스타일로.
모호하면 가장 보편적인 한국 가정 버전으로.

【2】 3가지 변형 제공
같은 요리의 서로 다른 변형/응용 3가지를 제시하세요.
예: "김치찌개" → ["기본 김치찌개", "참치 김치찌개", "돼지고기 김치찌개"]
예: "파스타" → ["크림 새우 파스타", "토마토 미트볼 파스타", "알리오 올리오"]
예: "오믈렛" → ["기본 오믈렛", "치즈 햄 오믈렛", "야채 오믈렛"]
변형이 명확하지 않은 요리면 분량/난이도 변형으로 (1인분/2인분, 간단/정식).

【3】 분량 표기 의무
ingredients 의 모든 항목에 정확한 분량 명시.
❌ 금지: "적당량", "약간", "조금"
✅ 필수: "돼지고기 200g", "간장 2큰술", "마늘 3쪽"

【4】 steps 구체성
각 단계에 분량, 시간, 불세기 명시. 5~8단계.
❌ 금지: "마늘을 볶는다", "양념해서 끓인다"
✅ 필수: "달군 팬에 식용유 2큰술을 두르고 다진 마늘 1큰술을 중불에서 30초간 볶는다"

【5】 표준 조리법 (불필요한 중간 요리 금지)
한 요리 만드는데 다른 요리 먼저 만들지 마세요.
❌ "계란볶음밥" 만들 때 계란말이 부쳐서 자르기
✅ 계란을 풀어 직접 스크램블

【6】 정확한 한국어
오타, 영어 혼용 금지.
❌ "참기rings", "올리브 oil"
✅ "참기름", "올리브오일"

━━━━━━━━━━━━━━━━━━━━━━

응답은 JSON 배열로만. 다른 텍스트 X.
[
  {
    "name": "${dishName} (변형 이름)",
    "description": "1-2문장 설명",
    "cookTime": "30분",
    "servings": 2,
    "difficulty": "Easy",
    "ingredients": ["재료 1 분량", "재료 2 분량", ...],
    "steps": ["1단계 상세", "2단계 상세", ...],
    "nutrition": { "calories": 320, "protein": 18, "carbs": 24, "fat": 12 }
  }
]

difficulty는 "Easy", "Medium", "Hard" 중 하나.
nutrition은 1인분 기준 kcal/g.`,
    }],
  });
  return extractJson<Recipe[]>(text);
}

export async function askQuokka(recipe: Recipe, question: string): Promise<string> {
  if (MOCK_MODE) {
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

  const text = await callClaude({
    model: MODEL_LIGHT,
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `당신은 요리를 잘 아는 친근한 쿼카 캐릭터입니다. 아래 레시피에 대해 사용자가 질문했습니다.
친근하고 짧게 (3-5문장) 한국어로 답해주세요. 이모지를 적절히 사용해 귀엽게 답변해주세요.
절대로 **굵은 글씨**, *기울임*, 마크다운 기호를 사용하지 마세요. 일반 텍스트로만 답해주세요.

[레시피 정보]
${recipeContext}

[질문]
${question}`,
    }],
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

  const text = await callClaude({
    model: MODEL_YOUTUBE,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `다음 유튜브 요리 영상 정보를 분석해서 레시피를 추출해주세요.

${parts}

자막이 있다면 자막의 실제 조리 흐름을 중심으로, 영상 설명의 재료 정보를 함께 활용해서 최대한 정확하고 상세하게 작성해주세요. 자막이 없다면 영상 설명과 제목만으로 최선을 다해 추출해주세요.

반드시 다음 JSON 형식으로만 응답하세요 (JSON 이외의 텍스트 없이):
{
  "recipeName": "요리 이름",
  "cookTime": "예: 30분",
  "servings": 2,
  "difficulty": "Easy 또는 Medium 또는 Hard",
  "ingredients": ["재료1 (양)", "재료2 (양)"],
  "steps": ["1단계 상세 설명", "2단계 상세 설명"],
  "tips": ["팁1", "팁2"]
}`,
    }],
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
