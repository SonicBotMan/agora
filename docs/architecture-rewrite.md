# Agora — 架构重写方案

> 基于 WeSight (SonicBotMan/wesight) 架构重写，保留核心理念，全新代码实现。
> 版本：v0.1-draft | 2026-06-01

---

## 一、项目定位

Agora 是一个开源桌面 AI Agent 工作台，为本地 AI 编码代理提供统一的图形化控制台，并内置深度研究、Agent 协作编排、本地知识库、热点工作台、Skill 管理中心和前端开发站六大特色功能。默认引擎为 OpenCode（轻量、CLI 原生、开箱即用），同时支持 OpenClaw、Claude Code、Hermes、DeepSeek-TUI、Codex 五个可选引擎。

**核心价值主张**：WeSight 把碎片化的 Agent 工具整合到了一个桌面工作空间。Agora 在此基础上，让 Agent 不仅能"用"，还能"研究"、"协作"、"记住"、"监控"和"创造"。

---

## 二、技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | Electron 40.x | 继承 WeSight 选型，已有成熟生态 |
| 前端 | React + TypeScript + Tailwind CSS + Redux Toolkit | 与 WeSight 一致，降低迁移成本 |
| 构建 | Vite + vite-plugin-electron | 开发端口 5175 |
| 打包 | electron-builder | macOS DMG / Windows NSIS / Linux AppImage |
| 数据库 | better-sqlite3 (FTS5) | 本地会话/消息/知识库 |
| 向量检索 | 可选 Ollama / transformers.js | 知识库语义搜索 |
| 代码编辑器 | Monaco Editor | 前端开发站 |
| 终端 | xterm.js | 前端开发站内嵌终端 |
| 测试 | Vitest (单元) + 自定义测试 (集成) | 增量测试 |
| 质量 | ESLint + Prettier + Husky | CI 做增量 lint |

---

## 三、保留 vs 砍掉

### 3.1 引擎（保留 6 个）

| 引擎 | 适配器来源 | 角色 | 改造重点 |
|---|---|---|---|
| **OpenCode** | `externalCliRuntimeAdapter.ts` 部分 | **默认引擎** | 独立轻量适配器，开箱即用 |
| OpenClaw | `openclawRuntimeAdapter.ts` (4205行) | 可选 | 精简为 Gateway 通信层，剥离飞书特化逻辑 |
| Claude Code | `coworkRunner.ts` (3295行) | 可选 | 保留 SDK 集成，重构权限审批流 |
| Hermes | `hermesRuntimeAdapter.ts` | 可选 | 保留，增强与 Hermes Gateway 的集成 |
| DeepSeek-TUI | `deepSeekTuiRuntimeAdapter.ts` | 可选 | 保留 SSE 流处理 |
| Codex | `codexRuntimeAdapter.ts` | 可选 | 保留，CLI 子进程通信 |

**默认引擎**：OpenCode — 轻量、无需复杂配置、CLI 原生、适合大多数场景。
用户可随时切换到其他引擎。

**砍掉的引擎**：CodexApp, GrokBuild, QwenCode, YdCowork（内置运行时）

### 3.2 IM 平台（保留 7 个）

| 平台 | 接入方式 | 改造 |
|---|---|---|
| 飞书 | Native SDK 直连 + OpenClaw Plugin | 保留双通道，简化配置 |
| 钉钉 | OpenClaw Plugin | 保留 |
| 微信 | OpenClaw Plugin | 保留 |
| QQ | OpenClaw Plugin | 保留 |
| 企业微信 | OpenClaw Plugin | 保留 |
| Telegram | OpenClaw 内置 | 保留 |
| Discord | OpenClaw 内置 | 保留 |

**砍掉的 IM**：网易云信、网易蜜蜂、POPO

### 3.3 功能模块

| 功能 | 处理 | 说明 |
|---|---|---|
| 桌面宠物 | 砍掉 | 以后再看怎么加 |
| 15 套主题 | 全部保留 | 用户满意 |
| AgentTeamRunner | 重写 | 升级为 DAG 编排器 |
| SkillManager | 优化 | 在现有基础上改进 |
| 定时任务 | 保留精简 | 去掉过于复杂的 policy 系统 |

---

## 四、目录结构

```
agora/
├── src/
│   ├── core/                    — 核心抽象层
│   │   ├── CoworkRuntime.ts         — 引擎接口（精简保留）
│   │   ├── EngineRouter.ts          — 路由器（6 引擎路由，默认 OpenCode）
│   │   ├── SessionManager.ts        — 会话 CRUD + 生命周期
│   │   ├── MessageStore.ts          — 消息持久化（SQLite）
│   │   ├── PermissionManager.ts     — 权限审批（从 main.ts 拆出）
│   │   ├── AttachmentHandler.ts     — 附件处理（从 main.ts 拆出）
│   │   └── ConfigManager.ts         — 全局配置（从 coworConfigStore 提取）
│   │
│   ├── engines/                 — 引擎适配器（每个引擎一个目录）
│   │   ├── openclaw/
│   │   │   ├── OpenClawAdapter.ts
│   │   │   ├── OpenClawEngineManager.ts
│   │   │   ├── GatewayClient.ts     — WebSocket/SSE 通信
│   │   │   └── types.ts
│   │   ├── claude-code/
│   │   │   ├── ClaudeCodeAdapter.ts
│   │   │   └── ClaudeSdkRunner.ts   — SDK IPC 封装
│   │   ├── hermes/
│   │   │   ├── HermesAdapter.ts
│   │   │   └── HermesClient.ts      — HTTP/JSON-RPC
│   │   ├── opencode/
│   │   │   └── OpenCodeAdapter.ts
│   │   ├── deepseek-tui/
│   │   │   └── DeepSeekTuiAdapter.ts
│   │   └── codex/
│   │       └── CodexAdapter.ts
│   │
│   ├── im/                      — IM 网关（精简）
│   │   ├── ImGatewayManager.ts      — 统一管理器
│   │   ├── ImStore.ts               — 配置持久化
│   │   ├── ImChatHandler.ts         — 纯聊天回复
│   │   ├── ImCoworkHandler.ts       — IM→Agent 会话转换
│   │   ├── ImDeliveryRoute.ts       — 消息投递路由
│   │   ├── ImReplyGuard.ts          — 防回复风暴
│   │   └── platforms/               — 平台特化
│   │       ├── feishu/
│   │       │   ├── NativeFeishuGateway.ts
│   │       │   └── FeishuConfig.ts
│   │       ├── dingtalk/
│   │       ├── wechat/
│   │       ├── qq/
│   │       ├── wecom/
│   │       ├── telegram/
│   │       └── discord/
│   │
│   ├── features/                — 特色功能模块（6个）
│   │   ├── deep-research/            — ① 深度研究
│   │   │   ├── ResearchEngine.ts         — 多轮搜索+交叉验证
│   │   │   ├── ResearchSession.ts        — 研究会话管理
│   │   │   ├── ReportGenerator.ts        — 结构化报告生成
│   │   │   ├── Sources/                  — 搜索源适配
│   │   │   │   ├── web.ts                    — 网页搜索
│   │   │   │   ├── scholar.ts                — 学术搜索
│   │   │   │   └── social.ts                 — 社交媒体搜索
│   │   │   └── types.ts
│   │   │
│   │   ├── agent-orchestrator/      — ② Agent 协作编排
│   │   │   ├── Orchestrator.ts           — Orchestrator Agent（拆任务+分配+汇总）
│   │   │   ├── TaskGraph.ts              — DAG 定义（节点=Agent任务，边=依赖）
│   │   │   ├── TaskScheduler.ts          — 并行/串行调度器
│   │   │   ├── AgentPool.ts              — 可用 Agent 池
│   │   │   ├── TaskResultAggregator.ts   — 结果汇总+冲突解决
│   │   │   ├── templates/                — 预置工作流模板
│   │   │   │   ├── project-dev.ts            — 开发项目
│   │   │   │   ├── plan-design.ts            — 方案策划
│   │   │   │   └── deep-investigation.ts     — 深度调研
│   │   │   └── types.ts
│   │   │
│   │   ├── knowledge-base/         — ③ 本地知识库
│   │   │   ├── KnowledgeStore.ts        — SQLite + FTS5 全文检索
│   │   │   ├── EmbeddingEngine.ts       — 本地向量化（可选 Ollama/transformers.js）
│   │   │   ├── DocumentProcessor.ts     — 文档摄入（MD/PDF/TXT/HTML）
│   │   │   ├── ConversationIngestor.ts  — 对话历史→知识库
│   │   │   ├── ResearchIngestor.ts      — 研究报告→知识库
│   │   │   ├── EntityExtractor.ts       — 实体抽取+关系链接
│   │   │   ├── KnowledgeSearch.ts       — 混合检索（关键词+语义）
│   │   │   └── types.ts
│   │   │
│   │   ├── hot-topics/             — ④ 热点工作台
│   │   │   ├── TopicMonitor.ts          — 持续监控调度
│   │   │   ├── SourceCrawlers/          — 数据源爬取
│   │   │   │   ├── hackernews.ts
│   │   │   │   ├── twitter.ts
│   │   │   │   ├── reddit.ts
│   │   │   │   ├── arxiv.ts
│   │   │   │   ├── weibo.ts
│   │   │   │   └── custom.ts
│   │   │   ├── TopicClassifier.ts       — 话题分类+评分
│   │   │   ├── TopicDigest.ts           — 每日摘要生成
│   │   │   ├── TopicActions.ts          — 基于热点的动作（发文/研究/推送）
│   │   │   └── types.ts
│   │   │
│   │   ├── skill-center/           — ⑤ Skill 管理中心
│   │   │   ├── SkillManager.ts          — 技能生命周期
│   │   │   ├── SkillScanner.ts          — SKILL.md 解析
│   │   │   ├── SkillSecurity.ts         — 安全扫描
│   │   │   ├── SkillMarketplace.ts      — 在线市场
│   │   │   └── types.ts
│   │   │
│   │   └── frontend-station/       — ⑥ 前端开发站
│   │       ├── DevServerManager.ts      — 内置 Vite/Next.js dev server 管理
│   │       ├── PreviewPanel.ts          — iframe/WebView 预览
│   │       ├── CodeEditor.ts            — Monaco Editor 集成
│   │       ├── TerminalManager.ts       — 内置终端（xterm.js）
│   │       ├── TemplateManager.ts       — 项目模板
│   │       ├── ComponentLibrary.ts      — UI 组件库浏览
│   │       └── types.ts
│   │
│   ├── mcp/                     — MCP 桥接
│   │   ├── McpServerManager.ts
│   │   ├── McpBridgeServer.ts
│   │   └── McpStore.ts
│   │
│   ├── scheduled-task/          — 定时任务（保留精简版）
│   │   ├── CronJobService.ts
│   │   ├── TaskStore.ts
│   │   └── policies/
│   │
│   ├── ipc/                     — IPC 层（按领域拆分）
│   │   ├── index.ts                    — 注册入口
│   │   ├── sessionHandlers.ts
│   │   ├── engineHandlers.ts
│   │   ├── imHandlers.ts
│   │   ├── skillHandlers.ts
│   │   ├── researchHandlers.ts
│   │   ├── orchestratorHandlers.ts
│   │   ├── knowledgeHandlers.ts
│   │   ├── hotTopicsHandlers.ts
│   │   ├── frontendStationHandlers.ts
│   │   └── mcpHandlers.ts
│   │
│   ├── shared/                  — 共享类型和常量
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── main.ts                  — 入口（只做初始化+窗口管理，<1000行）
│   └── preload.ts               — IPC 白名单
│
├── renderer/                    — 前端（React + Tailwind + Redux Toolkit）
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/                  — 布局组件
│   │   ├── cowork/                  — 对话界面
│   │   ├── research/                — 深度研究 UI
│   │   ├── orchestrator/            — Agent 编排 UI（可视化 DAG）
│   │   ├── knowledge/               — 知识库 UI
│   │   ├── hot-topics/              — 热点面板 UI
│   │   ├── skill-center/            — Skill 管理 UI
│   │   ├── frontend-station/        — 前端开发站 UI
│   │   ├── settings/                — 设置（按 tab 拆分）
│   │   ├── im/                      — IM 配置 UI
│   │   └── common/                  — 通用组件
│   ├── services/                     — API 封装层
│   ├── store/                        — Redux slices
│   ├── theme/                        — 主题系统（保留全部 15 套）
│   └── types/
│
├── SKILLs/                      — 内置技能
├── scripts/                     — 构建脚本
├── resources/                   — 静态资源
├── tests/                       — 测试
├── docs/                        — 文档
└── package.json
```

---

## 五、核心抽象层设计

### 5.1 CoworkRuntime 接口

```typescript
// src/core/CoworkRuntime.ts
export interface CoworkRuntime {
  // 生命周期
  startSession(id: string, prompt: string, opts: StartOptions): Promise<void>;
  continueSession(id: string, prompt: string, opts: ContinueOptions): Promise<void>;
  stopSession(id: string): void;

  // 权限
  respondToPermission(requestId: string, result: PermissionResult): void;

  // 状态
  isSessionActive(id: string): boolean;

  // 事件（通过 EventEmitter）
  on(event: 'message', handler: (sessionId: string, msg: CoworkMessage) => void): void;
  on(event: 'permissionRequest', handler: (sessionId: string, req: PermissionRequest) => void): void;
  on(event: 'runtimeMetric', handler: (sessionId: string, metric: RuntimeMetric) => void): void;
  on(event: 'complete', handler: (sessionId: string) => void): void;
  on(event: 'error', handler: (sessionId: string, error: string) => void): void;
}

export interface StartOptions {
  skillIds?: string[];
  systemPrompt?: string;
  autoApprove?: boolean;
  workspaceRoot?: string;
  confirmationMode?: 'modal' | 'text';
  imageAttachments?: ImageAttachment[];
  agentId?: string;
  agentEngine?: CoworkAgentEngine;
}

export interface ContinueOptions {
  systemPrompt?: string;
  skillIds?: string[];
  imageAttachments?: ImageAttachment[];
  agentId?: string;
  agentEngine?: CoworkAgentEngine;
}
```

### 5.2 EngineRouter（6 引擎路由）

```typescript
// src/core/EngineRouter.ts
export class EngineRouter extends EventEmitter implements CoworkRuntime {
  private runtimeByEngine: Record<CoworkAgentEngine, CoworkRuntime>;
  private sessionEngine: Map<string, CoworkAgentEngine>;
  private requestEngine: Map<string, CoworkAgentEngine>;

  constructor(deps: {
    openclaw: CoworkRuntime;
    claudeCode: CoworkRuntime;
    hermes: CoworkRuntime;
    openCode: CoworkRuntime;  // 默认引擎
    deepSeekTui: CoworkRuntime;
    codex: CoworkRuntime;
    // 默认引擎：OpenCode（轻量、无需复杂配置）
    // 用户可在设置中切换到其他引擎
    getCurrentEngine: () => CoworkAgentEngine.OpenCode;
    telemetry?: RuntimeTelemetryTracker;
  });

  // 根据 options.agentEngine 或当前引擎路由到对应 runtime
  async startSession(id: string, prompt: string, opts: StartOptions): Promise<void>;
  async continueSession(id: string, prompt: string, opts: ContinueOptions): Promise<void>;
  stopSession(id: string): void;

  // 引擎切换时停止所有活跃会话
  handleEngineConfigChanged(nextEngine: CoworkAgentEngine): void;
}
```

### 5.3 Agent 编排器（Orchestrator）

```typescript
// src/features/agent-orchestrator/types.ts

interface TaskNode {
  id: string;
  agentEngine: CoworkAgentEngine;  // 用哪个引擎执行
  agentId?: string;                 // 可选指定 Agent
  prompt: string;                   // 任务描述（支持模板变量 {{parent.result}}）
  dependsOn: string[];              // 依赖的前置任务 ID
  timeout?: number;                 // 超时秒数
  retry?: { maxAttempts: number; delay: number };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
}

interface TaskGraph {
  id: string;
  name: string;
  description: string;
  nodes: TaskNode[];
  source: 'auto' | 'manual' | 'template';
  createdAt: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

// Orchestrator Agent 核心逻辑
class Orchestrator {
  // Phase 1: 拆解 — 用户需求 → TaskGraph
  async plan(goal: string, context?: string): Promise<TaskGraph>;

  // Phase 2: 调度 — 按 DAG 拓扑排序，并行执行无依赖的任务
  async execute(graph: TaskGraph): Promise<TaskGraph>;

  // Phase 3: 汇总 — 收集所有任务结果，生成最终交付物
  async aggregate(graph: TaskGraph): Promise<string>;

  // 运行时干预
  cancelTask(nodeId: string): void;
  retryTask(nodeId: string): void;
  injectContext(nodeId: string, context: string): void;
}

// 预置工作流模板
const WORKFLOW_TEMPLATES = {
  'project-dev': { /* 开发项目：需求分析→架构设计→编码→测试→部署 */ },
  'plan-design': { /* 方案策划：调研→框架→细化→评审 */ },
  'deep-investigation': { /* 深度调研：多源搜索→交叉验证→报告生成 */ },
};
```

### 5.4 本地知识库

```typescript
// src/features/knowledge-base/types.ts

interface KnowledgeDocument {
  id: string;
  title: string;
  source: 'conversation' | 'research' | 'manual' | 'hot-topic';
  sourceId?: string;           // 关联的会话/研究/热点 ID
  content: string;
  contentType: 'markdown' | 'text' | 'html';
  metadata: {
    tags: string[];
    entities: Entity[];
    embedding?: number[];      // 向量（可选，需 Ollama/transformers.js）
    createdAt: string;
    updatedAt: string;
  };
}

interface Entity {
  name: string;
  type: 'person' | 'org' | 'concept' | 'tool' | 'tech';
  relations: { target: string; type: string }[];
}

// 检索接口 — 混合检索
interface KnowledgeSearch {
  // 关键词检索（SQLite FTS5）
  searchByKeywords(query: string, limit?: number): Promise<KnowledgeDocument[]>;

  // 语义检索（向量相似度，可选）
  searchByEmbedding(query: string, limit?: number): Promise<KnowledgeDocument[]>;

  // 混合检索（关键词 + 语义加权融合）
  searchHybrid(query: string, opts?: {
    keywordWeight?: number;
    semanticWeight?: number;
    limit?: number;
  }): Promise<KnowledgeDocument[]>;

  // 图查询（实体关系）
  searchByEntity(entityName: string, depth?: number): Promise<KnowledgeDocument[]>;
}
```

### 5.5 深度研究引擎

```typescript
// src/features/deep-research/types.ts

interface ResearchQuery {
  query: string;
  sources: ('web' | 'scholar' | 'social')[];
  maxRounds: number;           // 最多搜索轮数
 交叉验证: boolean;
}

interface ResearchResult {
  query: string;
  rounds: ResearchRound[];
  synthesis: string;           // 综合结论
  sources: Source[];           // 引用来源
  confidence: number;          // 置信度 0-1
  savedToKnowledgeBase: boolean;
}

interface ResearchRound {
  round: number;
  searchQueries: string[];
  findings: Finding[];
  newQuestions: string[];       // 本轮发现的新问题，触发下一轮
}

// ResearchEngine 核心逻辑
class ResearchEngine {
  async research(query: ResearchQuery): AsyncGenerator<ResearchEvent>;

  // 事件流
  on(event: 'round-complete', handler: (round: ResearchRound) => void): void;
  on(event: 'synthesis', handler: (result: ResearchResult) => void): void;
  on(event: 'saved', handler: (docId: string) => void): void;
}

type ResearchEvent =
  | { type: 'search-start'; round: number; queries: string[] }
  | { type: 'search-result'; round: number; findings: Finding[] }
  | { type: 'round-complete'; round: number; newQuestions: string[] }
  | { type: 'synthesis-start'; }
  | { type: 'synthesis-complete'; result: ResearchResult }
  | { type: 'saved-to-knowledge-base'; docId: string };
```

### 5.6 热点工作台

```typescript
// src/features/hot-topics/types.ts

interface TopicItem {
  id: string;
  title: string;
  summary: string;
  source: string;              // 'hackernews' | 'twitter' | 'reddit' | 'arxiv' | 'weibo' | 'custom'
  url: string;
  score: number;               // 热度评分
  category: string;            // 'ai' | 'dev' | 'product' | 'research' | ...
  discoveredAt: string;
  tags: string[];
}

interface TopicDigest {
  date: string;
  topics: TopicItem[];
  aiSummary?: string;          // AI 生成的每日摘要
}

// TopicMonitor 核心逻辑
class TopicMonitor {
  // 启动持续监控
  start(sources: SourceConfig[]): void;
  stop(): void;

  // 获取今日热点
  getTodayDigest(): Promise<TopicDigest>;

  // 基于热点的动作
  startResearch(topicId: string): Promise<void>;        // 深度研究
  startWriting(topicId: string, style?: string): Promise<void>; // 发文
  pushToIM(topicId: string, channels: string[]): Promise<void>; // 推送到 IM
  saveToKnowledge(topicId: string): Promise<void>;      // 存入知识库

  // 事件
  on(event: 'new-topic', handler: (topic: TopicItem) => void): void;
  on(event: 'digest-ready', handler: (digest: TopicDigest) => void): void;
}
```

### 5.7 前端开发站

```typescript
// src/features/frontend-station/types.ts

interface DevProject {
  id: string;
  name: string;
  template: 'vite-react' | 'vite-vue' | 'nextjs' | 'blank';
  path: string;
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  createdAt: string;
}

// DevServerManager 核心逻辑
class DevServerManager {
  // 创建项目
  async createProject(opts: { name: string; template: string; path?: string }): Promise<DevProject>;

  // 管理 dev server
  async startServer(projectId: string): Promise<void>;
  async stopServer(projectId: string): Promise<void>;
  async restartServer(projectId: string): Promise<void>;

  // 预览 URL
  getPreviewUrl(projectId: string): string;

  // 事件
  on(event: 'server-ready', handler: (projectId: string, url: string) => void): void;
  on(event: 'server-error', handler: (projectId: string, error: string) => void): void;
  on(event: 'hmr-update', handler: (projectId: string, file: string) => void): void;
}

// 前端开发站布局
// ┌─────────────────────────────────────────────┐
// │  FrontendStation View                       │
// │  ┌─────────┬───────────────┬──────────────┐ │
// │  │ 代码编辑 │  终端          │  预览面板    │ │
// │  │ Monaco  │  xterm.js     │  iframe/     │ │
// │  │ Editor  │               │  WebView     │ │
// │  │         │               │  实时热更新   │ │
// │  └─────────┴───────────────┴──────────────┘ │
// │  ┌──────────────────────────────────────────┐│
// │  │ Agent Chat Panel                         ││
// │  │ "帮我创建一个登录页面" → Agent 修改代码   ││
// │  │ → Dev Server HMR → 预览实时更新          ││
// │  └──────────────────────────────────────────┘│
// └─────────────────────────────────────────────┘
```

---

## 六、数据流

### 6.1 核心对话流

```
用户输入 → Preload IPC → Main process IPC handler
  → EngineRouter.startSession()
    → 具体引擎 Adapter.startSession()
      → [CLI spawn / SDK IPC / WebSocket]
      → 引擎输出事件 → Adapter 转换为 CoworkMessage
  → MessageStore.appendMessage() [SQLite]
  → IPC 回传 → Renderer Redux Store
  → React 重渲染
```

### 6.2 深度研究 → 知识库

```
用户发起研究 → ResearchEngine.research()
  → 多轮搜索（web/scholar/social）
  → 交叉验证 + 综合
  → ResearchIngestor.ingest(result)
    → KnowledgeStore.save() [SQLite + 可选向量化]
  → 结果展示在研究面板
```

### 6.3 热点 → 动作

```
TopicMonitor 持续爬取 → TopicClassifier 评分分类
  → 热点面板展示
  → 用户选择动作：
    → 发文：Agent 根据热点内容生成文章
    → 深度研究：触发 ResearchEngine
    → 推送：ImGatewayManager 投递到 IM
    → 存入知识库：KnowledgeStore.save()
```

### 6.4 Agent 编排

```
用户描述目标 → Orchestrator.plan()
  → LLM 生成 TaskGraph（DAG）
  → 可视化展示（前端 DAG 编辑器）
  → 用户确认/调整
  → Orchestrator.execute()
    → TaskScheduler 按拓扑排序调度
    → 并行执行无依赖的任务（各引擎 Adapter）
    → 任务完成 → 检查下游任务是否可执行
  → 全部完成 → Orchestrator.aggregate()
    → 汇总所有结果 → 生成最终交付物
```

### 6.5 前端开发站

```
用户选择模板 → DevServerManager.createProject()
  → 生成项目文件
  → DevServerManager.startServer()
    → spawn Vite/Next.js 子进程
    → 端口分配
  → Monaco Editor 编辑代码
  → Agent 辅助修改代码
  → 文件保存 → Vite HMR → iframe 预览实时更新
```

---

## 七、main.ts 拆分方案

当前 WeSight 的 main.ts 有 7730 行。目标：Agora 的 main.ts <1000 行。

### 7.1 拆分策略

```
src/main/main.ts (<1000行)
  ├── app 初始化
  │   ├── configureUserDataPath()
  │   ├── createWindow()
  │   ├── setupTray()
  │   └── registerGlobalShortcuts()
  │
  ├── 核心服务初始化
  │   ├── MessageStore.init()
  │   ├── EngineRouter.init()
  │   ├── ImGatewayManager.init()
  │   ├── SkillManager.init()
  │   ├── CronJobService.init()
  │   └── McpServerManager.init()
  │
  ├── IPC 注册（委托给 ipc/index.ts）
  │   └── registerAllIpcHandlers()
  │
  └── 生命周期管理
      ├── app.on('ready')
      ├── app.on('window-all-closed')
      └── app.on('before-quit')
```

### 7.2 IPC Handler 拆分

```
src/main/ipc/index.ts          — 统一注册入口
  ├── sessionHandlers.ts       — 会话 CRUD (start/continue/stop/delete/list/get)
  ├── engineHandlers.ts        — 引擎管理 (getStatus/install/configure)
  ├── imHandlers.ts            — IM 配置 (list/create/update/delete/test)
  ├── skillHandlers.ts         — 技能管理 (list/enable/disable/install/delete)
  ├── researchHandlers.ts      — 深度研究 (start/status/cancel/export)
  ├── orchestratorHandlers.ts  — Agent 编排 (plan/execute/cancel/getGraph)
  ├── knowledgeHandlers.ts     — 知识库 (search/add/delete/import/export)
  ├── hotTopicsHandlers.ts     — 热点 (getDigest/startResearch/pushToIM)
  ├── frontendStationHandlers.ts — 开发站 (createProject/start/stop/openInEditor)
  ├── mcpHandlers.ts           — MCP (list/create/update/delete)
  ├── permissionHandlers.ts    — 权限审批 (approve/deny)
  └── attachmentHandlers.ts    — 附件处理 (upload/download/preview)
```

---

## 八、IPC 通信设计

### 8.1 Preload 暴露的 API

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('agora', {
  // 平台信息
  platform: process.platform,
  arch: process.arch,

  // 会话管理
  session: {
    start: (opts) => ipcRenderer.invoke('session:start', opts),
    continue: (opts) => ipcRenderer.invoke('session:continue', opts),
    stop: (id) => ipcRenderer.invoke('session:stop', id),
    delete: (id) => ipcRenderer.invoke('session:delete', id),
    list: (agentId?) => ipcRenderer.invoke('session:list', agentId),
    get: (id) => ipcRenderer.invoke('session:get', id),
  },

  // 引擎管理
  engine: {
    getStatus: () => ipcRenderer.invoke('engine:getStatus'),
    install: (engine) => ipcRenderer.invoke('engine:install', engine),
    configure: (engine, config) => ipcRenderer.invoke('engine:configure', engine, config),
  },

  // IM 管理
  im: {
    listPlatforms: () => ipcRenderer.invoke('im:listPlatforms'),
    getInstances: () => ipcRenderer.invoke('im:getInstances'),
    createInstance: (data) => ipcRenderer.invoke('im:createInstance', data),
    testConnection: (id) => ipcRenderer.invoke('im:testConnection', id),
  },

  // 深度研究
  research: {
    start: (query) => ipcRenderer.invoke('research:start', query),
    cancel: (id) => ipcRenderer.invoke('research:cancel', id),
    getResult: (id) => ipcRenderer.invoke('research:getResult', id),
    onProgress: (cb) => ipcRenderer.on('research:progress', cb),
  },

  // Agent 编排
  orchestrator: {
    plan: (goal, context) => ipcRenderer.invoke('orchestrator:plan', goal, context),
    execute: (graphId) => ipcRenderer.invoke('orchestrator:execute', graphId),
    cancel: (graphId) => ipcRenderer.invoke('orchestrator:cancel', graphId),
    getStatus: (graphId) => ipcRenderer.invoke('orchestrator:getStatus', graphId),
  },

  // 知识库
  knowledge: {
    search: (query, opts) => ipcRenderer.invoke('knowledge:search', query, opts),
    add: (doc) => ipcRenderer.invoke('knowledge:add', doc),
    delete: (id) => ipcRenderer.invoke('knowledge:delete', id),
    import: (source) => ipcRenderer.invoke('knowledge:import', source),
  },

  // 热点
  hotTopics: {
    getDigest: () => ipcRenderer.invoke('hotTopics:getDigest'),
    startResearch: (topicId) => ipcRenderer.invoke('hotTopics:startResearch', topicId),
    pushToIM: (topicId, channels) => ipcRenderer.invoke('hotTopics:pushToIM', topicId, channels),
  },

  // 前端开发站
  frontendStation: {
    createProject: (opts) => ipcRenderer.invoke('frontendStation:createProject', opts),
    startServer: (projectId) => ipcRenderer.invoke('frontendStation:startServer', projectId),
    stopServer: (projectId) => ipcRenderer.invoke('frontendStation:stopServer', projectId),
    getProjects: () => ipcRenderer.invoke('frontendStation:getProjects'),
  },

  // 技能
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    install: (source) => ipcRenderer.invoke('skills:install', source),
    uninstall: (id) => ipcRenderer.invoke('skills:uninstall', id),
    toggle: (id, enabled) => ipcRenderer.invoke('skills:toggle', id, enabled),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // 通用存储
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
});
```

---

## 九、实施路线

### Phase 0：准备（1-2天）

- [ ] Fork WeSight 仓库到 SonicBotMan/agora
- [ ] 重命名项目（package.json, electron-builder.json, IDENTITY.md 等）
- [ ] 删除不需要的文件
  - 桌面宠物相关：`src/renderer/components/pet/`, `src/shared/pet/`
  - 引擎适配器：CodexApp, GrokBuild, QwenCode, YdCowork
  - IM 平台：网易云信 (nimGateway.ts, nimMedia.ts, nimQChatClient.ts), 网易蜜蜂, POPO
  - AgentTeamRunner（重写为 Orchestrator）
- [ ] 清理 SKILLs 目录中不需要的技能
- [ ] 更新 README

### Phase 1：核心骨架（3-5天）

- [ ] 拆分 main.ts → core/ + ipc/
- [ ] 实现 CoworkRuntime 接口
- [ ] 实现 EngineRouter（6 引擎）
- [ ] 精简 IM Gateway（7 平台）
- [ ] 重构 MessageStore（SQLite）
- [ ] 确保基础对话流程跑通（至少 1 个引擎 + 1 个 IM）
- [ ] 全量测试回归

### Phase 2：特色功能骨架（5-8天）

- [ ] 深度研究引擎（ResearchEngine + 多源搜索 + 交叉验证）
- [ ] Agent 编排器（Orchestrator + TaskGraph + TaskScheduler）
- [ ] 知识库基础（KnowledgeStore + FTS5 + DocumentProcessor）
- [ ] 热点监控基础（TopicMonitor + 2-3 个爬虫源）
- [ ] Skill 管理中心（SkillManager 优化）
- [ ] 前端开发站基础（DevServerManager + Monaco + xterm）
- [ ] 每个功能模块的 IPC handler

### Phase 3：前端 UI（5-8天）

- [ ] 6 个特色功能的 UI 面板
- [ ] 前端开发站的三栏布局（代码+终端+预览）
- [ ] Agent 编排的可视化 DAG 编辑器
- [ ] 热点面板（每日摘要+动作按钮）
- [ ] 知识库搜索界面
- [ ] 深度研究的进度展示
- [ ] 设置页面重构（按功能 tab 拆分，去掉过大的单文件）

### Phase 4：集成联调（3-5天）

- [ ] 深度研究 → 知识库 写入链路
- [ ] 热点 → 深度研究 / 发文 触发链路
- [ ] Agent 编排 → 各引擎调度链路
- [ ] 前端开发站 → Agent 代码修改 → HMR 预览链路
- [ ] 对话历史 → 知识库 自动沉淀
- [ ] 研究结果 → IM 投递链路

### Phase 5：打磨发布（2-3天）

- [ ] 性能优化（大消息、长时间会话）
- [ ] 错误处理和用户提示
- [ ] 文档更新
- [ ] CI 配置
- [ ] 首个 preview release

---

## 十、风险和决策点

### 10.1 技术风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| OpenClaw 适配器复杂度 | 高 | Phase 1 优先跑通，Phase 2 再优化 |
| 知识库向量化性能 | 中 | 先做 FTS5 关键词检索，向量化作为可选增强 |
| 前端开发站子进程管理 | 中 | 参考 VSCode 的 dev server 管理模式 |
| Monaco Editor 包体积 | 低 | 使用 @monaco-editor/react，按需加载 |
| Agent 编排的 LLM 幻觉 | 中 | TaskGraph 生成后需用户确认，支持手动编辑 |

### 10.2 待确认决策

| 决策 | 选项 | 建议 |
|---|---|---|
| 知识库向量化引擎 | Ollama 本地 / transformers.js / 外部 API | Ollama 本地（已有 GPU） |
| 热点爬取频率 | 每小时 / 每 30 分钟 | 每小时，避免被限流 |
| 前端开发站预览方式 | iframe / Webview / 内嵌浏览器 | iframe（最简单，HMR 透传） |
| 研究报告格式 | Markdown / HTML / PDF | Markdown（最通用，可导出其他格式） |

---

## 附录：WeSight → Agora 文件映射

| WeSight 文件 | Agora 位置 | 处理 |
|---|---|---|
| `src/main/main.ts` (7730行) | `src/main/main.ts` (<1000行) + `src/main/ipc/*.ts` | 拆分 |
| `src/main/libs/agentEngine/coworkEngineRouter.ts` | `src/core/EngineRouter.ts` | 精简 |
| `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` | `src/engines/openclaw/OpenClawAdapter.ts` | 精简 |
| `src/main/libs/coworkRunner.ts` | `src/engines/claude-code/ClaudeSdkRunner.ts` | 重构 |
| `src/main/libs/hermesRuntimeAdapter.ts` | `src/engines/hermes/HermesAdapter.ts` | 保留 |
| `src/main/libs/externalCliRuntimeAdapter.ts` | `src/engines/opencode/OpenCodeAdapter.ts` | 拆分 |
| `src/main/libs/deepSeekTuiRuntimeAdapter.ts` | `src/engines/deepseek-tui/DeepSeekTuiAdapter.ts` | 保留 |
| `src/main/libs/codexAppRuntimeAdapter.ts` | `src/engines/codex/CodexAdapter.ts` | 从 CodexApp 重建 |
| `src/main/im/imGatewayManager.ts` (3074行) | `src/im/ImGatewayManager.ts` + `src/im/platforms/` | 拆分 |
| `src/main/im/nimGateway.ts` | 删除 | 砍掉网易云信 |
| `src/main/skillManager.ts` | `src/features/skill-center/SkillManager.ts` | 优化 |
| `src/main/agentTeamRunner.ts` | `src/features/agent-orchestrator/Orchestrator.ts` | 重写 |
| `src/main/coworkStore.ts` | `src/core/MessageStore.ts` + `src/core/SessionManager.ts` | 重构 |
| `src/renderer/components/pet/` | 删除 | 砍掉宠物 |
| `src/renderer/components/Settings.tsx` (273KB) | `src/renderer/components/settings/*.tsx` | 拆分为多个文件 |
