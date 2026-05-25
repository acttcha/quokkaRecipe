import { Recipe } from '../types';
import { loadPreferences, preferencesToPrompt } from './preferences';

// Anthropic API 호출은 Supabase Edge Function (claude-proxy)를 통해 프록시.
// Claude API 키는 Supabase 서버에만 존재하고, 앱에는 publishable key만 박힘.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const CLAUDE_API_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`;

const MODEL = 'claude-sonnet-4-6';
const MODEL_LIGHT = 'claude-haiku-4-5-20251001';
// 비용 절감 트라이얼 — 레시피/유튜브 분석을 Haiku로. 품질 이슈 시 각각 MODEL로 되돌리기
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
          text: `이 이미지에서 보이는 모든 식재료를 식별해주세요.
한국어로 된 재료 이름만 JSON 배열로 반환하세요. 다른 텍스트는 포함하지 마세요.
예시: ["토마토", "양파", "마늘", "계란"]
식재료가 없으면: []`,
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
          text: `이것은 마트/슈퍼마켓 영수증 사진입니다. 영수증에서 식재료/식품 항목만 추출해주세요.
한국어로 된 식재료 이름만 JSON 배열로 반환하세요. 다른 텍스트는 포함하지 마세요.
- 세제·생활용품 등 식재료가 아닌 항목은 제외하세요
- 브랜드명·용량·수량은 제거하고 핵심 재료명만 추출하세요 (예: "풀무원 국산콩두부 300g" → "두부")
예시: ["계란", "우유", "양파", "닭가슴살"]
식재료가 없으면: []`,
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
      content: `다음 재료들로 만들 수 있는 레시피 3가지를 추천해주세요.
재료: ${ingredients.join(', ')}${prefText}

[작성 규칙 — 반드시 지킬 것]

1. ingredients는 모든 항목에 구체적인 분량을 적습니다. 한국 가정에서 흔히 쓰는 단위(큰술/작은술/컵/개/대/쪽/g)를 사용하세요.
   - 좋은 예: "돼지고기 앞다리살 200g", "대파 1대(약 50g)", "간장 2큰술", "마늘 3쪽", "물 400ml"
   - 나쁜 예: "고기 적당량", "양념 약간", "대파 조금", "마늘 적당히"

2. steps는 각 단계에서 어떤 재료를 얼마나 쓰는지 분량까지 명시합니다. 초보자도 따라할 수 있어야 합니다.
   - 좋은 예: "달군 팬에 식용유 2큰술을 두르고 다진 마늘 1큰술을 30초간 볶는다"
   - 나쁜 예: "마늘을 볶는다", "양념해서 볶는다"

3. 시간/온도/불세기가 있는 단계는 구체적으로 적습니다. (예: "중불에서 5분", "200℃ 오븐에서 15분", "약불로 줄여 10분 끓인다")

4. steps는 5~8단계로 충분히 구체적으로. 너무 짧게 줄여서 모호하게 만들지 마세요.

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
