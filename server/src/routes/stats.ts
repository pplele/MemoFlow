import { Router, Request, Response, NextFunction } from 'express';
import { memoryDb } from '../db/index.js';

const router = Router();

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = memoryDb.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
