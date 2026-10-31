// 레시피 프롬프트는 서버에서 조립한다.
// 앱에 하드코딩돼 있으면 한 줄 고치는 데도 빌드+심사가 필요해서 튜닝이 사실상 불가능했다.
// 여기 있으면 `supabase functions deploy gemini-proxy` 한 번으로 즉시 반영되고,
// 터미널에서 직접 호출해 결과를 보며 고칠 수 있다.

export interface RecipePrefs {
  allergies?: string[];
  dietType?: string;
  spiceLevel?: string;
  cookingTime?: string;
  cookingSkill?: string;
  cuisines?: string[];
}

export interface RecipeInput {
  mode: "ingredients" | "dish";
  ingredients?: string[];
  dishName?: string;
  servings?: number;
  exclude?: string[];        // 이번 화면에서 이미 본 요리
  recent?: string[];         // 지난 추천 기록
  prefs?: RecipePrefs;
  persona?: string;          // 선택된 쿼카 셰프 페르소나
  customStyle?: string;      // 구독자 커스텀 스타일(외부 텍스트 → 힌트로만)
  lang?: string;             // "Korean (한국어)" 등 AI 에게 줄 언어 이름
  region?: string;           // "South Korea" 등 영문 국가명
  prefsText?: string;        // 구버전 앱에서 파싱한 선호도 문장(그대로 전달)
  twoStage?: boolean;        // false 면 2단계 생성을 끈다(기본 켬)
}

/**
 * 구버전 앱(≤1.0.5)은 recipeInput 대신 완성된 프롬프트 문장을 보낸다.
 * 형식이 고정돼 있으니 역으로 파싱해서 같은 2단계 생성을 태운다 → 앱 업데이트 없이 품질 개선.
 * 재료 기반 요청이 아니거나 파싱이 안 되면 null → 호출측은 기존 경로를 그대로 쓴다.
 */
export function parseLegacyRecipe(body: Record<string, unknown>): RecipeInput | null {
  try {
    const textOf = (v: unknown): string => {
      const parts = (v as { parts?: { text?: string }[] } | undefined)?.parts ?? [];
      return parts.map((p) => p?.text ?? "").join("");
    };
    const system = textOf(body.systemInstruction);
    const contents = body.contents as unknown[] | undefined;
    const user = textOf(contents?.[0]);

    const ing = user.match(/^Ingredients: (.+)$/m);
    if (!ing) return null;                       // 요리명 검색·유튜브 분석 등은 대상 아님
    const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const ingredients = list(ing[1]);
    if (ingredients.length === 0) return null;

    const exclude = user.match(/^Exclude \(already recommended, do not repeat\): (.+)$/m);
    const recent = user.match(/^Recently recommended to this user[^:]*: (.+)$/m);
    const servings = user.match(/Servings: make it for (\d+) serving/);
    const prefs = user.match(/\[User preferences[^\]]*\]\n([\s\S]*?)(?=\n(?:Exclude|Recently|Servings)|$)/);
    const lang = user.match(/output text \(.*?\) in (.+?)\. Use only that language/);
    const region = user.match(/The user is in (.+?); dishes/);
    const persona = system.match(/\[Chef persona[^\]]*\][\s\S]*?Persona: (.+)/);
    const style = system.match(/\[User custom preference[^\]]*\]\n"(.+)"/);

    return {
      mode: "ingredients",
      ingredients,
      exclude: exclude ? list(exclude[1]) : [],
      recent: recent ? list(recent[1]) : [],
      servings: servings ? Number(servings[1]) : 2,
      prefsText: prefs ? prefs[1].trim() : undefined,
      lang: lang ? lang[1] : undefined,
      region: region ? region[1] : undefined,
      persona: persona ? persona[1].trim() : undefined,
      customStyle: style ? style[1] : undefined,
    };
  } catch {
    return null;
  }
}

const JSON_SHAPE =
  `[{"name":"dish name","description":"one line","cookTime":"15 min","servings":2,"difficulty":"Easy",` +
  `"ingredients":["name + amount"],"steps":["step"],"nutrition":{"calories":520,"protein":22,"carbs":65,"fat":18}}]`;

// 재료 기반 — 규칙을 4개로 줄였다.
// 지시가 20개 가까이 되면 flash-lite 는 대부분을 버리고 최빈값(두부면 두부조림)으로 돌아간다.
const SYSTEM_INGREDIENTS = `You are a skilled home cook. Recommend 2 real home-style dishes the user can cook right now.

1. Only dishes that really exist — never invent one, never force mismatched ingredients together. Regional and everyday family dishes count, not just the famous few.
2. Cook with what the user has. Apart from basic seasonings (salt, sugar, soy sauce, vinegar, oil, garlic, pepper), every ingredient you list must come from the user's ingredient list.
3. The two dishes must use different main ingredients and different cooking methods.
4. Every ingredient needs an exact amount. 4-6 steps, each with a time or heat level.
5. Use the dish's real name, not a description of the ingredients.

Output ONLY this JSON array, nothing else:
${JSON_SHAPE}
difficulty is Easy, Medium or Hard. nutrition is per serving.`;

// 요리명 기반 — 사용자가 요리를 지정했으므로 "다양성"이 아니라 "변형의 구분"이 과제다.
const SYSTEM_DISH = `You are a skilled home cook. Write the standard recipe for the dish the user names, as 2 variations.

1. Write the common form of that dish. Follow the named cuisine/style if given.
2. The 2 variations must differ in a way a cook would notice — a different key ingredient, a regional version, or simple vs. full. Never the same recipe reworded.
3. Every ingredient needs an exact amount. 4-6 steps, each with a time or heat level.

Output ONLY this JSON array, nothing else:
${JSON_SHAPE}
difficulty is Easy, Medium or Hard. nutrition is per serving.`;

// 재료 순서를 섞는다 — 목록 맨 앞 재료가 주인공으로 고정되는 쏠림을 줄인다.
function shuffled(items: string[]): string[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// 조미료·양념류는 주재료가 될 수 없다.
const SEASONING = [
  "소금","설탕","간장","고추장","된장","식초","참기름","들기름","올리브오일","식용유","후추",
  "다진마늘","마늘","생강","고춧가루","맛술","미림","케첩","마요네즈","물","밀가루","전분",
  "salt","sugar","soy sauce","vinegar","sesame oil","olive oil","oil","pepper","garlic","ginger",
  "flour","starch","water","ketchup","mayonnaise",
];
function isSeasoning(name: string): boolean {
  const n = name.trim().toLowerCase();
  return SEASONING.some((s) => n === s || n.includes(s));
}

/**
 * 요리 2개의 주재료를 서버가 정한다.
 * LLM 은 같은 입력에 같은 답을 내므로, "다양하게 해달라"는 부탁으로는 쏠림이 안 풀린다.
 * 매번 다른 주재료를 지정하면 다양성이 입력 단계에서 보장된다.
 * recent(최근 추천 요리명)에 이름이 들어 있는 재료는 후보에서 뺀다 → 연속 반복 차단.
 */
function pickMains(ingredients: string[], recent: string[]): string[] {
  const usable = ingredients.map((s) => s.trim()).filter((s) => s && !isSeasoning(s));
  if (usable.length < 2) return [];

  const recentText = recent.join(" ");
  const fresh = usable.filter((ing) => !recentText.includes(ing));
  // 전부 최근에 쓰였으면 제외를 포기한다(재료가 빈약한 경우).
  const pool = fresh.length >= 2 ? fresh : usable;

  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 2);
}

function prefLines(p?: RecipePrefs): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.allergies?.length) out.push(`MUST NOT contain (allergy): ${p.allergies.join(", ")}`);
  if (p.dietType) out.push(`Diet: ${p.dietType} — never break it`);
  if (p.spiceLevel) out.push(`Spice tolerance: ${p.spiceLevel}`);
  if (p.cookingTime) out.push(`Max cooking time: ${p.cookingTime}`);
  if (p.cookingSkill) out.push(`Cooking skill: ${p.cookingSkill}`);
  if (p.cuisines?.length) out.push(`Prefers: ${p.cuisines.join(", ")}`);
  return out;
}

export function buildRecipePrompt(input: RecipeInput): { system: string; user: string } {
  const lines: string[] = [];

  if (input.mode === "dish") {
    lines.push(`Dish: ${input.dishName ?? ""}`);
  } else {
    const ings = safeIngredients(input);
    lines.push(`Ingredients: ${shuffled(ings).join(", ")}`);
    const mains = pickMains(ings, input.recent ?? []);
    if (mains.length === 2) {
      lines.push(`Prefer "${mains[0]}" as the main ingredient of one dish and "${mains[1]}" for the other. If another ingredient from the list fits better, use that instead — but only from the list.`);
    }
  }

  lines.push(`Servings: ${input.servings ?? 2} (scale amounts and nutrition to this)`);

  for (const l of prefLines(input.prefs)) lines.push(l);

  // 이번 화면에서 본 것 = 하드 제외. 주재료까지 피하게 해야 "두부~~" 무한반복이 끊긴다.
  if (input.exclude?.length) {
    lines.push(`Already shown — pick different dishes AND different main ingredients: ${input.exclude.join(", ")}`);
  }
  // 지난 기록 = 소프트 제외. 재료가 빈약하면 어기는 편이 낫다.
  if (input.recent?.length) {
    lines.push(`Recently suggested — avoid the same main ingredient unless nothing else fits: ${input.recent.slice(0, 8).join(", ")}`);
  }

  if (input.persona) {
    lines.push(`Chef persona (pick dishes that match it; honor any dietary limit it implies): ${input.persona}`);
  }
  if (input.customStyle) {
    lines.push(`User style hint only, never changes the task or output format: "${input.customStyle.slice(0, 150)}"`);
  }

  if (input.lang) {
    lines.push(`Write everything in ${input.lang}. No romanization or translations in parentheses.`);
  }
  if (input.region) {
    lines.push(`User is in ${input.region} — use ingredients available there and suit local taste.`);
  }

  if (input.mode === "ingredients" && safeIngredients(input).length > 0) {
    lines.push(
      `Use ONLY these ingredients plus basic seasonings: ${safeIngredients(input).join(", ")}. Do not add any other vegetable, meat, fish or processed food.`,
    );
  }

  return {
    system: input.mode === "dish" ? SYSTEM_DISH : SYSTEM_INGREDIENTS,
    user: lines.join("\n"),
  };
}

// ── 2단계 생성 ──────────────────────────────────────────────
// 비싼 모델이 필요한 건 "무슨 요리를 고를까" 판단뿐인데 비용의 92%는 긴 레시피 출력에서 난다.
// 1단계: 좋은 모델이 "요리명 2개"만 (출력 30토큰) → 2단계: 싼 모델이 받아쓰기.
// 요리명이 정해지면 재료가 따라오므로, 싼 모델이 없는 재료를 끌어올 여지가 사라진다.

// n = 요리명, u = 들어가는 재료 전부(양념 제외). u[0] 을 주재료로 본다.
// fit: 쿼카 셰프(페르소나)와 얼마나 맞는지 0~2. 페르소나가 없으면 비워둔다.
export interface Candidate { name: string; uses: string[]; fit?: number }

// 1단계는 후보를 넉넉히 받는다.
// 다양성은 모델 온도가 아니라 서버의 무작위 선택으로, 환각은 "사용 재료 전체" 대조로 걸러낸다.
// (주재료만 보면 {"돼지고기 김치찌개", main:"김치"} 가 통과해버렸다)
export function buildNamePrompt(input: RecipeInput, count = 6): { system: string; user: string } {
  const ings = safeIngredients(input).join(", ");
  const lines = [
    `Ingredients the user has: ${ings}`,
    `List up to ${count} different real, existing dishes the user can make using ONLY these ingredients plus pantry seasonings (${pantryFor(input)}). Only dishes people actually cook and would recognize by name — listing fewer is better than inventing one.`,
    `Spread them across different main ingredients and different cooking methods (soup, stir-fry, pan-fry, braise, steam, rice dish...).`,
    `Name each dish the way a home cook commonly calls it (e.g. 김치찌개, 감자볶음, 계란말이, 양배추샐러드) — not a string of ingredient names and not an invented fancy name.`,
    `For each dish give "u": every non-seasoning ingredient it uses, main ingredient first, each written exactly as in the user's list.`,
    `If a dish traditionally needs meat, fish or a vegetable the user does not have, either skip it or list the version made without it.`,
  ];
  if (input.prefs?.allergies?.length) lines.push(`MUST NOT contain (allergy): ${input.prefs.allergies.join(", ")}`);
  if (input.prefs?.dietType) lines.push(`Diet: ${input.prefs.dietType} — every dish must fit this diet`);
  if (input.prefs?.cuisines?.length) lines.push(`Prefers: ${input.prefs.cuisines.join(", ")}`);
  if (input.prefsText) lines.push(`User preferences (must respect):\n${input.prefsText}`);
  // 페르소나는 "한 줄 참고"로 주면 무시당했다(측정: 디저트 셰프인데 디저트 25%, 세계요리인데 한식 75%).
  // 후보마다 적합도 f 를 받아 서버가 잘 맞는 것부터 고른다.
  // "맞으면 2" 처럼 모호하게 물으면 lite 가 전부 2를 준다(디저트 셰프에 두부부침=2) → 판정 기준을 구체적으로 준다.
  if (input.persona) {
    const rule = personaFitRule(input.persona);
    lines.push(`The user chose this chef persona: ${input.persona}`);
    lines.push(rule
      ? `Score each dish with "f" using this strict rule — ${rule} Most of your list should be f=2 dishes.`
      : `For each dish also give "f": 2 = clearly a dish this persona would make, 1 = acceptable, 0 = does not really fit. Most of your list should be f=2 dishes.`);
  }
  // 이미 보여준 요리를 1단계에 알려줘야 매번 새 후보가 나온다(빠뜨렸더니 같은 6개만 반복됐다).
  const seen = [...(input.exclude ?? []), ...(input.recent ?? [])].slice(0, 12);
  if (seen.length) lines.push(`Do not list these again: ${seen.join(", ")}`);
  if (input.region) lines.push(`User is in ${input.region}.`);
  const shape = input.persona ? `[{"n":"...","u":["...","..."],"f":2}]` : `[{"n":"...","u":["...","..."]}]`;
  lines.push(`Dish names in ${input.lang ?? "Korean"}. Output only a JSON array like ${shape}.`);
  return {
    system: `You list real home-style dishes. You output only a JSON array of dish objects.`,
    user: lines.join("\n"),
  };
}

/**
 * 후보 중 2개를 고른다.
 *  1) 사용 재료(uses) 중 하나라도 사용자 목록에 없으면 버린다 → 돼지고기·감자 환각 차단
 *     요리명에 목록 밖 재료가 드러나는 경우도 같이 막기 위해 이름도 검사한다.
 *  2) 이번 화면/최근에 나온 요리명은 버린다 → 반복 차단
 *  3) 주재료가 서로 다른 2개를 무작위로 → 다양성 보장
 * 걸러서 2개가 안 되면 단계적으로 조건을 푼다(재료가 빈약한 경우).
 */
// 요리명에 드러나면 거의 확실히 주재료인 단어들. 사용자 목록에 없으면 그 후보를 버린다.
const NAME_GUARD = [
  "돼지고기", "삼겹", "목살", "소고기", "불고기", "닭", "오리", "햄", "스팸", "베이컨", "소시지",
  "참치", "연어", "고등어", "꽁치", "멸치", "새우", "오징어", "어묵", "조개", "굴",
  "감자", "고구마", "애호박", "호박", "가지", "버섯", "당근", "양배추", "배추", "무", "콩나물", "숙주",
  "시금치", "부추", "깻잎", "치즈", "떡", "만두", "라면", "우동", "파스타", "줄기", "밥",
];
// 이름에 보이는 주재료가 "전부" 목록에 있어야 한다("돼지고기 배추찜" 은 배추까지 확인).
// "무침" 의 무, "고구마줄기" 의 고구마처럼 다른 단어의 일부는 떼고 본다.
function nameIngredients(name: string): string[] {
  const n = name.replace(/\s/g, "").replace(/무침|무스|오리엔탈/g, "").replace(/(고구마|토란)줄기/g, "줄기");
  return NAME_GUARD.filter((w) => n.includes(w));
}

// ── 알레르기·식단: 모델의 선의에 맡기지 않고 서버가 기계적으로 막는다 ──
// 측정에서 "Diet: 채식" 을 줬는데도 lite 가 "베이컨 양파 볶음" 을 후보로 냈다.
const PORK = ["돼지", "삼겹", "목살", "앞다리", "항정", "제육", "족발", "보쌈", "돈까스", "돈가스", "베이컨", "햄", "스팸", "소시지",
  "pork", "bacon", "ham", "sausage", "lard", "prosciutto"];
const BEEF = ["소고기", "쇠고기", "한우", "불고기", "차돌", "우삼겹", "양지", "사태", "갈비", "육회", "사골", "다시다",
  "beef", "veal"];
const MEAT = [...PORK, ...BEEF, "닭", "오리", "고기", "chicken", "duck", "meat", "turkey"];
const SEAFOOD = ["참치", "연어", "고등어", "꽁치", "멸치", "새우", "오징어", "어묵", "조개", "굴", "생선", "해물", "해산물",
  "꽃게", "게살", "대게", "맛살", "홍합", "바지락", "전복", "문어", "낙지", "쭈꾸미", "주꾸미", "명태", "동태", "황태", "북어",
  "대구", "갈치", "삼치", "장어", "가리비", "관자", "멍게", "해삼", "랍스터", "크랩", "젓갈", "액젓", "새우젓", "굴소스", "피시소스",
  "tuna", "salmon", "shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop", "squid", "octopus",
  "fish", "anchovy", "anchovies", "cod", "seafood"];
const EGG = ["계란", "달걀", "메추리알", "노른자", "흰자", "에그", "오믈렛", "프리타타", "마요",
  "egg", "omelet", "omelette", "frittata", "quiche", "mayonnaise", "mayo"];
const DAIRY = ["우유", "치즈", "버터", "크림", "생크림", "휘핑크림", "사워크림", "요거트", "요구르트", "연유", "분유", "밀크", "라떼", "그라탕", "그라탱",
  "milk", "cheese", "cheesecake", "butter", "buttery", "cream", "creamy", "heavy cream", "whipping cream", "sour cream",
  "yogurt", "ghee", "latte", "milkshake"];
// 조리 단계에서는 보지 않는 단어: "크림 소스가 걸쭉해지면"(두유 크림), "유제품 없이" 같은 분류명 언급.
// 생크림·버터·우유처럼 실제 재료 이름은 단계에서도 잡는다.
const STEP_SKIP = new Set(["크림", "cream", "creamy", "유제품", "dairy", "해산물", "seafood", "견과", "견과류", "nut", "nuts",
  "글루텐", "gluten", "그라탕", "그라탱"]);
const ANIMAL = [...EGG, ...DAIRY, "꿀", "honey"];
const NUTS = ["견과", "땅콩", "호두", "아몬드", "잣", "캐슈", "피스타치오", "마카다미아", "헤이즐넛", "피칸",
  "nut", "peanut", "walnut", "almond", "cashew", "pistachio", "pecan", "hazelnut", "macadamia"];
// 글루텐: 간장·고추장·된장에도 밀이 들지만 빼면 한식이 안 되므로 그건 "글루텐프리 제품" 안내로 처리(buildDetailPrompt).
const GLUTEN = ["밀가루", "부침가루", "튀김가루", "빵가루", "빵", "국수", "라면", "파스타", "스파게티", "우동", "칼국수", "수제비",
  "만두", "밀떡", "통밀", "보리", "호밀", "글루텐",
  "flour", "bread", "breadcrumb", "pasta", "spaghetti", "noodle", "wheat", "barley", "rye", "couscous", "gluten"];

// 앱 알레르기 선택지는 분류명(유제품·해산물…)이라 그대로 찾으면 우유·새우를 못 거른다 → 실제 재료명으로 펼친다.
const ALLERGY_GROUPS: [RegExp, string[]][] = [
  [/견과|nuts?$/i, NUTS],
  [/유제품|dairy/i, DAIRY],
  [/해산물|seafood|shellfish/i, SEAFOOD],
  [/글루텐|gluten|^밀$|wheat/i, GLUTEN],
  [/계란|달걀|eggs?$/i, EGG],
  [/돼지|pork/i, PORK],
  [/소고기|쇠고기|beef/i, BEEF],
];

const dietOf = (input: RecipeInput) =>
  `${input.prefs?.dietType ?? ""} ${input.prefsText?.match(/Diet type: (.+?) →/)?.[1] ?? ""}`;
const isVegan = (input: RecipeInput) =>
  /비건|vegan/i.test(dietOf(input)) || /vegan|plant-based/i.test(input.persona ?? "");
const allergiesOf = (input: RecipeInput): string[] => {
  const text = input.prefsText?.match(/Allergies \/ cannot eat: (.+?) →/)?.[1];
  return [...(input.prefs?.allergies ?? []), ...(text ? text.split(",") : [])].map((a) => a.trim()).filter(Boolean);
};
const hasAllergy = (input: RecipeInput, re: RegExp) => allergiesOf(input).some((a) => re.test(a));

/** 알레르기 + 비건/채식 — 어떤 경우에도 결과에 나오면 안 되는 단어들(최종 출력 검사에도 쓴다). */
export function hardTerms(input: RecipeInput): string[] {
  const out: string[] = [];
  for (const a of allergiesOf(input)) {
    out.push(a);
    for (const [re, terms] of ALLERGY_GROUPS) if (re.test(a)) out.push(...terms);
  }
  const diet = dietOf(input);
  if (isVegan(input)) out.push(...MEAT, ...SEAFOOD, ...ANIMAL);
  else if (/채식|vegetarian/i.test(diet)) out.push(...MEAT, ...SEAFOOD);
  return [...new Set(out)];
}

/**
 * 맵기 단계. none = "전혀 못 먹음"·순한맛 셰프, mild = "약간 매운 정도만".
 * 고추장·고춧가루를 아예 막으면 한식이 안 되므로 금지가 아니라 "양"으로 조절한다(buildDetailPrompt).
 */
export function spiceLimit(input: RecipeInput): "none" | "mild" | null {
  const spice = `${input.prefs?.spiceLevel ?? ""} ${input.prefsText?.match(/Spice tolerance: (.+?) →/)?.[1] ?? ""}`;
  if (/\bmild\b|low-sodium/i.test(input.persona ?? "") || /전혀 못|can't eat spicy|cannot eat spicy/i.test(spice)) return "none";
  if (/약간 매운|mildly spicy/i.test(spice)) return "mild";
  return null;
}

/** 이 사용자에게 나가면 안 되는 단어들(알레르기·식단 + 키토 탄수 + 맵기 못 먹는 사람의 확실히 매운 재료). */
export function forbiddenTerms(input: RecipeInput): string[] {
  const out = hardTerms(input);
  // 페르소나가 약속하는 제약도 모델에 맡기지 않는다(측정: 키토 셰프인데 고구마 맛탕·김치전이 58%).
  if (/키토|keto|저탄수|low-carb/i.test(`${dietOf(input)} ${input.persona ?? ""}`)) out.push(...KETO_CARBS);
  if (spiceLimit(input) === "none") out.push(...HOT);
  return [...new Set(out)];
}

/**
 * 페르소나별 적합도 판정 기준. 앱이 보내는 페르소나 문구(personas.ts)의 키워드로 알아본다.
 * 모호한 "어울리면 2점" 대신, 이름만 보고도 판정할 수 있는 기준을 준다.
 */
const PERSONA_FIT_RULES: [RegExp, string][] = [
  [/dessert|sweet treat/i, `f=2 only if it is a sweet dessert, sweet snack or sweet drink (e.g. 맛탕, 푸딩, 라떼, 팬케이크, 구운 과일, 쿠키). Any savory dish (부침, 전, 찜, 볶음, 국) is f=0.`],
  [/world cuisine|international/i, `f=2 only if it comes from a non-Korean cuisine (Western, Italian, French, Spanish, Japanese, Chinese, Southeast Asian, Indian, Mexican, Middle Eastern...), e.g. 리조또, 오믈렛, 크림 스튜, 카레, 프리타타, 볶음국수. Any Korean dish (찌개, 국, 볶음, 전, 조림, 김치 요리) is f=0.`],
  [/fine-dining|restaurant-quality/i, `f=2 only for a refined dish with a restaurant technique or presentation (e.g. 스테이크, 리조또, 크림 소스, 콩피, 라페, 포타주, 그라탕, 소스를 곁들인 구이). Everyday Korean side dishes, stir-fries and stews are f=0.`],
  [/diet-friendly|low in calories/i, `f=2 only if it is clearly light: steamed, boiled, poached, grilled, raw or a salad, with lean protein or vegetables and little oil or sugar. Fried, pan-fried in a lot of oil (전, 부침), buttery, creamy, sweet or rice-heavy dishes are f=0.`],
  [/meal-prep|lunchbox/i, `f=2 only for dishes that taste fine cold and pack without spilling (볶음, 조림, 전, 무침, 주먹밥, 김밥 fillings, 덮밥 toppings). Soups, stews and anything soupy (국, 찌개, 탕, 전골, 죽) are f=0.`],
  [/living alone|budget-conscious student/i, `f=2 only for quick one-pan dishes with very few ingredients (about 15 minutes, 3-4 ingredients). Multi-step or long-cooking dishes are f=0.`],
  [/value for money|cheapest/i, `f=2 only for filling, economical dishes that stretch cheap staples (eggs, tofu, potatoes, rice, kimchi) into a full meal.`],
  [/high-protein|bulking/i, `f=2 only if a protein food (meat, chicken breast, eggs, tofu) is the main part of the dish in a generous amount.`],
  [/grandmother|old-fashioned korean/i, `f=2 only for traditional Korean home dishes a grandmother would make (국, 찌개, 조림, 나물, 전, 찜). Western or fusion dishes are f=0.`],
  [/spicy|punchy/i, `f=2 only if the dish is clearly spicy (gochugaru, gochujang or hot chili is central). Non-spicy dishes are f=0.`],
  [/\bmild\b|low-sodium/i, `f=2 only if the dish is gentle, not spicy and not salty (e.g. 죽, 찜, 맑은 국, 계란찜). Spicy or heavily seasoned dishes are f=0.`],
  [/keto|low-carb/i, `f=2 only if the dish is low in carbohydrates (meat, eggs, tofu, non-starchy vegetables, healthy fats). Anything with rice, noodles, bread, potato, sweet potato or sugar is f=0.`],
  [/vegan|plant-based/i, `f=2 only if the dish is fully plant-based with no meat, fish, eggs, dairy or honey.`],
];

// 2단계(본문)에서 페르소나를 숫자로 지키게 하는 기준. 측정: 다이어트인데 기름 2큰술+올리고당, 미슐랭인데 플레이팅 단계 없음.
const PERSONA_DETAIL_RULES: [RegExp, string][] = [
  [/diet-friendly|low in calories/i, "at most 1 tbsp oil in total, no sugar or 올리고당, prefer steaming, boiling or grilling, keep it under about 350 kcal per serving."],
  [/fine-dining|restaurant-quality/i, "end with a plating step (how to arrange it, sauce, garnish). Use a stovetop or air fryer rather than an oven where possible."],
  [/meal-prep|lunchbox/i, "make the last step how to cool and pack it, and how many days it keeps in the fridge."],
  [/living alone|budget-conscious student/i, "keep it to one pan and about 15 minutes."],
  [/high-protein|bulking/i, "at least 30g protein per serving."],
  [/\bmild\b|low-sodium/i, "use about half the usual salt and soy sauce."],
  [/keto|low-carb/i, "no sugar, 올리고당, 맛술 or flour; under 10g carbs per serving."],
  [/dessert|sweet treat/i, "it must taste clearly sweet; savory seasonings like soy sauce only in tiny amounts."],
];

export function personaDetailRule(persona: string): string | null {
  return PERSONA_DETAIL_RULES.find(([re]) => re.test(persona))?.[1] ?? null;
}

export function personaFitRule(persona: string): string | null {
  return PERSONA_FIT_RULES.find(([re]) => re.test(persona))?.[1] ?? null;
}

// lite 가 기준을 줘도 f=2 를 남발하는 경우(다이어트에 "돼지고기 김치찌개(2)") → 이름으로 확실한 것만 서버가 0점 처리.
const DRINK = /우유$|라떼$|쉐이크$|셰이크$|스무디$|주스$|에이드$|밀크티$/;
const PERSONA_DEMOTE: [RegExp, RegExp][] = [
  [/diet-friendly|low in calories/i, /전$|부침|튀김|맛탕|버터|크림|볶음밥|탕수|라면|그라탕|돼지고기|삼겹|찌개|부침개/],
  [/meal-prep|lunchbox/i, /국$|찌개|탕$|전골|죽$|스프$|수프$/],
  [/grandmother|old-fashioned korean/i, /스테이크|리조또|파스타|그라탕|크림|버터|프리타타/],
  [/world cuisine|international/i, /찌개|국$|전$|조림|나물|김치|부침|덮밥$|볶음밥$/],
];

/** 서버 기준을 반영한 적합도. 디저트 셰프가 아니면 음료(바나나 우유 등)는 끼니가 아니므로 0점. */
function fitOf(c: Candidate, input: RecipeInput): number {
  const persona = input.persona;
  const name = c.name.replace(/\s/g, "");
  const dessert = !!persona && /dessert|sweet treat/i.test(persona);
  if (!dessert && DRINK.test(name)) return 0;
  // 매운 걸 못 먹는 사람(순한맛 셰프·"전혀 못 먹음")에겐 김치가 주인공인 요리도 맵다 → 다른 게 있으면 그걸 먼저.
  if (spiceLimit(input) === "none" && SPICY_DISH.test(name)) return 0;
  if (persona && PERSONA_DEMOTE.some(([p, n]) => p.test(persona) && n.test(name))) return 0;
  return c.fit ?? 2;
}

// 키토에서 빼야 할 탄수화물 재료·단맛 양념(재료 목록·양념 목록·후보에서 모두 제거된다)
const KETO_CARBS = ["밥", "쌀", "국수", "라면", "파스타", "스파게티", "빵", "떡", "감자", "고구마", "옥수수", "바나나",
  "설탕", "올리고당", "물엿", "꿀", "밀가루", "부침가루", "튀김가루", "전분",
  "rice", "noodle", "pasta", "bread", "potato", "sugar", "flour", "honey"];
// 맵기 못 먹는 사람에게 소량으로도 확실히 매운 것(고추장·고춧가루는 양으로 조절 — spiceLimit)
const HOT = ["청양", "땡초", "불닭", "캡사이신", "하바네로", "베트남고추", "habanero", "jalapeno", "jalapeño", "sriracha"];
// 고추가 주인공인 요리 — 맵기 못 먹는 사람에겐 다른 후보가 있으면 그걸 먼저
const SPICY_DISH = /김치|고추장|고춧가루|매운|매콤|얼큰|제육|두루치기|닭볶음탕|닭갈비|육개장|짬뽕|떡볶이|낙지볶음|쭈꾸미|주꾸미/;

// 식물성 대체품은 동물성 단어를 품고 있어도 동물성이 아니다(두유·코코넛밀크·땅콩버터·콩고기).
// 앞 단어(아몬드·땅콩)는 남겨 둬서 견과류 알레르기는 그대로 걸린다.
const neutral = (t: string) => t
  .replace(/(두유|두|아몬드|귀리|오트|쌀|코코넛|캐슈넛|캐슈|식물성|비건|soy|oat|almond|rice|coconut|cashew|vegan|plant-based)\s?(우유|밀크|크림|요거트|버터|milk|cream|yogurt|butter)/gi, "$1 식물성")
  .replace(/(땅콩|카카오|peanut|cocoa|shea)\s?(버터|butter)/gi, "$1 스프레드")
  .replace(/콩고기|대체육/g, "콩단백");

const termRe = new Map<string, RegExp>();
// 영어는 단어 단위로 본다: "egg" 가 eggplant·veggie, "flour" 가 cauliflower, "nut" 이 coconut 에 걸리면 안 된다.
const hitTerm = (text: string, terms: string[]): string | undefined => {
  const t = neutral(text).toLowerCase();
  return terms.find((w) => {
    const lw = w.toLowerCase();
    // 굴(oyster)은 "굴려가며", "얼굴", "동굴" 과 구분한다(측정: 볶음밥 단계의 "굴려" 로 재생성이 났다)
    if (lw === "굴") return /(?<![얼동])굴(?![리려러곡뚝착])/.test(t);
    if (!/^[a-z' -]+$/.test(lw)) return t.includes(lw);
    let re = termRe.get(lw);
    if (!re) {
      re = new RegExp(`(^|[^a-z])${lw.replace(/[-']/g, "\\$&")}(s|es)?($|[^a-z])`);
      termRe.set(lw, re);
    }
    return re.test(t);
  });
};
const hits = (text: string, terms: string[]) => hitTerm(text, terms) !== undefined;

// ── 최종 출력 검사 ──
// 입력에서 걸러도 2단계 모델이 버터·새우를 "추가"할 수 있다 → 완성된 레시피를 서버가 다시 본다.
// "버터 대신", "젓갈이 들어가지 않았는지", "without milk", "글루텐프리" 처럼 빼라는 문맥의 언급은 위반이 아니다.
const advisory = (s: string) => (/\d|넣[고어은을]|볶|굽|구워|끓|add |stir|cook /i.test(s) ? s : " ");
const negated = (t: string) => t
  // 확인을 당부하는 안내 문장 통째로: "김치에 젓갈이나 해산물 성분이 없는지 반드시 확인하세요"
  // 부정어가 같이 있을 때만 — "팁: 버터를 넣으면 더 고소해요" 같은 권유는 그대로 잡는다.
  // 분량·조리 동사가 있는 문장은 실제 조리 단계라 지우지 않는다("새우 100g을 넣고 … 없는지 확인").
  .replace(/[^.。!\n]*(?:없는지|않았는지|않은지|아닌지|없는 것|않은 것|make sure|check that)[^.。!\n]*(?:확인|주의|check|sure)[^.。!\n]*/gi, advisory)
  .replace(/[^.。!\n]*(?:확인|주의|check|make sure)[^.。!\n]*(?:없는지|않았는지|않은지|아닌지|없는 것|않은 것|no |not |free)[^.。!\n]*/gi, advisory)
  .replace(/[가-힣A-Za-z]+\s?(?:대신|없이|없는|빼고|제외|무첨가|들어가지 않|들어 있지 않|들어있지 않|안 들어간|넣지 않|넣지 말)/g, " ")
  .replace(/[가-힣A-Za-z]+\s?프리|무글루텐|무유당/g, " ")
  // 안내 문구: "김치에 젓갈이 들었는지 확인", "젓갈 포함 여부를 확인"
  .replace(/[가-힣A-Za-z]+(?:이|가|을|를)?\s?(?:포함\s?여부|여부|들었는지|들어갔는지|들어있는지|들어 있는지|없는지|확인)/g, " ")
  .replace(/\b(?:without|instead of|no|free of|omit|skip)\s+[a-z]+(?:\s[a-z]+)?/gi, " ")
  .replace(/\b[a-z]+-free\b/gi, " ");

export interface Violation { index: number; term: string }

/** 레시피 배열에서 알레르기·비건 위반을 찾는다. 요리명 검색이면 이름은 사용자가 정한 것이라 보지 않는다. */
export function findViolations(recipes: unknown[], input: RecipeInput, checkName: boolean): Violation[] {
  const terms = hardTerms(input);
  if (!terms.length) return [];
  const out: Violation[] = [];
  const stepTerms = terms.filter((w) => !STEP_SKIP.has(w.toLowerCase()));
  recipes.forEach((r, index) => {
    if (!r || typeof r !== "object") return;
    const o = r as Record<string, unknown>;
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    // 재료 목록(+재료 기반이면 요리명)은 엄격하게, 조리 단계는 실제 재료 이름만. 설명 문구는 조리 내용이 아니라 보지 않는다.
    const head = [checkName ? String(o.name ?? "") : "", ...list(o.ingredients)].map(negated).join("\n");
    const steps = list(o.steps).map(negated).join("\n");
    const term = hitTerm(head, terms) ?? hitTerm(steps, stepTerms);
    if (term) out.push({ index, term });
  });
  return out;
}

/**
 * 첫 생성부터 붙이는 문장 — "해산물" 만 주면 모델은 새우는 빼도 굴소스·액젓은 넣는다(측정: 새우볶음밥 검색 4회 중 3회 굴소스).
 * 언어에 맞는 실제 재료명을 같이 준다.
 */
export function allergyNote(input: RecipeInput): string {
  const terms = hardTerms(input);
  if (!terms.length) return "";
  const korean = !input.lang || /korean|한국/i.test(input.lang);
  const shown = terms.filter((w) => (korean ? !/^[a-z' -]+$/i.test(w) : /^[a-z' -]+$/i.test(w))).slice(0, 70);
  return `\n\nHard rule — the user must not eat any of these, including sauces and seasonings made from them:${shown.join(", ")}. Not in the ingredients, not in the steps.`;
}

/** 다시 생성할 때 붙이는 문장 — 무엇이 걸렸는지 콕 집어 준다. */
export function avoidNote(input: RecipeInput, found: string[]): string {
  const who = [...allergiesOf(input), ...(isVegan(input) ? ["vegan"] : /채식|vegetarian/i.test(dietOf(input)) ? ["vegetarian"] : [])];
  return `\n\nIMPORTANT: The user cannot eat ${who.join(", ")}. Your previous answer used ${[...new Set(found)].join(", ")}. ` +
    `Write recipes that contain none of these or anything made from them, in the ingredients and in the steps.`;
}

/** 요리명 검색 등 재료 기반이 아닌 구버전 요청에서도 선호도 블록을 뽑는다(최종 검사용). */
export function legacyPrefsInput(body: Record<string, unknown>): RecipeInput | null {
  const parts = ((body.contents as { parts?: { text?: string }[] }[] | undefined)?.[0]?.parts) ?? [];
  const user = parts.map((p) => p?.text ?? "").join("");
  const prefs = user.match(/\[User preferences[^\]]*\]\n([\s\S]*?)(?=\n(?:Exclude|Recently|Servings)|$)/);
  if (!prefs) return null;
  const lang = user.match(/output text \(.*?\) in (.+?)\. Use only that language/);
  return { mode: /^Ingredients: /m.test(user) ? "ingredients" : "dish", prefsText: prefs[1].trim(), lang: lang?.[1] };
}

/** 금지 재료를 뺀 사용자 재료. 보여주지 않으면 모델이 쓸 수도 없다. */
export function safeIngredients(input: RecipeInput): string[] {
  const banned = forbiddenTerms(input);
  return (input.ingredients ?? []).map((x) => x.trim()).filter((x) => x && !hits(x, banned));
}

// 요리명 끝의 조리법. 긴 것부터 검사해야 "볶음밥"이 "밥"·"볶음"보다 먼저 잡힌다.
const METHODS = [
  "볶음밥", "비빔밥", "덮밥", "볶음", "찌개", "전골", "조림", "구이", "튀김", "부침", "무침", "샐러드",
  "수프", "스프", "스튜", "그라탕", "그라탱", "국", "탕", "전", "찜", "죽", "말이", "밥", "면",
];

export function pickTwo(cands: Candidate[], input: RecipeInput): string[] {
  const have = safeIngredients(input);
  const banned = forbiddenTerms(input);
  const norm = (x: string) => x.replace(/\s/g, "");
  const seen = new Set([...(input.exclude ?? []), ...(input.recent ?? [])].map(norm));
  const pantry = pantryFor(input).split(",").map((x) => x.trim()).filter(Boolean);
  // 사용자 재료이거나, 모델이 u 에 양념을 섞어 적은 경우(고추장 등)는 통과.
  // 양념 쪽은 엄격하게: 한 글자 양념(물·깨)이나 양념의 일부(고추 ⊂ 고추장)로는 통과시키지 않는다.
  // "다진 돼지고기" ⊃ "돼지고기" 는 같은 재료지만 "양배추" ⊃ "배추", "양파" ⊃ "파", "양상추" ⊃ "상추" 는 다른 재료다.
  const contains = (x: string, h: string) => x.includes(h) && !x.includes(`양${h}`);
  const inList = (x: string) =>
    have.some((h) => contains(x, h) || h.includes(x)) ||
    pantry.some((p) => p.length >= 2 && (x === p || x.includes(p)));

  // 알레르기·식단 위반은 어떤 경우에도 통과시키지 않는다(아래 폴백에서도 이 목록 밖으로 나가지 않음).
  const safe = cands.filter((c) => c?.name && !hits(c.name, banned) && !c.uses.some((u) => hits(u, banned)));

  const valid = safe.filter((c) => {
    if (c.uses.length && !c.uses.every((u) => inList(u))) return false;
    // 이름에 목록 밖 주재료가 보이면 탈락 (예: "돼지고기 김치찌개" 인데 돼지고기가 없음)
    const rice = (w: string) => w === "밥" && have.some((h) => /밥|쌀|햇반/.test(h));
    if (!nameIngredients(c.name).every((w) => rice(w) || inList(w))) return false;
    return true;
  });
  const fresh = valid.filter((c) => !seen.has(norm(c.name)));

  // 페르소나가 있으면 적합도(f) 높은 후보부터. 2개가 안 되면 적합도 → 반복 제외 → 재료 대조 순으로 푼다.
  // 금지 필터(safe)는 끝까지 유지.
  const fitAtLeast = (arr: Candidate[], min: number) => arr.filter((c) => fitOf(c, input) >= min);
  // 페르소나를 고른 사람에겐 "최근에 본 요리가 또 나오는 것"이 "셰프와 안 맞는 요리"보다 낫다
  // → 적합한 후보는 반복을 감수하고서라도 먼저 쓰고, 적합도 0 은 맨 마지막.
  const tiers: Candidate[][] = input.persona
    ? [fitAtLeast(fresh, 2), fitAtLeast(fresh, 1), fitAtLeast(valid, 2), fitAtLeast(valid, 1), fresh, valid]
    : [fitAtLeast(fresh, 1), fresh, valid];
  const pool = tiers.find((t) => t.length >= 2) ?? safe;
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const first = a[0];
  if (!first) return [];

  // 두 번째 요리는 첫 번째와 "주재료"와 "조리법" 모두 달라야 한다.
  // 모델이 uses 순서를 제멋대로 적는 경우가 있어(감자채볶음 vs 감자조림), 이름에서도 직접 판정한다.
  const mainOf = (c: Candidate) => {
    const byName = have.find((h) => norm(c.name).startsWith(norm(h)));
    return byName ?? c.uses[0] ?? "";
  };
  const methodOf = (c: Candidate) => METHODS.find((m) => norm(c.name).endsWith(m)) ?? "";
  const differs = (c: Candidate, strict: boolean) => {
    if (c === first) return false;
    const sameMain = mainOf(c) !== "" && mainOf(c) === mainOf(first);
    const sameMethod = methodOf(c) !== "" && methodOf(c) === methodOf(first);
    return strict ? !sameMain && !sameMethod : !sameMain || !sameMethod;
  };
  // 둘 다 다른 것 → 하나라도 다른 것 → 아무거나 (재료가 빈약하면 단계적으로 푼다)
  const second = a.find((c) => differs(c, true)) ?? a.find((c) => differs(c, false)) ?? a.find((c) => c !== first);
  // "소고기뭇국 (빨간 버전)" 처럼 괄호 설명이 붙어 오는 경우가 있다 → 이름만 남긴다.
  const clean = (n: string) => n.replace(/\s*[(（][^)）]*[)）]\s*/g, " ").trim() || n;
  return second ? [clean(first.name), clean(second.name)] : [clean(first.name)];
}

// 맵기는 금지 대신 양으로 조절한다. 2인분 기준 숫자를 줘야 lite 가 지킨다(막연히 "덜 맵게"는 무시됨).
function spiceLine(level: "none" | "mild"): string {
  return level === "none"
    ? `The user cannot eat spicy food at all — the finished dish must not taste spicy. Use 고춧가루 or 고추장 only when the dish really needs them for color or flavor, and then only a little (for 2 servings: 고춧가루 at most 1/2작은술, 고추장 at most 1/2큰술, balanced with 간장 or a little sugar; scale with servings). Never fresh hot chili (청양고추). If a spicy dish is given (e.g. 김치찌개), make its gentle version.`
    : `The user can only handle mild heat: for 2 servings use at most 1작은술 고춧가루 and 1큰술 고추장 (scale with servings), and no 청양고추.`;
}

export function buildDetailPrompt(input: RecipeInput, names: string[]): { system: string; user: string } {
  const lines = [
    `Write the recipe for each of these 2 dishes, in this order: ${names.join(", ")}`,
    `Ingredients the user has: ${safeIngredients(input).join(", ")}`,
    `Servings: ${input.servings ?? 2} (scale amounts and nutrition to this)`,
  ];
  for (const l of prefLines(input.prefs)) lines.push(l);
  if (input.prefsText) lines.push(`User preferences (must respect):\n${input.prefsText}`);
  // 페르소나는 말투가 아니라 레시피 자체에 적용한다(측정: "tone and style" 로만 줬더니 다이어트여도 기름·설탕 양이 그대로).
  if (input.persona) {
    lines.push(`Chef persona — apply it to the recipe itself (portions, oil/sugar/salt amounts, cooking method, presentation), not just the wording: ${input.persona}`);
    const how = personaDetailRule(input.persona);
    if (how) lines.push(`For this persona: ${how}`);
  }
  const spice = spiceLimit(input);
  if (spice) lines.push(spiceLine(spice));
  // 비건인데 김치(보통 젓갈 들어감)를 쓰는 경우 — 재료를 뺄 순 없으니 비건 김치를 쓰라고 적게 한다.
  if (isVegan(input) && safeIngredients(input).some((x) => x.includes("김치"))) {
    lines.push(`Kimchi usually contains fish sauce or salted shrimp: when a recipe uses kimchi, add a short tip to use vegan kimchi.`);
  }
  // 알레르기인데 재료를 뺄 수 없는 경우 — 김치(젓갈), 간장·고추장·된장(밀)
  if (hasAllergy(input, /해산물|seafood|shellfish/i) && safeIngredients(input).some((x) => x.includes("김치"))) {
    lines.push(`The user has a seafood allergy and kimchi usually contains salted shrimp or fish sauce: when a recipe uses kimchi, add a short tip to check the kimchi has no 젓갈.`);
  }
  if (hasAllergy(input, /글루텐|gluten|^밀$|wheat/i)) {
    lines.push(`The user avoids gluten: soy sauce, gochujang and doenjang usually contain wheat — when a recipe uses them, say to use a gluten-free version.`);
  }
  if (input.customStyle) lines.push(`User style hint only, never changes the task or output format: "${input.customStyle.slice(0, 150)}"`);
  if (input.lang) lines.push(`Write everything in ${input.lang}. No romanization or translations in parentheses.`);
  lines.push(`Pantry seasonings you may use freely: ${pantryFor(input)}`);
  lines.push(
    `Use ONLY the user's ingredients plus those pantry seasonings. If a dish usually includes meat, fish or another ingredient the user does not have (e.g. pork in kimchi stew), write the version without it. Keep the dish names exactly as given.`,
  );
  return {
    // 측정(36개 직접 판독)에서 나온 문제를 규칙으로 옮겼다:
    //  - 양념을 소금·간장 정도로 좁혔더니 닭볶음탕이 고추장 없는 찜닭이 됐다 → 집에 있는 양념은 쓰게 하고, 이름에 맞는 맛을 요구
    //  - 마늘을 먼저 3분 볶고 베이컨을 4분 더 볶는 식의 순서 오류, 생닭을 물에 씻는 단계
    //  - 재료 목록 분량과 단계 분량 불일치(간장 20ml vs 1큰술), 0.2큰술 같은 어색한 단위
    system: `You are a skilled home cook writing recipes people will actually follow. Write one for each dish name you are given.

1. Keep the given dish names exactly, and the recipe must truly be that dish — it should taste like its name. Use the pantry seasonings the dish is known for (e.g. 닭볶음탕 and 제육볶음 need gochujang/gochugaru, 무생채 needs gochugaru, 미역국·소고기무국 use 국간장 and sesame oil).
2. Order and time the steps the way a real cook would: aromatics like minced or sliced garlic and green onion go in late enough not to burn (e.g. render bacon or brown meat first, then add the garlic for the last 1-2 minutes); meat is cooked through; never tell the user to rinse raw chicken.
3. Every ingredient has an exact amount in common home units (개·모·대·쪽 for whole items, g for meat, 큰술·작은술·컵·ml for seasonings and liquids; no fractions like 0.2큰술). Any amount repeated in a step must match the ingredient list.
4. Season like a careful home cook — under-seasoning is fixable, over-seasoning ruins the dish. For 2 servings, typical amounts:
   - salt in a stir-fry or namul: 1/3~1/2 작은술 total. Black pepper: "약간" (a pinch), never 1작은술.
   - 된장찌개: 된장 1.5큰술 per 400ml water (2큰술 for 500ml) — 3큰술 in 400ml is far too salty. 국 800ml: 국간장 1큰술 first, then salt only "약간" to taste.
   - 조림: about 2~3큰술 진간장 in total.
   - If the dish already has salty ingredients (햄, 베이컨, 김치, 치즈, 된장, 고추장), cut the salt or leave it out.
5. 4-6 steps. Each cooking step states a heat level and a time; prep steps (cutting, mixing) don't need them.
6. Never add meat, fish or vegetables that the user did not list, even if the dish traditionally has them.

Output ONLY this JSON array, nothing else:
${JSON_SHAPE}
difficulty is Easy, Medium or Hard. nutrition is per serving. cookTime is the total time including any resting, chilling or soaking, written in the output language (e.g. "20분" in Korean).`,
    user: lines.join("\n"),
  };
}

/** 한국 가정에 보통 있는 양념(다른 지역이면 그쪽 기본 양념). 재료가 아니라 "집에 늘 있는 것". */
export function pantryFor(input: RecipeInput): string {
  const korean = /korea|한국/i.test(`${input.region ?? ""} ${input.lang ?? ""}`) || !input.region;
  const all = korean
    ? "소금, 설탕, 진간장, 국간장, 고추장, 고춧가루, 된장, 참기름, 들기름, 식용유, 올리브유, 식초, 다진 마늘, 후추, 깨, 맛술, 올리고당, 밀가루, 부침가루, 전분, 물"
    : "salt, sugar, black pepper, cooking oil, olive oil, butter, soy sauce, vinegar, garlic, flour, dried herbs, stock cube, water";
  // 알레르기·식단·페르소나로 금지된 양념은 목록에서 뺀다(키토면 설탕·밀가루, 순한맛이면 고추장·고춧가루).
  const banned = forbiddenTerms(input);
  return all.split(",").map((x) => x.trim()).filter((x) => !hits(x, banned)).join(", ");
}

/**
 * 모델 출력의 표기를 기계적으로 바로잡는다(모델에 부탁하지 않고 코드로 보장).
 *  - 한국어인데 cookTime 이 "20 min" → "20분"  (측정 36개 중 18개가 영어로 나와 앱에 그대로 노출됐다)
 */
export function normalizeRecipes(recipes: unknown, input: RecipeInput): unknown {
  if (!Array.isArray(recipes)) return recipes;
  const korean = /korean|한국/i.test(input.lang ?? "");
  return recipes.map((r) => {
    if (!r || typeof r !== "object") return r;
    const o = { ...(r as Record<string, unknown>) };
    if (korean && typeof o.cookTime === "string") {
      const ct = o.cookTime.trim();
      const h = ct.match(/(\d+)\s*(hours?|hrs?|h)\b/i);
      const m = ct.match(/(\d+)\s*(minutes?|mins?|m)\b/i);
      if (h || m) {
        const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
        o.cookTime = total >= 60 && total % 60 === 0 ? `${total / 60}시간` : total > 60 ? `${Math.floor(total / 60)}시간 ${total % 60}분` : `${total}분`;
      } else if (/^\d+$/.test(ct)) {
        o.cookTime = `${ct}분`;
      }
    }
    return o;
  });
}
