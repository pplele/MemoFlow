import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { config } from '../config/index.js';
import { memoryDb, embeddingDb, MemoryRow } from '../db/index.js';
import { generateAndStoreEmbedding, removeFromCache } from './embedding.js';

/**
 * 防止循环写入：
 * 当应用自身要写一个文件时，先调用 markPendingWrite(filePath) 把路径加入该 Set。
 * watcher 检测到该文件的变化时直接跳过。
 * 在写入完成后调用 clearPendingWrite(filePath)。
 */
const pendingWrites = new Set<string>();

/** 防抖计时器：按文件路径分别 debounce */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/** 忽略的目录与文件 */
const IGNORE_PATTERNS = [
  /(^|[\/\\])\../, // 隐藏文件
  /[\/\\]\.obsidian[\/\\]/, // Obsidian 配置目录
  /[\/\\]assets[\/\\]/, // 资源目录
  /[\/\\]templates[\/\\]/, // 模板目录
];

let watcher: FSWatcher | null = null;

/**
 * 标记一个文件即将由应用自身写入，watcher 会忽略该文件的后续变化事件。
 * 写入完成后请调用 clearPendingWrite。
 */
export function markPendingWrite(filePath: string): void {
  pendingWrites.add(path.resolve(filePath));
}

export function clearPendingWrite(filePath: string): void {
  pendingWrites.delete(path.resolve(filePath));
}

/** 安全执行：忽略对 pendingWrites 中文件的处理 */
function isPendingWrite(filePath: string): boolean {
  return pendingWrites.has(path.resolve(filePath));
}

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(filePath));
}

/**
 * 从 Markdown 文件解析出 MemoryRow。
 * 解析失败时抛出错误，由调用方决定如何处理。
 */
function parseMemoryFile(filePath: string): MemoryRow {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(fileContent);
  const data = parsed.data || {};
  const body = (parsed.content || '').trim();

  if (!data.id || typeof data.id !== 'string') {
    throw new Error(`Missing id in frontmatter: ${filePath}`);
  }

  // 优先取第一个 H1 标题作为 raw_content
  const h1Match = body.match(/^#\s+(.+)$/m);
  const titleLine = h1Match ? h1Match[1].trim() : '';
  // 找到 "## AI 解析摘要" 之前的内容作为 raw_content
  const summaryIdx = body.indexOf('## AI 解析摘要');
  const beforeSummary = summaryIdx > 0 ? body.slice(0, summaryIdx) : body;
  // 去掉首行 H1，剩下的就是正文
  const lines = beforeSummary.split('\n');
  const contentLines = lines.filter((l, idx) => !(idx === 0 && l.startsWith('# ')));
  const rawContent = contentLines.join('\n').trim() || titleLine;

  // 兼容旧数据：tags/entities 可能是数组或 JSON 字符串
  let tagsJson: string | null = null;
  if (Array.isArray(data.tags)) {
    tagsJson = JSON.stringify(data.tags);
  } else if (typeof data.tags === 'string') {
    tagsJson = data.tags;
  }

  let entitiesJson: string | null = null;
  if (Array.isArray(data.entities)) {
    entitiesJson = JSON.stringify(data.entities);
  } else if (typeof data.entities === 'string') {
    entitiesJson = data.entities;
  }

  const createdAt = typeof data.created_at === 'string'
    ? data.created_at
    : new Date().toISOString();
  const updatedAt = typeof data.updated_at === 'string'
    ? data.updated_at
    : createdAt;

  return {
    id: data.id,
    file_path: filePath,
    source: typeof data.source === 'string' ? data.source : 'obsidian',
    type: typeof data.type === 'string' ? data.type : 'text',
    category: typeof data.category === 'string' ? data.category : null,
    raw_content: rawContent,
    summary: typeof data.summary === 'string' ? data.summary : titleLine || rawContent.slice(0, 100),
    entities_json: entitiesJson,
    tags_json: tagsJson,
    files_json: null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/** 处理 add/change 事件：upsert 到内存数据库 + 异步重建向量 */
function handleUpsert(filePath: string): void {
  try {
    const row = parseMemoryFile(filePath);
    const existing = memoryDb.getById(row.id);
    if (existing) {
      // 保留现有的 files_json：markdown 不包含文件元数据，
      // 解析 markdown 时无法重建 files_json，因此更新时保留原值。
      memoryDb.update(row.id, { ...row, files_json: existing.files_json });
      console.log(`[VaultWatcher] updated: ${row.id}`);
    } else {
      memoryDb.insert(row);
      console.log(`[VaultWatcher] added: ${row.id}`);
    }

    // 异步重建 embedding（失败不影响主流程）
    const embeddingText = (row.summary || '') + ' ' + row.raw_content;
    generateAndStoreEmbedding(row.id, embeddingText).catch((err) => {
      console.error(`[VaultWatcher] Embedding failed for ${row.id}:`, err);
    });
  } catch (err) {
    console.error(`[VaultWatcher] Failed to parse ${filePath}:`, (err as Error).message);
  }
}

/** 处理 unlink 事件：根据文件路径从数据库中删除 */
function handleUnlink(filePath: string): void {
  const all = memoryDb.all();
  const target = all.find((m) => path.resolve(m.file_path) === path.resolve(filePath));
  if (!target) {
    // 文件本来就不在数据库中，忽略
    return;
  }
  removeFromCache(target.id);
  embeddingDb.delete(target.id);
  memoryDb.delete(target.id);
  console.log(`[VaultWatcher] removed: ${target.id}`);
}

/** debounce 包装：同一文件短时间内多次事件合并为一次 */
function debouncedHandle(
  filePath: string,
  handler: (p: string) => void,
  delay = config.vault.watchDebounceMs
): void {
  const existing = debounceTimers.get(filePath);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    debounceTimers.delete(filePath);
    handler(filePath);
  }, delay);
  debounceTimers.set(filePath, timer);
}

/** 启动 vault 监听器 */
export function startVaultWatcher(): void {
  if (watcher) {
    console.warn('[VaultWatcher] Already started, skipping');
    return;
  }

  const memoriesDir = path.join(config.vault.path, 'memories');
  if (!fs.existsSync(memoriesDir)) {
    fs.mkdirSync(memoriesDir, { recursive: true });
  }

  watcher = chokidar.watch(memoriesDir, {
    persistent: true,
    ignoreInitial: false, // 启动时处理现有文件，确保 DB 与 Vault 同步
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
    ignored: (p: string) => shouldIgnore(p),
  });

  watcher
    .on('add', (filePath) => {
      if (isPendingWrite(filePath)) {
        clearPendingWrite(filePath);
        return;
      }
      if (!filePath.endsWith('.md')) return;
      debouncedHandle(filePath, handleUpsert);
    })
    .on('change', (filePath) => {
      if (isPendingWrite(filePath)) {
        clearPendingWrite(filePath);
        return;
      }
      if (!filePath.endsWith('.md')) return;
      debouncedHandle(filePath, handleUpsert);
    })
    .on('unlink', (filePath) => {
      if (!filePath.endsWith('.md')) return;
      // unlink 不需要防抖（单次事件）
      debounceTimers.delete(filePath);
      handleUnlink(filePath);
    })
    .on('error', (err) => {
      console.error('[VaultWatcher] Error:', err);
    });

  console.log(`[VaultWatcher] Watching ${memoriesDir}`);
}

/** 停止 vault 监听器（用于测试或关闭流程） */
export async function stopVaultWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    debounceTimers.forEach((t) => clearTimeout(t));
    debounceTimers.clear();
    console.log('[VaultWatcher] Stopped');
  }
}
