/**
 * Token estimates. Each model family counts tokens its own way and the exact
 * count needs that vendor's API, so the engine estimates from characters and
 * says so wherever it shows a number. About four characters a token is the
 * usual figure for English text.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
