# MemoFlow 配置指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并修改配置：

```bash
cp .env.example .env
```

---

## 核心配置

### LLM 提供商配置

支持多种 LLM 提供商，可在前端设置页面一键切换。

| 提供商 | API Key 获取 | 默认模型 |
|--------|-------------|---------|
| **MIMO（豆包）** | [火山引擎](https://console.volcengine.com/) | `mimo-v2.5-pro` |
| **DeepSeek** | [DeepSeek 平台](https://platform.deepseek.com/) | `deepseek-v4-flash` |
| **Qwen（通义千问）** | [阿里云百炼](https://bailian.console.aliyun.com/) | `qwen2.5-7b-chat` |

**环境变量示例**：

```env
# 当前使用的提供商
LLM_PROVIDER=mimo

# 当前提供商的 API Key
LLM_API_KEY=your-api-key

# 当前提供商的 Base URL
LLM_BASE_URL=https://api.xiaomimimo.com/v1

# 当前提供商的模型
LLM_MODEL=mimo-v2.5-pro

# 温度参数（0-1，越低越精准）
LLM_TEMPERATURE=0.3
```

### 多提供商配置（一键切换）

通过 `PROVIDER_CONFIGS` 配置多个提供商，切换时自动加载：

```env
PROVIDER_CONFIGS={"deepseek":{"apiKey":"sk-xxx","baseUrl":"https://api.deepseek.com","model":"deepseek-v4-flash"},"mimo":{"apiKey":"sk-xxx","baseUrl":"https://api.xiaomimimo.com/v1","model":"mimo-v2.5-pro"}}
```

---

## 飞书机器人配置

### 步骤 1：创建企业自建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 点击 **「创建企业自建应用」**
3. 填写应用名称（如：MemoFlow），点击 **「创建」**

### 步骤 2：添加机器人能力

1. 点击左侧菜单 **「应用能力」** → **「添加应用能力」**
2. 找到 **「机器人」** 卡片，点击 **「添加」**
3. 设置机器人名称和头像

### 步骤 3：获取凭证

1. 点击左侧菜单 **「凭证与基础信息」**
2. 复制：
   - **App ID**（如：`cli_xxx`）
   - **App Secret**（如：`xxx`）

### 步骤 4：开通权限

1. 点击左侧菜单 **「权限管理」** → **「开通权限」**
2. 搜索并开通以下权限：
   - `im:message.p2p_msg:readonly`（读取用户发给机器人的单聊消息）
   - `im:message:send_as_bot`（以应用的身份发消息）

### 步骤 5：配置事件订阅

1. 点击左侧菜单 **「事件与回调」**
2. 在 **订阅方式** 中选择 **「使用长连接接收事件」**
3. 点击 **「添加事件」**，添加：
   - `im.message.receive_v1`（接收消息事件）
4. 订阅类型选择 **「应用身份」**

### 步骤 6：发布应用

1. 点击左侧菜单 **「版本管理与发布」**
2. 点击 **「创建版本」**，填写版本信息
3. 点击 **「申请线上发布」**
4. 等待企业管理员审批（测试企业可自动通过）

### 步骤 7：配置环境变量

```env
# 飞书机器人
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
```

### 步骤 8：启动测试

启动服务器后，在飞书中搜索机器人名称发送消息测试。

---

## 可选配置

### Webhook 模式（单向通知）

如需仅发送通知（不接收消息），可配置 Webhook：

```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

### 知识库路径

```env
# Obsidian Vault 路径（相对或绝对路径）
VAULT_PATH=./vault
VAULT_WATCH_ENABLED=true
VAULT_WATCH_DEBOUNCE_MS=500
```

### 文件上传

```env
# 最大文件大小（字节）
MAX_FILE_SIZE=10485760

# 允许的文件类型
ALLOWED_FILE_TYPES=pdf,docx,xlsx,pptx,jpg,jpeg,png,gif
```

### 向量数据库

```env
# 使用 Ollama 本地模型（可选）
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# Embedding 配置（可选）
EMBEDDING_PROVIDER=
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=
EMBEDDING_MODEL=
```

---

## 配置文件结构

```
MemoFlow/
├── .env                    # 环境变量配置
├── vault/                  # 知识库目录
│   └── memories/           # 记忆文件
├── server/
│   └── data/
│       └── memoflow.db.json # 数据库文件
└── client/
    └── src/
        └── pages/
            └── SettingsPage.tsx # 设置页面
```

---

## 常见问题

### Q: 飞书机器人收不到消息？

1. 确认应用已发布上线
2. 确认权限已开通并审批通过
3. 确认事件订阅已配置
4. 检查服务器日志是否有 `[Feishu] Long connection started successfully`

### Q: 切换 LLM 提供商后配置不生效？

1. 在设置页面点击对应提供商按钮切换
2. 切换后会自动加载已保存的配置
3. 首次使用需先保存配置

### Q: API Key 安全吗？

1. API Key 仅存储在本地 `.env` 文件中
2. 不会上传到云端或第三方服务
3. 建议定期轮换 API Key

---

## 完整配置示例

```env
# 服务器配置
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# LLM 配置
LLM_PROVIDER=mimo
LLM_API_KEY=sk-your-api-key
LLM_BASE_URL=https://api.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro
LLM_TEMPERATURE=0.3

# 多提供商配置
PROVIDER_CONFIGS={"deepseek":{"apiKey":"sk-deepseek-key","baseUrl":"https://api.deepseek.com","model":"deepseek-v4-flash"},"mimo":{"apiKey":"sk-mimo-key","baseUrl":"https://api.xiaomimimo.com/v1","model":"mimo-v2.5-pro"}}

# 知识库
VAULT_PATH=./vault
VAULT_WATCH_ENABLED=true

# 飞书机器人
FEISHU_APP_ID=cli_your-app-id
FEISHU_APP_SECRET=your-app-secret

# 文件上传
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,xlsx,pptx,jpg,jpeg,png,gif
```