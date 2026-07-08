import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { parseMemory, ParsedMemory } from './ai.js';
import { memoryDb, embeddingDb, factDb } from '../db/index.js';
import { generateAndStoreEmbedding, removeFromCache } from './embedding.js';
import { markPendingWrite, clearPendingWrite } from './vault-watcher.js';
import { scheduleFactExtraction } from './fact-extractor.js';

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface CreateMemoryInput {
  content: string;
  source?: string;
  type?: string;
  skipAi?: boolean;
  tags?: string[];
  files?: UploadedFile[];
}

export interface CreateMemoryResult {
  id: string;
  status: 'parsed' | 'quick';
  category: string;
  tags: string[];
  entities: ParsedMemory['entities'];
  relations: ParsedMemory['relations'];
  summary: string;
  file_path: string;
  created_at: string;
  files?: UploadedFile[];
}

function generateMemoryId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6);
  return `mem_${dateStr}_${random}`;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)
    .trim();
}

function generateMarkdown(
  id: string,
  content: string,
  parsed: ParsedMemory,
  source: string,
  type: string,
  createdAt: string,
  files?: UploadedFile[]
): string {
  const categoryPath = parsed.category + (parsed.sub_category ? `/${parsed.sub_category}` : '');
  const tags = parsed.tags.map((t) => `"${t}"`).join(', ');
  const entitiesYaml = parsed.entities.map((e) => {
    const parts = [`  - type: "${e.type}"`, `    name: "${e.name}"`];
    if (e.value) parts.push(`    value: "${e.value}"`);
    if (e.label) parts.push(`    label: "${e.label}"`);
    if (e.deadline) parts.push(`    deadline: "${e.deadline}"`);
    return parts.join('\n');
  });

  const relationsYaml = parsed.relations.map((r) =>
    `  - from: "${r.from}"\n    relation: "${r.relation}"\n    to: "${r.to}"`
  );

  const summary = parsed.summary || content.slice(0, 100);
  const title = sanitizeFileName(summary.slice(0, 30)) || '记忆';
  const confidence = parsed.confidence ?? 0;

  const tagsDisplay = parsed.tags.length > 0
    ? parsed.tags.map((t) => `#${t}`).join(' ')
    : '无';

  const entitiesDisplay = parsed.entities.length > 0
    ? parsed.entities.map((e) => `- **${e.name}** (${e.type})${e.value ? `: ${e.value}` : ''}`).join('\n')
    : '暂无';

  const entityLinks = parsed.entities
    .filter((e) => e.name)
    .map((e) => `- [[${e.name}]]`)
    .join('\n');

  const uploadsDir = path.join(config.vault.path, 'uploads');
  const attachmentsSection = files && files.length > 0
    ? files.map((f) => {
        // 生成相对于 uploads 目录的路径（如 images/xxx.jpg），与 Obsidian 双链语法匹配
        const relPath = path.relative(uploadsDir, f.path).replace(/\\/g, '/');
        return f.mimetype.startsWith('image/') ? `![[${relPath}]]` : `[[${relPath}]]`;
      }).join('\n')
    : '暂无';

  const entitiesList = parsed.entities.map((e) => e.name).filter(Boolean);
  const relevantFacts = getRelevantFacts(entitiesList);
  const factsDisplay = relevantFacts.length > 0
    ? relevantFacts.map((f) => `- **${f.entity}** → ${f.attribute}: ${f.value}`).join('\n')
    : '暂无';

  return `---
id: "${id}"
title: "${title}"
created_at: "${createdAt}"
updated_at: "${createdAt}"
source: "${source}"
type: "${type}"
category: "${categoryPath}"
tags: [${tags}]
entities:
${entitiesYaml.join('\n') || '[]'}
relations:
${relationsYaml.join('\n') || '[]'}
confidence: ${confidence}
---

# ${title}

## 正文

${content}

## AI 解析摘要

${summary}

## 元数据

| 属性 | 值 |
|------|------|
| ID | \`${id}\` |
| 来源 | ${source} |
| 类型 | ${type} |
| 分类 | ${categoryPath} |
| 创建时间 | ${createdAt} |
| 更新时间 | ${createdAt} |
| 置信度 | ${(confidence * 100).toFixed(0)}% |

## 标签

${tagsDisplay}

## 实体

${entitiesDisplay}

## 关联记忆

${entityLinks || '（暂无关联）'}
- [[${categoryPath}]]

## 附件

${attachmentsSection}

## 提取的事实

${factsDisplay}
`;
}

function extractEntitiesFromText(text: string): string[] {
  const entities: string[] = [];
  const chineseChars = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
  const mixedWords = text.match(/[\u4e00-\u9fa5][a-zA-Z]+|[a-zA-Z]+[\u4e00-\u9fa5]/g) || [];
  entities.push(...chineseChars, ...englishWords, ...mixedWords);
  return [...new Set(entities)];
}

function getRelevantFacts(entities: string[]): Array<{ entity: string; attribute: string; value: string }> {
  const allFacts = factDb.all();
  const relevantFacts: Array<{ entity: string; attribute: string; value: string }> = [];
  
  for (const entity of entities) {
    const facts = allFacts.filter(f => 
      f.entity.toLowerCase().includes(entity.toLowerCase()) ||
      entity.toLowerCase().includes(f.entity.toLowerCase())
    );
    for (const f of facts) {
      if (!relevantFacts.some(rf => rf.entity === f.entity && rf.attribute === f.attribute)) {
        relevantFacts.push({ entity: f.entity, attribute: f.attribute, value: f.value });
      }
    }
  }
  
  return relevantFacts.slice(0, 20);
}

export async function createMemory(input: CreateMemoryInput): Promise<CreateMemoryResult> {
  const { content, source = 'web', type = 'text', skipAi = false, tags = [], files } = input;

  const id = generateMemoryId();
  const now = new Date().toISOString();
  
  let parsed: ParsedMemory;
  
  if (skipAi) {
    parsed = {
      category: '生活',
      sub_category: '日常记录',
      tags: tags.length > 0 ? tags : [],
      entities: [],
      relations: [],
      summary: content.slice(0, 100),
    };
  } else {
    const entities = extractEntitiesFromText(content);
    const knownFacts = getRelevantFacts(entities);
    parsed = await parseMemory(content, knownFacts);
  }

  const categoryPath = parsed.category + (parsed.sub_category ? `/${parsed.sub_category}` : '');
  const summary = parsed.summary || content.slice(0, 100);
  const fileName = `${now.slice(0, 10)}_${sanitizeFileName(summary.slice(0, 30))}.md`;
  const memoriesDir = path.join(config.vault.path, 'memories');
  const filePath = path.resolve(path.join(memoriesDir, fileName));

  if (!fs.existsSync(memoriesDir)) {
    fs.mkdirSync(memoriesDir, { recursive: true });
  }

  const markdown = generateMarkdown(id, content, parsed, source, type, now, files);
  // 标记为应用自身写入，防止 vault-watcher 重复处理
  markPendingWrite(filePath);
  try {
    fs.writeFileSync(filePath, markdown, 'utf-8');
  } finally {
    // 写入完成后稍后清理（给 watcher 留出事件触发窗口）
    setTimeout(() => clearPendingWrite(filePath), 1000);
  }

  const filesJson = files ? JSON.stringify(files) : null;

  memoryDb.insert({
    id,
    file_path: filePath,
    source,
    type,
    category: categoryPath,
    raw_content: content,
    summary,
    entities_json: JSON.stringify(parsed.entities),
    tags_json: JSON.stringify(parsed.tags),
    files_json: filesJson,
    created_at: now,
    updated_at: now,
  });

  // 异步生成向量，不阻塞主流程（失败不影响记忆创建）
  const embeddingText = summary + ' ' + content;
  generateAndStoreEmbedding(id, embeddingText).catch((err) => {
    console.error(`[Embedding] Failed to generate for ${id}:`, err);
  });

  // 异步更新事实库（带防抖，5秒内多次触发合并为一次）
  scheduleFactExtraction();

  return {
    id,
    status: skipAi ? 'quick' : 'parsed',
    category: categoryPath,
    tags: parsed.tags,
    entities: parsed.entities,
    relations: parsed.relations,
    summary,
    file_path: filePath,
    created_at: now,
    files,
  };
}

export function deleteMemory(id: string): boolean {
  const memory = memoryDb.getById(id);
  if (!memory) return false;

  // 用 path.resolve 统一路径格式（Windows 兼容）
  const resolvedPath = path.resolve(memory.file_path);
  if (fs.existsSync(resolvedPath)) {
    // 标记为应用自身删除，watcher 收到 unlink 时直接跳过
    markPendingWrite(resolvedPath);
    try {
      fs.unlinkSync(resolvedPath);
    } catch (err) {
      console.error(`[Delete] Failed to delete file ${resolvedPath}:`, err);
      // 文件删除失败，仍然继续清理数据库（避免不一致）
    } finally {
      setTimeout(() => clearPendingWrite(resolvedPath), 1000);
    }
  }

  removeFromCache(id);
  embeddingDb.delete(id);
  return memoryDb.delete(id);
}

export function updateMemory(id: string, updates: { content?: string }): any {
  const memory = memoryDb.getById(id);
  if (!memory) return undefined;

  const now = new Date().toISOString();

  if (updates.content) {
    memoryDb.update(id, {
      raw_content: updates.content,
      updated_at: now,
    });

    if (fs.existsSync(path.resolve(memory.file_path))) {
      const fileContent = fs.readFileSync(path.resolve(memory.file_path), 'utf-8');
      const updatedContent = fileContent.replace(
        /(?<=^---\n[\s\S]*?\n---\n\n#[^\n]+\n\n)[\s\S]*?(?=\n## AI 解析摘要)/,
        `${updates.content}\n`
      );
      fs.writeFileSync(path.resolve(memory.file_path), updatedContent, 'utf-8');
    }
  }

  return memoryDb.getById(id);
}
