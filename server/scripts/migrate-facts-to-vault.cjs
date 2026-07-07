const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'memoflow.db.json');
const FACTS_DIR = path.join(__dirname, '..', '..', 'vault', 'facts');

function getMemoryLinkName(memoryId, memoryMap) {
  const mem = memoryMap.get(memoryId);
  if (mem && mem.file_path) {
    return path.basename(mem.file_path, '.md');
  }
  return memoryId.replace('mem_', '');
}

function generateFactMarkdown(entity, facts, memoryMap) {
  const escapedEntity = entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
  const now = new Date().toISOString();

  const factLines = facts.map((f) => {
    let sources = [];
    try {
      sources = f.sources_json ? JSON.parse(f.sources_json) : [];
    } catch (e) {}

    const sourceLinks = sources
      .map((s) => `[[${getMemoryLinkName(s, memoryMap)}]]`)
      .join(', ');

    const confidence = f.confidence != null ? f.confidence : 0;
    return `- **${f.attribute}**: ${f.value} (置信度: ${(confidence * 100).toFixed(0)}%)${sourceLinks ? ` 来源: ${sourceLinks}` : ''}`;
  });

  const allSources = facts.flatMap((f) => {
    try {
      return f.sources_json ? JSON.parse(f.sources_json) : [];
    } catch (e) {
      return [];
    }
  });
  const uniqueSources = [...new Set(allSources)];

  const sourceLinks = uniqueSources.length > 0
    ? uniqueSources.map((s) => `- [[${getMemoryLinkName(s, memoryMap)}]]`).join('\n')
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

function migrateFactsToVault() {
  console.log('=== 迁移事实到 Obsidian Vault ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('数据库文件不存在');
    return;
  }

  if (!fs.existsSync(FACTS_DIR)) {
    fs.mkdirSync(FACTS_DIR, { recursive: true });
  }

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const facts = dbData.facts || [];
  const memories = dbData.memories || [];

  console.log(`数据库中有 ${facts.length} 条事实, ${memories.length} 条记忆`);

  if (facts.length === 0) {
    console.log('没有事实需要迁移');
    return;
  }

  const memoryMap = new Map();
  for (const m of memories) {
    memoryMap.set(m.id, m);
  }

  const entities = new Map();
  for (const f of facts) {
    if (!entities.has(f.entity)) {
      entities.set(f.entity, []);
    }
    entities.get(f.entity).push(f);
  }

  console.log(`涉及 ${entities.size} 个实体\n`);

  let written = 0;
  for (const [entity, entityFacts] of entities) {
    const safeEntity = entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
    const filePath = path.join(FACTS_DIR, `${safeEntity}.md`);
    const markdown = generateFactMarkdown(entity, entityFacts, memoryMap);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    console.log(`写入: ${safeEntity}.md (${entityFacts.length} 条事实)`);
    written++;
  }

  console.log(`\n=== 迁移完成 ===`);
  console.log(`写入了 ${written} 个实体文件`);
}

try {
  migrateFactsToVault();
} catch (err) {
  console.error('迁移失败:', err);
}
