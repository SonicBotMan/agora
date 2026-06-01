# Agora

<p align="center">
  <img src="public/readme-banner.svg" alt="Agora desktop AI agent workspace" width="900">
</p>

<h3 align="center">
  Desktop AI Agent Workspace
</h3>

<p align="center">
  <a href="https://github.com/SonicBotMan/agora/stargazers"><img src="https://img.shields.io/github/stars/SonicBotMan/agora?style=flat-square&color=1b79ff" alt="GitHub stars"></a>
  <a href="https://github.com/SonicBotMan/agora/network/members"><img src="https://img.shields.io/github/forks/SonicBotMan/agora?style=flat-square&color=14b8a6" alt="GitHub forks"></a>
  <a href="https://github.com/SonicBotMan/agora/releases/latest"><img src="https://img.shields.io/github/v/release/SonicBotMan/agora?style=flat-square&color=f59e0b" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/SonicBotMan/agora?style=flat-square&color=64748b" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-111827?style=flat-square" alt="Cross-platform">
</p>

<p align="center">
  <strong>English</strong> | <a href="README_zh.md">简体中文</a>
</p>

Agora is an open-source desktop workspace for AI coding agents. Built with Electron, React, and TypeScript, it provides a unified visual interface for installing, configuring, and running multiple local agent engines — including OpenCode (default), OpenClaw, Claude Code, Hermes, DeepSeek-TUI, and Codex. Agora connects these engines to chat, tools, files, IM platforms, model providers, and runtime analytics in a single desktop application.

> If Agora improves your agent workflow, give it a star — it helps more developers discover the project.

---

## Why Agora

Terminal-native coding agents are powerful, but their setup, model routing, permissions, IM entry points, file changes, and runtime metrics are scattered across separate contexts. Agora consolidates them into one cohesive desktop workspace:

- **Unified engine hub** — Install, detect, and switch between multiple local agent CLIs from a single UI.
- **Visual chat surface** — Run agents through a rich chat interface with tool panels, slash commands, file diffs, and permission prompts.
- **IM integration** — Route agent tasks through Feishu, DingTalk, Telegram, Discord, WeChat, WeCom, and QQ.
- **Runtime observability** — Track every task's engine, model, token usage, time-to-first-token (TTFT), tokens-per-second (TPS), tool latency, steps, status, and duration.
- **Extensible** — Extend workflows with SkillHub marketplace skills, built-in skills, scheduled tasks, and cross-session memory.

---

## Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Agent Engine Hub** | Run OpenCode (default), OpenClaw, Claude Code, Hermes, DeepSeek-TUI, or Codex — one-click install or reuse existing local CLI configs. |
| 2 | **Unified Model Providers** | Configure OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, Moonshot, Ollama, OpenRouter, GitHub Copilot, and custom OpenAI-compatible endpoints. |
| 3 | **IM Agent Hub** | Route messages from Feishu, DingTalk, Telegram, Discord, WeChat, WeCom, and QQ into any engine with per-platform bot profiles. |
| 4 | **AI Runtime Dashboard** | Measure calls by engine, model, source, status, tokens, completion time, TTFT, output-phase TPS, estimated model TPS, tool latency, and agent steps. |
| 5 | **SkillHub Marketplace** | Discover, install, enable, disable, update, and remove skills through an integrated marketplace. |
| 6 | **Scheduled Tasks & Memory** | Create recurring agent jobs for research, reports, monitoring, and reminders with automatic memory extraction across sessions. |

### Planned Features

| Feature | Description |
|---------|-------------|
| 🔬 **Deep Research** | Autonomous multi-source research agent with citation tracking and report generation. |
| 🧩 **Agent Orchestration** | Multi-agent coordination for complex workflows with task delegation and handoff. |
| 📚 **Knowledge Base** | Persistent vector store for documents, codebases, and project context. |
| 🔥 **Hot Topics** | Real-time trend discovery and auto-summarization from community sources. |
| ⚙️ **Skill Center** | Dedicated hub for creating, testing, and publishing custom agent skills. |
| 🖥️ **Frontend Station** | Visual component playground for AI-generated UI previews and iteration. |

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="public/readme/screenshots/cowork-chat.png" alt="Agora Cowork chat">
    </td>
    <td width="50%">
      <img src="public/readme/screenshots/agent-engines.png" alt="Agora agent engine settings">
    </td>
  </tr>
  <tr>
    <td><strong>Cowork Chat</strong><br>Run local coding agents as a desktop chat with engine and model controls.</td>
    <td><strong>Agent Engines</strong><br>Configure OpenCode, OpenClaw, Claude Code, Hermes, DeepSeek-TUI, and Codex.</td>
  </tr>
  <tr>
    <td width="50%">
      <img src="public/readme/screenshots/runtime-dashboard.png" alt="Agora runtime dashboard">
    </td>
    <td width="50%">
      <img src="public/readme/screenshots/live-workspace.png" alt="Agora live workspace">
    </td>
  </tr>
  <tr>
    <td><strong>AI Runtime Dashboard</strong><br>Inspect engine, model, tokens, TTFT, output-phase TPS, estimated model TPS, cost, and status.</td>
    <td><strong>Live Workspace</strong><br>Watch file writes, code changes, tool activity, and generated artifacts while the agent works.</td>
  </tr>
  <tr>
    <td width="50%">
      <img src="public/readme/screenshots/skills-marketplace.png" alt="Agora skills marketplace">
    </td>
    <td width="50%">
      <img src="public/readme/screenshots/studio-pet.png" alt="Agora studio">
    </td>
  </tr>
  <tr>
    <td><strong>Skills Marketplace</strong><br>Browse SkillHub categories, install skills locally, and manage installed skills from Agora.</td>
    <td><strong>Studio</strong><br>Visual workspace to observe agent activity and task progress.</td>
  </tr>
</table>

---

## Agent Engines

| Engine | Best For | Setup |
|--------|----------|-------|
| **OpenCode** | Default terminal agent workflow (default engine) | One-click install or existing CLI config reuse |
| **OpenClaw** | Local agent runtime with gateway and IM capabilities | One-click install or existing CLI config reuse |
| **Claude Code** | Claude Code workflows with a graphical chat surface | One-click install or existing CLI config reuse |
| **Hermes** | Nous Research Hermes agent runtime and gateway | One-click install or existing CLI config reuse |
| **DeepSeek-TUI** | DeepSeek HTTP/SSE runtime and tool streaming | One-click install or existing CLI config reuse |
| **Codex** | Codex CLI workflows, local task execution, and IM control | One-click install or existing CLI config reuse |

## IM Platforms

Agora routes agent tasks through IM platforms with per-engine bot profiles:

| Platform | Integration |
|----------|-------------|
| Feishu (Lark) | Native gateway |
| DingTalk | Native gateway |
| Telegram | Native gateway |
| Discord | Native gateway |
| WeCom (WeChat Work) | Native gateway |
| WeChat | Native gateway |
| QQ | Native gateway |

## Model Providers

Agora centralizes model configuration and maps it into the selected engine when the engine follows Agora settings.

- Add multiple providers and models.
- Use official OpenAI, Anthropic Claude, and Google Gemini providers.
- Add OpenAI-compatible providers for DeepSeek, Qwen, Moonshot, Ollama, OpenRouter, GitHub Copilot, local gateways, or private endpoints.
- Switch between Agora-managed model settings and existing local CLI configuration.
- Import or sync local engine configuration when you want Agora to manage it.

---

## Quick Start

### Prerequisites

- **Node.js** `>=24`
- **npm** (or `pnpm` / `yarn`)

### Development

```bash
git clone https://github.com/SonicBotMan/agora.git
cd agora
npm install
npm run electron:dev
```

The Vite dev server runs at `http://localhost:5175`.

### Development with Agent Runtimes

```bash
# Start Agora and detect supported local agent CLIs
npm run electron:dev

# Shorthand aliases for specific engine development
npm run electron:dev:openclaw
npm run electron:dev:hermes
```

Useful environment variables for OpenClaw development:

```bash
# Override OpenClaw source location
OPENCLAW_SRC=/path/to/openclaw npm run electron:dev:openclaw

# Force OpenClaw runtime rebuild
OPENCLAW_FORCE_BUILD=1 npm run electron:dev:openclaw

# Skip OpenClaw version checkout for local development
OPENCLAW_SKIP_ENSURE=1 npm run electron:dev:openclaw
```

### Build

```bash
# TypeScript + Vite
npm run build

# Electron main process
npm run compile:electron

# Lint
npm run lint
```

### Package for Distribution

```bash
# macOS
npm run dist:mac
npm run dist:mac:x64
npm run dist:mac:arm64
npm run dist:mac:universal

# Windows
npm run dist:win

# Linux
npm run dist:linux
```

Managed runtime metadata is declared in `package.json`. Generated runtime folders, build artifacts, local secrets, and packaged release output are gitignored.

---

## Project Structure

Agora uses Electron process isolation. The renderer never directly accesses Node.js APIs; privileged operations go through a typed preload bridge and IPC handlers in the main process.

```
src/
├── main/                        # Electron main process
│   ├── main.ts                  # Entry point, IPC handlers, window lifecycle
│   ├── preload.ts               # Safe renderer bridge via contextBridge
│   ├── sqliteStore.ts           # Local persistence (settings, sessions, etc.)
│   ├── coworkStore.ts           # Cowork session and message storage
│   ├── skillManager.ts          # Skill loading and management
│   ├── im/                      # IM gateway integrations
│   │   ├── feishu/              # Feishu (Lark) gateway
│   │   ├── dingtalk/            # DingTalk gateway
│   │   ├── telegram/            # Telegram gateway
│   │   ├── discord/             # Discord gateway
│   │   ├── wecom/               # WeCom gateway
│   │   ├── wechat/              # WeChat gateway
│   │   └── qq/                  # QQ gateway
│   └── libs/
│       ├── agentEngine/         # Engine adapters and router
│       │   ├── coworkEngineRouter.ts   # Routes to built-in or external engines
│       │   ├── claudeRuntimeAdapter.ts # Built-in Claude Agent SDK adapter
│       │   └── openclawRuntimeAdapter.ts # OpenClaw gateway adapter
│       ├── coworkRunner.ts      # Agent execution engine
│       ├── coworkMemoryExtractor.ts # Memory extraction from conversations
│       └── openclawEngineManager.ts  # OpenClaw runtime lifecycle
│
├── renderer/                    # React frontend (renderer process)
│   ├── App.tsx                  # App shell
│   ├── components/
│   │   ├── cowork/              # Chat, studio, activity workspace, engine UI
│   │   ├── Settings.tsx         # Model, engine, IM, skills, memory, and app settings
│   │   └── pet/                 # Desktop companion UI
│   ├── services/                # IPC wrappers and app services
│   └── store/slices/            # Redux state management
│
├── shared/                      # Shared constants and types
│
SKILLs/                          # Built-in skills
scripts/                         # Runtime, packaging, and setup scripts
```

### Built-in Skills

| Area | Examples |
|------|----------|
| Research | Web search, tech news, stock research, film/music search |
| Documents | DOCX, XLSX, PPTX, PDF processing |
| Automation | Playwright, local tools, scheduled tasks |
| Creative | Remotion video, frontend design, canvas design, image and video workflows |
| Communication | IMAP/SMTP email and IM channels |
| Agent building | Skill creator, skill vetting, custom planning |

Skills can be installed, enabled, disabled, deleted, and routed from the desktop UI.

---

## Security Model

- **Context isolation** is enabled in the renderer.
- **Node integration** is disabled in the renderer.
- Sensitive operations run through main-process IPC only.
- Tool execution surfaces permission requests before running.
- Local data is stored in SQLite under the app data directory.
- Runtime folders, build artifacts, generated assets, and local secrets are gitignored.

---

## Contributing

Contributions are welcome! Whether it's bug fixes, new features, documentation improvements, or community support — every contribution helps.

1. **Fork** the repository.
2. **Create a feature branch**: `git checkout -b feat/my-feature`.
3. **Commit your changes**: `git commit -m 'feat: add some feature'`.
4. **Push to the branch**: `git push origin feat/my-feature`.
5. **Open a Pull Request**.

Please ensure your code passes linting (`npm run lint`) and follows the existing code style.

### Development Guidelines

- Use conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).
- Keep the renderer free of Node.js direct dependencies — use IPC bridges.
- Add tests for new features when applicable (run with `npm run test:memory`).

---

## Acknowledgements

Agora is shaped by many excellent open-source projects and agent community practices:

- [OpenCode](https://github.com/opencode-ai/opencode) — pioneering open terminal agent workflows, serving as the default engine.
- [OpenClaw](https://github.com/openclaw/openclaw) — local agent runtime, gateway, and IM agent capabilities.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — local agent runtime, gateway, and model configuration ideas.
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/) — terminal-based agent workflow inspiration.
- [Codex](https://github.com/openai/codex) — CLI agent for local task execution.
- [DeepSeek-TUI](https://github.com/deepseek-ai/deepseek-tui) — terminal UI for DeepSeek models.
- [SkillHub](https://skillhub.lol/skills) — skill discovery, installation, and marketplace flows.
- The broader terminal-agent ecosystem and everyone pushing local AI agent workflows forward.

---

## License

MIT. See [LICENSE](LICENSE).
