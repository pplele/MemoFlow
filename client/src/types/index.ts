// ==================== 实体与关系 ====================

export interface Entity {
  type: string;
  name: string;
  value?: string;
  label?: string;
  deadline?: string;
}

export interface Relation {
  from: string;
  relation: string;
  to: string;
}

// ==================== 记忆 ====================

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface Memory {
  id: string;
  tempId?: string;
  status?: 'loading' | 'success' | 'failed';
  file_path?: string;
  source: 'web' | 'feishu' | 'file-upload';
  type: 'text' | 'image' | 'document';
  category?: string;
  sub_category?: string;
  raw_content: string;
  summary?: string;
  entities?: Entity[];
  tags?: string[];
  files?: UploadedFile[];
  relations?: Relation[];
  created_at: string;
  updated_at: string;
}

export interface MemoryListResponse {
  items: Memory[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateMemoryRequest {
  content: string;
  source?: string;
  type?: string;
}

export interface CreateMemoryResponse {
  id: string;
  status: 'parsed';
  category: string;
  sub_category?: string;
  tags: string[];
  entities: Entity[];
  relations: Relation[];
  summary: string;
  file_path: string;
  created_at: string;
}

export interface FileMeta {
  original_name: string;
  file_type: string;
  file_size: number;
  extracted_text_length: number;
}

export interface FileUploadResponse extends CreateMemoryResponse {
  file_meta: FileMeta;
}

// ==================== 搜索 ====================

export interface SearchResult {
  query: string;
  memories: Array<Memory & { score: number }>;
  facts: Fact[];
  search_meta?: {
    keyword_count: number;
    vector_count: number;
    keyword_weight: number;
    vector_weight: number;
  };
}

// ==================== 事实 ====================

export interface Fact {
  id: string;
  entity: string;
  attribute: string;
  value: string;
  confidence?: number;
  source_count?: number;
  sources?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface FactListResponse {
  items: Fact[];
  total: number;
}

export interface FactByEntityResponse {
  entity: string;
  facts: Fact[];
}

// ==================== 智能问答 ====================

export interface QARequest {
  question: string;
  context?: string[];
}

export interface QASource {
  id: string;
  type: 'memory' | 'fact';
  content: string;
  summary?: string;
  category?: string;
  file_path?: string;
  files?: UploadedFile[];
  score: number;
}

export interface QAResponse {
  answer: string;
  sources: QASource[];
  used_memories: number;
  used_facts: number;
}

// ==================== 仪表盘 ====================

export interface DashboardStats {
  total_memories: number;
  week_new: number;
  total_entities: number;
  total_relations: number;
  total_facts: number;
  category_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  top_tags: Array<{ tag: string; count: number }>;
  daily_activity: Array<{ date: string; count: number }>;
  recent_7_days: Array<{ date: string; count: number }>;
}

// ==================== 通用 ====================

export interface DeleteResponse {
  id: string;
  deleted: boolean;
}

export interface ErrorResponse {
  error: string;
}

// ==================== Agent ====================

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  id: string;
  name: string;
  result: string;
  error?: string;
}

export interface AgentStreamEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer' | 'error' | 'done';
  data: unknown;
}

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AgentToolCall[];
  toolResults?: AgentToolResult[];
}
