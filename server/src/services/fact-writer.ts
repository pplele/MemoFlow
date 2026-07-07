import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { factDb, memoryDb } from '../db/index.js';

const factsDir = path.join(config.vault.path, 'facts');

export function initFactsDir(): void {
  if (!fs.existsSync(factsDir)) {
    fs.mkdirSync(factsDir, { recursive: true });
  }
}

function getMemoryLinkName(memoryId: string): string {
  const mem = memoryDb.getById(memoryId);
  if (mem && mem.file_path) {
    return path.basename(mem.file_path, '.md');
  }
  return memoryId.replace('mem_', '');
}

export function generateFactMarkdown(entity: string, facts: Array<{
  id: string;
  entity: string;
  attribute: string;
  value: string;
  confidence: number;
  source_count: number;
  sources: string[];
  created_at: string;
  updated_at: string;
}>): string {
  const escapedEntity = entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
  const now = new Date().toISOString();

  const factLines = facts.map((f) => {
    const sourceLinks = f.sources
      .map((s) => `[[${getMemoryLinkName(s)}]]`)
      .join(', ');

    return `- **${f.attribute}**: ${f.value} (置信度: ${(f.confidence * 100).toFixed(0)}%)${sourceLinks ? ` 来源: ${sourceLinks}` : ''}`;
  });

  const allSources = facts.flatMap((f) => f.sources);
  const uniqueSources = allSources.filter((s, i, arr) => arr.indexOf(s) === i);
  const sourceLinks = uniqueSources.length > 0
    ? uniqueSources.map((s) => `- [[${getMemoryLinkName(s)}]]`).join('\n')
    : '暂无';

  return `---
id: "${escapedEntity}"
entity: "${entity}"
fact_count: ${facts.length}
created_at: "${now}"
updated_at: "${now}"
---

# ${entity}

## 基本信息

| 属性 | 值 |
|------|------|
| 实体名称 | ${entity} |
| 事实数量 | ${facts.length} |

## 事实列表

${factLines.join('\n')}

## 关联记忆

${sourceLinks}
`;
}

export function writeFactsToVault(): void {
  initFactsDir();

  const allFacts = factDb.all();
  if (allFacts.length === 0) {
    console.log('[FactWriter] No facts to write');
    return;
  }

  const entities = new Map<string, any[]>();
  for (const f of allFacts) {
    if (!entities.has(f.entity)) {
      entities.set(f.entity, []);
    }
    entities.get(f.entity)!.push({
      id: f.id,
      entity: f.entity,
      attribute: f.attribute,
      value: f.value,
      confidence: f.confidence ?? 0,
      source_count: f.source_count ?? 0,
      sources: f.sources_json ? JSON.parse(f.sources_json) : [],
      created_at: f.created_at || '',
      updated_at: f.updated_at || '',
    });
  }

  for (const [entity, facts] of entities) {
    const safeEntity = entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
    const filePath = path.join(factsDir, `${safeEntity}.md`);
    const markdown = generateFactMarkdown(entity, facts);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    console.log(`[FactWriter] Written: ${filePath}`);
  }

  console.log(`[FactWriter] Written ${entities.size} entity files`);
}

export function writeFactToVault(entity: string): void {
  initFactsDir();

  const facts = factDb.getByEntity(entity);
  if (facts.length === 0) {
    console.log(`[FactWriter] No facts for entity: ${entity}`);
    return;
  }

  const factArray = facts.map((f) => ({
    id: f.id,
    entity: f.entity,
    attribute: f.attribute,
    value: f.value,
    confidence: f.confidence ?? 0,
    source_count: f.source_count ?? 0,
    sources: f.sources_json ? JSON.parse(f.sources_json) : [],
    created_at: f.created_at || '',
    updated_at: f.updated_at || '',
  }));

  const safeEntity = entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
  const filePath = path.join(factsDir, `${safeEntity}.md`);
  const markdown = generateFactMarkdown(entity, factArray);
  fs.writeFileSync(filePath, markdown, 'utf-8');
  console.log(`[FactWriter] Written: ${filePath}`);
}
