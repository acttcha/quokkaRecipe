// 1.0.5 앱이 보내는 요청 본문을 앱 소스 템플릿 그대로 재구성
const NO_ROM = ' Use only that language and its native script — do NOT add romanization, transliteration, pronunciation, or another-language translation in parentheses or brackets.';
function legacyBody({ ings, prefs = [], exclude = [], recent = [], servings = 2, persona, style, lang = 'Korean (한국어)', country = 'South Korea' }) {
  const prefText = prefs.length ? `\n\n[User preferences — MUST be reflected]\n${prefs.join('\n')}` : '';
  const ex = exclude.length ? `\nExclude (already recommended, do not repeat): ${exclude.join(', ')}` : '';
  const rc = recent.length ? `\nRecently recommended to this user — avoid repeating these unless one is clearly the best fit: ${recent.slice(0, 10).join(', ')}` : '';
  const sv = `\nServings: make it for ${servings} serving(s) — scale ingredient amounts and nutrition for ${servings} serving(s), and set JSON "servings" to ${servings}.`;
  const vd = `\n\n[Variety seed — soft hint for THIS request only]\nBefore settling on the obvious choice, look at these directions first: "soup or stew" and "steamed".\nThis is only a starting direction so repeated requests don't return the same dishes. If the ingredients or the user's preferences don't fit it, ignore it completely and pick dishes that genuinely fit — never force a mismatch.`;
  const loc = `\n\n[Language & Region] Write ALL output text (dish names, descriptions, ingredients, steps, etc.) in ${lang}.${NO_ROM} The user is in ${country}; dishes must be realistically makeable with ingredients typically available there and suit local tastes. Everyday local dishes and regional specialties are equally welcome — just don't pick a cuisine the available ingredients clearly can't support.`;
  let system = 'You are a skilled home cook ... (RECIPE_SYSTEM)';
  if (persona) system += `\n\n[Chef persona — APPLY THIS STRONGLY]\nThe user has chosen a chef persona. Actively choose the DISHES and cooking style that best match this persona (not just tone) while still making the most of the available ingredients. Persona: ${persona}\nIf the persona implies a hard dietary constraint (e.g. vegan → no animal products, keto → minimal carbs, low-sodium), you MUST honor it strictly even if it means picking different dishes.`;
  if (style) system += `\n\n[User custom preference — STYLE/TONE HINT ONLY]\n"${style}"\nTreat this as a soft preference only.`;
  system += `\n\nAlways output real, valid recipes in the EXACT JSON format specified above.`;
  return {
    model: 'gemini-flash-lite-latest',
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: `Ingredients: ${ings.join(', ')}${prefText}${ex}${rc}${sv}${vd}` + loc }] }],
    generationConfig: { maxOutputTokens: 2200, temperature: 1, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' },
  };
}
module.exports = { legacyBody };
