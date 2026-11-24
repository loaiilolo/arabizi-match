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

test("toSkeleton reads $ as sh only when attached to a letter", () => {
  assert.equal(toSkeleton("$ukran"), toSkeleton("shukran"));
  assert.equal(toSkeleton("$50"), "50");
  assert.equal(toSkeleton("50$"), "50");
});

test("toSkeleton handles digit+apostrophe letters", () => {
  assert.equal(toSkeleton("sha3'al"), toSkeleton("شغل"));
  assert.equal(toSkeleton("7'e$ako"), toSkeleton("خيشاكو"));
  assert.equal(toSkeleton("ma6'loom"), toSkeleton("مظلوم"));
  assert.equal(toSkeleton("9'a3f"), toSkeleton("ضعف"));
});

test("toSkeleton keeps digit+apostrophe literal when no letter is attached", () => {
  assert.equal(toSkeleton("5' 9'"), "5 9");
});

test("toSkeleton maps Latin 9 to ص and drops stray apostrophes inside words", () => {
  assert.equal(toSkeleton("9aba7"), toSkeleton("صباح"));
  assert.equal(toSkeleton("ma'loom"), toSkeleton("maloom"));
});

test("pure numbers (sizes, years, model numbers) are kept literal", () => {
  assert.equal(toSkeleton("39"), "39");
  assert.equal(toSkeleton("size 42"), toSkeleton("sz") + " 42");
  assert.equal(toSkeleton("2024"), "2024");
  assert.equal(toSkeleton("١٢٣"), "123");
  assert.equal(toSkeleton("iphone 13"), toSkeleton("iphone") + " 13");
});

test("search rejects other sizes at the default threshold", () => {
  const items = ["مقاس 39", "مقاس 42", "مقاس 93", "مقاس 38"];
  assert.deepEqual(search("مقاس 39", items).map((x) => x.item), ["مقاس 39"]);
  assert.deepEqual(search("size 39", ["size 39", "size 38", "size 93"]).map((x) => x.item), ["size 39"]);
});

test("pure numbers match exactly at defaults: 39 does not match 395", () => {
  assert.deepEqual(search("size 39", ["size 395", "size 39"]).map((x) => x.item), ["size 39"]);
  assert.deepEqual(search("39", ["395", "39", "3"]).map((x) => x.item), ["39"]);
});

test("text prefix matching for the last word still works", () => {
  assert.deepEqual(search("shan", ["شنطة جلد"], { threshold: 0.7 }).map((x) => x.item), ["شنطة جلد"]);
});
