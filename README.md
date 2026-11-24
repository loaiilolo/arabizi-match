# arabizi-match

Match Franco-Arabic (Arabizi) and Arabic spelling variants in search. Zero dependencies, MIT.

People often type Arabic words in Latin letters with digits ("shanta", "7abibi", "3asal") or
spell the same Arabic word several ways (شنطة / شنطه). Plain string search misses these.
`arabizi-match` reduces both scripts to a rough consonant skeleton and ranks items by similarity.

This is a heuristic for search and autocomplete. It is not a transliteration engine and it does
not translate.

## Status

Version 0.1. Rules are tuned for Egyptian Arabic usage and have been tested only on the small
hand-written examples in `test/`. Whether it improves a real shop's search is untested.
Feedback with real queries is welcome.

## Usage

```js
import { search, similarity, normalizeArabic } from "arabizi-match";

const products = [{ name: "شنطة جلد نسائي" }, { name: "جزمة رياضية" }, { name: "فستان سهرة" }];

search("shanta geld", products, { key: "name" });
// [{ item: { name: "شنطة جلد نسائي" }, score: 1 }]

similarity("fostan", "فستان"); // 1
normalizeArabic("مَدْرَسَـة"); // "مدرسه"
```

`search(query, items, { key, threshold = 0.7, limit = 10 })`. The last query word (not a number) also matches
as a prefix, for search-as-you-type. For repeated searches over a large list, build the index once:

```js
import { createIndex } from "arabizi-match";
const index = createIndex(products, { key: "name" });
index.search("gazma", { limit: 5 });
```

Try `demo/index.html` through any static server (`python3 -m http.server`, open `/demo/`).

## How it works

1. Normalize: strip diacritics and tatweel, fold أ/إ/آ to ا, ى to ي, ة to ه, convert Eastern
   and Persian digits.
2. Skeleton: map letters to consonant classes (for example ص/س/ث to `s`, ط/ت to `t`,
   `3` and ع to `3`, `7` and ح to `7`, `5`/kh and خ to `x`), drop vowel letters, drop a final
   ه/h. Latin digraphs sh, kh, gh, th, dh are handled, plus `$` for sh and `3'`, `7'`, `9'`, `6'`
   for غ, خ, ض, ظ. A number on its own (size, year, model number) is kept as written and only matches the same number exactly, with no prefix matching.
3. Compare words by edit distance. Dropping `q` costs half, since Egyptians write `2` for both
   hamza and qaf.

## Checks run so far

- 20 tests (`npm test`), passing on Node 18, 20 and 22 locally. They cover multiword ranking against
  distractor products, word order, mixed Arabic/Latin with digits, unrelated queries, empty and
  invalid inputs, very long input, and a 20,000 item list.
- Types compile under `tsc --strict`.
- Measured: about 0.4 s for one uncached `search` over 50,000 short items on a shared test machine;
  use `createIndex` for repeated queries.
- The test products and queries were written by the author, not collected from real shops.

## Known limitations

- Vowels are dropped, so different words can collide (`kitab` and `كاتب`).
- `w` and `y` are treated as vowels, so words that depend on them as consonants match loosely.
- Only Egyptian-style conventions are tuned. Gulf and Levantine Franco is not tested.
- Words that mix letters and digits (`s23`, `2x`) are read as Franco-Arabic, so model codes can match loosely.
- Matching is word by word with no stemming or morphology.
- `h` is not guessed as ح (people write `7`), so "heta2t" does not match "حائط".
- Items sharing one query word can score around 0.75 even when other words differ; tune `threshold`.
- Not production-ready: no real-world evaluation yet.

## Roadmap

- Larger, community-reviewed test set of real queries
- Optional dialect profiles
- A PHP port

## Development

```
npm test
```

License: MIT
