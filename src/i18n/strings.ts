import type { AppLang } from '../services/locale';
import ko from './ko.json';
import en from './en.json';

// 모든 UI 문자열. 'namespace.key' 평면 키. 동적값은 {var} 자리표시자.
// 실제 데이터는 ko.json / en.json 에 있다 (이스케이프 안전).
export const STRINGS: Record<AppLang, Record<string, string>> = { ko, en };
