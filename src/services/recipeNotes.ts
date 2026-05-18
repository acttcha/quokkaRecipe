import * as FileSystem from 'expo-file-system/legacy';

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  askedAt: string;
}

interface RecipeNotes {
  memo: string;
  qaHistory: QAEntry[];
}

function path(recipeId: string) {
  return `${FileSystem.documentDirectory}recipe_notes_${recipeId}.json`;
}

async function load(recipeId: string): Promise<RecipeNotes> {
  try {
    const info = await FileSystem.getInfoAsync(path(recipeId));
    if (!info.exists) return { memo: '', qaHistory: [] };
    return JSON.parse(await FileSystem.readAsStringAsync(path(recipeId)));
  } catch {
    return { memo: '', qaHistory: [] };
  }
}

async function persist(recipeId: string, notes: RecipeNotes) {
  await FileSystem.writeAsStringAsync(path(recipeId), JSON.stringify(notes));
}

export async function getMemo(recipeId: string) {
  return (await load(recipeId)).memo;
}

export async function saveMemo(recipeId: string, memo: string) {
  const notes = await load(recipeId);
  await persist(recipeId, { ...notes, memo });
}

export async function getQAHistory(recipeId: string): Promise<QAEntry[]> {
  return (await load(recipeId)).qaHistory;
}

export async function addQAEntry(recipeId: string, question: string, answer: string): Promise<void> {
  const notes = await load(recipeId);
  const entry: QAEntry = {
    id: Date.now().toString(),
    question,
    answer,
    askedAt: new Date().toISOString(),
  };
  await persist(recipeId, { ...notes, qaHistory: [entry, ...notes.qaHistory] });
}

export async function deleteQAEntry(recipeId: string, entryId: string): Promise<void> {
  const notes = await load(recipeId);
  await persist(recipeId, { ...notes, qaHistory: notes.qaHistory.filter(e => e.id !== entryId) });
}
