# MemoFlow 🧠

> 本地优先的个人数字记忆中枢 — 让 AI 帮你记住一切

⚠️ **本项目仍在开发中（WIP），功能可能不稳定，API 随时可能变更。**

## 简介

MemoFlow 是一个本地优先的个人记忆管理系统。它将你的碎片化信息（文字、图片、文档）自动结构化为记忆，并提供智能搜索和问答能力。所有数据存储在本地，通过 Obsidian Vault 作为可视化后端，你完全拥有自己的数据。

## 功能

- **📝 智能记忆录入** — 输入文字或上传文件，AI 自动解析分类、提取实体、生成摘要
- **🔍 混合搜索** — 关键词匹配 + 语义向量搜索，精准召回相关记忆
- **💬 智能问答** — 基于记忆库回答问题，引用来源可追溯
- **🤖 AI Agent** — ReAct 模式智能助手，自动调用工具完成搜索、创建、分析
- **📂 文件库** — 统一管理图片、PDF、Word、Excel 等附件，Obsidian 原生引用
- **🕸️ 知识图谱** — 自动构建实体关系网络，可视化记忆关联
- **📊 事实库** — 从记忆中提取持久事实（偏好、属性、关系）
- **📓 Obsidian 集成** — 记忆以 Markdown 存储，附件用 `![[...]]` 引用，支持双向编辑

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | 本地 JSON 文件存储（零依赖） |
| AI | 豆包/OpenAI 兼容 API（向量嵌入 + 对话） |
| 文件监听 | Chokidar（Vault 双向同步） |
| 存储 | Obsidian Vault（Markdown + 附件） |

## 快速开始

### 环境要求

- Node.js >= 18
- 一个 OpenAI 兼容的 API Key（豆包/小米 MiMo 等）

### 安装

```bash
# 克隆仓库
git clone https://github.com/pplele/MemoFlow.git
cd MemoFlow

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key
```

### 配置

编辑 `.env` 文件：

```env
DOUBAO_API_KEY=your_api_key_here
DOUBAO_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-1-5-pro-32k
DOUBAO_EMBEDDING_MODEL=doubao-embedding
```

### 运行

```bash
# 同时启动前后端（开发模式）
npm run dev

# 或分开启动
npm run dev:client   # 前端 http://localhost:3000
npm run dev:server   # 后端 http://localhost:3001
```

### 构建

```bash
npm run build
```

## 项目结构

```
MemoFlow/
├── client/               # React 前端
│   └── src/
│       ├── pages/        # 页面组件
│       ├── stores/       # Zustand 状态管理
│       ├── api/          # API 调用
│       └── components/   # 通用组件
├── server/               # Express 后端
│   └── src/
│       ├── routes/       # API 路由
│       ├── services/     # 业务逻辑
│       │   ├── agent/    # AI Agent (ReAct)
│       │   └── ...
│       ├── db/           # 数据库层
│       └── config/       # 配置
├── vault/                # Obsidian Vault (用户数据)
│   ├── memories/         # 记忆 Markdown (gitignore)
│   ├── uploads/          # 上传附件 (gitignore)
│   ├── templates/        # 模板
│   └── .obsidian/        # Obsidian 配置
└── .env.example          # 环境变量模板
```

## 开发状态

- [x] 记忆录入与 AI 解析
- [x] 文件上传与文件库
- [x] 关键词 + 向量混合搜索
- [x] 智能问答
- [x] AI Agent（ReAct 模式）
- [x] Obsidian 双向同步
- [x] 知识图谱
- [ ] 事实库自动提取优化
- [ ] 移动端适配
- [ ] 插件系统

## License

MIT
