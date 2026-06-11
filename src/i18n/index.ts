import { getLang } from '../services/locale';
import { STRINGS } from './strings';

/**
 * 번역 함수. key 는 'namespace.key' 형식.
 * 동적 값은 문자열 안에 {name} 형태로 넣고 vars 로 치환.
 *   t('home.charged', { count: 2 })  // "잎사귀 2개가 충전됐어요!"
 * 누락된 키는 한국어 → 키 순으로 폴백(앱이 깨지지 않음).
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = getLang();
  let s = STRINGS[lang]?.[key] ?? STRINGS.ko?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export { useLang, getLang, setLang } from '../services/locale';
