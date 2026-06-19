import * as FileSystem from 'expo-file-system/legacy';

// 장보기 목록 — 폰 로컬에만 저장. 항목 추가 → 하나씩 체크(줄긋기) → 냉장고로 이동.

const FILE_PATH = FileSystem.documentDirectory + 'shopping_list.json';

export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

export async function getShoppingList(): Promise<ShoppingItem[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    return JSON.parse(raw) as ShoppingItem[];
  } catch {
    return [];
  }
}

async function writeAll(list: ShoppingItem[]): Promise<ShoppingItem[]> {
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(list));
  return list;
}

// 중복(대소문자·공백 무시) 제외하고 추가. 새 항목은 맨 위.
export async function addShoppingItems(names: string[]): Promise<ShoppingItem[]> {
  const list = await getShoppingList();
  const existing = new Set(list.map(i => i.name.trim().toLowerCase()));
  const toAdd: ShoppingItem[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || existing.has(key)) continue;
    existing.add(key);
    toAdd.push({ id: `${Date.now()}_${toAdd.length}`, name, checked: false });
  }
  return writeAll([...toAdd, ...list]);
}

export async function toggleShoppingItem(id: string): Promise<ShoppingItem[]> {
  const list = await getShoppingList();
  return writeAll(list.map(i => (i.id === id ? { ...i, checked: !i.checked } : i)));
}

export async function removeShoppingItem(id: string): Promise<ShoppingItem[]> {
  const list = await getShoppingList();
  return writeAll(list.filter(i => i.id !== id));
}

export async function clearCheckedItems(): Promise<ShoppingItem[]> {
  const list = await getShoppingList();
  return writeAll(list.filter(i => !i.checked));
}
