// Deterministic, whole-word signal matching for the persona engine.
//
// The plan requires matching scenario signal entries as whole words or whole
// contiguous phrases only — never substring fragments inside unrelated words
// ("nice" must not match "niceties"). We tokenize both the user text and each
// signal into normalized word tokens and compare token sequences directly, so
// no regular expression is ever built from scenario data (no regex-injection
// surface) and the result is purely deterministic.

// Split text into normalized word tokens: lowercase, apostrophes removed so
// contractions match regardless of style ("that's" / "that’s" / "thats"), and
// any run of non-letter/non-number characters (spaces, punctuation, emoji)
// treated as a token boundary. Unicode letters/numbers are preserved so
// accented characters (e.g. "café") survive.
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

// True if the signal's token sequence appears as a contiguous, in-order run
// within the user's token sequence.
function phraseMatches(userTokens: string[], signalTokens: string[]): boolean {
  if (signalTokens.length === 0) return false;
  const limit = userTokens.length - signalTokens.length;
  for (let start = 0; start <= limit; start += 1) {
    let matched = true;
    for (let offset = 0; offset < signalTokens.length; offset += 1) {
      if (userTokens[start + offset] !== signalTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

// True if any signal in the list matches the pre-tokenized user text as a whole
// word or whole phrase.
export function matchesAnySignal(userTokens: string[], signals: string[]): boolean {
  for (const signal of signals) {
    if (phraseMatches(userTokens, tokenize(signal))) return true;
  }
  return false;
}
