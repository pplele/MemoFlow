import { config } from '../config/index.js';

// ==================== 类型定义 ====================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ParsedMemory {
  category: string;
  sub_category?: string;
  tags: string[];
  entities: Array<{ type: string; name: string; value?: string; label?: string; deadline?: string }>;
  relations: Array<{ from: string; relation: string; to: string }>;
  summary: string;
  confidence?: number;
  fact_hints?: string[];
}

export interface ParsedDocument {
  doc_type: string;
  title: string;
  key_data: string;
  entities: Array<{ type: string; name: string }>;
  category: string;
  tags: string[];
  summary: string;
}

export interface ExtractedFact {
  entity: string;
  attribute: string;
  value: string;
  confidence: number;
  sources: string[];
}

export interface EmbeddingResult {
  vector: number[];
}

export interface QAContext {
  memories: Array<{ id: string; content: string; summary?: string; category?: string }>;
  facts: Array<{ entity: string; attribute: string; value: string }>;
}

// ==================== Prompt 模板 ====================

const MEMORY_PARSE_PROMPT = `你是一个个人记忆助手。用户会给你一段碎片信息，请从中提取结构化数据。

【已知事实】（从用户已有的事实库中获取的实体信息，供你参考）
{KNOWN_FACTS}

请以 JSON 格式返回以下字段：
{
  "category": "主分类（家庭/工作/生活/学习/购物/健康）",
  "sub_category": "子分类",
  "tags": ["标签1", "标签2"],
  "entities": [
    {"type": "person|place|item|concept|time|task|org", "name": "名称", "value": "值（如适用）", "label": "标签/别名"}
  ],
  "relations": [
    {"from": "实体A", "relation": "关系", "to": "实体B"}
  ],
  "summary": "一句话摘要",
  "fact_hints": ["从这条记录中可能提取的长期事实（如有）"]
}

分类规则：
- 家庭：家人、亲戚、家庭事务
- 工作：职场、任务、会议、项目
- 生活：日常、餐饮、出行、娱乐
- 学习：阅读、课程、知识点
- 购物：购买清单、商品、品牌偏好
- 健康：医疗、药品、运动、饮食

实体类型说明：
- person：与记忆相关的人
- place：地理位置或场所
- item：具体物品或商品
- concept：抽象知识概念
- time：时间点或时间段（value 用 ISO 日期格式）
- task：需要执行的事项（可带 deadline）
- org：公司、机构

重要规则：
1. 如果【已知事实】中有相关实体的信息，请在 entities 的 label 字段中注明（如"女朋友"）
2. 如果新内容与已知事实冲突，请以新内容为准，并在 fact_hints 中提示可能需要更新事实
3. 对于已知实体，在摘要中可以使用其标签（如"女朋友pp"）使内容更清晰

只返回 JSON，不要任何额外文字。`;

const DOCUMENT_PARSE_PROMPT = `你是一个文档结构化提取助手。用户上传了一份文档，已提取了纯文本内容，请从中提取关键信息。

请以 JSON 格式返回：
{
  "doc_type": "文档类型（报价单/合同/报表/方案/课件/其他）",
  "title": "文档标题",
  "key_data": "核心数据摘要（如金额、日期、甲方乙方等）",
  "entities": [{"type": "person|org|place|concept", "name": "名称"}],
  "category": "建议分类（家庭/工作/生活/学习/购物/健康）",
  "tags": ["标签"],
  "summary": "一段话概括文档核心内容"
}

只返回 JSON，不要任何额外文字。`;

const QA_SYSTEM_PROMPT = `你是 MemoFlow 用户的个人记忆助手。你可以访问用户的记忆库、事实库和知识图谱。

回答规则：
1. 只基于提供的记忆内容回答，不要编造信息
2. 如果记忆库中没有相关信息，明确告知并建议用户记录
3. 引用来源时标注具体记录
4. 对于待办类问题，按时间顺序列出
5. 对于建议类问题，基于历史偏好给出合理建议
6. 回答要简洁、有条理，使用中文`;

const FACT_EXTRACTION_PROMPT = `你是一个个人事实提取器。请从以下记忆记录中，提取"不变的、持久的事实"。

规则：
- 优先提取跨多条记录一致的事实（至少出现 2 次），置信度更高
- 对于单条记录中的明确属性关系，也可以提取，但置信度较低（0.5以下）
- 事实应该是有长期价值的偏好、属性、关系
- 给出置信度（基于出现次数和上下文一致性，0-1 之间）
- 忽略一次性的事件和临时信息

返回 JSON 数组：
[
  {"entity": "实体名", "attribute": "属性", "value": "值", "confidence": 0.9, "sources": ["记录ID列表"]}
]

如果没有可提取的事实，返回空数组 []。
只返回 JSON，不要任何额外文字。`;

// ==================== API 调用 ====================

export async function chatCompletion(
  messages: ChatMessage[],
  temperature = 0.3,
  retries = 2
): Promise<string> {
  if (!config.doubao.apiKey) {
    throw new Error('DOUBAO_API_KEY is not set. Please check your .env file.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${config.doubao.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.doubao.apiKey}`,
        },
        body: JSON.stringify({
          model: config.doubao.model,
          messages,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Doubao API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        console.warn(`[AI] Retry ${attempt + 1}/${retries}...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  if (!config.doubao.apiKey) {
    throw new Error('DOUBAO_API_KEY is not set');
  }

  const response = await fetch(`${config.doubao.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.doubao.apiKey}`,
    },
    body: JSON.stringify({
      model: config.doubao.embeddingModel,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Doubao Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return {
    vector: data.data?.[0]?.embedding || [],
  };
}

// ==================== 业务封装 ====================

export function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试找到第一个 { 或 [ 到最后一个 } 或 ]
    const firstBrace = cleaned.search(/[{[]/);
    const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Failed to parse JSON from AI response');
  }
}

export async function parseMemory(content: string, knownFacts: Array<{ entity: string; attribute: string; value: string }> = []): Promise<ParsedMemory> {
  let result = '';
  
  const factsText = knownFacts.length > 0
    ? knownFacts.map(f => `- ${f.entity}: ${f.attribute} = ${f.value}`).join('\n')
    : '（暂无）';
  
  const prompt = MEMORY_PARSE_PROMPT.replace('{KNOWN_FACTS}', factsText);

  try {
    result = await chatCompletion(
      [{ role: 'user', content: `${prompt}\n\n用户输入：${content}` }],
      0.2
    );
  } catch (error) {
    console.error('[AI] chatCompletion failed, using fallback:', error);
    return {
      category: '生活',
      sub_category: '',
      tags: [],
      entities: [],
      relations: [],
      summary: content.slice(0, 100),
    };
  }

  try {
    const parsed = extractJson(result);
    return {
      category: parsed.category || '生活',
      sub_category: parsed.sub_category || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      summary: parsed.summary || content.slice(0, 100),
      fact_hints: Array.isArray(parsed.fact_hints) ? parsed.fact_hints : [],
    };
  } catch (error) {
    console.error('[AI] Failed to parse memory:', error);
    return {
      category: '生活',
      tags: [],
      entities: [],
      relations: [],
      summary: content.slice(0, 100),
    };
  }
}

export async function parseDocument(textContent: string): Promise<ParsedDocument> {
  const truncated = textContent.slice(0, 3000);
  let result = '';
  try {
    result = await chatCompletion(
      [{ role: 'user', content: `${DOCUMENT_PARSE_PROMPT}\n\n文档内容：${truncated}` }],
      0.2
    );
  } catch (error) {
    console.error('[AI] chatCompletion failed, using fallback:', error);
    return {
      doc_type: '其他',
      title: '未命名文档',
      key_data: '',
      entities: [],
      category: '工作',
      tags: [],
      summary: truncated.slice(0, 100),
    };
  }

  try {
    const parsed = extractJson(result);
    return {
      doc_type: parsed.doc_type || '其他',
      title: parsed.title || '未命名文档',
      key_data: parsed.key_data || '',
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      category: parsed.category || '工作',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: parsed.summary || truncated.slice(0, 100),
    };
  } catch (error) {
    console.error('[AI] Failed to parse document:', error);
    return {
      doc_type: '其他',
      title: '未命名文档',
      key_data: '',
      entities: [],
      category: '工作',
      tags: [],
      summary: truncated.slice(0, 100),
    };
  }
}

export async function answerQuestion(
  question: string,
  context: QAContext,
  history: ChatMessage[] = []
): Promise<{ answer: string; sources: Array<{ id: string; excerpt: string }> }> {
  const contextText = context.memories
    .map((m) => `[${m.id}] (${m.category || '未分类'}) ${m.summary || m.content}`)
    .join('\n');

  const factsText = context.facts
    .map((f) => `${f.entity}的${f.attribute}：${f.value}`)
    .join('\n');

  const userMessage = `用户问题：${question}

相关记忆：
${contextText || '（无相关记忆）'}

相关事实：
${factsText || '（无相关事实）'}

请基于以上信息回答用户的问题。如果信息不足，请明确告知。`;

  const messages: ChatMessage[] = [
    { role: 'system', content: QA_SYSTEM_PROMPT },
    ...history.slice(-6),
    { role: 'user', content: userMessage },
  ];

  const answer = await chatCompletion(messages, 0.5);

  const sources = context.memories.slice(0, 5).map((m) => ({
    id: m.id,
    excerpt: m.summary || m.content.slice(0, 80),
  }));

  return { answer, sources };
}

export async function extractFacts(
  records: Array<{ id: string; content: string; summary?: string }>
): Promise<ExtractedFact[]> {
  if (records.length < 2) {
    return [];
  }

  const recordsText = records
    .map((r) => `ID: ${r.id}\n内容: ${r.content}\n摘要: ${r.summary || '无'}`)
    .join('\n---\n');

  const result = await chatCompletion(
    [{ role: 'user', content: `${FACT_EXTRACTION_PROMPT}\n\n输入记录：\n${recordsText}` }],
    0.3
  );

  try {
    const parsed = extractJson(result);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f: any) => f.entity && f.attribute && f.value
    );
  } catch (error) {
    console.error('[AI] Failed to extract facts:', error);
    return [];
  }
}
