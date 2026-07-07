import { Router, Request, Response, NextFunction } from 'express';
import { buildLinkGraph, getBacklinks, getOutgoingLinks } from '../services/links.js';
import { memoryDb } from '../db/index.js';

const router = Router();

// GET /links/graph
// 全图数据（节点 + 边）
router.get('/graph', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const graph = buildLinkGraph();
    res.json(graph);
  } catch (error) {
    next(error);
  }
});

// GET /links/backlinks?target=xxx
// 反向链接：哪些记忆指向了 target
router.get('/backlinks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const target = (req.query.target as string || '').trim();
    if (!target) {
      return res.status(400).json({ error: 'target query parameter is required' });
    }
    const backlinks = getBacklinks(target);
    res.json({ target, count: backlinks.length, backlinks });
  } catch (error) {
    next(error);
  }
});

// GET /links/outgoing/:memoryId
// 一条记忆的所有外链
router.get('/outgoing/:memoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = memoryDb.getById(req.params.memoryId);
    if (!memory) {
      return res.status(404).json({ error: `Memory ${req.params.memoryId} not found` });
    }
    const links = getOutgoingLinks(req.params.memoryId);
    res.json({
      memory_id: req.params.memoryId,
      file_path: memory.file_path,
      outgoing: links,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
