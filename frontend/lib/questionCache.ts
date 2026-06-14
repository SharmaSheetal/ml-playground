// Client-side question pool cache - stores AI-generated questions in localStorage.
// Avoids hitting the LLM on every click: generates 3 at once, pops randomly until
// pool is empty, then refills. Separate pools per section+type (quiz / practice).

const CACHE_KEY  = 'mlops_q_pool';
const BATCH_SIZE = 3;  // how many questions to generate per LLM call
const REFILL_AT  = 1;  // refill when pool drops to this size

interface Pool {
  available: string[];
}
type CacheStore = Record<string, Pool>;

function load(): CacheStore {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); }
  catch { return {}; }
}

function save(store: CacheStore): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(store));
}

/** Return and remove a random question from the pool. Returns null if empty. */
export function popQuestion(key: string): string | null {
  const store = load();
  const pool  = store[key]?.available ?? [];
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const q   = pool[idx];
  save({ ...store, [key]: { available: pool.filter((_, i) => i !== idx) } });
  return q;
}

/** Add questions to a pool (deduplicates). */
export function pushQuestions(key: string, questions: string[]): void {
  const store    = load();
  const existing = store[key]?.available ?? [];
  const existingSet = new Set(existing);
  const fresh    = questions.filter(q => !existingSet.has(q));
  save({ ...store, [key]: { available: existing.concat(fresh) } });
}

/** True when the pool is at or below REFILL_AT - caller should trigger a background refill. */
export function needsRefill(key: string): boolean {
  return (load()[key]?.available.length ?? 0) <= REFILL_AT;
}

/** How many questions are sitting in the pool. */
export function poolSize(key: string): number {
  return load()[key]?.available.length ?? 0;
}

/** Cache key helpers */
export const quizKey     = (heading: string) => `quiz:${heading}`;
export const practiceKey = (heading: string) => `practice:${heading}`;

/** Parse a numbered-list LLM response into individual questions.
 *  Handles formats like "1. Q\n2. Q\n3. Q" or double-newline-separated. */
export function parseQuestionBatch(raw: string): string[] {
  // Try "1. ..." or "1) ..." patterns
  const numbered = raw.split(/\n/).filter(l => /^\d+[.)]\s+/.test(l.trim()));
  if (numbered.length >= 2) {
    return numbered.map(l => l.replace(/^\d+[.)]\s+/, '').trim()).filter(Boolean);
  }
  // Try double-newline separation
  const paras = raw.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paras.length >= 2) return paras;
  // Single question fallback
  return [raw.trim()].filter(Boolean);
}

/** Prompt that asks for BATCH_SIZE questions at once. */
export function buildBatchPrompt(heading: string, body: string, type: 'quiz' | 'practice'): string {
  const focus = type === 'practice'
    ? 'Each should test a DIFFERENT aspect - trade-offs, failure modes, edge cases, production implications, or common mistakes. These will be answered and evaluated.'
    : 'Each should test a DIFFERENT angle - one on trade-offs, one on edge cases, one on production implications. These are just for reflection.';

  return `You are a senior ML engineer.

Based on this concept:
## ${heading}
${body}

Generate exactly ${BATCH_SIZE} technical interview questions. ${focus}

Return ONLY the questions, numbered exactly like this (no preamble, no explanations):
1. [first question]
2. [second question]
3. [third question]`;
}

export { BATCH_SIZE };
