import test from "node:test";
import assert from "node:assert/strict";
import { search, createIndex, toSkeleton, normalizeArabic } from "arabizi-match";

const P = ["شنطة جلد نسائي","شنطة ظهر مدرسية","جزمة رياضية رجالي","جزمة حريمي كعب","فستان سهرة اسود","فستان قطن صيفي",
  "تليفون سامسونج جالاكسي","شاحن تليفون ايفون","عسل نحل طبيعي","عسل اسود","ساعة يد رجالي","ساعة حائط",
  "تيشيرت قطن 42","بنطلون جينز 42","كوتشي نايك","سماعة بلوتوث"];
const top = (q) => search(q, P)[0]?.item;

test("multiword queries rank the right product above distractors", () => {
  assert.equal(top("shanta zahr"), "شنطة ظهر مدرسية");
  assert.equal(top("shanta geld"), "شنطة جلد نسائي");
  assert.equal(top("gazma harimi"), "جزمة حريمي كعب");
  assert.equal(top("fostan eswed"), "فستان سهرة اسود");
  assert.equal(top("3asal eswed"), "عسل اسود");
  assert.equal(top("telefon iphone"), "شاحن تليفون ايفون");
  assert.equal(top("kotshi nike"), "كوتشي نايك");
});

test("word order does not matter", () => {
  assert.equal(top("ايفون شاحن"), "شاحن تليفون ايفون");
  assert.equal(top("iphone shahen"), "شاحن تليفون ايفون");
});

test("mixed Arabic/Latin and numbers", () => {
  assert.equal(top("تيشيرت 42"), "تيشيرت قطن 42");
  assert.equal(top("tshert 42"), "تيشيرت قطن 42");
});

test("unrelated queries return no results", () => {
  for (const q of ["laptop dell", "pizza", "xyz", "غسالة", "refrigerator"]) {
    assert.deepEqual(search(q, P), [], q);
  }
});

test("empty, whitespace, punctuation and one-letter queries return nothing", () => {
  for (const q of ["", "   ", "!!!", "a", "ab", "؟؟"]) assert.deepEqual(search(q, P), [], JSON.stringify(q));
});

test("invalid input types do not throw", () => {
  for (const v of [undefined, null, {}, [], NaN, Symbol.iterator.description]) {
    assert.doesNotThrow(() => toSkeleton(v));
    assert.doesNotThrow(() => normalizeArabic(v));
  }
  assert.equal(toSkeleton({}), "");
  assert.equal(toSkeleton(undefined), "");
  assert.equal(toSkeleton("😀 \u0000"), "");
  assert.deepEqual(search("shanta", [null, undefined, 5, "شنطة"], { threshold: 0.9 }).map((r) => r.item), ["شنطة"]);
});

test("very long input stays fast", () => {
  const t = Date.now();
  search("a".repeat(100000) + "b", ["b".repeat(100000)], { threshold: 0 });
  assert.ok(Date.now() - t < 1000);
});

test("createIndex gives the same results as search and handles 20k items", () => {
  const big = [];
  for (let i = 0; i < 20000; i++) big.push(`${P[i % P.length]} ${i}`);
  const idx = createIndex(big);
  const t = Date.now();
  const r = idx.search("shanta zahr", { limit: 5 });
  assert.ok(Date.now() - t < 1000);
  assert.equal(r.length, 5);
  assert.deepEqual(r, search("shanta zahr", big, { limit: 5 }));
});

test("documented collisions and misses (limits, not bugs)", () => {
  assert.equal(toSkeleton("kitab"), toSkeleton("كاتب")); // vowels dropped
  assert.deepEqual(search("sa3a heta2t", P), []); // h for ح is not guessed
});
