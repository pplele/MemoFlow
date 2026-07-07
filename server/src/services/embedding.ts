import { createEmbedding } from './ai.js';
import { embeddingDb, memoryDb } from '../db/index.js';

// 内存中的向量缓存：Map<memoryId, number[]>
let vectorCache: Map<string, number[]> = new Map();
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  vectorCache = new Map();
  const embeddings = embeddingDb.getAll();
  for (const e of embeddings) {
    try {
      const vector = JSON.parse(e.vector);
      vectorCache.set(e.memory_id, vector);
    } catch (err) {
      console.warn(`[Embedding] Failed to parse vector for ${e.memory_id}`);
    }
  }
  cacheLoaded = true;
  console.log(`[Embedding] Loaded ${vectorCache.size} vectors into memory`);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export async function generateAndStoreEmbedding(memoryId: string, text: string): Promise<void> {
  try {
    const { vector } = await createEmbedding(text);
    const vectorStr = JSON.stringify(vector);
    embeddingDb.upsert(memoryId, vectorStr);
    vectorCache.set(memoryId, vector);
  } catch (error) {
    console.error(`[Embedding] Failed to generate embedding for ${memoryId}:`, error);
  }
}

export async function semanticSearch(query: string, topK = 10): Promise<Array<{ id: string; score: number }>> {
  loadCache();

  if (vectorCache.size === 0) {
    return [];
  }

  try {
    const { vector: queryVector } = await createEmbedding(query);

    const scores: Array<{ id: string; score: number }> = [];
    for (const [memoryId, vector] of vectorCache) {
      const score = cosineSimilarity(queryVector, vector);
      scores.push({ id: memoryId, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  } catch (error) {
    console.error('[Embedding] Semantic search failed:', error);
    return [];
  }
}

export function getSimilarMemories(memoryId: string, topK = 5): Array<{ id: string; score: number }> {
  loadCache();

  const targetVector = vectorCache.get(memoryId);
  if (!targetVector) return [];

  const scores: Array<{ id: string; score: number }> = [];
  for (const [id, vector] of vectorCache) {
    if (id === memoryId) continue;
    const score = cosineSimilarity(targetVector, vector);
    scores.push({ id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

export function removeFromCache(memoryId: string) {
  vectorCache.delete(memoryId);
}

export function getCacheSize(): number {
  return vectorCache.size;
}
