import { memoryDb, factDb } from '../../db/index.js';
import { semanticSearch, getSimilarMemories } from '../embedding.js';
import { buildLinkGraph } from '../links.js';
import { createMemory } from '../memory-parser.js';
import { decodeFileName } from '../encoding.js';

// ==================== 类型定义 ====================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ==================== 辅助函数 ====================

function truncate(str: string, maxLen = 2000): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...（已截断）';
}

// ==================== 10 个工具定义 ====================

const tools: ToolDefinition[] = [
  // 1. 搜索记忆（混合检索）
  {
    name: 'search_memories',
    description: '搜索记忆库，使用关键词+语义混合检索，返回最相关的记忆列表',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词或自然语言描述' },
        top_k: { type: 'number', description: '返回结果数量，默认10' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const query = String(args.query);
      const topK = Number(args.top_k) || 10;

      // 关键词搜索
      const keywordResults = memoryDb.search(query);

      // 语义搜索
      let vectorResults: Array<{ id: string; score: number }> = [];
      try {
        vectorResults = await semanticSearch(query, topK);
      } catch {
        // 语义搜索失败，仅用关键词
      }

      // 分数融合: keyword_weight=0.6, vector_weight=0.4
      const maxKwScore = keywordResults.length > 0 ? keywordResults[0].score : 1;
      const scoreMap = new Map<string, number>();

      for (const r of keywordResults) {
        scoreMap.set(r.id, (r.score / maxKwScore) * 0.6);
      }
      for (const r of vectorResults) {
        const existing = scoreMap.get(r.id) || 0;
        scoreMap.set(r.id, existing + r.score * 0.4);
      }

      const merged = Array.from(scoreMap.entries())
        .map(([id, score]) => {
          const row = memoryDb.getById(id);
          return row ? { id, score, summary: row.summary || row.raw_content.slice(0, 60), category: row.category || '' } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, topK);

      return truncate(JSON.stringify(merged));
    },
  },

  // 2. 获取单条记忆
  {
    name: 'get_memory',
    description: '根据记忆 ID 获取完整的记忆内容',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '记忆 ID' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const id = String(args.id);
      const row = memoryDb.getById(id);
      if (!row) return JSON.stringify({ error: `记忆 ${id} 不存在` });
      return truncate(JSON.stringify({
        id: row.id,
        category: row.category,
        raw_content: row.raw_content,
        summary: row.summary,
        tags: row.tags_json ? JSON.parse(row.tags_json) : [],
        entities: row.entities_json ? JSON.parse(row.entities_json) : [],
        created_at: row.created_at,
      }));
    },
  },

  // 3. 创建记忆
  {
    name: 'create_memory',
    description: '创建一条新记忆，AI 会自动解析分类、提取实体和摘要',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记忆内容文本' },
        source: { type: 'string', description: '来源，默认 agent' },
      },
      required: ['content'],
    },
    execute: async (args) => {
      const content = String(args.content);
      const source = String(args.source || 'agent');
      try {
        const result = await createMemory({ content, source, type: 'text' });
        return truncate(JSON.stringify({
          id: result.id,
          category: result.category,
          summary: result.summary,
          tags: result.tags,
          entities: result.entities,
          file_path: result.file_path,
        }));
      } catch (err: any) {
        return JSON.stringify({ error: `创建记忆失败: ${err.message}` });
      }
    },
  },

  // 4. 列出记忆
  {
    name: 'list_memories',
    description: '按分类、日期或热度列出记忆',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '按分类筛选：家庭/工作/生活/学习/购物/健康' },
        page: { type: 'number', description: '页码，默认1' },
        limit: { type: 'number', description: '每页数量，默认10' },
        tier: { type: 'string', description: '热度筛选: hot(7天内)/warm(7-30天)/cold(30天+)' },
      },
      required: [],
    },
    execute: async (args) => {
      const result = memoryDb.list({
        category: args.category ? String(args.category) : undefined,
        page: Number(args.page) || 1,
        limit: Number(args.limit) || 10,
        tier: args.tier as 'hot' | 'warm' | 'cold' | undefined,
      });
      const items = result.items.map((m) => ({
        id: m.id,
        category: m.category,
        summary: m.summary || m.raw_content.slice(0, 60),
        created_at: m.created_at,
      }));
      return truncate(JSON.stringify({ total: result.total, page: result.page, items }));
    },
  },

  // 5. 查询事实库
  {
    name: 'get_facts',
    description: '查询事实库，可按关键词搜索',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词（可选）' },
      },
      required: [],
    },
    execute: async (args) => {
      const keyword = args.keyword ? String(args.keyword) : '';
      const facts = keyword
        ? factDb.search(keyword)
        : factDb.all();
      const items = facts.slice(0, 20).map((f) => ({
        id: f.id,
        entity: f.entity,
        attribute: f.attribute,
        value: f.value,
        confidence: f.confidence,
      }));
      return truncate(JSON.stringify({ total: facts.length, items }));
    },
  },

  // 6. 查询指定实体的事实
  {
    name: 'get_facts_by_entity',
    description: '查询指定实体的所有事实',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: '实体名称' },
      },
      required: ['entity'],
    },
    execute: async (args) => {
      const entity = String(args.entity);
      const facts = factDb.getByEntity(entity);
      const items = facts.map((f) => ({
        id: f.id,
        attribute: f.attribute,
        value: f.value,
        confidence: f.confidence,
      }));
      return truncate(JSON.stringify({ entity, total: items.length, items }));
    },
  },

  // 7. 知识图谱
  {
    name: 'get_knowledge_graph',
    description: '获取知识图谱数据，包含记忆节点和实体关系',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: '筛选关键词（可选）' },
      },
      required: [],
    },
    execute: async (args) => {
      const graph = buildLinkGraph();
      const filter = args.filter ? String(args.filter).toLowerCase() : '';

      let nodes = graph.nodes;
      let edges = graph.edges;

      if (filter) {
        const matchingIds = new Set(
          nodes
            .filter((n) => n.label.toLowerCase().includes(filter))
            .map((n) => n.id)
        );
        // 也包含与匹配节点相连的边对应的节点
        const connectedIds = new Set(matchingIds);
        for (const e of edges) {
          if (matchingIds.has(e.source) || matchingIds.has(e.target)) {
            connectedIds.add(e.source);
            connectedIds.add(e.target);
          }
        }
        nodes = nodes.filter((n) => connectedIds.has(n.id));
        edges = edges.filter((e) => connectedIds.has(e.source) && connectedIds.has(e.target));
      }

      // 截断防止过大
      const result = {
        total_nodes: nodes.length,
        total_edges: edges.length,
        nodes: nodes.slice(0, 50).map((n) => ({ id: n.id, label: n.label, type: n.type })),
        edges: edges.slice(0, 80).map((e) => ({ source: e.source, target: e.target, type: e.type })),
      };
      return truncate(JSON.stringify(result));
    },
  },

  // 8. 统计概览
  {
    name: 'get_stats',
    description: '获取记忆库的统计概览，包括总数、分类分布、来源分布等',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const stats = memoryDb.getStats();
      return truncate(JSON.stringify({
        total_memories: stats.total_memories,
        week_new: stats.week_new,
        total_facts: stats.total_facts,
        category_distribution: stats.category_distribution,
        source_distribution: stats.source_distribution,
        top_tags: stats.top_tags.slice(0, 10),
      }));
    },
  },

  // 9. 语义搜索
  {
    name: 'semantic_search',
    description: '纯语义向量搜索，适合模糊/概念性查询',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '自然语言查询' },
        top_k: { type: 'number', description: '返回结果数量，默认5' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const query = String(args.query);
      const topK = Number(args.top_k) || 5;
      try {
        const results = await semanticSearch(query, topK);
        const items = results.map((r) => {
          const row = memoryDb.getById(r.id);
          return row
            ? { id: r.id, score: r.score, summary: row.summary || row.raw_content.slice(0, 60) }
            : null;
        }).filter(Boolean);
        return truncate(JSON.stringify(items));
      } catch (err: any) {
        return JSON.stringify({ error: `语义搜索失败: ${err.message}` });
      }
    },
  },

  // 10. 查找相似记忆
  {
    name: 'find_similar',
    description: '查找与指定记忆相似的其他记忆',
    parameters: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: '目标记忆 ID' },
        top_k: { type: 'number', description: '返回结果数量，默认5' },
      },
      required: ['memory_id'],
    },
    execute: async (args) => {
      const memoryId = String(args.memory_id);
      const topK = Number(args.top_k) || 5;
      const results = getSimilarMemories(memoryId, topK);
      const items = results.map((r) => {
        const row = memoryDb.getById(r.id);
        return row
          ? { id: r.id, score: r.score, summary: row.summary || row.raw_content.slice(0, 60) }
          : null;
      }).filter(Boolean);
      return truncate(JSON.stringify(items));
    },
  },

  // 11. 搜索文件库
  {
    name: 'search_files',
    description: '搜索文件库中的文件，支持按文件名、类型搜索',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词（文件名或内容）' },
        file_type: { type: 'string', description: '文件类型筛选（image/pdf/docx/xlsx/ppt/zip等，可选）' },
      },
      required: [],
    },
    execute: async (args) => {
      const keyword = args.keyword ? String(args.keyword).toLowerCase() : '';
      const fileType = args.file_type ? String(args.file_type).toLowerCase() : '';

      const allMemories = memoryDb.all();
      const results: Array<{ id: string; filename: string; path: string; mimetype: string; category: string; size: number }> = [];

      for (const m of allMemories) {
        if (!m.files_json) continue;

        try {
          const files = JSON.parse(m.files_json);
          if (!Array.isArray(files)) continue;

          for (const f of files) {
            const fileName = (f.name || '').toLowerCase();
            const mimeType = (f.mimetype || '').toLowerCase();

            const matchKeyword = !keyword || fileName.includes(keyword);
            const matchType = !fileType || mimeType.includes(fileType) || fileName.includes(fileType);

            if (matchKeyword && matchType) {
              results.push({
                id: m.id,
                filename: decodeFileName(f.name),
                path: f.path,
                mimetype: f.mimetype,
                category: decodeFileName(m.category || ''),
                size: f.size || 0,
              });
            }
          }
        } catch {}
      }

      results.sort((a, b) => b.size - a.size);
      return truncate(JSON.stringify({ total: results.length, items: results.slice(0, 20) }));
    },
  },

  // 12. 浏览文件库
  {
    name: 'list_files',
    description: '浏览文件库，按分类或时间列出文件',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '按分类筛选（可选）' },
        page: { type: 'number', description: '页码，默认1' },
        limit: { type: 'number', description: '每页数量，默认10' },
      },
      required: [],
    },
    execute: async (args) => {
      const category = args.category ? String(args.category) : '';
      const page = Number(args.page) || 1;
      const limit = Number(args.limit) || 10;

      const allMemories = memoryDb.all();
      const results: Array<{ id: string; filename: string; path: string; mimetype: string; category: string; size: number; created_at: string }> = [];

      for (const m of allMemories) {
        if (!m.files_json) continue;
        if (category && m.category !== category) continue;

        try {
          const files = JSON.parse(m.files_json);
          if (!Array.isArray(files)) continue;

          for (const f of files) {
            results.push({
              id: m.id,
              filename: decodeFileName(f.name),
              path: f.path,
              mimetype: f.mimetype,
              category: decodeFileName(m.category || ''),
              size: f.size || 0,
              created_at: m.created_at || '',
            });
          }
        } catch {}
      }

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const start = (page - 1) * limit;
      const end = start + limit;

      return truncate(JSON.stringify({
        total: results.length,
        page,
        total_pages: Math.ceil(results.length / limit),
        items: results.slice(start, end),
      }));
    },
  },
];

// ==================== 导出 ====================

/** 获取所有工具定义 */
export function getTools(): ToolDefinition[] {
  return tools;
}

/** 转为豆包/OpenAI 兼容的 tools 格式 */
export function getOpenAITools() {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** 按名称查找并执行工具 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return JSON.stringify({ error: `未知工具: ${name}` });
  }
  try {
    return await tool.execute(args);
  } catch (err: any) {
    return JSON.stringify({ error: `工具执行失败: ${err.message}` });
  }
}
