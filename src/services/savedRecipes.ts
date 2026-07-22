import * as FileSystem from 'expo-file-system/legacy';
import { Recipe, SavedRecipe } from '../types';

const FILE_PATH = FileSystem.documentDirectory + 'saved_recipes.json';

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    return JSON.parse(raw) as SavedRecipe[];
  } catch {
    return [];
  }
}

export async function saveRecipe(
  recipe: Recipe,
  sourceIngredients: string[],
  meta?: { source?: 'ai' | 'youtube'; youtubeVideoId?: string; youtubeThumbnail?: string; youtubeTitle?: string },
): Promise<void> {
  const saved = await getSavedRecipes();
  const existing = saved.find(r => r.name === recipe.name);
  if (existing) return;

  const newEntry: SavedRecipe = {
    ...recipe,
    id: `${Date.now()}_${recipe.name}`,
    savedAt: new Date().toISOString(),
    sourceIngredients,
    ...meta,
  };
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify([newEntry, ...saved]));
}

/** 사용자가 직접 작성한 레시피를 저장. (이름 중복 검사 없이 항상 새 항목으로 추가) */
export async function addManualRecipe(recipe: Recipe): Promise<void> {
  const saved = await getSavedRecipes();
  const newEntry: SavedRecipe = {
    ...recipe,
    id: `${Date.now()}_manual`,
    savedAt: new Date().toISOString(),
    sourceIngredients: recipe.ingredients,
    source: 'manual',
  };
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify([newEntry, ...saved]));
}

export async function removeRecipe(id: string): Promise<void> {
  const saved = await getSavedRecipes();
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(saved.filter(r => r.id !== id)));
}

export async function moveRecipeToFolder(recipeId: string, folderId: string | null): Promise<void> {
  const saved = await getSavedRecipes();
  const updated = saved.map(r => {
    if (r.id !== recipeId) return r;
    return folderId === null ? { ...r, folderId: undefined } : { ...r, folderId };
  });
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(updated));
}

export async function updateRecipe(id: string, updates: Partial<Recipe>): Promise<void> {
  const saved = await getSavedRecipes();
  const updated = saved.map(r => r.id === id ? { ...r, ...updates } : r);
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(updated));
}

export async function isRecipeSaved(name: string): Promise<boolean> {
  const saved = await getSavedRecipes();
  return saved.some(r => r.name === name);
}
