import { memoryDb, factDb, MemoryRow, FactRow } from '../db/index.js';
import { semanticSearch } from './embedding.js';
import { chatCompletion, ChatMessage } from './ai.js';
import { decodeFileName } from './encoding.js';

const QA_SYSTEM_PROMPT = `你是一个个人数字记忆助手，名字叫 MemoFlow。你的任务是基于用户的【个人记忆库】回答问题。

规则：
1. 严格基于下方提供的【相关记忆】和【相关事实】回答，不要编造信息。
2. 如果记忆中包含答案，整合信息后用自然、亲切的中文回答。
3. 在回答末尾用 [1]、[2] 这种格式标注信息来源编号。
4. 如果记忆中没有相关信息，礼貌地告诉用户"暂无相关记忆"，并建议补充。
5. 回答尽量简洁、结构化，可以使用列表或小标题。`;

export interface QASource {
  id: string;
  type: 'memory' | 'fact';
  content: string;
  summary?: string;
  category?: string;
  file_path?: string;
  files?: Array<{ name: string; path: string; mimetype: string }>;
  score: number;
}

export interface QAResult {
  answer: string;
  sources: QASource[];
  used_memories: number;
  used_facts: number;
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  const commonWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '呢', '吗', '吧', '啊', '呀']);
  
  const chineseChars = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const word of chineseChars) {
    if (!commonWords.has(word)) {
      keywords.push(word);
    }
    const singleChars = word.split('');
    for (let i = 0; i < singleChars.length - 1; i++) {
      const twoChar = singleChars[i] + singleChars[i + 1];
      if (!commonWords.has(twoChar)) {
        keywords.push(twoChar);
      }
    }
    for (let i = 0; i < singleChars.length - 2; i++) {
      const threeChar = singleChars[i] + singleChars[i + 1] + singleChars[i + 2];
      if (!commonWords.has(threeChar)) {
        keywords.push(threeChar);
      }
    }
  }
  
  const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
  const mixedWords = text.match(/[\u4e00-\u9fa5][a-zA-Z]+|[a-zA-Z]+[\u4e00-\u9fa5]/g) || [];
  
  keywords.push(...englishWords, ...mixedWords);
  
  return [...new Set(keywords)].slice(0, 10);
}

/**
 * 召回 Top-K 记忆：先用关键词，再用向量，去重合并。
 * 关键词分数 0.6 + 向量分数 0.4。
 */
async function recallMemories(
  query: string,
  topK = 5
): Promise<Array<{ row: MemoryRow; score: number }>> {
  const keywords = extractKeywords(query);
  const keywordScores = new Map<string, number>();

  for (const kw of keywords) {
    const hits = memoryDb.search(kw);
    if (hits.length > 0) {
      const max = Math.max(...hits.map((h) => h.score));
      for (const h of hits) {
        const current = keywordScores.get(h.id) || 0;
        const normalized = max > 0 ? h.score / max : 0;
        keywordScores.set(h.id, Math.max(current, normalized));
      }
    }
  }

  if (keywordScores.size === 0) {
    const directHits = memoryDb.search(query);
    if (directHits.length > 0) {
      const max = Math.max(...directHits.map((h) => h.score));
      for (const h of directHits) {
        keywordScores.set(h.id, max > 0 ? h.score / max : 0);
      }
    }
  }

  let vectorScores = new Map<string, number>();
  try {
    const vectorHits = await semanticSearch(query, topK * 2);
    for (const v of vectorHits) {
      vectorScores.set(v.id, v.score);
    }
  } catch (err) {
    console.warn('[QA] Vector search failed, keyword only:', err);
  }

  const allIds = new Set<string>([...keywordScores.keys(), ...vectorScores.keys()]);
  const fused: Array<{ id: string; score: number }> = [];
  for (const id of allIds) {
    const ks = keywordScores.get(id) || 0;
    const vs = vectorScores.get(id) || 0;
    fused.push({ id, score: ks * 0.6 + vs * 0.4 });
  }
  fused.sort((a, b) => b.score - a.score);

  const top = fused.slice(0, topK);
  const result: Array<{ row: MemoryRow; score: number }> = [];
  for (const r of top) {
    const row = memoryDb.getById(r.id);
    if (row) result.push({ row, score: r.score });
  }
  return result;
}

function recallFacts(query: string, topK = 5): FactRow[] {
  return factDb.search(query).slice(0, topK);
}

function buildContextPrompt(
  question: string,
  memories: Array<{ row: MemoryRow; score: number }>,
  facts: FactRow[]
): ChatMessage[] {
  const lines: string[] = [];
  lines.push('【相关记忆】');
  if (memories.length === 0) {
    lines.push('（无）');
  } else {
    memories.forEach((m, idx) => {
      const content = (m.row.summary || m.row.raw_content).slice(0, 500);
      const cat = m.row.category ? `[${m.row.category}]` : '';
      lines.push(`[${idx + 1}] ${cat} ${content}`);
    });
  }
  lines.push('');
  lines.push('【相关事实】');
  if (facts.length === 0) {
    lines.push('（无）');
  } else {
    facts.forEach((f, idx) => {
      lines.push(`[F${idx + 1}] ${f.entity} 的 ${f.attribute}：${f.value}`);
    });
  }
  lines.push('');
  lines.push(`【用户问题】\n${question}`);

  return [
    { role: 'system', content: QA_SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

export async function answerQuestion(question: string): Promise<QAResult> {
  const [memories, facts] = await Promise.all([
    recallMemories(question, 5),
    Promise.resolve(recallFacts(question, 5)),
  ]);

  const sources: QASource[] = memories.map((m, idx) => {
    let files: Array<{ name: string; path: string; mimetype: string }> | undefined;
    if (m.row.files_json) {
      try {
        const rawFiles = JSON.parse(m.row.files_json);
        if (Array.isArray(rawFiles)) {
          files = rawFiles.map((f: { name: string; path: string; mimetype: string }) => ({
            ...f,
            name: decodeFileName(f.name),
          }));
        }
      } catch (e) {
        console.error('[QA] Failed to parse files_json:', e);
      }
    }
    return {
      id: m.row.id,
      type: 'memory',
      content: m.row.raw_content,
      summary: m.row.summary || undefined,
      category: m.row.category || undefined,
      file_path: m.row.file_path,
      files,
      score: Math.round(m.score * 100) / 100,
    };
  });

  // 无任何召回时直接返回兜底答案
  if (memories.length === 0 && facts.length === 0) {
    return {
      answer: '你的记忆库中暂无相关信息。可以试着在主页添加一些记录，或者换个问法。',
      sources: [],
      used_memories: 0,
      used_facts: 0,
    };
  }

  const messages = buildContextPrompt(question, memories, facts);

  // 调用 AI 生成答案；失败时降级为基于召回内容的拼接
  let answerText = '';
  try {
    answerText = (await chatCompletion(messages, 0.4)).trim();
  } catch (err) {
    console.warn('[QA] AI generation failed, using recall-based fallback:', (err as Error).message);
    answerText = buildFallbackAnswer(question, memories, facts);
  }

  return {
    answer: answerText,
    sources,
    used_memories: memories.length,
    used_facts: facts.length,
  };
}

/** 兜底答案：直接拼接召回的 Top-1 记忆内容（无 AI 时） */
function buildFallbackAnswer(
  question: string,
  memories: Array<{ row: MemoryRow; score: number }>,
  facts: FactRow[]
): string {
  const parts: string[] = [];
  parts.push(`关于"${question}"，从你的记忆库中找到了以下相关内容：\n`);
  memories.forEach((m, idx) => {
    const text = m.row.summary || m.row.raw_content;
    parts.push(`[${idx + 1}] ${text}`);
  });
  if (facts.length > 0) {
    parts.push('\n相关事实：');
    facts.forEach((f, idx) => {
      parts.push(`- ${f.entity} 的 ${f.attribute}：${f.value}`);
    });
  }
  return parts.join('\n');
}
