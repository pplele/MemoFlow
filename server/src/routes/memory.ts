import { Router, Request, Response, NextFunction } from 'express';
import { memoryDb } from '../db/index.js';
import { createMemory, deleteMemory, updateMemory } from '../services/memory-parser.js';
import { decodeFileName } from '../services/encoding.js';

const router = Router();

// ==================== 类型转换辅助 ====================

interface EntityRow {
  type: string;
  name: string;
  value?: string;
  label?: string;
  deadline?: string;
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

interface UploadedFile {
  name: string;
  path: string;
  size: number;
  mimetype: string;
}

function rowToMemory(row: any) {
  const files = safeParse<UploadedFile[]>(row.files_json, []);
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
    entities: safeParse<EntityRow[]>(row.entities_json, []),
    tags: safeParse<string[]>(row.tags_json, []),
    files: decodedFiles,
    relations: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ==================== POST /memories ====================

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, source, type } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required and must be a non-empty string' });
    }

    const result = await createMemory({
      content: content.trim(),
      source: source || 'web',
      type: type || 'text',
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== GET /memories ====================

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const category = req.query.category as string | undefined;
    const date_from = req.query.date_from as string | undefined;
    const date_to = req.query.date_to as string | undefined;
    const tier = req.query.tier as 'hot' | 'warm' | 'cold' | undefined;
    const type_group = req.query.type_group as 'text' | 'files' | undefined;

    const result = memoryDb.list({ page, limit, category, date_from, date_to, tier, type_group });
    res.json({
      items: result.items.map(rowToMemory),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== GET /memories/:id ====================

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = memoryDb.getById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: `Memory ${req.params.id} not found` });
    }
    res.json(rowToMemory(row));
  } catch (error) {
    next(error);
  }
});

// ==================== PUT /memories/:id ====================

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required for update' });
    }

    const updated = updateMemory(req.params.id, { content: content.trim() });
    if (!updated) {
      return res.status(404).json({ error: `Memory ${req.params.id} not found` });
    }
    res.json(rowToMemory(updated));
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE /memories/:id ====================

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = deleteMemory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: `Memory ${req.params.id} not found` });
    }
    res.json({ id: req.params.id, deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
