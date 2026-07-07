import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { memoryDb } from '../db/index.js';

const WIKILINK_RE = /\[\[([^\[\]\n]+?)\]\]/g;

export interface LinkNode {
  id: string;
  label: string;
  type: 'memory' | 'entity' | 'category';
  file_path?: string;
  count?: number;
}

export interface LinkEdge {
  source: string;
  target: string;
  type: 'wikilink' | 'entity' | 'category';
}

export interface LinkGraph {
  nodes: LinkNode[];
  edges: LinkEdge[];
  total_memories: number;
  total_entities: number;
}

/** 扫描所有 vault .md 文件，提取 [[wikilink]] 形式的链接 */
export function extractWikilinksFromVault(): LinkEdge[] {
  const memoriesDir = path.join(config.vault.path, 'memories');
  if (!fs.existsSync(memoriesDir)) return [];

  const edges: LinkEdge[] = [];
  const files = fs.readdirSync(memoriesDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(memoriesDir, file);
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // 从 frontmatter 提取 memory id
    const idMatch = content.match(/^id:\s*"?([^"\n]+)"?/m);
    if (!idMatch) continue;
    const memoryId = idMatch[1].trim();

    // 提取 [[xxx]] 链接
    const matches = content.matchAll(WIKILINK_RE);
    for (const m of matches) {
      const target = m[1].trim();
      if (!target || target === memoryId) continue;
      edges.push({
        source: memoryId,
        target: `entity:${target}`,
        type: 'wikilink',
      });
    }

    // 把 frontmatter 里的 category 也作为边
    const catMatch = content.match(/^category:\s*"?([^"\n]+)"?/m);
    if (catMatch) {
      const cat = catMatch[1].trim();
      if (cat) {
        edges.push({
          source: memoryId,
          target: `category:${cat}`,
          type: 'category',
        });
      }
    }
  }

  return edges;
}

/** 从数据库中提取 entity → memory 关系 */
export function extractEntityEdges(): LinkEdge[] {
  const edges: LinkEdge[] = [];
  for (const m of memoryDb.all()) {
    if (!m.entities_json) continue;
    try {
      const entities = JSON.parse(m.entities_json);
      for (const e of entities) {
        if (e?.name) {
          edges.push({
            source: m.id,
            target: `entity:${e.name}`,
            type: 'entity',
          });
        }
      }
    } catch {
      // 忽略解析错误
    }
  }
  return edges;
}

export function buildLinkGraph(): LinkGraph {
  const memories = memoryDb.all();
  const memoryNodes: LinkNode[] = memories.map((m) => ({
    id: m.id,
    label: (m.summary || m.raw_content).slice(0, 30),
    type: 'memory',
    file_path: m.file_path,
  }));

  // 合并 wikilink + entity + category 三类边
  const allEdges = [
    ...extractWikilinksFromVault(),
    ...extractEntityEdges(),
  ];

  // 统计每个 entity / category 出现次数
  const targetCount = new Map<string, number>();
  for (const e of allEdges) {
    targetCount.set(e.target, (targetCount.get(e.target) || 0) + 1);
  }

  const entityNodes: LinkNode[] = [];
  for (const [target, count] of targetCount.entries()) {
    const [type, ...rest] = target.split(':');
    const label = rest.join(':');
    entityNodes.push({
      id: target,
      label,
      type: type === 'category' ? 'category' : 'entity',
      count,
    });
  }

  return {
    nodes: [...memoryNodes, ...entityNodes],
    edges: allEdges,
    total_memories: memories.length,
    total_entities: entityNodes.length,
  };
}

/** 获取目标的双向链接（哪些记忆指向了它） */
export function getBacklinks(targetName: string): Array<{
  memory_id: string;
  file_path: string;
  summary: string;
}> {
  const target = `entity:${targetName}`;
  const edges = [
    ...extractWikilinksFromVault(),
    ...extractEntityEdges(),
  ];
  const sourceIds = new Set<string>();
  for (const e of edges) {
    if (e.target === target) sourceIds.add(e.source);
  }
  const result: Array<{ memory_id: string; file_path: string; summary: string }> = [];
  for (const id of sourceIds) {
    const m = memoryDb.getById(id);
    if (m) {
      result.push({
        memory_id: m.id,
        file_path: m.file_path,
        summary: m.summary || m.raw_content.slice(0, 50),
      });
    }
  }
  return result;
}

/** 获取一条记忆的所有外链（指向了哪些 entity / category） */
export function getOutgoingLinks(memoryId: string): Array<{ target: string; type: string }> {
  const edges = [
    ...extractWikilinksFromVault(),
    ...extractEntityEdges(),
  ];
  const result: Array<{ target: string; type: string }> = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.source === memoryId && !seen.has(e.target)) {
      seen.add(e.target);
      const [type, ...rest] = e.target.split(':');
      result.push({ target: rest.join(':'), type });
    }
  }
  return result;
}
