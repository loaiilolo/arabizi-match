export function normalizeArabic(input: string): string;
export function toSkeleton(input: string): string;
export function similarity(a: string, b: string): number;
export interface SearchOptions<T> {
  key?: T extends string ? never : (keyof T & string) | ((item: T) => string);
  threshold?: number;
  limit?: number;
}
export interface SearchResult<T> { item: T; score: number }
export function search<T = string>(query: string, items: T[], options?: SearchOptions<T>): SearchResult<T>[];
export interface Index<T> { search(query: string, options?: { threshold?: number; limit?: number }): SearchResult<T>[] }
export function createIndex<T = string>(items: T[], options?: SearchOptions<T>): Index<T>;
