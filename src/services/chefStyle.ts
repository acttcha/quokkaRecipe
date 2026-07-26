import * as SecureStore from 'expo-secure-store';

// "나만의 셰프 스타일" — 구독자가 입력하는 커스텀 프롬프트(말투·취향).
//  레시피 생성 시 스타일 힌트로 주입된다(가드레일은 claude.ts generateRecipeJson 참고).
//  동기 캐시로 생성 시점에 바로 읽을 수 있게 유지.
const KEY = 'chef_style_v1';
export const CHEF_STYLE_MAX = 150;

let _style = '';

export async function loadChefStyle(): Promise<void> {
  try { _style = (await SecureStore.getItemAsync(KEY)) ?? ''; } catch { /* 무시 */ }
}

/** 마지막으로 저장된 커스텀 셰프 스타일(동기). 없으면 ''. */
export function getCachedChefStyle(): string {
  return _style;
}

export async function setChefStyle(text: string): Promise<void> {
  _style = text;
  try { await SecureStore.setItemAsync(KEY, text); } catch { /* 무시 */ }
}
