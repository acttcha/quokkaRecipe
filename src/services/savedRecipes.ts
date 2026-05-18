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

export async function saveRecipe(recipe: Recipe, sourceIngredients: string[]): Promise<void> {
  const saved = await getSavedRecipes();
  const existing = saved.find(r => r.name === recipe.name);
  if (existing) return; // 이미 저장됨

  const newEntry: SavedRecipe = {
    ...recipe,
    id: `${Date.now()}_${recipe.name}`,
    savedAt: new Date().toISOString(),
    sourceIngredients,
  };
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify([newEntry, ...saved]));
}

export async function removeRecipe(id: string): Promise<void> {
  const saved = await getSavedRecipes();
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(saved.filter(r => r.id !== id)));
}

export async function isRecipeSaved(name: string): Promise<boolean> {
  const saved = await getSavedRecipes();
  return saved.some(r => r.name === name);
}
