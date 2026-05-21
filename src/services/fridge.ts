import * as SecureStore from 'expo-secure-store';

const KEY = 'fridge_ingredients';

// 항상 있다고 간주 (냉장고에 입력 없어도 OK) — 물은 여기서만 처리
const ALWAYS_AVAILABLE = [
  '물', '소금', '설탕', '후추', '흑후추', '백후추', '식용유',
  '올리브오일', '참기름', '들기름', '식초', '물엿', '맛술',
];

export function isBasicIngredient(recipeIng: string): boolean {
  const lower = recipeIng.toLowerCase();
  return ALWAYS_AVAILABLE.some(b => lower.includes(b));
}

export function matchesFridge(fridgeItems: string[], recipeIng: string): boolean {
  if (isBasicIngredient(recipeIng)) return true;
  const lower = recipeIng.toLowerCase();
  return fridgeItems.some(fi => lower.includes(fi.toLowerCase()));
}

export function getMissingIngredients(fridgeItems: string[], recipeIngredients: string[]): string[] {
  return recipeIngredients.filter(ing => !matchesFridge(fridgeItems, ing));
}

export async function getFridgeIngredients(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

async function persist(items: string[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(items));
}

export async function addIngredients(items: string[]): Promise<void> {
  const existing = await getFridgeIngredients();
  const trimmed = items.map(i => i.trim()).filter(Boolean);
  const merged = Array.from(new Set([...existing, ...trimmed]));
  await persist(merged);
}

export async function addIngredient(item: string): Promise<void> {
  const trimmed = item.trim();
  if (!trimmed) return;
  const existing = await getFridgeIngredients();
  if (existing.includes(trimmed)) return;
  await persist([...existing, trimmed]);
}

export async function removeIngredient(item: string): Promise<void> {
  const existing = await getFridgeIngredients();
  await persist(existing.filter(i => i !== item));
}

export async function clearFridge(): Promise<void> {
  await persist([]);
}

const SETUP_KEY = 'fridge_setup_done';

export async function isFridgeSetupDone(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(SETUP_KEY);
  return !!val;
}

export async function markFridgeSetupDone(): Promise<void> {
  await SecureStore.setItemAsync(SETUP_KEY, '1');
}
