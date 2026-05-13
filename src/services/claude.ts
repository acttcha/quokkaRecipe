import { Recipe } from '../types';
import { loadPreferences, preferencesToPrompt } from './preferences';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MODEL_LIGHT = 'claude-haiku-4-5-20251001';
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? '';

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
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
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

export async function generateRecipes(ingredients: string[]): Promise<Recipe[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const text = await callClaude({
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `다음 재료들로 만들 수 있는 레시피 3가지를 추천해주세요.
재료: ${ingredients.join(', ')}${prefText}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "name": "요리 이름",
    "description": "요리 설명 (1-2문장)",
    "cookTime": "30분",
    "servings": 2,
    "difficulty": "Easy",
    "ingredients": ["재료1 100g", "재료2 2개"],
    "steps": ["1단계", "2단계", "3단계"],
    "nutrition": { "calories": 320, "protein": 18, "carbs": 24, "fat": 12 }
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
