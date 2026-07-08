import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { decodeFileName } from '../services/encoding.js';

export interface MemoryRow {
  id: string;
  file_path: string;
  source: string;
  type: string;
  category: string | null;
  raw_content: string;
  summary: string | null;
  entities_json: string | null;
  tags_json: string | null;
  files_json: string | null;
  created_at: string;
  updated_at: string;
  rowid?: number;
}

export interface EmbeddingRow {
  memory_id: string;
  vector: string;
}

export interface FactRow {
  id: string;
  entity: string;
  attribute: string;
  value: string;
  confidence: number | null;
  source_count: number | null;
  sources_json: string | null;
  created_at: string | null;
  updated_at: string | null;
  rowid?: number;
}

interface DataStore {
  memories: MemoryRow[];
  embeddings: EmbeddingRow[];
  facts: FactRow[];
  nextRowid: { memories: number; facts: number };
}

let store: DataStore = {
  memories: [],
  embeddings: [],
  facts: [],
  nextRowid: { memories: 1, facts: 1 },
};

let saveTimer: NodeJS.Timeout | null = null;

function getDataPath(): string {
  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return config.db.path + '.json';
}

export function initDb(): Promise<void> {
  return new Promise((resolve) => {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      try {
        const raw = fs.readFileSync(dataPath, 'utf-8');
        store = JSON.parse(raw);
      } catch (e) {
        console.warn('[DB] Failed to load data file, starting fresh:', e);
      }
    }
    scheduleSave();
    console.log('[DB] Database initialized at', dataPath);
    console.log(`[DB] ${store.memories.length} memories, ${store.facts.length} facts`);
    resolve();
  });
}

function scheduleSave() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(() => {
    saveToDisk().catch(console.error);
  }, 5000);
}

let dirty = false;
let writeLock = false;

export function markDirty() {
  dirty = true;
}

export async function saveToDisk() {
  if (!dirty || writeLock) return;
  writeLock = true;
  try {
    const dataPath = getDataPath();
    const tmpPath = dataPath + '.tmp';
    await fs.promises.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, dataPath);
    dirty = false;
  } catch (error) {
    console.error('[DB] Failed to save:', error);
  } finally {
    writeLock = false;
  }
}

function assignRowid(table: 'memories' | 'facts'): number {
  const id = store.nextRowid[table];
  store.nextRowid[table]++;
  return id;
}

export const memoryDb = {
  all(): MemoryRow[] {
    return [...store.memories];
  },

  getById(id: string): MemoryRow | undefined {
    return store.memories.find((m) => m.id === id);
  },

  insert(row: Omit<MemoryRow, 'rowid'>): MemoryRow {
    const rowid = assignRowid('memories');
    const newRow = { ...row, rowid };
    store.memories.push(newRow);
    markDirty();
    return newRow;
  },

  update(id: string, updates: Partial<MemoryRow>): MemoryRow | undefined {
    const idx = store.memories.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    store.memories[idx] = { ...store.memories[idx], ...updates };
    markDirty();
    return store.memories[idx];
  },

  delete(id: string): boolean {
    const idx = store.memories.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    store.memories.splice(idx, 1);
    store.embeddings = store.embeddings.filter((e) => e.memory_id !== id);
    markDirty();
    return true;
  },

  search(keyword: string): (MemoryRow & { score: number })[] {
    const kw = keyword.toLowerCase();
    const results: (MemoryRow & { score: number })[] = [];

    for (const m of store.memories) {
      let score = 0;
      if (m.raw_content.toLowerCase().includes(kw)) score += 2;
      if (m.summary?.toLowerCase().includes(kw)) score += 3;
      if (m.tags_json?.toLowerCase().includes(kw)) score += 4;
      if (m.entities_json?.toLowerCase().includes(kw)) score += 2;
      if (m.category?.toLowerCase().includes(kw)) score += 1;
      if (m.files_json) {
        try {
          const files = JSON.parse(m.files_json);
          if (Array.isArray(files)) {
            for (const f of files) {
              if (f.name && decodeFileName(f.name).toLowerCase().includes(kw)) {
                score += 3;
                break;
              }
            }
          }
        } catch {}
      }
      if (score > 0) {
        results.push({ ...m, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  },

  count(): number {
    return store.memories.length;
  },

  list(opts?: {
    page?: number;
    limit?: number;
    category?: string;
    date_from?: string;
    date_to?: string;
    tier?: 'hot' | 'warm' | 'cold';
    type_group?: 'text' | 'files';
  }): { items: MemoryRow[]; total: number; page: number; pageSize: number } {
    let filtered = [...store.memories];

    if (opts?.category) {
      const cat = opts.category;
      filtered = filtered.filter((m) => m.category === cat);
    }

    if (opts?.type_group === 'text') {
      filtered = filtered.filter((m) => m.type === 'text' || m.type === undefined);
    } else if (opts?.type_group === 'files') {
      filtered = filtered.filter((m) => m.type !== 'text' && m.type !== undefined);
    }

    if (opts?.date_from) {
      const from = opts.date_from;
      filtered = filtered.filter((m) => m.created_at >= from);
    }

    if (opts?.date_to) {
      const to = opts.date_to;
      filtered = filtered.filter((m) => m.created_at <= to + 'T23:59:59');
    }

    if (opts?.tier) {
      const now = Date.now();
      const hotDays = 7 * 24 * 60 * 60 * 1000;
      const warmDays = 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((m) => {
        const t = new Date(m.created_at).getTime();
        const age = now - t;
        if (opts.tier === 'hot') return age <= hotDays;
        if (opts.tier === 'warm') return age > hotDays && age <= warmDays;
        return age > warmDays;
      });
    }

    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const total = filtered.length;
    const page = opts?.page || 1;
    const pageSize = opts?.limit || 20;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },

  getStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const categoryDist: Record<string, number> = {};
    const dailyActivity: Record<string, number> = {};
    const sourceDist: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    const entitySet = new Set<string>();
    let weekNew = 0;

    for (const m of store.memories) {
      if (m.category) {
        const cat = m.category.split('/')[0];
        categoryDist[cat] = (categoryDist[cat] || 0) + 1;
      }

      const date = m.created_at.slice(0, 10);
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;

      if (new Date(m.created_at) >= weekAgo) {
        weekNew++;
      }

      const source = m.source || 'unknown';
      sourceDist[source] = (sourceDist[source] || 0) + 1;

      if (m.tags_json) {
        try {
          const tags = JSON.parse(m.tags_json);
          for (const t of Array.isArray(tags) ? tags : []) {
            if (typeof t === 'string' && t) {
              tagCount[t] = (tagCount[t] || 0) + 1;
            }
          }
        } catch {}
      }

      if (m.entities_json) {
        try {
          const entities = JSON.parse(m.entities_json);
          for (const e of entities) {
            entitySet.add(e.name || e.value || '');
          }
        } catch {}
      }
    }

    const dailyActivityArr = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // 强制保留最近 7 天（即使某些天为 0）
    const recent7: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      recent7.push({ date: key, count: dailyActivity[key] || 0 });
    }

    const topTags = Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      total_memories: store.memories.length,
      week_new: weekNew,
      total_entities: entitySet.size,
      total_relations: 0,
      total_facts: store.facts.length,
      category_distribution: categoryDist,
      source_distribution: sourceDist,
      top_tags: topTags,
      daily_activity: dailyActivityArr,
      recent_7_days: recent7,
    };
  },
};

export const embeddingDb = {
  getByMemoryId(memoryId: string): EmbeddingRow | undefined {
    return store.embeddings.find((e) => e.memory_id === memoryId);
  },

  getAll(): EmbeddingRow[] {
    return [...store.embeddings];
  },

  upsert(memoryId: string, vector: string): void {
    const idx = store.embeddings.findIndex((e) => e.memory_id === memoryId);
    if (idx >= 0) {
      store.embeddings[idx].vector = vector;
    } else {
      store.embeddings.push({ memory_id: memoryId, vector });
    }
    markDirty();
  },

  delete(memoryId: string): boolean {
    const idx = store.embeddings.findIndex((e) => e.memory_id === memoryId);
    if (idx === -1) return false;
    store.embeddings.splice(idx, 1);
    markDirty();
    return true;
  },
};

export const factDb = {
  all(): FactRow[] {
    return [...store.facts];
  },

  getById(id: string): FactRow | undefined {
    return store.facts.find((f) => f.id === id);
  },

  getByEntity(entity: string): FactRow[] {
    return store.facts.filter((f) => f.entity === entity);
  },

  insert(row: Omit<FactRow, 'rowid'>): FactRow {
    const rowid = assignRowid('facts');
    const newRow = { ...row, rowid };
    store.facts.push(newRow);
    markDirty();
    return newRow;
  },

  update(id: string, updates: Partial<FactRow>): FactRow | undefined {
    const idx = store.facts.findIndex((f) => f.id === id);
    if (idx === -1) return undefined;
    store.facts[idx] = { ...store.facts[idx], ...updates };
    markDirty();
    return store.facts[idx];
  },

  delete(id: string): boolean {
    const idx = store.facts.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    store.facts.splice(idx, 1);
    markDirty();
    return true;
  },

  search(keyword: string): (FactRow & { score: number })[] {
    const kw = keyword.toLowerCase();
    const results: (FactRow & { score: number })[] = [];

    for (const f of store.facts) {
      let score = 0;
      if (f.entity.toLowerCase().includes(kw)) score += 3;
      if (f.attribute.toLowerCase().includes(kw)) score += 2;
      if (f.value.toLowerCase().includes(kw)) score += 2;
      if (score > 0) {
        results.push({ ...f, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  },

  count(): number {
    return store.facts.length;
  },
};

export async function closeDb() {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  await saveToDisk();
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
