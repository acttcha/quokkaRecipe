import * as SecureStore from 'expo-secure-store';
import { isPro } from './subscription';

// 쿼카 페르소나 — 메인에서 선택. 기본/자취는 무료, 나머지는 구독자 전용.
//  선택된 페르소나의 prompt 가 레시피 생성 시 스타일로 주입된다(claude.ts).
export interface Persona {
  id: string;
  emoji: string;
  free: boolean;
  image: any;      // require(...)
  prompt: string;  // 레시피 생성용 영어 스타일 지시(기본은 빈 문자열=중립)
}

export const PERSONAS: Persona[] = [
  { id: 'default', emoji: '🐨', free: true, image: require('../../assets/quokka.png'),
    prompt: '' },
  { id: 'solo', emoji: '🏠', free: true, image: require('../../assets/personas/solo.webp'),
    prompt: 'Cook like a budget-conscious student living alone: cheap, very few ingredients, quick and easy, minimal cleanup.' },

  { id: 'diet', emoji: '🥗', free: false, image: require('../../assets/personas/diet.webp'),
    prompt: 'Diet-friendly meals: low in calories but high in satiety, light and healthy.' },
  { id: 'budget', emoji: '💸', free: false, image: require('../../assets/personas/budget.webp'),
    prompt: 'Maximize value for money: cheapest common ingredients, generous portions, economical.' },
  { id: 'lunchbox', emoji: '🍱', free: false, image: require('../../assets/personas/lunchbox.webp'),
    prompt: 'Meal-prep and lunchbox friendly: dishes that keep well, pack easily, and can be batch-cooked ahead.' },
  { id: 'dessert', emoji: '🧁', free: false, image: require('../../assets/personas/dessert.webp'),
    prompt: 'Focus on desserts, baking, and sweet treats.' },
  { id: 'michelin', emoji: '⭐', free: false, image: require('../../assets/personas/michelin.webp'),
    prompt: 'Cook like a fine-dining chef: refined, restaurant-quality dishes with elegant plating and technique, but still doable at home.' },
  { id: 'bulk', emoji: '💪', free: false, image: require('../../assets/personas/bulk.webp'),
    prompt: 'High-protein muscle-building meals for bulking up, with strong protein content.' },
  { id: 'spicy', emoji: '🌶️', free: false, image: require('../../assets/personas/spicy.webp'),
    prompt: 'Bold, spicy, punchy flavors (Korean/Asian heat).' },
  { id: 'vegan', emoji: '🌱', free: false, image: require('../../assets/personas/vegan.webp'),
    prompt: 'Strictly plant-based vegan: absolutely no meat, fish, dairy, eggs, or any animal products.' },
  { id: 'world', emoji: '🌍', free: false, image: require('../../assets/personas/world.webp'),
    prompt: 'Explore diverse world cuisines and adventurous international dishes from various countries.' },
  { id: 'mild', emoji: '🍵', free: false, image: require('../../assets/personas/mild.webp'),
    prompt: 'Mild, gentle, low-sodium, easy-on-the-stomach comfort dishes.' },
  { id: 'keto', emoji: '🥑', free: false, image: require('../../assets/personas/keto.webp'),
    prompt: 'Keto / low-carb high-fat meals: minimize carbs, emphasize healthy fats and protein.' },
  { id: 'granny', emoji: '🧓', free: false, image: require('../../assets/personas/granny.webp'),
    prompt: 'Warm, old-fashioned Korean home-style comfort food like a caring grandmother, with a cozy nostalgic tone.' },
];

export const DEFAULT_PERSONA_ID = 'default';
const KEY = 'persona_id_v1';
let _selectedId = DEFAULT_PERSONA_ID;

export function getPersona(id: string): Persona {
  return PERSONAS.find(p => p.id === id) ?? PERSONAS[0];
}

export async function loadPersona(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v && PERSONAS.some(p => p.id === v)) _selectedId = v;
  } catch { /* 무시 */ }
}

export function getSelectedPersonaId(): string {
  return _selectedId;
}

export async function setSelectedPersona(id: string): Promise<void> {
  if (!PERSONAS.some(p => p.id === id)) return;
  _selectedId = id;
  try { await SecureStore.setItemAsync(KEY, id); } catch { /* 무시 */ }
}

// 실제 적용 페르소나: 유료 페르소나인데 비구독자면 기본으로 폴백(안전장치).
export function getEffectivePersona(): Persona {
  const p = getPersona(_selectedId);
  return (!p.free && !isPro()) ? getPersona(DEFAULT_PERSONA_ID) : p;
}
