import * as FileSystem from 'expo-file-system/legacy';

// 요리 일기 — "내가 만든 요리" 완성 사진 기록. 서버 없이 폰 로컬에만 저장.
// 사진 파일은 앱 영구 폴더(cook_photos/)로 복사하고, 메타데이터만 JSON에 보관.

const FILE_PATH = FileSystem.documentDirectory + 'cooking_log.json';
const PHOTO_DIR = FileSystem.documentDirectory + 'cook_photos/';

export interface CookLog {
  id: string;
  recipeName: string;
  photoUri: string;   // 영구 폴더 내 파일 경로
  cookedAt: string;   // ISO
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export async function getCookLogs(): Promise<CookLog[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    return JSON.parse(raw) as CookLog[];
  } catch {
    return [];
  }
}

async function writeAll(list: CookLog[]): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(list));
}

// 임시 캐시 경로(srcUri)를 영구 폴더로 복사하고 기록 추가.
export async function addCookLog(recipeName: string, srcUri: string): Promise<CookLog> {
  await ensureDir();
  const id = `${Date.now()}`;
  const ext = (srcUri.split('.').pop() || 'jpg').split('?')[0].slice(0, 4) || 'jpg';
  const dest = `${PHOTO_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  const entry: CookLog = { id, recipeName, photoUri: dest, cookedAt: new Date().toISOString() };
  const list = await getCookLogs();
  await writeAll([entry, ...list]);
  return entry;
}

export async function removeCookLog(id: string): Promise<void> {
  const list = await getCookLogs();
  const target = list.find(l => l.id === id);
  if (target) {
    try { await FileSystem.deleteAsync(target.photoUri, { idempotent: true }); } catch { /* 파일 없으면 무시 */ }
  }
  await writeAll(list.filter(l => l.id !== id));
}

export async function getCookLogsForRecipe(recipeName: string): Promise<CookLog[]> {
  const list = await getCookLogs();
  return list.filter(l => l.recipeName === recipeName);
}

export async function getCookLogCount(): Promise<number> {
  return (await getCookLogs()).length;
}
