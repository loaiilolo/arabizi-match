import test from "node:test";
import assert from "node:assert/strict";
import { normalizeArabic, toSkeleton, similarity, search } from "../src/index.js";

test("normalizeArabic folds spelling variants and digits", () => {
  assert.equal(normalizeArabic("أحمد"), "احمد");
  assert.equal(normalizeArabic("مَدْرَسَـة"), "مدرسه");
  assert.equal(normalizeArabic("مستشفى"), "مستشفي");
  assert.equal(normalizeArabic("٢٠٢٦"), "2026");
  assert.equal(normalizeArabic("  SHANTA   Gedida "), "shanta gedida");
});

test("Franco and Arabic share a skeleton", () => {
  assert.equal(toSkeleton("shanta"), toSkeleton("شنطة"));
  assert.equal(toSkeleton("7abibi"), toSkeleton("حبيبي"));
  assert.equal(toSkeleton("3asal"), toSkeleton("عسل"));
  assert.equal(toSkeleton("kheyar"), toSkeleton("خيار"));
  assert.equal(toSkeleton("gazma"), toSkeleton("جزمة"));
});

test("similarity is 1 for equivalent spellings and low for unrelated words", () => {
  assert.equal(similarity("fostan", "فستان"), 1);
  assert.ok(similarity("fostan", "فستان") > similarity("fostan", "شنطة"));
  assert.ok(similarity("telefon", "تليفون") >= 0.8);
  assert.ok(similarity("shanta", "gazma") < 0.5);
});

const products = [
  { id: 1, name: "شنطة جلد نسائي" },
  { id: 2, name: "جزمة رياضية" },
  { id: 3, name: "فستان سهرة" },
  { id: 4, name: "عسل نحل طبيعي" },
  { id: 5, name: "تليفون سامسونج" },
];

test("search finds Arabic products from Franco queries", () => {
  assert.equal(search("shanta geld", products, { key: "name" })[0].item.id, 1);
  assert.equal(search("gazma", products, { key: "name" })[0].item.id, 2);
  assert.equal(search("fostan sahra", products, { key: "name" })[0].item.id, 3);
  assert.equal(search("3asal", products, { key: "name" })[0].item.id, 4);
});

test("search supports Arabic queries with spelling variants", () => {
  assert.equal(search("شنطه", products, { key: "name" })[0].item.id, 1);
  assert.equal(search("تلفون", products, { key: "name" })[0].item.id, 5);
});

test("search supports prefixes for search-as-you-type", () => {
  assert.equal(search("fost", products, { key: "name" })[0].item.id, 3);
});

test("search returns nothing below threshold and respects limit", () => {
  assert.deepEqual(search("laptop", products, { key: "name" }), []);
  assert.equal(search("a", ["ا", "ب"], { threshold: 0 }).length, 2);
  assert.equal(search("shanta", ["شنطة", "شنطه", "شنطة كبيرة"], { limit: 2 }).length, 2);
});

test("string items and key function work", () => {
  assert.equal(search("gazma", ["جزمة"])[0].item, "جزمة");
  assert.equal(search("gazma", products, { key: (p) => p.name })[0].item.id, 2);
});

test("empty and non-string input do not throw", () => {
  assert.equal(toSkeleton(""), "");
  assert.equal(toSkeleton(null), "");
  assert.deepEqual(search("", products, { key: "name" }), []);
});

test("known limitation: vowels are dropped, so some different words collide", () => {
  // "kitab" (كتاب) and "katib" (كاتب) share the skeleton "ktb". Documented in README.
  assert.equal(toSkeleton("kitab"), toSkeleton("كاتب"));
});

test("digits that are not Franco letters are kept", () => {
  assert.equal(toSkeleton("تيشيرت 42"), toSkeleton("tshert 42"));
});
