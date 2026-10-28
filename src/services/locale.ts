import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// 앱 언어 (UI + AI 응답 언어). 'auto' 면 기기 언어 따름.
export type AppLang = 'ko' | 'en';

const LANG_KEY = 'app_language';

// ⚠️ 여러 화면이 모듈 최상위에서 t() 를 평가하는데 그 시점은 loadLocale() 보다 앞이다.
//    그래서 기기 언어를 여기서 미리 반영해봤지만, 저장된 언어 설정(SecureStore)은 동기로 읽을 수 없어
//    "영어 기기 + 한국어 설정" 조합이 오히려 나빠진다 → 기본값을 유지한다.
//    제대로 고치려면 각 화면의 모듈 레벨 t() 를 컴포넌트 안으로 옮겨야 한다.
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

// 로마자/번역 병기 금지 — 예: "된장찌개 (Doenjang Jjigae)" 같은 괄호 병기를 막는다.
const NO_ROMANIZATION = ' Use only that language and its native script — do NOT add romanization, transliteration, pronunciation, or another-language translation in parentheses or brackets.';

/** AI 프롬프트용: 응답 언어만 지정 (비전·Q&A·유튜브 분석 등). */
export function languageDirective(): string {
  return `\n\nWrite all output in ${AI_LANG_NAME[_lang]}.${NO_ROMANIZATION}`;
}

/** AI 프롬프트용: 응답 언어 + 지역(요리 현지화) 지시문 (레시피 추천). */
export function localeDirective(): string {
  const language = AI_LANG_NAME[_lang];
  const country = REGION_NAME[_regionCode] ?? _regionCode;
  // 지역 힌트는 "재료 구하기 현실성 + 현지 입맛"까지만. 예전엔 "흔하고 친숙한 요리"를 요구해서
  // 레시피가 매번 최빈값(김치찌개·볶음밥류)으로 쏠렸다 → 지역 요리·가정식도 열어둔다.
  return `\n\n[Language & Region] Write ALL output text (dish names, descriptions, ingredients, steps, etc.) in ${language}.${NO_ROMANIZATION}${
    country
      ? ` The user is in ${country}; dishes must be realistically makeable with ingredients typically available there and suit local tastes. Everyday local dishes and regional specialties are equally welcome — just don't pick a cuisine the available ingredients clearly can't support.`
      : ''
  }`;
}
