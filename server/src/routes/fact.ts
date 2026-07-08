import { Router, Request, Response, NextFunction } from 'express';
import { factDb } from '../db/index.js';
import { runFactExtraction } from '../services/fact-extractor.js';
import { writeFactsToVault, writeFactToVault } from '../services/fact-writer.js';
import { safeParse } from '../utils/index.js';

const router = Router();

function rowToFact(row: any) {
  return {
    id: row.id,
    entity: row.entity,
    attribute: row.attribute,
    value: row.value,
    confidence: row.confidence ?? undefined,
    source_count: row.source_count ?? undefined,
    sources: safeParse(row.sources_json, []),
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

// GET /facts
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const facts = factDb.all().map(rowToFact);
    res.json({ items: facts, total: facts.length });
  } catch (error) {
    next(error);
  }
});

// GET /facts/:entity
router.get('/:entity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = decodeURIComponent(req.params.entity);
    const facts = factDb.getByEntity(entity).map(rowToFact);
    res.json({ entity, facts });
  } catch (error) {
    next(error);
  }
});

// PUT /facts/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = factDb.update(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: `Fact ${req.params.id} not found` });
    }
    writeFactToVault(updated.entity);
    res.json(rowToFact(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /facts/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fact = factDb.getById(req.params.id);
    const deleted = factDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: `Fact ${req.params.id} not found` });
    }
    if (fact) {
      writeFactToVault(fact.entity);
    }
    res.json({ id: req.params.id, deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /facts/extract
// 从所有记忆中提取事实（去重合并到事实库）
router.post('/extract', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const extracted = await runFactExtraction();
    const facts = factDb.all().map(rowToFact);
    res.json({
      extracted_count: extracted.length,
      facts: facts.slice(-extracted.length),
    });
  } catch (error) {
    const message = (error as Error)?.message || '提取失败';
    console.warn('[FactExtract] failed:', message);
    res.json({
      extracted_count: 0,
      facts: [],
      success: false,
      error: message.includes('DOUBAO_API_KEY')
        ? 'AI 服务未配置（缺少 DOUBAO_API_KEY），无法提取事实'
        : message,
    });
  }
});

export default router;
