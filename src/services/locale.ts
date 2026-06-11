import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// 앱 언어 (UI + AI 응답 언어). 'auto' 면 기기 언어 따름.
export type AppLang = 'ko' | 'en';

const LANG_KEY = 'app_language';

let _lang: AppLang = 'ko';
let _regionCode = 'KR';   // ISO 지역코드 (예: KR, US, JP) — AI 추천 현지화용

// AI 프롬프트에 넣을 언어 이름
const AI_LANG_NAME: Record<AppLang, string> = {
  ko: 'Korean (한국어)',
  en: 'English',
};

// 흔한 지역코드 → 영문 국가명 (AI 가 알아듣게). 없으면 코드 그대로 전달.
const REGION_NAME: Record<string, string> = {
  KR: 'South Korea', US: 'the United States', JP: 'Japan', CN: 'China',
  TW: 'Taiwan', GB: 'the United Kingdom', CA: 'Canada', AU: 'Australia',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', MX: 'Mexico',
  IN: 'India', TH: 'Thailand', VN: 'Vietnam', ID: 'Indonesia',
  PH: 'the Philippines', SG: 'Singapore', BR: 'Brazil',
};

export async function loadLocale(): Promise<void> {
  try {
    const locales = Localization.getLocales();
    const device = locales?.[0];
    _regionCode = device?.regionCode ?? 'KR';

    const saved = await SecureStore.getItemAsync(LANG_KEY);
    if (saved === 'ko' || saved === 'en') {
      _lang = saved;
    } else {
      // 저장값 없으면 기기 언어로 — 한국어면 ko, 그 외 전부 en
      _lang = device?.languageCode === 'ko' ? 'ko' : 'en';
    }
  } catch {
    _lang = 'ko';
    _regionCode = 'KR';
  }
}

export function getLang(): AppLang {
  return _lang;
}

/** 기기/저장된 ISO 지역코드 (예: KR, US). YouTube 검색 현지화 등에 사용. */
export function getRegionCode(): string {
  return _regionCode;
}

// ── 언어 변경 구독 (UI 즉시 반영용) ──────────────────────────
const _listeners = new Set<() => void>();
function notify() { _listeners.forEach(fn => fn()); }
function subscribe(fn: () => void) { _listeners.add(fn); return () => { _listeners.delete(fn); }; }

/** 현재 언어를 반환하는 hook — 언어 바뀌면 구독 컴포넌트가 리렌더된다. */
export function useLang(): AppLang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export async function setLang(l: AppLang): Promise<void> {
  if (_lang === l) return;
  _lang = l;
  notify();
  await SecureStore.setItemAsync(LANG_KEY, l);
}

/** AI 프롬프트용: 응답 언어만 지정 (비전·Q&A·유튜브 분석 등). */
export function languageDirective(): string {
  return `\n\nWrite all output in ${AI_LANG_NAME[_lang]}.`;
}

/** AI 프롬프트용: 응답 언어 + 지역(요리 현지화) 지시문 (레시피 추천). */
export function localeDirective(): string {
  const language = AI_LANG_NAME[_lang];
  const country = REGION_NAME[_regionCode] ?? _regionCode;
  return `\n\n[Language & Region] Write ALL output text (dish names, descriptions, ingredients, steps, etc.) in ${language}.${
    country
      ? ` The user is in ${country}; prefer dishes that are commonly eaten and familiar there, and that can realistically be made with ingredients typically available in that country. Do not force unfamiliar cuisine.`
      : ''
  }`;
}
