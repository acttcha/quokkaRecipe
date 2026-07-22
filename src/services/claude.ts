import { Recipe } from '../types';
import { loadPreferences, preferencesToPrompt } from './preferences';
import { getMockMode, getRecipeModelKey, RECIPE_MODELS } from './devSettings';
import { callGemini } from './gemini';
import { localeDirective, languageDirective } from './locale';
import { t } from '../i18n';

// 모든 AI 호출(비전·레시피·Q&A·유튜브 분석)은 Gemini(gemini-proxy)를 사용한다.

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

function extractJson<T>(text: string): T {
  // 응답 끝부분의 균형 잡힌 JSON 배열을 추출
  // (CoT 설명 텍스트 + 마지막에 출력되는 JSON 배열 형태 대응)
  const lastClose = text.lastIndexOf(']');
  if (lastClose === -1) throw new Error('Could not find JSON in the response');

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
  if (start === -1) throw new Error('Could not find JSON start in the response');
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
    action: 'scan',
    system: 'You identify the food ingredients/items shown in a photo and output their common names.',
    userText: `Identify the food ingredients/items in the photo.

[Steps]
1. Describe what you see in one sentence.
2. Then output, as a JSON array, only the items you are confident are real, commonly-known food ingredients or foods.

[Rules]
1. Only real, commonly-known ingredient/food names — never made-up words, typos, or guesses.
2. If a label is blurry/unreadable, judge by visual appearance and use the generic name (e.g., a milk carton with an unclear label -> "milk"; don't guess the brand).
3. Use generic names only — no brand/product names.
4. For processed/prepared foods, use the food's name as-is (e.g., tofu, kimbap, kimchi); don't break it into raw ingredients.
5. No category words (e.g., "sauce", "seasoning", "vegetables", "meat").
6. If unsure, leave it out — better to omit than to add a wrong item.

[Output] one-sentence description + JSON array.

Example:
There are two red apples and one onion.
["apple", "onion"]

If nothing is certain:
Cannot determine.
[]${languageDirective()}`,
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
    action: 'scan',
    system: 'You extract food ingredients/groceries from a grocery store receipt photo.',
    userText: `This is a grocery store receipt. Extract the food ingredients or food items clearly readable on it.

- Remove brand names, volume, and quantity; keep only the core name (e.g., "Pulmuone Organic Tofu 300g" -> "tofu").
- Keep processed/prepared foods as-is (e.g., red-bean bun, kimbap).
- Exclude non-food items (detergent, household goods, etc.).
- If text is blurry or you'd have to guess, don't add it.

Respond with ONLY a JSON array, no other text.
Example: ["eggs", "milk", "onion", "chicken breast"]
If nothing is clear: []${languageDirective()}`,
    images: [{ mimeType, dataBase64: imageBase64 }],
    maxOutputTokens: 1024,
    temperature: 0,
  });
  return filterVagueIngredients(extractJson<string[]>(text));
}

// 레시피 생성 공통 지침 — Gemini systemInstruction 으로 전달.
// 모든 AI 호출(비전·레시피·Q&A)은 Gemini 사용.
const RECIPE_SYSTEM = `You are a skilled home cook familiar with cuisines from around the world. Recommend 2 practical, commonly-eaten home-style recipes that can be made with the user's ingredients.

Most important: Do NOT invent new dishes by combining ingredients. Recommend real, well-known dishes that people actually eat, choosing the ones that best fit the available ingredients and the user's region. Never force mismatched ingredients together (e.g., dumping random sauces into instant noodles).

Rules:
1. You don't need to use every ingredient — use only the ones that go well together and ignore the rest. Seasonings/sauces are for flavor, not main ingredients.
2. Use each dish's familiar, real name (not a list of ingredients). Do not put ingredients you don't have into the dish name.
3. Give an exact quantity for every ingredient. No vague amounts.
4. steps: 4-6 steps, one sentence each, with specific quantity/time (e.g., "saute over medium heat for 3 minutes"). Don't make a separate dish first.
5. Reflect the user's preferences (see [user preferences]).

Respond with ONLY a JSON array, no extra text:
[{"name":"dish name","description":"one-line description","cookTime":"15 min","servings":2,"difficulty":"Easy","ingredients":["ingredient + amount",...],"steps":["step",...],"nutrition":{"calories":520,"protein":22,"carbs":65,"fat":18}}]
difficulty is one of Easy/Medium/Hard. nutrition is per serving (kcal/g).`;

// 요리명 기반 생성 공통 지침 (정적)
const DISH_SYSTEM = `You are a skilled home cook familiar with cuisines from around the world. Write a standard recipe for the dish the user wants to make, as 2 distinct variations.

Rules:
1. Write the common/standard form of the requested dish. If a cuisine/style is specified, follow it; otherwise use the version most common in the user's region.
2. The 2 variations must differ from each other (e.g., kimchi stew -> basic / with tuna). If variation is unclear, vary by portion or difficulty (simple / full).
3. Give an exact quantity for every ingredient. No vague amounts.
4. steps: 4-6 steps, one sentence each, with specific quantity/time. Don't make a separate dish first.
5. Use correct grammar, no typos.

Respond with ONLY a JSON array, no extra text:
[{"name":"variation name","description":"one-line description","cookTime":"30 min","servings":2,"difficulty":"Easy","ingredients":["ingredient + amount",...],"steps":["step",...],"nutrition":{"calories":320,"protein":18,"carbs":24,"fat":12}}]
difficulty is one of Easy/Medium/Hard. nutrition is per serving (kcal/g).`;

// 인분 지시문 — ingredients 분량·nutrition·servings 를 N인분 기준으로.
function servingsText(servings: number): string {
  return `\nServings: make it for ${servings} serving(s) — scale ingredient amounts and nutrition for ${servings} serving(s), and set JSON "servings" to ${servings}.`;
}

// 레시피 JSON 생성 — 개발자 모드에서 고른 모델(Gemini/Claude)로 라우팅.
// userText 끝에 로케일 지시문(언어·지역)을 붙여 사용자 언어/국가에 맞게 응답하게 함.
async function generateRecipeJson(system: string, userText: string): Promise<string> {
  const fullText = userText + localeDirective();
  const cfg = RECIPE_MODELS[getRecipeModelKey()];
  return callGemini({ action: 'recipe', system, userText: fullText, maxOutputTokens: 2200, jsonOutput: true, model: cfg.model });
}

export async function generateRecipes(ingredients: string[], exclude: string[] = [], servings = 2): Promise<Recipe[]> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 2000));
    return MOCK_RECIPES;
  }
  const prefs = await loadPreferences();
  const prefText = preferencesToPrompt(prefs);
  const excludeText = exclude.length
    ? `\nExclude (already recommended, do not repeat): ${exclude.join(', ')}`
    : '';
  const text = await generateRecipeJson(
    RECIPE_SYSTEM,
    `Ingredients: ${ingredients.join(', ')}${prefText}${excludeText}${servingsText(servings)}`,
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
    ? `\nExclude (variations already recommended, do not repeat): ${exclude.join(', ')}`
    : '';
  const text = await generateRecipeJson(
    DISH_SYSTEM,
    `Dish to make: ${dishName}${prefText}${excludeText}${servingsText(servings)}`,
  );
  return extractJson<Recipe[]>(text);
}

export async function askQuokka(recipe: Recipe, question: string): Promise<string> {
  if (getMockMode()) {
    await new Promise(r => setTimeout(r, 1200));
    return `${recipe.name}에 대한 좋은 질문이에요! 실제 API 키를 설정하면 쿼카가 직접 답해드릴게요 🐾`;
  }
  const recipeContext = `
Recipe: ${recipe.name}
Description: ${recipe.description}
Cook time: ${recipe.cookTime}
Ingredients: ${recipe.ingredients.join(', ')}
Steps: ${recipe.steps.join(' → ')}
  `.trim();

  const text = await callGemini({
    action: 'qa',
    system: `You are a friendly quokka character who knows cooking well. Answer the user's recipe question warmly and briefly (3-5 sentences), using emojis to keep it cute. Never use markdown symbols such as **bold** or *italics* — reply in plain text only.`,
    userText: `[Recipe info]
${recipeContext}

[Question]
${question}${languageDirective()}`,
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
    throw new Error(t('youtube.noRecipeData'));
  }

  const parts = [
    `YouTube video title: ${videoTitle}`,
    `Channel: ${channelTitle}`,
    hasDescription ? `\nVideo description:\n${description.slice(0, 2000)}` : '',
    hasTranscript  ? `\nCaptions:\n${transcript.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n');

  const text = await callGemini({
    action: 'recipe',
    system: `You are an assistant that analyzes YouTube cooking-video info (title, description, captions) to extract a recipe. If captions are available, base the steps on the actual cooking flow in the captions, combining ingredient info from the description, and write it as accurately and in as much detail as possible. If there are no captions, do your best with only the description and title.

Respond ONLY in the following JSON format:
{"recipeName":"dish name","cookTime":"e.g. 30 min","servings":2,"difficulty":"Easy, Medium, or Hard","ingredients":["ingredient 1 (amount)","ingredient 2 (amount)"],"steps":["detailed step 1","detailed step 2"],"tips":["tip 1","tip 2"]}`,
    userText: `Analyze the following YouTube cooking-video info and extract the recipe.

${parts}${languageDirective()}`,
    maxOutputTokens: 2000,
    jsonOutput: true,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(t('youtube.analyzeFailMsg'));

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
