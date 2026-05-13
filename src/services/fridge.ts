import * as SecureStore from 'expo-secure-store';

const KEY = 'fridge_ingredients';

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
