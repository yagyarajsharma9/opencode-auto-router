# opencode-auto-router

> Advanced silent auto LLM routing plugin for OpenCode — free, open source, and works on every OS.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yagyarajsharma9/opencode-auto-router)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-1.0+-purple.svg)](https://github.com/anomalyco/opencode)
[![OS Support](https://img.shields.io/badge/os-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](README.md)

## What It Does

When you use open-source or free-tier AI models through OpenCode, they can hit rate limits, run out of quota, or degrade in quality without you noticing. **opencode-auto-router** silently detects this and automatically switches to a better model — so your workflow never breaks.

## Why You Need It

Imagine you're building a large project Claude Sonnet 4 hits its rate limit. Without this plugin, you'd see an error and have to switch models manually. With this plugin:

1. It detects the failure instantly
2. Finds the best available model
3. Retries the request silently
4. You never see an error

**You keep working without interruption.**

## Key Features

### 1. Quality Tier System — Large Projects Get the Best Model

Every free model is categorized into a tier:

| Tier | What It Means | Best For |
|---|---|---|
| **BEST** | Top reasoning, largest context | Large projects, complex code generation |
| **GREAT** | Strong performance | Daily development, code review |
| **GOOD** | Solid & reliable | Quick tasks, scripting |
| **BASIC** | Fast & lightweight | Simple completions, comments |

When you have a large project, the router automatically picks the **BEST** tier model first.

### 2. Capability-Based Fallback — Descending Order by Specs

If your preferred model is unavailable (rate-limited, expired free tier, etc.), the router falls back in this order:

```
1. Quality Tier    → BEST > GREAT > GOOD > BASIC
2. Context Window  → 200K > 128K > 32K (larger = better for big projects)
3. Parameters      → Higher parameters = more capable
4. Health Score    → Most reliable model wins
```

**Example:** Claude Sonnet 4 (BEST, 200K context) fails → falls back to Gemini 2.5 Pro (BEST, 1M context) → then to Claude Haiku (GREAT) → then to Llama 3.3 70B (GOOD).

### 3. Proactive Health Monitoring

The plugin continuously tracks each model's health based on:

| Factor | Weight | What It Measures |
|---|---|---|
| Success Rate | 35% | How often it responds successfully |
| Response Time | 20% | How fast it replies |
| Error Rate | 20% | How many errors it has |
| Consecutive Errors | 10% | Is it getting worse? |
| Freshness | 10% | Did it work recently? |
| Cooldown Penalty | 5% | Is it temporarily disabled? |

- **Healthy**: Score ≥ 70
- **Degraded**: Score 40–69  
- **Unhealthy**: Score < 40

### 4. Auto-Discovery

The plugin automatically discovers all free and paid models available across 75+ providers through Models.dev. No manual configuration needed.

### 5. Self-Healing Configuration

The plugin learns over time. If a model keeps failing, it automatically deprioritizes it and updates your fallback chain.

### 6. Persistent State

Health scores and model history survive OpenCode restarts (saved to `.opencode/auto-router-state.json`).

### 7. Silent Mode

Users never see error messages or model switches. Everything happens in the background.

### 8. Works on Every OS

Windows, Linux, macOS — the plugin works everywhere because OpenCode runs everywhere.

## Installation

### Prerequisites

- Node.js >= 20.0.0
- OpenCode >= 1.0.0
- A code editor or terminal with OpenCode installed

### Quick Start

1. **Install the plugin:**
```bash
npm install opencode-auto-router
```

2. **Add it to your OpenCode config** (`~/.config/opencode/opencode.json` or `opencode.json` in your project):
```json
{
  "plugin": ["opencode-auto-router"]
}
```

3. **Start using OpenCode as normal.** The router works silently in the background.

### Manual Configuration (Recommended)

For best results, configure a custom fallback chain:
```json
{
  "plugin": ["opencode-auto-router"],
  "autoRouter": {
    "fallbackChain": [
      { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4" },
      { "provider": "google", "model": "gemini-2.5-pro", "label": "Gemini 2.5 Pro" },
      { "provider": "google", "model": "gemini-2.5-flash", "label": "Gemini 2.5 Flash" },
      { "provider": "anthropic", "model": "claude-3-5-haiku-20241022", "label": "Claude Haiku" },
      { "provider": "groq", "model": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B" },
      { "provider": "deepseek", "model": "deepseek-v3", "label": "DeepSeek V3" }
    ],
    "maxRetriesPerSession": 3,
    "cooldownMs": 5000,
    "silenceMode": true,
    "trackUsage": true,
    "autoHeal": true,
    "minHealthScore": 50
  }
}
```

## How It Works — Step by Step

### Scenario: You ask a coding question

```
You: "Write a REST API for user authentication"
    |
    v
OpenCode sends request to Claude Sonnet 4 (BEST tier)
    |
    v
Claude Sonnet 4 responds successfully (health: 92%)
    |
    v
Plugin records: success, response time 1200ms
    |
    v
You get your response — no interruption
```

### Scenario: Claude Sonnet 4 hits rate limit

```
You: "Refactor this function"
    |
    v
OpenCode sends request to Claude Sonnet 4 (BEST tier)
    |
    v
429 Rate Limit Error!
    |
    v
Plugin detects error, marks Claude Sonnet 4 as failed
    |
    v
Plugin checks: "What's the next BEST model?"
    |
    v
Gemini 2.5 Pro (BEST tier, 1M context) → health: 88%
    |
    v
Retries with Gemini 2.5 Pro
    |
    v
Gemini 2.5 Pro responds successfully
    |
    v
Plugin records: success, updated fallback chain
    |
    v
You get your response — never saw the error
```

### Scenario: All BEST models are exhausted

```
1. Claude Sonnet 4     → RATE LIMITED
2. Gemini 2.5 Pro      → RATE LIMITED  
3. Claude Haiku (GREAT) → available! (health: 75%)
    |
    v
Plugin routes to Claude Haiku automatically
Plugin logs the switch for your review
You keep working
```

## Free Model Catalog

### Tier 1: BEST (Large Projects)

| Model | Provider | Context | Free Tier | Notes |
|---|---|---|---|---|
| Claude Sonnet 4 | Anthropic (Zen) | 200K | Yes (via Zen) | Best reasoning for code |
| Gemini 2.5 Pro | Google | 1M | Yes | Largest context window |

### Tier 2: GREAT (Daily Development)

| Model | Provider | Context | Free Tier | Notes |
|---|---|---|---|---|
| Claude Haiku | Anthropic (Zen) | 200K | Yes (via Zen) | Fast and reliable |
| Gemini 2.5 Flash | Google | 1M | Yes | Great balance of speed & quality |
| Gemma | Google | 8K | Yes | Lightweight and fast |

### Tier 3: GOOD (General Tasks)

| Model | Provider | Context | Free Tier | Notes |
|---|---|---|---|---|
| Llama 3.3 70B | Groq | 128K | Yes (30 req/min) | Powerful open model |
| DeepSeek V3 | DeepSeek | 128K | Yes | Excellent coding ability |
| Mixtral 8x7B | Groq | 32K | Yes (30 req/min) | Good for structured tasks |

### Tier 4: BASIC (Quick Tasks)

| Model | Provider | Context | Free Tier | Notes |
|---|---|---|---|---|
| Qwen Coder | Alibaba | Varies | Yes | Fast code completions |
| DeepSeek Chat | DeepSeek | 8K | Yes | Simple Q&A |

## Built-in Tools

### `/autoRouter` — Health Dashboard

Check real-time health scores for all tracked models:
```
!autoRouter
```
Output:
```
# Auto Router Health Report
- `anthropic/claude-sonnet-4-20250514`: tier=BEST  health=85%  latency=1200ms
- `google/gemini-2.5-pro`:              tier=BEST  health=91%  latency=980ms
- `anthropic/claude-3-5-haiku-20241022`: tier=GREAT health=95%  latency=450ms
- `groq/llama-3.3-70b-versatile`:       tier=GOOD  health=88%  latency=320ms
```

### `/routerStatus` — Router Status

Check the router's current configuration and free model suggestions:
```
!routerStatus
```

## Configuration Reference

### Full Configuration Schema

```json
{
  "autoRouter": {
    "fallbackChain": [
      {
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "label": "Claude Sonnet 4",
        "isFree": true,
        "capability": {
          "contextWindow": 200000,
          "qualityTier": "best",
          "supportsVision": true,
          "supportsTools": true
        }
      }
    ],
    "maxRetriesPerSession": 3,
    "cooldownMs": 5000,
    "silenceMode": true,
    "trackUsage": true,
    "healthCheckIntervalMs": 30000,
    "autoHeal": true,
    "minHealthScore": 50
  }
}
```

### All Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fallbackChain` | `ModelEntry[]` | Built-in | Ordered model list with optional capabilities |
| `maxRetriesPerSession` | `number` | `3` | Max retry attempts before showing error |
| `cooldownMs` | `number` | `5000` | Delay between retry attempts (milliseconds) |
| `silenceMode` | `boolean` | `true` | Suppress user notifications during failover |
| `trackUsage` | `boolean` | `true` | Enable per-model usage statistics |
| `healthCheckIntervalMs` | `number` | `30000` | How often to check model health (ms) |
| `autoHeal` | `boolean` | `true` | Auto-update fallback chain based on performance |
| `minHealthScore` | `number` | `50` | Minimum health score for proactive switching |

### Model Entry Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `string` | Yes | OpenCode provider name |
| `model` | `string` | Yes | Model identifier |
| `label` | `string` | No | Human-readable display name |
| `isFree` | `boolean` | No | Whether this is a free-tier model |
| `capability` | `ModelCapability` | No | Context window, tier, features |

## Development

### Prerequisites

```bash
node -v   # >= 20.0.0
npm -v    # >= 10.0.0
```

### Setup

```bash
git clone https://github.com/yagyarajsharma9/opencode-auto-router.git
cd opencode-auto-router
npm install
```

### Available Scripts

```bash
npm run build      # TypeScript compilation (dist/)
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint (if configured)
npm test           # Run tests (if added later)
```

### Project Structure

```
opencode-auto-router/
├── VERSION                       # Current version number
├── README.md                     # This file — full guidance
├── CONTRIBUTING.md               # How to contribute
├── LICENSE                       # MIT License
├── CHANGELOG.md                  # Version history
├── AGENTS.md                     # Agent reference for the plugin
├── docs/
│   └── overview.md               # Architecture overview
├── example-config/
│   └── opencode.json             # Example configuration
├── src/
│   ├── index.ts                  # Main plugin entry point
│   ├── types.ts                  # All TypeScript type definitions
│   ├── health/
│   │   └── scorer.ts            # Health scoring engine
│   ├── discovery/
│   │   └── auto-discover.ts     # Auto-discovery module
│   ├── router/
│   │   └── intelligent-router.ts# Tier-based routing engine
│   └── state/
│       └── store.ts             # Persistent state management
├── dist/                         # Compiled output
├── package.json                  # Package configuration
├── tsconfig.json                 # TypeScript configuration
└── .gitignore                    # Git ignore rules
```

## Open Source — Contributing

This project is **100% free and open source** under the MIT License. Everyone can use, modify, and distribute it.

### How to Contribute

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix
4. **Make your changes** with clear commits
5. **Test** that everything still builds cleanly
6. **Submit a Pull Request** with a clear description

### Reporting Issues

- Use GitHub Issues to report bugs, request features, or ask questions
- Include your OpenCode version, OS, and config when reporting bugs

### Community Guidelines

- Be respectful and constructive
- Follow the existing code style
- Add tests for new features
- Update documentation when you add features

## License

[MIT](LICENSE) — Free to use, modify, and distribute. No restrictions.

## Credits

Built for the OpenCode community to make AI coding better for everyone — regardless of which model you can access.

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-28 | Initial release with quality tiers, health monitoring, auto-discovery, capability-based fallback, self-healing config |

## Support

- **GitHub Issues**: [https://github.com/yagyarajsharma9/opencode-auto-router/issues](https://github.com/yagyarajsharma9/opencode-auto-router/issues)
- **OpenCode Docs**: [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

---

**Made with ❤️ for the open-source AI community**