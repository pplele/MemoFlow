import { Router, Request, Response, NextFunction } from 'express';
import { memoryDb, factDb } from '../db/index.js';
import { semanticSearch } from '../services/embedding.js';
import { decodeFileName } from '../services/encoding.js';

const router = Router();

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// 归一化关键词分数到 0-1 区间
function normalizeKeywordScores(
  hits: Array<any & { score: number }>
): Map<string, number> {
  if (hits.length === 0) return new Map();
  const maxScore = Math.max(...hits.map((h) => h.score));
  const result = new Map<string, number>();
  for (const h of hits) {
    result.set(h.id, maxScore > 0 ? h.score / maxScore : 0);
  }
  return result;
}

// GET /search?q=keyword
// 混合搜索：关键词匹配 + 向量语义召回 + 分数融合
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'query parameter q is required' });
    }

    const topK = parseInt(req.query.top_k as string, 10) || 20;
    const keywordWeight = parseFloat(req.query.kw_weight as string) || 0.6;
    const vectorWeight = parseFloat(req.query.vec_weight as string) || 0.4;

    // 1. 关键词搜索
    const keywordHits = memoryDb.search(query).slice(0, topK * 2);
    const keywordScores = normalizeKeywordScores(keywordHits);

    // 2. 向量语义搜索（异步执行，失败则仅用关键词）
    let vectorHits: Array<{ id: string; score: number }> = [];
    try {
      vectorHits = await semanticSearch(query, topK * 2);
    } catch (err) {
      console.warn('[Search] Semantic search failed, falling back to keyword only:', err);
    }
    const vectorScores = new Map<string, number>();
    for (const v of vectorHits) {
      vectorScores.set(v.id, v.score);
    }

    // 3. 融合两个召回源的结果
    const allIds = new Set<string>([...keywordScores.keys(), ...vectorScores.keys()]);
    const fused: Array<{ id: string; score: number; keywordScore: number; vectorScore: number }> = [];
    for (const id of allIds) {
      const ks = keywordScores.get(id) || 0;
      const vs = vectorScores.get(id) || 0;
      const score = ks * keywordWeight + vs * vectorWeight;
      fused.push({ id, score, keywordScore: ks, vectorScore: vs });
    }

    // 4. 排序并取 Top-K
    fused.sort((a, b) => b.score - a.score);
    const topResults = fused.slice(0, topK);

    // 5. 从 DB 读取完整记忆信息
    const memoryResults = topResults.map((r) => {
      const row = memoryDb.getById(r.id);
      if (!row) return null;
      const files = safeParse<Array<{ name: string; path: string; mimetype: string }>>(row.files_json, []);
      const decodedFiles = files.map(f => ({
        ...f,
        name: decodeFileName(f.name),
      }));
      return {
        id: row.id,
        file_path: row.file_path,
        source: row.source,
        type: row.type,
        category: row.category || undefined,
        raw_content: row.raw_content,
        summary: row.summary || undefined,
        entities: safeParse(row.entities_json, []),
        tags: safeParse(row.tags_json, []),
        files: decodedFiles,
        relations: [],
        created_at: row.created_at,
        updated_at: row.updated_at,
        score: Math.round(r.score * 100) / 100,
      };
    }).filter(Boolean) as Array<any>;

    // 6. 事实搜索（仅关键词匹配）
    const factHits = factDb.search(query).slice(0, 10).map((f) => ({
      id: f.id,
      entity: f.entity,
      attribute: f.attribute,
      value: f.value,
      confidence: f.confidence ?? undefined,
      source_count: f.source_count ?? undefined,
      sources: safeParse(f.sources_json, []),
      created_at: f.created_at || undefined,
      updated_at: f.updated_at || undefined,
    }));

    res.json({
      query,
      memories: memoryResults,
      facts: factHits,
      search_meta: {
        keyword_count: keywordHits.length,
        vector_count: vectorHits.length,
        keyword_weight: keywordWeight,
        vector_weight: vectorWeight,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
