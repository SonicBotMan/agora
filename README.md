# Agora

<p align="center">
  <img src="public/readme-banner.svg" alt="Agora desktop AI agent workspace" width="900">
</p>

<h3 align="center">
  Desktop AI Agent Workspace for Local Coding Agents
</h3>

<p align="center">
  <a href="https://github.com/freestylefly/agora/stargazers"><img src="https://img.shields.io/github/stars/freestylefly/agora?style=flat-square&color=1b79ff" alt="GitHub stars"></a>
  <a href="https://github.com/freestylefly/agora/network/members"><img src="https://img.shields.io/github/forks/freestylefly/agora?style=flat-square&color=14b8a6" alt="GitHub forks"></a>
  <a href="https://github.com/freestylefly/agora/releases/latest"><img src="https://img.shields.io/github/v/release/freestylefly/agora?style=flat-square&color=f59e0b" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/freestylefly/agora?style=flat-square&color=64748b" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-111827?style=flat-square&logo=apple&logoColor=white" alt="macOS Apple Silicon">
</p>

<p align="center">
  <strong>English</strong> | <a href="README_zh.md">简体中文</a>
</p>

Agora is an open-source desktop control console for local AI agents. It helps you install or reuse OpenCode (default), Claude Code, Codex, Qwen Code, DeepSeek-TUI, and the built-in agent runtime, then gives them a visual workspace for chat, tools, files, IM channels, skills, model providers, runtime metrics, and desktop companion workflows.

> Early public releases ship macOS Apple Silicon first. If Agora helps your agent workflow, a Star makes the project easier for more builders to discover.

## Quick Links

- Website: [agora.app](https://agora.app/)
- Latest release: [github.com/freestylefly/agora/releases/latest](https://github.com/freestylefly/agora/releases/latest)
- Screenshots: [Screenshots](#screenshots)
- Core features: [Core Features](#core-features)
- Agent engines: [Agent Engines](#agent-engines)
- Development: [Quick Start](#quick-start)

## Why Agora

Terminal-native coding agents are powerful, while their setup, model routing, permissions, IM entry points, file changes, and runtime metrics often live in separate places. Agora turns those moving pieces into one desktop workspace:

- Install, detect, and reuse local agent CLIs from a beginner-friendly UI.
- Run coding agents through a visual chat with tool panels, slash commands, file diffs, and permission prompts.
- Connect agent tasks to 7 IM platforms: Feishu, DingTalk, Telegram, Discord, WeChat Work, NetEase IM, and WeChat Official Account.
- Track every task with engine, model, token usage, TTFT, TPS, tool latency, steps, status, and duration.
- Extend workflows through SkillHub skills, built-in skills, scheduled tasks, memory, and a desktop pet that follows active work.

## Features

1. **Agent Engine Hub** — Run OpenCode (default), Claude Code, Codex, Qwen Code, DeepSeek-TUI, or the built-in runtime from the same workspace, with one-click setup or existing local CLI config reuse.
2. **Unified Model Providers** — Configure OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, Moonshot, Ollama, OpenRouter, GitHub Copilot, and custom OpenAI-compatible endpoints.
3. **IM Agent Hub** — Route messages from Feishu, DingTalk, Telegram, Discord, WeChat Work, NetEase IM, and WeChat Official Account into any engine with per-platform bot profiles.
4. **AI Runtime Dashboard** — Measure calls by engine, model, source, status, tokens, completion time, TTFT, output-phase TPS, estimated model TPS, tool latency, and agent steps.
5. **SkillHub Marketplace** — Discover, categorize, install, enable, disable, update, and remove local skills through an integrated marketplace.
6. **Scheduled Tasks & Memory** — Create recurring agent jobs for research, reports, monitoring, and reminders, with automatic memory extraction and personalization across sessions.

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
    <td><strong>Agent Engines</strong><br>Configure OpenCode, Claude Code, Codex, Qwen Code, DeepSeek-TUI, and the built-in runtime.</td>
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
      <img src="public/readme/screenshots/studio-pet.png" alt="Agora studio and desktop companion">
    </td>
  </tr>
  <tr>
    <td><strong>Skills Marketplace</strong><br>Browse SkillHub categories, install skills locally, and manage installed skills from Agora.</td>
    <td><strong>Studio & Pet</strong><br>Use a visual office-style workspace and desktop companion to follow active agent tasks.</td>
  </tr>
</table>

## Agent Engines

| Engine           | Best For                                                    | Setup Path                                      |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| OpenCode         | Default terminal agent workflow                             | One-click install or existing local CLI config  |
| Claude Code      | Claude Code workflows with a graphical chat surface         | One-click install or existing local CLI config  |
| Codex            | Codex CLI workflows, local task execution, and IM control   | One-click install or existing local CLI config  |
| Qwen Code        | Qwen-friendly coding workflows and DashScope setups         | One-click install or existing local CLI config  |
| DeepSeek-TUI     | DeepSeek-TUI HTTP/SSE runtime and tool streaming            | One-click install or existing local CLI config  |
| Built-in runtime | General desktop cowork sessions and skills                  | Included in Agora                               |

## IM Platforms

Agora routes agent tasks through 7 IM platforms with per-engine bot profiles:

| Platform          | Integration Type |
| ----------------- | ---------------- |
| Feishu            | Native gateway   |
| DingTalk          | Native gateway   |
| Telegram          | Native gateway   |
| Discord           | Native gateway   |
| WeChat Work       | Native gateway   |
| NetEase IM (NIM)  | Native gateway   |
| WeChat OA         | Webhook          |

## Model Providers

Agora keeps model setup in one place, then maps it into the selected engine when that engine follows Agora settings.

- Add multiple providers and models.
- Use official OpenAI, Anthropic Claude, and Google Gemini providers.
- Add OpenAI-compatible providers for DeepSeek, Qwen, Moonshot, Ollama, OpenRouter, GitHub Copilot, local gateways, or private endpoints.
- Switch between Agora-managed model settings and existing local CLI configuration.
- Import or sync local engine configuration when you want Agora to manage it.

## Download

Public desktop builds are published through GitHub Releases:

- Website: [agora.app](https://agora.app/)
- Latest release: [github.com/freestylefly/agora/releases/latest](https://github.com/freestylefly/agora/releases/latest)

Early public releases currently ship macOS Apple Silicon builds first. Release assets are intended for end users. CI artifacts are short-lived build outputs for maintainers to test before a release is published.

## Download And Install

### 1. Download the DMG

Download `Agora-*-arm64.dmg` from the [latest release](https://github.com/freestylefly/agora/releases/latest), open it, and drag `Agora.app` into the `Applications` folder.

<p align="center">
  <img src="public/readme/tutorial/install-dmg.svg" alt="Agora DMG install guide" width="760">
</p>

### 2. If macOS says the app is damaged

Preview builds are not signed and notarized yet. macOS may show a message like:

> "Agora.app" is damaged and cannot be opened. You should move it to the Trash.

This is usually a Gatekeeper quarantine warning for an unsigned app. It does not mean the downloaded package is corrupted. Click Cancel first.

<p align="center">
  <img src="public/readme/tutorial/macos-damaged-warning.svg" alt="macOS unsigned app warning" width="620">
</p>

### 3. Remove the quarantine attribute

Open the built-in macOS Terminal app and run:

```bash
xattr -cr /Applications/Agora.app
```

<p align="center">
  <img src="public/readme/tutorial/xattr-terminal.svg" alt="Run xattr in Terminal" width="760">
</p>

After the command finishes, open Agora again. If you installed Agora somewhere else, replace `/Applications/Agora.app` with the actual path to your `Agora.app`.

## Quick Start

### Requirements

- Node.js `>=24 <25`
- npm

### Development

```bash
git clone https://github.com/freestylefly/agora.git
cd agora
npm install
npm run electron:dev
```

The Vite dev server runs at `http://localhost:5175`.

### Development With Agent Runtimes

```bash
# Start Agora and detect supported local agent CLIs from Settings
npm run electron:dev

# Convenience aliases currently point to the same development entry
npm run electron:dev:openclaw
npm run electron:dev:hermes
```

Useful OpenClaw development variables:

```bash
# Override OpenClaw source location
OPENCLAW_SRC=/path/to/openclaw npm run electron:dev:openclaw

# Force OpenClaw runtime rebuild
OPENCLAW_FORCE_BUILD=1 npm run electron:dev:openclaw

# Skip OpenClaw version checkout for local OpenClaw development
OPENCLAW_SKIP_ENSURE=1 npm run electron:dev:openclaw
```

## Build

```bash
# TypeScript + Vite
npm run build

# Electron main process
npm run compile:electron

# ESLint
npm run lint
```

## Packaging

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

Managed runtime metadata is declared in `package.json`. Generated runtime folders, build artifacts, local secrets, and packaged release output are ignored by Git.

## Architecture

Agora uses Electron process isolation. The renderer never directly accesses Node.js APIs; privileged operations go through a typed preload bridge and IPC handlers in the main process.

<p align="center">
  <img src="public/readme-architecture.svg" alt="Agora architecture principle diagram" width="960">
</p>

### Main Process

- Window lifecycle, tray behavior, desktop pet windows, and deep links
- SQLite persistence for settings, sessions, messages, runtime calls, skills, and auth tokens
- Agent engine routing and external CLI adapters
- OpenClaw and Hermes gateway lifecycle helpers
- IM gateway integrations and native Feishu routing
- Skill management, scheduled tasks, file activity tracking, and runtime telemetry

### Renderer

- React + Redux Toolkit + Tailwind CSS
- Cowork chat UI, studio view, live workspace, runtime dashboard, and artifacts
- Engine selector, model selector, settings, skills, MCP, agents, IM, memory, and appearance UI
- Stream rendering for messages, tool calls, command output, slash command panels, files, images, and permission prompts

### Key Directories

```text
src/main/
  main.ts                         Electron entry and IPC handlers
  preload.ts                      Safe renderer bridge
  sqliteStore.ts                  Local persistence
  coworkStore.ts                  Session and message storage
  libs/agentEngine/               Engine adapters and router
  libs/externalAgent*.ts          External CLI setup and config helpers
  im/                             IM gateway integrations

src/renderer/
  App.tsx                         App shell
  components/cowork/              Chat, studio, activity workspace, engine UI
  components/Settings.tsx         Model, engine, IM, skills, memory, and app settings
  components/pet/                 Desktop companion UI
  services/                       IPC wrappers and app services
  store/slices/                   Redux state

SKILLs/                           Built-in skills
scripts/                          Runtime, packaging, and setup scripts
src/shared/                       Shared constants and types
```

## Built-in Skills

Agora includes a broad skills library for day-to-day agent work and connects to SkillHub for marketplace installation.

| Area           | Examples                                                                  |
| -------------- | ------------------------------------------------------------------------- |
| Research       | web search, tech news, stock research, film/music search                  |
| Documents      | DOCX, XLSX, PPTX, PDF processing                                          |
| Automation     | Playwright, local tools, scheduled tasks                                  |
| Creative       | Remotion video, frontend design, canvas design, image and video workflows |
| Communication  | IMAP/SMTP email and IM channels                                           |
| Agent building | skill creator, skill vetting, custom planning                             |

Skills can be installed, enabled, disabled, deleted, and routed from the desktop UI.

## Security Model

- Context isolation is enabled.
- Node integration is disabled in the renderer.
- Sensitive operations run through main-process IPC.
- Tool execution can surface permission requests before running.
- Local data is stored in SQLite under the app data directory.
- Runtime folders, build artifacts, generated assets, and local secrets are ignored by Git.

## Roadmap Ideas

- More engine adapters and runtime profiles
- Better local configuration import and provider sync flows
- Richer IM agent profiles and message formats
- Shareable task templates
- More visual inspection tools for long-running agent tasks
- Skill marketplace updates, reviews, and version management

## Community WeChat Group

Scan the QR code below to join the Agora WeChat group and talk with other builders. The QR code is valid until June 8, 2026; if it expires, follow the official account below to get the latest invite.

<p align="center">
  <img src="public/readme/community/wechat-group.jpg" alt="Agora WeChat Group" width="320">
</p>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=freestylefly/agora&type=Date)](https://star-history.com/#freestylefly/agora&Date)

## WeChat Official Account

Search **苍何** on WeChat or scan the QR code below to follow Canghe's original WeChat official account. Reply with **AI** to get more AI prompt and agent workflow resources.

<p align="center">
  <img src="public/wechat-official-account.png" alt="Canghe WeChat Official Account" width="280">
</p>

## Acknowledgements

Agora is shaped by many excellent open-source projects and agent community practices. Special thanks to:

- [OpenCode](https://github.com/opencode-ai/opencode) for pioneering open terminal agent workflows and serving as the default engine.
- [OpenClaw](https://github.com/openclaw/openclaw) for exploring local agent runtimes, gateways, and IM agent capabilities.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) for local agent runtime, gateway, and model configuration ideas.
- [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) for the pixel-style AI studio inspiration.
- [SkillHub](https://skillhub.lol/skills) for ideas around skill discovery, installation, and marketplace flows.
- The terminal-agent ecosystem around Claude Code, Codex, OpenCode, Qwen Code, DeepSeek-TUI, and the builders pushing local AI agent workflows forward.

## License

MIT. See [LICENSE](LICENSE).
