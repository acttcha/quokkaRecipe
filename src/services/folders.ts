import * as FileSystem from 'expo-file-system/legacy';
import { Folder } from '../types';

const FILE_PATH = FileSystem.documentDirectory + 'folders.json';

export async function getFolders(): Promise<Folder[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    return JSON.parse(raw) as Folder[];
  } catch {
    return [];
  }
}

export async function createFolder(name: string): Promise<Folder> {
  const folders = await getFolders();
  const newFolder: Folder = {
    id: `folder_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
  };
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify([...folders, newFolder]));
  return newFolder;
}

export async function deleteFolder(id: string): Promise<void> {
  const folders = await getFolders();
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(folders.filter(f => f.id !== id)));
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folders = await getFolders();
  await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(
    folders.map(f => f.id === id ? { ...f, name } : f)
  ));
}
