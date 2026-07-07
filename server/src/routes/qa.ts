import { Router, Request, Response, NextFunction } from 'express';
import { answerQuestion } from '../services/qa.js';

const router = Router();

// POST /qa
// 基于用户记忆库 + 事实库回答问题
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const result = await answerQuestion(question.trim());
    res.json({
      answer: result.answer,
      sources: result.sources,
      used_memories: result.used_memories,
      used_facts: result.used_facts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
