// arabizi-match: compare Arabic text and Franco-Arabic (Arabizi) text by
// reducing both to a rough consonant "skeleton" and measuring edit distance.
// This is a heuristic for search, not a transliteration engine.

const TASHKEEL = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const EASTERN = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Normalize Arabic spelling variants and digits. Latin text is lowercased. */
export function normalizeArabic(input) {
  if (typeof input === "number" && Number.isFinite(input)) input = String(input);
  if (typeof input !== "string") return "";
  let s = input.normalize("NFKC");
  s = s.replace(TASHKEEL, "").replace(TATWEEL, "");
  s = s.replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627"); // أ إ آ ٱ -> ا
  s = s.replace(/\u0649/g, "\u064A"); // ى -> ي
  s = s.replace(/\u0629/g, "\u0647"); // ة -> ه
  s = s.replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A"); // ؤ -> و, ئ -> ي
  s = s.replace(/[\u0660-\u0669]/g, (d) => String(EASTERN.indexOf(d)));
  s = s.replace(/[\u06F0-\u06F9]/g, (d) => String(PERSIAN.indexOf(d)));
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Arabic letter -> skeleton token. Confusable emphatic/plain pairs share a token.
const AR = {
  "\u0628": "b", "\u062A": "t", "\u062B": "s", "\u062C": "g", "\u062D": "7",
  "\u062E": "x", "\u062F": "d", "\u0630": "z", "\u0631": "r", "\u0632": "z",
  "\u0633": "s", "\u0634": "S", "\u0635": "s", "\u0636": "d", "\u0637": "t",
  "\u0638": "z", "\u0639": "3", "\u063A": "G", "\u0641": "f", "\u0642": "q",
  "\u0643": "k", "\u0644": "l", "\u0645": "m", "\u0646": "n", "\u0647": "h",
  "\u067E": "b", "\u0686": "g", "\u0698": "z", "\u06A4": "f", "\u06AF": "g",
};
const AR_DROP = new Set(["\u0627", "\u0648", "\u064A", "\u0621"]); // ا و ي ء act as vowels/hamza

const MAX_WORD = 64; // caps edit-distance cost on pathological input

// Latin digraphs first (longest match), then single characters.
const LAT_DIGRAPH = { sh: "S", kh: "x", gh: "G", th: "s", dh: "z", ch: "S", ph: "f" };
const LAT = {
  b: "b", t: "t", s: "s", g: "g", j: "g", d: "d", z: "z", r: "r", f: "f", q: "q",
  k: "k", l: "l", m: "m", n: "n", h: "h", p: "b", v: "f", c: "k", x: "x",
  7: "7", 3: "3", 5: "x", 8: "q", 9: "q", 2: "q", 6: "t", 4: "d",
};
const LAT_DROP = new Set(["a", "e", "i", "o", "u", "y", "w"]);

/**
 * Reduce text (Arabic, Franco-Arabic or mixed) to a skeleton string.
 * A word-final ة/ه/h is dropped so "shanta" matches "شنطة".
 */
export function toSkeleton(input) {
  const words = normalizeArabic(input).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.map(wordSkeleton).filter(Boolean).join(" ");
}

function wordSkeleton(word) {
  const out = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (AR[c]) { out.push(AR[c]); continue; }
    if (AR_DROP.has(c)) continue;
    const two = c + (chars[i + 1] || "");
    if (LAT_DIGRAPH[two]) { out.push(LAT_DIGRAPH[two]); i++; continue; }
    if (LAT_DROP.has(c)) continue;
    if (LAT[c]) { out.push(LAT[c]); continue; }
    if (/\d/.test(c)) out.push(c); // other digits stay as-is (sizes, years)
  }
  // Trailing h comes from ة or a final -a/-ah spelling; treat as optional.
  if (out.length > 1 && out[out.length - 1] === "h") out.pop();
  return out.slice(0, MAX_WORD).join("");
}

// A dropped 2 (hamza/qaf) is cheap to miss: Egyptians write 2 for both.
function delCost(ch) { return ch === "q" ? 0.5 : 1; }

function distance(a, b) {
  const n = a.length, m = b.length;
  let prev = new Array(m + 1);
  prev[0] = 0;
  for (let j = 1; j <= m; j++) prev[j] = prev[j - 1] + delCost(b[j - 1]);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1);
    cur[0] = prev[0] + delCost(a[i - 1]);
    for (let j = 1; j <= m; j++) {
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur[j] = Math.min(sub, prev[j] + delCost(a[i - 1]), cur[j - 1] + delCost(b[j - 1]));
    }
    prev = cur;
  }
  return prev[m];
}

/** Similarity of two single words, 0..1. */
export function similarity(a, b) {
  const sa = toSkeleton(a), sb = toSkeleton(b);
  if (!sa && !sb) return normalizeArabic(a) === normalizeArabic(b) ? 1 : 0;
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  return Math.max(0, 1 - distance(sa, sb) / Math.max(sa.length, sb.length));
}

function score(queryTokens, textTokens) {
  if (!queryTokens.length || !textTokens.length) return 0;
  let total = 0;
  queryTokens.forEach((q, qi) => {
    let best = 0;
    for (const t of textTokens) {
      let s = q === t ? 1 : Math.max(0, 1 - distance(q, t) / Math.max(q.length, t.length));
      // The last query token may be a prefix (search-as-you-type).
      if (qi === queryTokens.length - 1 && q.length >= 2 && t.startsWith(q)) s = Math.max(s, 0.9);
      if (s > best) best = s;
    }
    total += best;
  });
  return total / queryTokens.length;
}

/**
 * Rank items against a query.
 * @param {string} query Arabic, Franco-Arabic or mixed.
 * @param {Array<string|object>} items Strings, or objects when options.key is set.
 * @param {{key?: string|((item:any)=>string), threshold?: number, limit?: number}} [options]
 */
export function search(query, items, options = {}) {
  return createIndex(items, options).search(query, options);
}

/**
 * Precompute item skeletons once for repeated searches over a large list.
 * @returns {{search(query: string, options?: {threshold?: number, limit?: number}): Array<{item: any, score: number}>}}
 */
export function createIndex(items, options = {}) {
  const { key } = options;
  const getText = typeof key === "function" ? key : key ? (x) => x[key] : (x) => x;
  const entries = [];
  for (const item of items) {
    let text;
    try { text = getText(item); } catch { text = ""; }
    entries.push({ item, tokens: toSkeleton(text).split(" ").filter(Boolean) });
  }
  return {
    search(query, opts = {}) {
      const { threshold = 0.7, limit = 10 } = { ...options, ...opts };
      const qTokens = toSkeleton(query).split(" ").filter(Boolean);
      const results = [];
      for (const e of entries) {
        const s = score(qTokens, e.tokens);
        if (s >= threshold) results.push({ item: e.item, score: Math.round(s * 1000) / 1000 });
      }
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    },
  };
}

